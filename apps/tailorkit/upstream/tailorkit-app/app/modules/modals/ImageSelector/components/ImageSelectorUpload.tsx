import { Button, DropZone } from '@shopify/polaris'
import { UploadIcon } from '@shopify/polaris-icons'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import BlockLoading from '~/components/loading/BlockLoading'

interface ImageSelectorUploadProps {
  variant: 'dropzone' | 'button'
  accept: string
  onDrop: (_: File[], acceptedFiles: File[], rejectedFiles: File[]) => Promise<void>
  isProcessing?: boolean
}

export default function ImageSelectorUpload({
  variant,
  accept,
  onDrop,
  isProcessing = false,
}: ImageSelectorUploadProps) {
  const { t } = useTranslation()

  const fileInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      if (node && variant === 'button') {
        node.addEventListener('change', async e => {
          const target = e.target as HTMLInputElement
          if (target.files) {
            const filesArray = Array.from(target.files)
            await onDrop(filesArray, filesArray, [])
            target.value = '' // Reset input
          }
        })
      }
    },
    [onDrop, variant]
  )

  if (variant === 'button') {
    return (
      <label htmlFor="sidebar-image-upload">
        <input
          id="sidebar-image-upload"
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          style={{ display: 'none' }}
        />
        <Button
          icon={UploadIcon}
          onClick={() => document.getElementById('sidebar-image-upload')?.click()}
          fullWidth
          disabled={isProcessing}
        >
          {t('upload-image')}
        </Button>
      </label>
    )
  }

  return (
    <DropZone
      errorOverlayText="File format is not supported"
      overlayText="Drop files to upload"
      type="image"
      accept={accept}
      onDrop={onDrop}
      allowMultiple
    >
      {isProcessing ? (
        <BlockLoading paddingBlockStart={'1000'} paddingBlockEnd={'0'} />
      ) : (
        <DropZone.FileUpload
          actionTitle={t('add-media')}
          actionHint={t('accepts-a-single-webp-jpg-or-png-file-up-to-maximagesize', { maxImageSize: '20MB' })}
        />
      )}
    </DropZone>
  )
}
