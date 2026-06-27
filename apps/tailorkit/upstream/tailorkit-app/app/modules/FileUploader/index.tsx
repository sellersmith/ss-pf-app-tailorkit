import type { DropZoneProps } from '@shopify/polaris'
import { BlockStack, Button, DropZone, InlineStack, ProgressBar, Text } from '@shopify/polaris'
import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ONE_SECOND } from '~/constants/time'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { sleep } from '~/utils/sleep'
import { useStore } from '~/libs/external-store'
import { useUploadFiles } from '~/modules/TemplateEditor/hooks/useUploadFiles'
import type { InvalidFileError, TUploadType } from './constants'
import { fileUploadStateStore } from './fileUploaderStore'
import { validateFiles } from './fns'

// Memoized Progress Component
const UploadProgress = memo(function UploadProgress({
  isUploading,
  fileUploaded,
  totalFiles,
  onViewDetailedResult,
}: {
  isUploading: boolean
  fileUploaded: number
  totalFiles: number
  onViewDetailedResult?: () => void
}) {
  const { t } = useTranslation()

  const progress = useMemo(() => {
    // Ensure we show at least some progress when upload starts
    if (fileUploaded === 0 && totalFiles > 0) {
      return 10 // Show initial 10% when upload starts but no files are completed yet
    }
    return (fileUploaded / totalFiles) * 100 || 10
  }, [fileUploaded, totalFiles])

  const handleViewDetailedResult = useCallback(() => {
    onViewDetailedResult?.()
  }, [onViewDetailedResult])

  if (totalFiles === 0) {
    return null
  }

  return (
    <BlockStack gap={'200'}>
      <ProgressBar tone="success" progress={progress} />
      {onViewDetailedResult && (
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
      )}
    </BlockStack>
  )
})

interface IFileUploaderProps {
  uploadType: TUploadType
  accept: string
  acceptType: 'image' | 'file'
  allowMultiple: boolean
  disabled: boolean
  actionHint: string
  actionTitle: string
  onAfterUploaded?: (uploadedFiles: File[]) => void
  validateFunction: (file: File) => Promise<{ isValidExtension: boolean; isValidType: boolean; isValidFile?: boolean }>
  processFileUploadFunction: (
    files: File[],
    uploadFn: ReturnType<typeof useUploadFiles>['uploadFiles'],
    onProgress: (count: number) => void,
    onError: (message: string, errors?: InvalidFileError[]) => void,
    options?: {
      fileUploadType?: string
    }
  ) => Promise<{ success: boolean; uploadedFiles: File[]; errorFiles?: InvalidFileError[] }>
  onViewDetailedResult?: () => void
  dropZoneProps?: DropZoneProps
}

function FileUploader(props: IFileUploaderProps) {
  const {
    uploadType,
    accept,
    acceptType,
    allowMultiple,
    disabled,
    actionHint,
    actionTitle,
    onAfterUploaded,
    validateFunction,
    processFileUploadFunction,
    onViewDetailedResult,
    ...dropZoneProps
  } = props

  const { t } = useTranslation()
  const uploadFileState = useStore(fileUploadStateStore, state => state[uploadType])
  const { uploadFiles } = useUploadFiles()

  const { isUploading, invalidFiles, files, fileUploaded } = uploadFileState
  const totalFilesError = useMemo(() => invalidFiles.length, [invalidFiles]) || 0
  const totalFilesUploading = useMemo(() => files.length, [files]) + totalFilesError
  const totalFilesUploaded = useMemo(() => fileUploaded + totalFilesError, [fileUploaded, totalFilesError])

  const handleDrop = useCallback(
    async (droppedFiles: File[], acceptedFiles: File[], rejectedFiles: File[]) => {
      try {
        fileUploadStateStore.dispatch({ type: 'CLEAR_STATE', uploadType })

        const invalidFiles = await validateFiles(droppedFiles, validateFunction)

        const validFiles
          = invalidFiles.length > 0
            ? droppedFiles.filter(file => !invalidFiles.some(invalid => invalid.name === file.name))
            : droppedFiles

        if (invalidFiles.length) {
          fileUploadStateStore.dispatch({
            type: 'SET_INVALID_FILES',
            uploadType,
            files: invalidFiles,
            message: t('invalid-font-files'),
          })
        }

        // Continue with valid files if there are any
        if (validFiles.length === 0) {
          return // Only return if no valid files
        }

        fileUploadStateStore.dispatch({ type: 'SET_FILES', uploadType, files: validFiles })
        fileUploadStateStore.dispatch({ type: 'SET_UPLOADING', uploadType, isUploading: true })

        const result = await processFileUploadFunction(
          validFiles,
          uploadFiles,
          count => fileUploadStateStore.dispatch({ type: 'SET_UPLOAD_PROGRESS', uploadType, count }),
          (message, errors) => {
            if (errors) {
              fileUploadStateStore.dispatch({ type: 'SET_INVALID_FILES', uploadType, files: errors, message })
            } else {
              fileUploadStateStore.dispatch({ type: 'SET_ERROR', uploadType, message })
            }
          },
          {
            fileUploadType: uploadType,
          }
        )

        if (result.success) {
          await sleep(ONE_SECOND)
          if (onAfterUploaded) {
            onAfterUploaded(result.uploadedFiles)
          }
        }

        fileUploadStateStore.dispatch({ type: 'SET_UPLOADING', uploadType, isUploading: false })
      } catch (e) {
        console.error(e)
        fileUploadStateStore.dispatch({ type: 'SET_ERROR', uploadType, message: formatErrorMessage(e) })
        fileUploadStateStore.dispatch({ type: 'SET_UPLOADING', uploadType, isUploading: false })
      }
    },
    [uploadType, validateFunction, processFileUploadFunction, uploadFiles, t, onAfterUploaded]
  )

  return (
    <BlockStack gap="400">
      <DropZone
        accept={accept}
        onDrop={handleDrop}
        allowMultiple={allowMultiple}
        disabled={isUploading || disabled}
        type={acceptType}
        {...dropZoneProps}
      >
        <DropZone.FileUpload actionHint={actionHint} actionTitle={actionTitle} />
      </DropZone>

      <UploadProgress
        isUploading={isUploading}
        fileUploaded={totalFilesUploaded}
        totalFiles={totalFilesUploading}
        onViewDetailedResult={onViewDetailedResult}
      />
    </BlockStack>
  )
}

export default FileUploader
