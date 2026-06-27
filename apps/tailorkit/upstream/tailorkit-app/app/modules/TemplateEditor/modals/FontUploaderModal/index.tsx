import { BlockStack, Box, Button, DropZone, InlineStack, Modal, ProgressBar, Spinner, Text } from '@shopify/polaris'
import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MODAL_ID } from '~/constants/modal'
import { ONE_SECOND } from '~/constants/time'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { useModal } from '~/utils/hooks/useModal'
import { sleep } from '~/utils/sleep'
import { useUploadFiles } from '../../hooks/useUploadFiles'
import { processFileUpload, validateFiles } from './fns'
import { ALLOWED_FONT_EXTENSIONS } from '~/constants/dropzone'
import type { FooterProps } from '@shopify/polaris/build/ts/src/components/Modal/components'
import { createStore, useStore } from '~/libs/external-store'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { FILE_UPLOAD_EVENTS } from '../../constants'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'

type ViewType = 'modal' | 'popover'

interface FontUploaderModalProps {
  noScroll?: boolean
  loadingState?: boolean
  viewType?: ViewType
  modalTitle?: string
  filtersComponent?: React.ReactNode
  fontListComponent?: React.ReactNode
  primaryAction?: FooterProps['primaryAction']
  secondaryActions?: FooterProps['secondaryActions']
  onAfterUploaded?: (fontsUploaded: any[]) => void
}

const MODAL_KEY = MODAL_ID.UPLOAD_FONTS_MODAL

export interface InvalidFileError {
  name: string
  reason: 'type' | 'size'
}

interface State {
  files: File[]
  invalidFiles: InvalidFileError[]
  isUploading: boolean
  fileUploaded: number
  errorMessage: string
}

const initialState: State = {
  files: [],
  invalidFiles: [],
  isUploading: false,
  fileUploaded: 0,
  errorMessage: '',
}

type Action =
  | { type: 'CLEAR_STATE' }
  | { type: 'SET_FILES'; files: File[] }
  | { type: 'SET_INVALID_FILES'; files: InvalidFileError[]; message: string }
  | { type: 'SET_UPLOAD_PROGRESS'; count: number }
  | { type: 'SET_ERROR'; message: string }
  | { type: 'SET_UPLOADING'; isUploading: boolean }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'CLEAR_STATE':
      return { ...initialState }
    case 'SET_FILES':
      return { ...state, files: action.files }
    case 'SET_INVALID_FILES':
      return {
        ...state,
        invalidFiles: action.files,
        errorMessage: action.message,
      }
    case 'SET_UPLOAD_PROGRESS':
      return { ...state, fileUploaded: action.count }
    case 'SET_ERROR':
      return { ...state, errorMessage: action.message }
    case 'SET_UPLOADING':
      return { ...state, isUploading: action.isUploading }
    default:
      return state
  }
}

export const uploadFontStateStore = createStore(reducer, initialState)

// Memoized Progress Component
const UploadProgress = memo(function UploadProgress({
  isUploading,
  fileUploaded,
  totalFiles,
  returnContext,
}: {
  isUploading: boolean
  fileUploaded: number
  totalFiles: number
  returnContext?: any
}) {
  const { t } = useTranslation()
  const { openModal, closeModal } = useModal()

  const progress = useMemo(() => {
    // Ensure we show at least some progress when upload starts
    if (fileUploaded === 0 && totalFiles > 0) {
      return 10 // Show initial 10% when upload starts but no files are completed yet
    }
    return (fileUploaded / totalFiles) * 100 || 10
  }, [fileUploaded, totalFiles])

  const handleViewDetailedResult = useCallback(() => {
    closeModal(MODAL_KEY)
    openModal(MODAL_ID.UPLOAD_FONTS_RESULT_MODAL, { returnContext })
  }, [closeModal, openModal, returnContext])

  if (totalFiles === 0) {
    return null
  }

  return (
    <BlockStack gap={'200'}>
      <ProgressBar tone="success" progress={progress} />
      <InlineStack gap={'150'}>
        <Text as="p">
          {isUploading ? t('processing-without-dots') : t('processed')}: {fileUploaded}/{totalFiles}
        </Text>
        {!isUploading && (
          <Button variant="plain" onClick={handleViewDetailedResult}>
            {t('view-detailed-results')}
          </Button>
        )}
      </InlineStack>
    </BlockStack>
  )
})

function FontUploaderModal(props: FontUploaderModalProps) {
  const {
    noScroll,
    modalTitle,
    loadingState,
    filtersComponent,
    fontListComponent,
    primaryAction,
    secondaryActions,
    onAfterUploaded,
  } = props

  const { t } = useTranslation()
  const { state: modalState, closeModal } = useModal()
  const uploadFontState = useStore(uploadFontStateStore, state => state)
  const { uploadFiles } = useUploadFiles()
  const { isUploading, invalidFiles, files, fileUploaded } = uploadFontState
  const totalFilesError = useMemo(() => invalidFiles.length, [invalidFiles]) || 0
  const totalFilesUploading = useMemo(() => files.length, [files]) + totalFilesError
  const totalFilesUploaded = useMemo(() => fileUploaded + totalFilesError, [fileUploaded, totalFilesError])
  const modalData = modalState[MODAL_KEY]
  const active = modalData?.active && modalData?.data?.context !== 'font-option-set'
  const currentContext = modalData?.data

  // Prevent page scroll when modal is open
  usePreventPageScroll(!!active)

  const onClose = useCallback(() => {
    closeModal(MODAL_KEY)
  }, [closeModal])

  const handleDrop = useCallback(
    async (droppedFiles: File[], acceptedFiles: File[], rejectedFiles: File[]) => {
      try {
        Transmitter.trigger(FILE_UPLOAD_EVENTS.UPLOAD)
        uploadFontStateStore.dispatch({ type: 'CLEAR_STATE' })

        const invalidFiles = validateFiles(droppedFiles)

        const validFiles
          = invalidFiles.length > 0
            ? droppedFiles.filter(file => !invalidFiles.some(invalid => invalid.name === file.name))
            : droppedFiles

        if (invalidFiles.length) {
          uploadFontStateStore.dispatch({
            type: 'SET_INVALID_FILES',
            files: invalidFiles,
            message: t('invalid-font-files'),
          })
        }

        // Continue with valid files if there are any
        if (validFiles.length === 0) {
          Transmitter.trigger(FILE_UPLOAD_EVENTS.UPLOADED)
          return // Only return if no valid files
        }

        uploadFontStateStore.dispatch({ type: 'SET_FILES', files: validFiles })
        uploadFontStateStore.dispatch({ type: 'SET_UPLOADING', isUploading: true })

        const result = await processFileUpload(
          validFiles,
          uploadFiles,
          count => uploadFontStateStore.dispatch({ type: 'SET_UPLOAD_PROGRESS', count }),
          (message, errors) => {
            if (errors) {
              uploadFontStateStore.dispatch({ type: 'SET_INVALID_FILES', files: errors, message })
            } else {
              uploadFontStateStore.dispatch({ type: 'SET_ERROR', message })
            }
          }
        )

        if (result.success) {
          await sleep(ONE_SECOND)
          if (onAfterUploaded) {
            onAfterUploaded(result.uploadedFiles)
          }
        }
        Transmitter.trigger(FILE_UPLOAD_EVENTS.UPLOADED)

        uploadFontStateStore.dispatch({ type: 'SET_UPLOADING', isUploading: false })
      } catch (e) {
        console.error(e)
        uploadFontStateStore.dispatch({ type: 'SET_ERROR', message: formatErrorMessage(e) })
        uploadFontStateStore.dispatch({ type: 'SET_UPLOADING', isUploading: false })
      }
    },
    [uploadFiles, t, onAfterUploaded]
  )

  return (
    <Modal
      open={active}
      onClose={onClose}
      title={modalTitle || t('upload-fonts')}
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
            <DropZone
              accept={ALLOWED_FONT_EXTENSIONS.join(',')}
              onDrop={handleDrop}
              allowMultiple={true}
              disabled={isUploading}
            >
              <DropZone.FileUpload actionHint={t('accept-font-formats')} actionTitle={t('upload-fonts')} />
            </DropZone>

            <UploadProgress
              isUploading={isUploading}
              fileUploaded={totalFilesUploaded}
              totalFiles={totalFilesUploading}
              returnContext={currentContext}
            />
          </BlockStack>
          {fontListComponent}
        </Modal.Section>
      )}
    </Modal>
  )
}

export default FontUploaderModal
