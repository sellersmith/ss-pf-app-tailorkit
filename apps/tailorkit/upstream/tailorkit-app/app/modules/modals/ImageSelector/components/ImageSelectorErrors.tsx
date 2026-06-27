import type { ErrorFile } from '~/types/media'
import ErrorFilesMessage, { ErrorUploadFilesMessage } from './ErrorFilesMessage'
import BlockLoading from '~/components/loading/BlockLoading'

interface ImageSelectorErrorsProps {
  rejectedFiles: ErrorFile[]
  errorMessage: string
  isProcessing: boolean
}

export default function ImageSelectorErrors({ rejectedFiles, errorMessage, isProcessing }: ImageSelectorErrorsProps) {
  return (
    <>
      {rejectedFiles.length > 0 && <ErrorFilesMessage rejectedFiles={rejectedFiles} />}
      {errorMessage && <ErrorUploadFilesMessage message={errorMessage} />}
      {isProcessing && <BlockLoading paddingBlockStart="400" paddingBlockEnd="0" />}
    </>
  )
}
