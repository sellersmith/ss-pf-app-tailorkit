import { BlockStack, Button, Tooltip } from '@shopify/polaris'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccordionList } from '~/components/Accordion'
import { MAX_LABEL_ON_STOREFRONT, MAX_OPTION_SET_NAME_SIZE } from '~/constants/canvas'
import { TOAST } from '~/constants/toasts'
import { useStore } from '~/libs/external-store'
import TextFieldValidation from '~/modules/TemplateEditor/common/text-field-validation'
import { FILE_UPLOAD_EVENTS, MUTATION_LAYER_FROM_INSPECTOR_EVENTS } from '~/modules/TemplateEditor/constants'
import { getDefaultStorefrontLabel } from '~/modules/TemplateEditor/elements/fns'
import { preCompositeThumbnail } from '~/shared/utils/thumbnail-pre-compositor'
import { ProgressStore } from '~/stores/canvas/progress'
import { markLayerStoreAsDeleted, type TLayerStore } from '~/stores/modules/layer'
import { LayerStoreSelection, useLayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { TemplateEditorStore } from '~/stores/modules/template'
import { optionSetDataKeys, ELayerType, EOptionSet, type IMAGE_OPTION_SET } from '~/types/psd'
import { dataURLtoFile } from '~/utils/file-types'
import { showToast } from '~/utils/toastEvents'
import { uuid } from '~/utils/uuid'

export const BulkImageOptionSetCreator = () => {
  const { t } = useTranslation()
  const { checkedLayerStores } = useLayerStoreSelection()

  // Filter only image layers
  const imageLayerStores: TLayerStore[] = useMemo(
    () => checkedLayerStores.filter((ls: TLayerStore) => ls.getState().type === ELayerType.IMAGE),
    [checkedLayerStores]
  )

  const [storefrontLabel, setStorefrontLabel] = useState(
    getDefaultStorefrontLabel({ t, type: EOptionSet.IMAGE_OPTION })
  )
  const [systemName, setSystemName] = useState(t('select-an-image'))
  const [loading, setLoading] = useState(false)
  const processingBackgroundUploader = useStore(ProgressStore, state => state.index !== state.total)

  const disableCreate
    = !storefrontLabel.trim() || !systemName.trim() || imageLayerStores.length < 2 || processingBackgroundUploader

  const handleCreate = useCallback(async () => {
    if (disableCreate) return
    setLoading(true)

    try {
      // Use the first selected layer as base
      const baseLayerStore = imageLayerStores[0]
      const baseLayerState = baseLayerStore.getState()

      // Build files array from selected images
      const files = await Promise.all(
        imageLayerStores.map(async ls => {
          const layer = ls.getState()
          const { image, width, height, settings } = layer
          const imageSrc = typeof image === 'string' ? image : image?.src || ''
          const fileId = uuid()
          const fileEntry: Record<string, any> = {
            _id: fileId,
            name: layer.label || layer.legacyName || 'Image',
            src: imageSrc,
            width: width || 0,
            height: height || 0,
            selecting: false,
          }
          // Preserve overlay data if present (SVG overlay from VectorEditor)
          if (settings?.overlay) {
            fileEntry.overlay = settings.overlay
          }
          // Preserve existing composited thumbnail URL if present
          if ((settings as any)?.compositedThumbnailSrc) {
            fileEntry.compositedThumbnailSrc = (settings as any).compositedThumbnailSrc
          }
          return fileEntry
        })
      )

      const optionSetId = uuid()
      const key = optionSetDataKeys[EOptionSet.IMAGE_OPTION]
      const optionSet: IMAGE_OPTION_SET = {
        _id: optionSetId,
        type: EOptionSet.IMAGE_OPTION,
        label: systemName.trim(),
        labelOnStoreFront: storefrontLabel.trim(),
        data: {
          [key]: files,
        } as any,
      }

      // Attach option set to base layer
      baseLayerStore.dispatch({
        type: 'UPDATE_OPTION_SET',
        payload: { optionSet },
      })

      // Enable "Your Options" tab on the base layer
      // Set enableSellerImage=true and enableBuyerImage=false to ensure the "Your Image" tab
      // is selected in the inspector after option set creation (mutually exclusive behavior)
      // Also sync imageUploaderOptions.allowCustomerUseImageOptionSet for API consistency
      const currentImageUploaderOptions = (baseLayerState.settings as any)?.imageUploaderOptions || {}

      baseLayerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: {
              ...baseLayerState.settings,
              enableSellerImage: true,
              enableBuyerImage: false,
              imageUploaderOptions: {
                ...currentImageUploaderOptions,
                allowCustomerUseImageOptionSet: true,
              },
            },
          },
        },
      })

      // Remove other selected layers (except base) from outline by marking them as deleted
      const otherLayerStores = imageLayerStores.slice(1)
      const otherLayerIds = otherLayerStores.map(ls => ls.getState()._id)

      otherLayerStores.forEach(ls => {
        // Mark as deleted on editor so that Outline and save flow ignore them
        markLayerStoreAsDeleted(ls.getState()._id, true)
      })

      // Broadcast event to clear validation errors related to the removed layers
      Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.CLEAR_VALIDATION_ERRORS, {
        layerIds: [...otherLayerIds, baseLayerState._id],
      })

      // Update extractedLayerStores in TemplateEditorStore to exclude deleted layers
      const currentExtracted = TemplateEditorStore.getState().extractedLayerStores as TLayerStore[]

      TemplateEditorStore.dispatch({
        type: 'SET_EXTRACTED_LAYER_IDS',
        payload: {
          extractedLayerStores: currentExtracted.filter(ls => !otherLayerIds.includes(ls.getState()._id)),
        },
      })

      // Notify other parts of editor
      Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.TEMPLATE_ELEMENT_DATA_CHANGED, {
        id: baseLayerState._id,
        elementData: baseLayerState,
      })

      // Automatically switch the inspector to "Add new option set" edit mode
      baseLayerStore.dispatch({
        type: 'UPDATE_OPTION_SET_EDITING_STATE',
        payload: {
          optionSetType: EOptionSet.IMAGE_OPTION,
          editingState: {
            newOptionSetPressed: true,
            existOptionSetPressed: false,
            editMode: true,
          },
        },
      })

      // Update selection – focus inspector on the base layer and clear multi-selection
      LayerStoreSelection.dispatch({
        type: 'SET_LAYER_STORE_SELECTION',
        payload: {
          clickedLayerStore: baseLayerStore,
          checkedLayerStores: [],
        },
      })

      showToast(t(TOAST.TEMPLATE_EDITOR.OPTION_SET_CREATED))

      // Generate and trigger composited thumbnail uploads for images with overlays (fire and forget)
      // Skip files that already have a compositedThumbnailSrc (already uploaded)
      files.forEach(async fileEntry => {
        if (fileEntry.overlay && !fileEntry.compositedThumbnailSrc) {
          try {
            const compositedResult = await preCompositeThumbnail({
              imageUrl: fileEntry.src,
              overlay: fileEntry.overlay,
              thumbnailWidth: 120,
            })
            if (compositedResult) {
              const file = dataURLtoFile(compositedResult.dataUrl, `composited-${fileEntry._id}.png`)
              Transmitter.trigger(FILE_UPLOAD_EVENTS.SELECT, {
                files: [{ _id: baseLayerStore.getState()._id, file }],
                fileUploadType: 'composited-thumbnail',
                compositedThumbnailMeta: { optionId: fileEntry._id },
              })
            }
          } catch (error) {
            console.warn('Failed to generate composited thumbnail during bulk conversion:', error)
          }
        }
      })
    } catch (e) {
      console.error('Bulk image option set creation failed', e)
      showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
    } finally {
      setLoading(false)
    }
  }, [disableCreate, imageLayerStores, storefrontLabel, systemName, t])

  const ButtonWrapper = ({ children }: { children: React.ReactNode }) =>
    processingBackgroundUploader ? <Tooltip content={t('waiting-for-images-to-upload')}>{children}</Tooltip> : children

  if (imageLayerStores.length < 2) return null

  return (
    <AccordionList
      items={[
        {
          open: true,
          id: 'image-option-set-library',
          label: t('create-image-option-set'),
          content: (
            <BlockStack gap={'200'}>
              <TextFieldValidation
                maxLength={MAX_LABEL_ON_STOREFRONT}
                autoComplete="off"
                showCharacterCount
                value={storefrontLabel}
                requiredIndicator
                label={t('set-label-to-show-on-storefront')}
                placeholder={t('input-your-label')}
                enableAIContentGenerator={true}
                onChange={value => setStorefrontLabel(value)}
              />

              <TextFieldValidation
                maxLength={MAX_OPTION_SET_NAME_SIZE}
                autoComplete="off"
                showCharacterCount
                value={systemName}
                requiredIndicator
                label={t('set-name-for-system-management')}
                placeholder={t('input-your-label')}
                enableAIContentGenerator={true}
                onChange={value => setSystemName(value)}
              />
              <ButtonWrapper>
                <Button fullWidth disabled={disableCreate} loading={loading} onClick={handleCreate}>
                  {t('create-option-set')}
                </Button>
              </ButtonWrapper>
            </BlockStack>
          ),
        },
      ]}
    />
  )
}

export default BulkImageOptionSetCreator
