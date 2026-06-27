import { useNavigate } from '@remix-run/react'
import { Banner, BlockStack, DropZone, Frame, InlineStack, List, Modal, Text, Thumbnail } from '@shopify/polaris'
import { useCallback, useState } from 'react'
import { openIDBDatabase, storeFileToIDB } from '~/bootstrap/db/index-db'
import { ModalWithoutBackdropAction } from '~/components/common/Modal/ModalWithoutBackdropAction'
import { PHOTOSHOP_THUMBNAIL } from '~/constants/assets-url'
import { ALLOWED_PHOTO_SHOP_TYPES } from '~/constants/dropzone'
import { CanvasErrors } from '~/constants/errors'
import { IDB_DATABASE_NAME, IDB_STORE_NAME } from '~/constants/index-db'
import { PSD_TEMPLATE, type TEMPLATE_TYPES } from '~/constants/template'
import { formatBytes } from '~/utils/formatBytes'
import { showGenericErrorToast } from '~/utils/toastEvents'
import { uuid } from '~/utils/uuid'

interface IModalUpdatePSDFileProps {
  active: boolean
  toggleModalCreateTemplate: (type: TEMPLATE_TYPES) => void
  t: any
}

export default function ModalUpdatePSDFile(props: IModalUpdatePSDFileProps) {
  const { active, toggleModalCreateTemplate, t } = props
  const navigate = useNavigate()

  const handleChange = useCallback(() => toggleModalCreateTemplate(PSD_TEMPLATE), [toggleModalCreateTemplate])
  const [rejectedFiles, setRejectedFiles] = useState<File[]>([])
  const [psdFile, setPsdFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const hasError = rejectedFiles.length > 0

  const fileUpload = !psdFile && <DropZone.FileUpload actionTitle={t('upload-psd-file')} />

  const uploadedFiles = psdFile && (
    <div style={{ height: '100%', display: 'grid', placeContent: 'center' }}>
      <InlineStack align="center">
        <InlineStack gap={'200'}>
          <Thumbnail size="small" alt={psdFile.name} source={PHOTOSHOP_THUMBNAIL} />
          <BlockStack>
            <Text as="p" variant="bodyLg">
              {psdFile.name}
            </Text>
            <Text variant="bodySm" as="p">
              {formatBytes(psdFile.size)}
            </Text>
          </BlockStack>
        </InlineStack>
      </InlineStack>
    </div>
  )

  const errorMessage = hasError && (
    <Banner title="The following images couldn’t be uploaded:" tone="critical">
      <List type="bullet">
        {rejectedFiles.map((file, index) => (
          <List.Item key={index}>{`"${file.name}" is not supported. File type must be .psd`}</List.Item>
        ))}
      </List>
    </Banner>
  )

  const handleDropZoneDrop = useCallback(async (_dropFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) => {
    try {
      if (_rejectedFiles.length > 0) {
        setRejectedFiles(_rejectedFiles)
      } else {
        setRejectedFiles([])
      }

      const acceptedFile = acceptedFiles[0]
      if (!acceptedFile) {
        throw new Error(CanvasErrors.INVALID_FILE)
      }

      setPsdFile(acceptedFile)
    } catch (e) {
      console.error(e)

      showGenericErrorToast()
    }
  }, [])

  const onCreateTemplateFromPSDFile = useCallback(async () => {
    if (!psdFile) return

    setLoading(true)

    const id = uuid()

    const file = psdFile
    const storeName = IDB_STORE_NAME.PSD_FILE

    try {
      const db = await openIDBDatabase(IDB_DATABASE_NAME.PSD, storeName)
      await storeFileToIDB(db, storeName, file, id, file.name)
      console.log('File stored successfully')

      setLoading(false)

      navigate(`/templates/${id}?source=psd&content=${id}`)

      handleChange()
    } catch (error) {
      setLoading(false)

      showGenericErrorToast()
      console.error('Error storing file:', error)
    }
  }, [navigate, psdFile, handleChange])

  return (
    <Frame>
      <ModalWithoutBackdropAction
        open={active}
        onClose={handleChange}
        title={t('upload-your-design')}
        primaryAction={{
          content: t('create'),
          loading,
          disabled: !psdFile,
          onAction: onCreateTemplateFromPSDFile,
        }}
        secondaryActions={[
          {
            content: t('cancel'),
            onAction: handleChange,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            {errorMessage}

            <DropZone onDrop={handleDropZoneDrop} accept={ALLOWED_PHOTO_SHOP_TYPES.join(', ')} allowMultiple={false}>
              {uploadedFiles}
              {fileUpload}
            </DropZone>
          </BlockStack>
        </Modal.Section>
      </ModalWithoutBackdropAction>
    </Frame>
  )
}
