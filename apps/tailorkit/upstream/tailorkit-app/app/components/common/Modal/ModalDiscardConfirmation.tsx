import { Modal } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { Fragment } from 'react/jsx-runtime'

export const DISCARD_CONFIRMATION_MODAL_ID = 'discard-confirmation-modal'

interface ModalDiscardConfirmationProps {
  active: boolean
  handleChange: () => void
  onDiscard: () => void
}

export default function ModalDiscardConfirmation({ active, handleChange, onDiscard }: ModalDiscardConfirmationProps) {
  const { t } = useTranslation()

  return (
    <Fragment>
      <Modal
        open={active}
        onClose={handleChange}
        title={t('discard-confirmation-modal-title')}
        primaryAction={{
          content: t('discard-changes'),
          destructive: true,
          onAction: onDiscard,
        }}
        secondaryActions={[
          {
            content: t('continue-editing'),
            onAction: handleChange,
          },
        ]}
      >
        <Modal.Section>
          <p>{t('discard-confirmation-modal-message')}</p>
        </Modal.Section>
      </Modal>
    </Fragment>
  )
}
