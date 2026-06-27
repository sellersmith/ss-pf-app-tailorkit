import { Modal, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

interface IWarningModal {
  active: boolean
  onClose: () => void
  onConfirmChange: () => void
}

export const WarningSwitchCreateOptionSetModal = (props: IWarningModal) => {
  const { active, onClose, onConfirmChange } = props
  const { t } = useTranslation()

  const handleChange = () => {
    onConfirmChange()
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  return (
    <Modal
      open={active}
      title={t('change-your-selection')}
      onClose={onClose}
      primaryAction={{
        content: t('change'),
        onAction: handleChange,
      }}
      secondaryActions={[
        {
          content: t('cancel'),
          onAction: handleCancel,
        },
      ]}
    >
      <Modal.Section titleHidden>
        <Text as="p" variant="bodyMd">
          {t('once-you-change-your-selection-the-results-of-previous-choice-will-disappear')}
        </Text>
      </Modal.Section>
    </Modal>
  )
}
