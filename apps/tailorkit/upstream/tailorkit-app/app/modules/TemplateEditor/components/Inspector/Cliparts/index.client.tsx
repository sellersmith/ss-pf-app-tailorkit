import { BlockStack, Button, Icon, InlineStack, Tooltip, Text } from '@shopify/polaris'
import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import { AccordionList } from '~/components/Accordion'
import TextFieldComponent from '~/components/common/TextFieldComponent'
import { CLIPART_CANVAS_EDITOR_LAYER, MAX_CLIPART_NAME_SIZE } from './constants'
import { useSaveTemplate } from '~/modules/TemplateEditor/hooks/useSaveTemplate'
import { useLayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { createLayerStore, getLayerStoreById, type TLayerStore } from '~/stores/modules/layer'
import { uuid } from '~/utils/uuid'
import { TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import { type LayerDocument } from '~/models/Layer.server'
import {
  DEFAULT_TEMPLATE_DIMENSION,
  DEFAULT_TEMPLATE_EDITOR_STORE,
  TemplateEditorStore,
} from '~/stores/modules/template'
import { useStore } from '~/libs/external-store'
import { blobToBase64 } from '~/utils/file-types'
import { showGenericErrorToast, showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { restoreClonedCache } from '~/utils/konva-cache'
import { ClipartCanvas } from './ClipartCanvas.client'
import type Konva from 'konva'
// import { useAppHandle } from '~/utils/hooks/useAppHandle'
// import { getMyShopifySubdomainName } from '~/shopify/fns'
import { ProgressStore } from '~/stores/canvas/progress'
import { duplicateLayers, getTemplateElementsIncludingMultiLayout } from '~/modules/TemplateEditor/fns'
import type { IBoundingBoxClipartCanvas } from './fns'
import { calculateBoundingBox } from './fns'
import { ELayerType } from '~/types/psd'
import { InfoIcon } from '@shopify/polaris-icons'
import { useShopDomain } from '~/utils/shopify/useShopParams'

export const ClipartsInspector = (props: { defaultOpen?: boolean; layerStores?: TLayerStore[] }) => {
  const { defaultOpen = true, layerStores = [] } = props
  const { t } = useTranslation()

  const shopDomain = useShopDomain()
  // const subDomain = getMyShopifySubdomainName(shopDomain || '')

  const stageRef = useRef<Konva.Stage>(null)
  const tracking = useFeatureTracking('clipart_creation')
  const hasTrackedRef = useRef(false)

  // Track when clipart inspector opens
  useEffect(() => {
    if (!hasTrackedRef.current) {
      tracking.trackStarted()
      hasTrackedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { onSaveClipart } = useSaveTemplate()
  const { checkedLayerStores } = useLayerStoreSelection()
  // const { appHandle } = useAppHandle()

  const [clipartName, setClipartName] = useState(t('untitled'))
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const extractedLayerStores = useStore(TemplateEditorStore, state => state.extractedLayerStores)
  const templateDimension = useStore(TemplateEditorStore, state => state.dimension)
  const extractedLayerIds = extractedLayerStores.map((layerStore: TLayerStore) => layerStore.getState()._id)

  const layerStoresToCreateClipart = useMemo(() => {
    if (layerStores.length) {
      return layerStores
    }

    return checkedLayerStores
  }, [layerStores, checkedLayerStores])

  const layerStatesToCreateClipart = layerStoresToCreateClipart
    .filter((s: TLayerStore) => Boolean(s?.getState()))
    .map((layerStore: TLayerStore) => layerStore.getState())

  const showHelpText = useMemo(() => {
    if (!layerStatesToCreateClipart.length) return false

    return layerStatesToCreateClipart.some(layerState => {
      // Check for imageless layers first as this is a simple check
      if (layerState.type === ELayerType.IMAGELESS) return true

      // Skip checking conditionalLogic if it doesn't exist
      if (!layerState.conditionalLogic?.controls?.conditions?.length) return false

      // Find any condition with controlled layers
      return layerState.conditionalLogic.controls.conditions.some(
        (condition: any) => condition.ifOptionSelected && condition.thenShowOrHideLayers?.length > 0
      )
    })
  }, [layerStatesToCreateClipart])

  const layerStatesSorted = [...layerStatesToCreateClipart].sort((a: LayerDocument, b: LayerDocument) => {
    return extractedLayerIds.indexOf(a._id) - extractedLayerIds.indexOf(b._id)
  })

  const layerStoresSorted = useMemo(
    () => [...layerStatesSorted.map((layerState: LayerDocument) => getLayerStoreById(layerState._id))],
    [layerStatesSorted]
  )
  const boundingBox = calculateBoundingBox(layerStatesSorted)

  const calculateDimensionsLayer = useCallback((layerState: LayerDocument, boundingBox: IBoundingBoxClipartCanvas) => {
    const { top = 0, left = 0 } = layerState
    const layerPosition = {
      top: top - boundingBox.y,
      left: left - boundingBox.x,
    }

    return {
      layerPosition,
    }
  }, [])

  const handleSaveClipart = useCallback(async () => {
    setLoading(true)
    setTimeout(() => {
      showToast(t(TOAST.TEMPLATE_EDITOR.CLIPART_SAVING))
      const stage = stageRef?.current

      if (stage) {
        // Clone the stage to perform transformations without affecting the user's view
        const clonedStage = stage.clone({
          width: stage.width(),
          height: stage.height(),
          scale: { x: 1, y: 1 }, // Set the cloned stage's scale to 1
          position: { x: 0, y: 0 }, // Set the cloned stage's position to default
        })
        const canvasLayer = clonedStage.findOne(`#${CLIPART_CANVAS_EDITOR_LAYER}`)

        if (!canvasLayer) {
          showGenericErrorToast()

          return
        }

        // Restore cache for all cached groups (inner shadows, etc.)
        // IMPORTANT: Cache pixelRatio must match toBlob pixelRatio to prevent white line artifacts
        restoreClonedCache(canvasLayer) // Uses default pixelRatio to match toBlob({ pixelRatio: 1 })

        canvasLayer.toBlob({
          pixelRatio: 1,
          mimeType: 'image/webp',
          quality: 0.8,
          callback: async blob => {
            clonedStage.destroy() // Clean up the cloned stage

            if (blob) {
              try {
                const base64Image = await blobToBase64(blob)

                if (!base64Image) {
                  console.error('Fail to create base64 image')
                  throw new Error(CommonError)
                }

                const layers = duplicateLayers({
                  layers: getTemplateElementsIncludingMultiLayout(
                    layerStoresSorted.map((layer: TLayerStore) => layer.getState())
                  ),
                  shopDomain,
                })

                const layersStateFormatted = layers.map((layerState: LayerDocument) => {
                  const { layerPosition } = calculateDimensionsLayer(layerState, boundingBox)

                  return {
                    ...layerState,
                    ...layerPosition,
                  }
                })

                const layersStoreFormatted = layersStateFormatted.map((layerState: LayerDocument) =>
                  createLayerStore(layerState)
                )

                // Save template preview image or further processing
                const { saved: savedSuccess } = await onSaveClipart(
                  layersStateFormatted,
                  {
                    ...DEFAULT_TEMPLATE_EDITOR_STORE,
                    dimension: {
                      ...(templateDimension || DEFAULT_TEMPLATE_DIMENSION),
                      width: boundingBox.width,
                      height: boundingBox.height,
                    },
                    _id: uuid(),
                    name: clipartName || 'Untitled',
                    type: TEMPLATE_TYPE.CLIPART,
                    shopDomain,
                    extractedLayerStores: layersStoreFormatted,
                  },
                  base64Image
                )

                if (savedSuccess) {
                  tracking.trackCompleted('saved')
                  showToast(t(TOAST.TEMPLATE_EDITOR.CLIPART_SAVED), {
                    action: t('view'),
                    // onAction: () =>
                    //   window.open(
                    //     `https://admin.shopify.com/store/${subDomain}/apps/${appHandle}/libraries?tab=${TEMPLATE_TYPE.CLIPART}`,
                    //     '_blank'
                    //   ),
                  })
                } else {
                  tracking.trackError('save_failed')
                  showToast(t(TOAST.TEMPLATE_EDITOR.CLIPART_SAVED_ERROR))
                }
              } catch (error) {
                tracking.trackError('save_exception')
                showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
              } finally {
                setLoading(false)
              }
            } else {
              showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
              setLoading(false)
            }
          },
        })
      } else {
        showGenericErrorToast()
        setLoading(false)
      }
    }, 500)
  }, [
    clipartName,
    t,
    layerStoresSorted,
    shopDomain,
    templateDimension,
    boundingBox,
    onSaveClipart,
    calculateDimensionsLayer,
    tracking,
  ])

  const handleChangeClipartName = useCallback(
    (value: string) => {
      setClipartName(value.substring(0, MAX_CLIPART_NAME_SIZE))
      if (errorMessage && value.trim()) {
        setErrorMessage('')
      }
    },
    [errorMessage]
  )

  const handleBlur = useCallback(() => {
    const validValue = clipartName.trim()
    setClipartName(validValue.substring(0, MAX_CLIPART_NAME_SIZE))
  }, [clipartName])

  // Check if uploading layer images is in progress.
  const index = useStore(ProgressStore, state => state.index)
  const total = useStore(ProgressStore, state => state.total)

  const progress = total > 0 ? (index / total) * 100 : 0
  const uploadingLayerImages = total !== 0 && progress < 100

  const renderLabel = useMemo(() => {
    return (
      <InlineStack blockAlign="center" gap={'050'}>
        <Text as="span" variant="bodyMd">
          {t('clipart-name')}
        </Text>
        {showHelpText && (
          <Tooltip
            content={t('layers-without-images-or-with-display-conditions-may-not-display-as-expected-in-the-clipart')}
          >
            <Icon source={InfoIcon} tone="warning" />
          </Tooltip>
        )}
      </InlineStack>
    )
  }, [showHelpText, t])

  return (
    <AccordionList
      items={[
        {
          open: defaultOpen,
          id: 'clipart-library',
          label: t('create-clipart'),
          content: (
            <BlockStack gap={'200'}>
              <TextFieldComponent
                maxLength={MAX_CLIPART_NAME_SIZE}
                label={renderLabel}
                autoComplete="off"
                value={clipartName}
                onChange={handleChangeClipartName}
                placeholder={t('input-clipart-name')}
                onBlur={handleBlur}
                error={errorMessage}
              />
              {
                // Do not create clipart while uploading layer images.
                uploadingLayerImages ? (
                  <Tooltip content={t('cannot-create-clipart-while-uploading-layer-images')}>
                    <Button fullWidth onClick={handleSaveClipart} loading={loading} disabled={true}>
                      {t('create-clipart')}
                    </Button>
                  </Tooltip>
                ) : (
                  <Button onClick={handleSaveClipart} loading={loading}>
                    {t('create-clipart')}
                  </Button>
                )
              }
              {loading && (
                <div style={{ width: '100%', height: '100%', position: 'absolute', top: -99999, left: -99999 }}>
                  <ClipartCanvas boundingBox={boundingBox} layersStore={layerStoresSorted} stageRef={stageRef} />
                </div>
              )}
            </BlockStack>
          ),
        },
      ]}
    />
  )
}
