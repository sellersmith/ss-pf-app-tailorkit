import { Box } from '@shopify/polaris'
import { useState } from 'react'
import type { IUploadFile } from './UploadProcess'
import { ProcessUploaded, ProcessUploading } from './UploadProcess'

interface ModalProcessPopoverProps {
  uploadingFiles: IUploadFile[]
  errorFiles: IUploadFile[]
  isLimitFilesOnFirstUpload?: boolean
  onClearFiles: () => void
  onCancelUpload: (file: IUploadFile) => void
  pendingFiles?: IUploadFile[]
  limitMessage?: string
  onlyShowFailed?: boolean
}

export default function ModalProcessPopover({
  uploadingFiles,
  errorFiles,
  isLimitFilesOnFirstUpload = false,
  onClearFiles,
  onCancelUpload,
  pendingFiles = [],
  onlyShowFailed = false,
}: ModalProcessPopoverProps) {
  const [isExpand, setIsExpand] = useState(false)

  const handleExpandProcessDetail = () => {
    setIsExpand(prev => !prev)
  }

  const handleClearFilesUploaded = () => {
    onClearFiles()
    handleExpandProcessDetail()
  }

  const listFileUploading = uploadingFiles.filter(file => file.isUploading)
  const listFileUploaded = uploadingFiles.filter(file => file.isUploading === false && !file.isCanceled)
  const isUploading = listFileUploading.length > 0
  const isUploaded = listFileUploaded.length > 0 || errorFiles.length > 0

  if (!isLimitFilesOnFirstUpload && !isUploading && !isUploaded) return null

  return (
    <Box
      position="absolute"
      insetBlockEnd={'100'}
      insetInlineEnd={'300'}
      width="300px"
      borderRadius="200"
      background="bg-inverse"
      zIndex="499"
    >
      {isUploading ? (
        <ProcessUploading
          isExpand={true}
          handleExpandProcessDetail={handleExpandProcessDetail}
          uploadingFiles={uploadingFiles}
          errorFiles={errorFiles}
          pendingFiles={pendingFiles}
          onCancelUpload={onCancelUpload}
        />
      ) : (
        <ProcessUploaded
          onlyShowFailed={onlyShowFailed}
          isExpand={isExpand}
          handleExpandProcessDetail={handleExpandProcessDetail}
          handleClearFilesUploaded={handleClearFilesUploaded}
          uploadingFiles={uploadingFiles}
          errorFiles={errorFiles}
        />
      )}
    </Box>
  )
}
