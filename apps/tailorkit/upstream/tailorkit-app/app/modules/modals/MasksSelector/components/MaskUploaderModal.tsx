import { BlockStack, Box, InlineStack, Modal, Spinner } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'
import { ALLOWED_IMAGE_EXTENSIONS, ALLOWED_IMAGE_TYPES } from '~/constants/dropzone'
import type { FooterProps } from '@shopify/polaris/build/ts/src/components/Modal/components'
import { useStore } from '~/libs/external-store'
import FileUploader from '~/modules/FileUploader'
import { isValidRatio } from '~/utils/file-types/validate-media-file-size'
import { convertBlobToDataUrl } from '~/utils/file-types'
import { processFileUpload } from '~/modules/TemplateEditor/modals/FontUploaderModal/fns'
import { fileUploadStateStore } from '~/modules/FileUploader/fileUploaderStore'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'

interface MaskUploaderModalProps {
  noScroll?: boolean
  loadingState?: boolean
  modalTitle?: string
  filtersComponent?: React.ReactNode
  masksListComponent?: React.ReactNode
  primaryAction?: FooterProps['primaryAction']
  secondaryActions?: FooterProps['secondaryActions']
  onAfterUploaded?: (masksUploaded: File[]) => void
}

const MODAL_KEY = MODAL_ID.MASK_SELECTOR_OPTION_SET_MODAL
const UPLOAD_TYPE = 'masks'

/**
 * Checks if a file name has a valid image extension
 * @param fileName - The name of the file to check
 * @returns boolean indicating if the extension is valid
 */
const hasValidImageExtension = (fileName: string): boolean => {
  if (!fileName.includes('.') || fileName.startsWith('.') || fileName.endsWith('.')) {
    return false
  }

  const extension = fileName.split('.').pop()
  return Boolean(extension && ALLOWED_IMAGE_EXTENSIONS.includes(`.${extension}`))
}

/**
 * @description Check media file are valid before uploading file
 * @param files
 * @returns
 */
async function validateMediaFile(
  file: File
): Promise<{ isValidExtension: boolean; isValidType: boolean; isValidFile?: boolean }> {
  const blobFile = convertBlobToDataUrl(file)
  const isValid = await isValidRatio(file, blobFile, false)

  const isValidType = ALLOWED_IMAGE_TYPES.includes(file.type)
  const isValidExtension = hasValidImageExtension(file.name)

  return { isValidExtension, isValidType, isValidFile: isValid as boolean }
}

function MaskUploaderModal(props: MaskUploaderModalProps) {
  const {
    noScroll,
    modalTitle,
    loadingState,
    filtersComponent,
    masksListComponent,
    primaryAction,
    secondaryActions,
    onAfterUploaded,
  } = props

  const { t } = useTranslation()
  const { state: modalState, closeModal } = useModal()
  const uploadMaskState = useStore(fileUploadStateStore, state => state[UPLOAD_TYPE])
  const { isUploading } = uploadMaskState
  const active = modalState[MODAL_KEY]?.active

  const onClose = useCallback(() => {
    closeModal(MODAL_KEY)
    fileUploadStateStore.dispatch({ type: 'CLEAR_STATE', uploadType: 'masks' })
  }, [closeModal])

  // Prevent page scroll when modal is open
  usePreventPageScroll(!!active)

  return (
    <Modal
      open={active}
      onClose={onClose}
      title={modalTitle || t('upload-masks')}
      primaryAction={
        primaryAction || {
          content: t('close'),
          onAction: onClose,
        }
      }
      secondaryActions={secondaryActions}
      noScroll={noScroll}
    >
      {loadingState ? (
        <div style={{ height: 468 }}>
          <Box padding={'2800'}>
            <InlineStack align="center">
              <Spinner size="large" />
            </InlineStack>
          </Box>
        </div>
      ) : (
        <Modal.Section>
          <BlockStack gap="400">
            {filtersComponent}
            <FileUploader
              uploadType={UPLOAD_TYPE}
              accept={ALLOWED_IMAGE_EXTENSIONS.join(',')}
              acceptType="image"
              allowMultiple={true}
              disabled={isUploading}
              actionHint={t('black-and-white-images-with-the-placeholder-shape-in-black-and-the-background-in-white')}
              actionTitle={t('upload-masks')}
              onAfterUploaded={onAfterUploaded}
              validateFunction={validateMediaFile}
              processFileUploadFunction={processFileUpload}
              dropZoneProps={{
                errorOverlayText: t('file-format-is-not-supported'),
                overlayText: t('drop-files-to-upload'),
              }}
            />
          </BlockStack>
          {masksListComponent}
        </Modal.Section>
      )}
    </Modal>
  )
}

export default MaskUploaderModal
