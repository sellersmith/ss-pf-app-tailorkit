import { Box, Icon, InlineGrid, InlineStack, Scrollable, Spinner, Text, Thumbnail } from '@shopify/polaris'
import { AlertCircleIcon, CheckCircleIcon, XIcon, ChevronDownIcon, ChevronUpIcon } from '@shopify/polaris-icons'
import { getShopifyThumbnail } from '~/utils/loadImage'

export interface IUploadFile {
  id: string
  url: string
  alt: string
  errorMessage?: string
  isUploading?: boolean
  isCanceled?: boolean
}

interface FileFailedProps {
  file: IUploadFile
}

interface FileUploadingProps {
  file: IUploadFile
  isPendingFile: boolean
  onCancelUpload: (file: IUploadFile) => void
}

interface ProcessUploadingProps {
  isExpand: boolean
  handleExpandProcessDetail: () => void
  uploadingFiles: IUploadFile[]
  errorFiles: IUploadFile[]
  pendingFiles?: IUploadFile[]
  onCancelUpload: (file: IUploadFile) => void
}

interface ProcessUploadedProps {
  isExpand: boolean
  handleExpandProcessDetail: () => void
  handleClearFilesUploaded: () => void
  uploadingFiles: IUploadFile[]
  errorFiles: IUploadFile[]
  onlyShowFailed?: boolean
}

const FileFailed = ({ file }: FileFailedProps) => {
  return (
    <Box padding={'300'} borderBlockStartWidth="025" borderColor="border-inverse">
      <InlineGrid columns={'auto 20px'} gap={'300'}>
        <InlineStack gap={'200'} wrap={false}>
          <div className="thumbnail-process">
            <Thumbnail source={getShopifyThumbnail(file.url)} alt={file.alt} transparent size="extraSmall" />
          </div>
          <Box width="212px">
            <Text as="p" variant="bodyMd" truncate tone="text-inverse">
              {file.alt}
            </Text>
            <Text as="p" variant="bodyMd" tone="critical">
              <span style={{ color: 'var(--p-color-bg-fill-critical)' }}>{file.errorMessage}</span>
            </Text>
          </Box>
        </InlineStack>
        <Icon source={AlertCircleIcon} tone="critical" />
      </InlineGrid>
    </Box>
  )
}

const FileUploading = ({ file, isPendingFile, onCancelUpload }: FileUploadingProps) => {
  const handleCancelUpload = () => {
    onCancelUpload(file)
  }

  return (
    <Box padding={'300'} borderBlockStartWidth="025" borderColor="border-inverse">
      <InlineGrid columns={'auto 20px'} gap={'300'}>
        <InlineStack gap={'200'} wrap={false} blockAlign="start">
          <div className="thumbnail-process">
            <Spinner size="small" />
            {/* <Thumbnail source={getShopifyThumbnail(file.url)} alt={file.alt} transparent size="extraSmall" /> */}
          </div>
          <Box width="212px">
            <Text as="p" variant="bodySm" truncate tone="text-inverse">
              {file.alt}
            </Text>
            {file.isCanceled && (
              <Text as="p" variant="bodyMd" tone="subdued">
                Canceled
              </Text>
            )}
          </Box>
        </InlineStack>
        {file.isCanceled ? null : isPendingFile ? (
          <div style={{ cursor: 'pointer' }} onClick={handleCancelUpload}>
            <Icon source={XIcon} />
          </div>
        ) : (
          <div className="progress-spinner" />
        )}
      </InlineGrid>
    </Box>
  )
}

export const ProcessUploading = ({
  isExpand,
  handleExpandProcessDetail,
  uploadingFiles,
  errorFiles,
  pendingFiles = [],
  onCancelUpload,
}: ProcessUploadingProps) => {
  const listFileUploading = uploadingFiles.filter(
    file => file.isUploading || (file.isCanceled && file.isUploading === false)
  )

  const listFileInProcess = listFileUploading.filter(file => !file.isCanceled)
  const isError = errorFiles.length > 0

  return (
    <>
      <Box padding={'300'}>
        <InlineStack align="space-between">
          <Text variant="headingMd" as="h2" tone="text-inverse">
            {!isError ? 'Uploading' : `${errorFiles.length} ${errorFiles.length === 1 ? 'file' : 'files'} failed`}
          </Text>
          <div style={{ cursor: 'pointer', height: '20px' }} onClick={handleExpandProcessDetail}>
            {isExpand ? <ChevronDownIcon /> : <ChevronUpIcon />}
          </div>
        </InlineStack>
        <Text variant="bodyMd" as="p" tone="subdued">{`${listFileInProcess.length} remaining`}</Text>
      </Box>
      {isExpand && (
        <Scrollable shadow style={{ maxHeight: '200px', overflowX: 'hidden' }}>
          <InlineStack>
            {errorFiles.map((file, index) => (
              <FileFailed key={index} file={file} />
            ))}
            {listFileUploading.map((file, index) => {
              const isPendingFile = pendingFiles.some(f => f.id === file.id)
              return (
                <FileUploading key={index} file={file} isPendingFile={isPendingFile} onCancelUpload={onCancelUpload} />
              )
            })}
          </InlineStack>
        </Scrollable>
      )}
    </>
  )
}

export const ProcessUploaded = ({
  isExpand,
  handleExpandProcessDetail,
  handleClearFilesUploaded,
  uploadingFiles,
  errorFiles,
  onlyShowFailed,
}: ProcessUploadedProps) => {
  const listFileUploaded = uploadingFiles.filter(file => file.isUploading === false)

  const existingError = errorFiles.length > 0

  if (onlyShowFailed && !existingError) {
    return null
  }

  if (errorFiles.length === 0 && !onlyShowFailed) {
    return (
      <Box padding={'300'}>
        <InlineStack align="space-between">
          <InlineStack gap={'150'}>
            <Box>
              <Icon source={CheckCircleIcon} tone="success" />
            </Box>
            <Text variant="headingMd" as="h2" tone="text-inverse">
              Files uploaded
            </Text>
          </InlineStack>

          <div style={{ cursor: 'pointer' }} onClick={handleClearFilesUploaded}>
            <Icon source={XIcon} />
          </div>
        </InlineStack>
      </Box>
    )
  }

  return (
    <>
      <Box padding={'300'}>
        <InlineStack align="space-between">
          <InlineStack gap={'150'}>
            <Box>
              <Icon source={AlertCircleIcon} tone="critical" />
            </Box>
            <Text variant="headingMd" as="h2" tone="text-inverse">
              {`${errorFiles.length} ${errorFiles.length === 1 ? 'file' : 'files'} failed`}
            </Text>
          </InlineStack>
          <InlineStack gap={'100'}>
            <div style={{ cursor: 'pointer', height: '20px' }} onClick={handleExpandProcessDetail}>
              {isExpand ? <ChevronDownIcon /> : <ChevronUpIcon />}
            </div>
            <div style={{ cursor: 'pointer' }} onClick={handleClearFilesUploaded}>
              <Icon source={XIcon} />
            </div>
          </InlineStack>
        </InlineStack>
        {listFileUploaded.length > 0 && (
          <Text variant="bodyMd" as="p" tone="subdued">{`${listFileUploaded.length} successful`}</Text>
        )}
      </Box>
      {isExpand && (
        <Scrollable shadow style={{ maxHeight: '200px', overflowX: 'hidden' }}>
          <InlineStack>
            {errorFiles.map((file, index) => (
              <FileFailed key={index} file={file} />
            ))}
          </InlineStack>
        </Scrollable>
      )}
    </>
  )
}
