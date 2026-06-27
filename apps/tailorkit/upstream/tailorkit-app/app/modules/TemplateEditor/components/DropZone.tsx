import { BlockStack, Box, DropZone, Text } from '@shopify/polaris'
import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import { ALLOWED_PHOTO_SHOP_TYPES } from '~/constants/dropzone'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'
import { useExtractPSD } from '~/utils/extractPSD'

export function DropZoneComponent(props: WithTranslationProps) {
  const { t } = props

  const extracting = useStore(TemplateEditorStore, state => state.extracting)

  const { processLayersForRenderingAfterUploadingPSDFile } = useExtractPSD()

  return (
    <Box padding={'400'}>
      <BlockStack gap={'050'}>
        <Text as="p" variant="headingMd">
          {t('elements')}
        </Text>
        <DropZone
          onDrop={processLayersForRenderingAfterUploadingPSDFile}
          accept={ALLOWED_PHOTO_SHOP_TYPES.join(', ')}
          disabled={extracting}
          allowMultiple={false}
        >
          <DropZone.FileUpload actionTitle={t('upload-psd-file')} />
        </DropZone>
      </BlockStack>
    </Box>
  )
}

interface IDropZoneWithCustomPSDFileDialogProps {
  extracting: boolean
  openFileDialog: boolean
  onFileDialogClose: () => void
  handleDropZoneDrop: (files: File[], acceptedFiles: File[], rejectedFiles: File[]) => void
}

export function DropZoneWithCustomPSDFileDialog(props: IDropZoneWithCustomPSDFileDialogProps) {
  const { extracting, openFileDialog, handleDropZoneDrop, onFileDialogClose } = props

  return (
    <div style={{ display: 'none' }}>
      <DropZone
        accept={ALLOWED_PHOTO_SHOP_TYPES.join(', ')}
        disabled={extracting}
        allowMultiple={false}
        openFileDialog={openFileDialog}
        onDrop={handleDropZoneDrop}
        onFileDialogClose={onFileDialogClose}
      />
    </div>
  )
}
