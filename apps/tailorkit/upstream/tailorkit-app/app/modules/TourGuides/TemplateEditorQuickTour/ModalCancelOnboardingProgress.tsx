import { useTranslation } from 'react-i18next'
import { useModal } from '~/utils/hooks/useModal'
import { Modal } from '@shopify/polaris'

interface IModalCancelOnboardingProgressProps {
  modalKey: string
  onPrimaryAction: () => void
  onSecondaryAction: () => void
}

function ModalCancelOnboardingProgress(props: IModalCancelOnboardingProgressProps) {
  const { modalKey, onPrimaryAction, onSecondaryAction } = props
  const { state } = useModal()

  const { t } = useTranslation()

  const active = state[modalKey]?.active

  return (
    <Modal
      open={active}
      onClose={onPrimaryAction}
      title={t('cancel-onboarding-progress')}
      primaryAction={{
        content: t('continue-onboarding'),
        onAction: onPrimaryAction,
      }}
      secondaryActions={[
        {
          content: t('skip'),
          onAction: onSecondaryAction,
        },
      ]}
    >
      <Modal.Section>
        <p>{t('cancel-onboarding-progress-description')}</p>
      </Modal.Section>
    </Modal>
  )
}

export default ModalCancelOnboardingProgress
