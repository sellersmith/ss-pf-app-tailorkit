import { BlockStack, Modal, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import ProgressBarComponent from '~/components/common/ProgressBarState'
import { useStore } from '~/libs/external-store'
import { ProgressStore } from '~/stores/canvas/progress'
import { useCallback, useMemo } from 'react'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'

export function ImageUploaderModalProgress() {
  const { t } = useTranslation()
  const { state, closeModal } = useModal()
  const modalActive = state[MODAL_ID.BACKGROUND_PROGRESS_UPLOADER_MODAL]?.active

  const index = useStore(ProgressStore, state => state.index)
  const total = useStore(ProgressStore, state => state.total)

  const progress = useMemo(() => {
    return total > 0 ? (index / total) * 100 : 0
  }, [index, total])

  const isProgressing = useMemo(() => {
    return total > 0 && progress < 100
  }, [total, progress])

  const handleCloseModal = useCallback(() => {
    closeModal(MODAL_ID.BACKGROUND_PROGRESS_UPLOADER_MODAL)
  }, [closeModal])

  return (
    <Modal
      open={modalActive}
      title={t('uploading-background')}
      onClose={handleCloseModal}
      primaryAction={{
        content: t('done'),
        disabled: isProgressing,
        onAction: handleCloseModal,
      }}
    >
      <Modal.Section>
        <BlockStack gap={'100'}>
          <Text as="p" variant="bodyMd">
            {t('some-files-are-uploading-this-may-take-a-few-minutes')}
          </Text>

          <ProgressBarComponent progress={progress} tone="success" size="medium" />
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
