import { BlockStack, List, Modal, Text } from '@shopify/polaris'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'
import { uploadFontStateStore } from '../FontUploaderModal'
import { useStore } from '~/libs/external-store'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'

export default function ViewDetailedResultFontModal() {
  const { t } = useTranslation()
  const { state: modalState, closeModal, openModal } = useModal()
  const uploadFontState = useStore(uploadFontStateStore, state => state)
  const { files, invalidFiles, fileUploaded } = uploadFontState

  const active = modalState[MODAL_ID.UPLOAD_FONTS_RESULT_MODAL]?.active

  // Prevent page scroll when modal is open
  usePreventPageScroll(!!active)

  const errorFilesFormatted = useMemo(
    () =>
      invalidFiles
        .map(file => ({
          id: file.name,
          url: '',
          alt: file.name,
          errorMessage: t(file.reason === 'type' ? 'invalid-file-type' : 'file-too-large'),
        }))
        .sort((a, b) => a.alt.localeCompare(b.alt)),
    [invalidFiles, t]
  )
  const onClose = useCallback(() => {
    // Get the context to return to from result modal data
    const returnContext = modalState[MODAL_ID.UPLOAD_FONTS_RESULT_MODAL]?.data?.returnContext
    closeModal(MODAL_ID.UPLOAD_FONTS_RESULT_MODAL)
    uploadFontStateStore.dispatch({ type: 'CLEAR_STATE' })
    openModal(MODAL_ID.UPLOAD_FONTS_MODAL, returnContext)
  }, [closeModal, openModal, modalState])

  return (
    <Modal
      open={active}
      title={t('font-upload-result')}
      onClose={onClose}
      primaryAction={{
        content: t('close'),
        onAction: onClose,
      }}
    >
      <Modal.Section>
        <BlockStack gap={'200'}>
          <Text as="p" variant="bodyMd" fontWeight="medium">
            {t('fonts-successfully-uploaded')}:&nbsp;{fileUploaded}/{files.length + invalidFiles.length}
          </Text>
          <Text as="p" variant="bodyMd" fontWeight="medium">
            {t('fonts-unsuccessfully-uploaded')}:&nbsp;{invalidFiles.length}/{files.length + invalidFiles.length}
          </Text>
          <List>
            {errorFilesFormatted.map(item => (
              <List.Item key={item.id}>
                <Text as="p" variant="bodyMd" truncate>
                  {item.alt}&nbsp;({t('reason')}:&nbsp;{item.errorMessage})
                </Text>
              </List.Item>
            ))}
          </List>
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
