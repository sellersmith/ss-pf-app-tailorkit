import { BlockStack, Box, Icon, InlineStack, Text } from '@shopify/polaris'
import { LightbulbIcon, UploadIcon } from '@shopify/polaris-icons'
import { Fragment, useCallback, useMemo } from 'react'
import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import BlockLoading from '~/components/loading/BlockLoading'
import { useStore } from '~/libs/external-store'
import ImageSelector from '~/modules/modals/ImageSelector'
import { ImageOptionUploadingStore } from '~/stores/loading/image-option-uploading'
import type { TLayerStore } from '~/stores/modules/layer'
import { optionSetDataKeys, type ImageOptionSet } from '~/types/psd'
import type { IImageQuery } from '~/types/shopify-files'
import ImageItems from './items'
import { useValidateOptionSetData } from '~/modules/TemplateEditor/elements/hooks/useValidateOptionSetData'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import { TRIGGER_ELEMENT } from '~/components/TourGuide/constants'
import { useTourStatus } from '~/utils/hooks/useTourStatus'
import { addImageOptions } from './fns'
import MaskSelector from '~/modules/modals/MasksSelector'
import { fileUploadStateStore } from '~/modules/FileUploader/fileUploaderStore'

interface IUploadImagesProps extends WithTranslationProps {
  layerStore: TLayerStore
  optionSet: any
  editMode?: boolean
  existOptionSetPressed?: boolean
  imageUploadType: 'images' | 'masks'
  allowEditPricing?: boolean
  insertDataToOptionSet?: boolean
}

export function UploadImages(props: IUploadImagesProps) {
  const {
    t,
    layerStore,
    optionSet,
    editMode,
    existOptionSetPressed,
    imageUploadType = 'images',
    allowEditPricing,
    insertDataToOptionSet = false,
  } = props

  const imageSetName = optionSet?.label
  const layerId = layerStore.getState()._id
  const isImageUploadType = imageUploadType === 'images'
  const allowEditImagePricing = allowEditPricing ?? isImageUploadType
  const componentConfigs = {
    textFieldPlaceholder: isImageUploadType ? t('upload-images-webp-jpg-png') : t('upload-masks-webp-jpg-png'),
  }
  const modalKey = isImageUploadType
    ? MODAL_ID.IMAGE_SELECTOR_OPTION_SET_MODAL
    : MODAL_ID.MASK_SELECTOR_OPTION_SET_MODAL
  const optionSetType = optionSet?.type
  const optionSetDataKey = optionSetDataKeys[optionSetType as keyof typeof optionSetDataKeys]

  const imagesUploading = useStore(ImageOptionUploadingStore, state => state.imagesUploading)
  const files: ImageOptionSet[] = useMemo(
    () => optionSet?.data?.[optionSetDataKey] || [],
    [optionSet?.data, optionSetDataKey]
  )
  const { state: imageModalState, openModal: openImageModal, closeModal: closeImageModal } = useModal()
  const imageModalActive = imageModalState[modalKey]?.active

  const { tourId, active: tourActive } = useTourStatus()

  useValidateOptionSetData({ layerId, optionSet })

  const onClose = useCallback(() => {
    closeImageModal(modalKey)
    fileUploadStateStore.dispatch({ type: 'CLEAR_STATE', uploadType: imageUploadType })
  }, [closeImageModal, imageUploadType, modalKey])

  const onIndicateClose = useCallback(() => {
    if (tourId && tourActive) {
      return
    }

    closeImageModal(modalKey)
  }, [tourId, tourActive, closeImageModal, modalKey])

  const toggleImageSelectModal = useCallback(() => {
    if (imageModalActive) {
      closeImageModal(modalKey)
    } else {
      openImageModal(modalKey)
    }
  }, [closeImageModal, imageModalActive, modalKey, openImageModal])

  const onAddImageOptions = useCallback(
    async (mediaFiles: IImageQuery[] | null) => {
      addImageOptions(mediaFiles, layerStore, optionSet, insertDataToOptionSet)

      setTimeout(() => {
        const imageOptionList = document.querySelector('.image-option-list')
        if (imageOptionList) {
          imageOptionList.scrollTo({ top: imageOptionList.scrollHeight, behavior: 'smooth' })
        }
      }, 50)
    },
    [layerStore, optionSet, insertDataToOptionSet]
  )

  return (
    <Fragment>
      {imagesUploading ? (
        <BlockLoading />
      ) : !files.length ? (
        <div className="fit-dropZone">
          <div
            role={TRIGGER_ELEMENT}
            tabIndex={imageSetName ? 0 : -1}
            aria-label={t('upload-your-images')}
            style={{
              cursor: imageSetName ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
            }}
            onClick={() => {
              openImageModal(modalKey)
            }}
            onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
              if (imageSetName && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                openImageModal(modalKey)
              }
            }}
          >
            <Box
              padding="400"
              borderRadius="200"
              borderWidth="025"
              borderStyle="dashed"
              borderColor="border"
              background={imageSetName ? 'bg-surface' : 'bg-surface-disabled'}
              position="relative"
            >
              <BlockStack gap="200" align="center">
                <Icon source={UploadIcon} tone={imageSetName ? 'base' : 'subdued'} />
                <Text as="p" variant="bodySm" alignment="center" tone="subdued">
                  {componentConfigs.textFieldPlaceholder}
                </Text>
              </BlockStack>
            </Box>
          </div>

          {isImageUploadType && (
            <Box paddingBlockStart={'100'}>
              <InlineStack gap={'100'} wrap={false} blockAlign="start">
                <span style={{ width: '16px' }}>
                  <Icon source={LightbulbIcon} />
                </span>
                <Text as="p" variant="bodySm" tone="subdued">
                  {t('click-an-image-option-to-adjust-it-on-canvas')}
                </Text>
              </InlineStack>
            </Box>
          )}
        </div>
      ) : (
        <BlockStack gap={'100'}>
          <ImageItems
            layerStore={layerStore}
            optionSet={optionSet}
            editMode={!!editMode}
            existOptionSetPressed={!!existOptionSetPressed}
            allowEditImagePricing={allowEditImagePricing}
            toggleImageSelectModal={toggleImageSelectModal}
          />
        </BlockStack>
      )}

      {imageModalActive ? (
        imageUploadType === 'images' ? (
          <ImageSelector
            active={imageModalActive}
            allowMultiple
            onSelectImage={onAddImageOptions}
            onClose={onClose}
            onIndicateClose={onIndicateClose}
          />
        ) : (
          <MaskSelector
            selectedMasks={optionSet?.data?.masks || []}
            onSelectMask={onAddImageOptions}
            onClose={onClose}
          />
        )
      ) : null}
    </Fragment>
  )
}
