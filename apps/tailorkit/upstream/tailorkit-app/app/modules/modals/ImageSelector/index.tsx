import { BlockStack, Box, Button, Link, Modal, Scrollable } from '@shopify/polaris'
import type { BaseImage } from '~/types/integration'
import type { IImageQuery } from '~/types/shopify-files'
import { usePreventPageScroll } from '../hooks/usePreventPageScroll'
import { TRIGGER_ELEMENT } from '~/components/TourGuide/constants'
import { useTranslation } from 'react-i18next'
import { useImageSelector } from './hooks/useImageSelector'
import ImageSelectorSearch from './components/ImageSelectorSearch'
import ImageSelectorUpload from './components/ImageSelectorUpload'
import ImageSelectorGrid from './components/ImageSelectorGrid'
import ImageSelectorErrors from './components/ImageSelectorErrors'
import imageSelectorStyles from './styles.css?url'

export const linksImageModalCSS = [{ rel: 'stylesheet', href: imageSelectorStyles }]

interface IImageSelectorProps {
  active: boolean
  onSelectImage: (image: IImageQuery[] | null) => void
  baseImage?: BaseImage[] | null
  allowMultiple?: boolean
  /** Maximum number of images that can be selected. Only applies when allowMultiple is true */
  maxSelection?: number
  onClose: (metaData?: any) => void
  /** This onIndicateClose will be called when the modal is closed by clicking the close button or clicking the cancel button */
  onIndicateClose?: () => void
}

const ImageSelector = (props: IImageSelectorProps) => {
  const { active, baseImage, allowMultiple = false, maxSelection, onClose, onIndicateClose } = props
  const { t } = useTranslation()

  // Prevent page scroll when modal is open (only for modal variant)
  usePreventPageScroll(active)

  // All business logic in the hook
  const {
    textFieldValue,
    imagesProcessing,
    imagesSelected,
    rejectedFiles,
    errorMessage,
    mediaList,
    isFetching,
    fetchNextPage,
    deferredQuery,
    hasError,
    validMediaFiles,
    subDomain,
    setTextFieldValue,
    setImagesSelected,
    onSelect,
    onDropHandler,
    handleFetchMoreMedia,
  } = useImageSelector({ baseImage, onSelectImage: props.onSelectImage, onClose })

  const onCloseHandler = onIndicateClose || onClose

  return (
    <Modal
      open={active}
      onClose={onCloseHandler}
      title={t('select-file')}
      footer={
        <Link removeUnderline target="_blank" url={`https://admin.shopify.com/store/${subDomain}/content/files`}>
          {t('open-media-files')}
        </Link>
      }
      secondaryActions={[
        {
          id: 'image-selector-modal-cancel',
          content: t('cancel'),
          onAction: onCloseHandler,
        },
      ]}
      primaryAction={{
        id: 'image-selector-modal-done',
        disabled: !imagesSelected.length,
        content: t('select'),
        onAction: onSelect,
      }}
      noScroll
    >
      <div id="image-selector-modal">
        <Box padding={'400'}>
          <ImageSelectorSearch
            value={textFieldValue}
            onChange={setTextFieldValue}
            showEmptyMessage={!deferredQuery && !mediaList?.length}
            isFetching={isFetching}
          />
        </Box>

        <Scrollable
          style={{
            height: 'calc(100vh - 272px)',
            maxHeight: 'calc(100vh - 272px)',
          }}
          onScrolledToBottom={() => {
            setTimeout(() => {
              handleFetchMoreMedia()
            }, 200)
          }}
        >
          {!deferredQuery && (
            <Box paddingInlineStart={'400'} paddingInlineEnd={'400'}>
              <BlockStack gap={'400'}>
                {hasError && (
                  <ImageSelectorErrors
                    rejectedFiles={rejectedFiles}
                    errorMessage={errorMessage}
                    isProcessing={imagesProcessing}
                  />
                )}
                <ImageSelectorUpload
                  variant="dropzone"
                  accept={validMediaFiles}
                  onDrop={onDropHandler}
                  isProcessing={imagesProcessing}
                />
              </BlockStack>
            </Box>
          )}

          <ImageSelectorGrid
            files={mediaList}
            isLoading={fetchNextPage}
            isFetching={isFetching}
            imagesSelected={imagesSelected}
            onSelectImages={setImagesSelected}
            allowMultiple={allowMultiple}
            maxSelection={maxSelection}
            showEmpty
            deferredQuery={deferredQuery}
          />
        </Scrollable>
      </div>

      <div style={{ display: 'none' }}>
        <Button id="close-image-selector-modal-btn" role={TRIGGER_ELEMENT} onClick={onClose} />
      </div>
    </Modal>
  )
}

export default ImageSelector
