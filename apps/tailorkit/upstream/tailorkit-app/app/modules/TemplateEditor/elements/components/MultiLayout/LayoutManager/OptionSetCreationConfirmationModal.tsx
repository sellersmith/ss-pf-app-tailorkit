import { Modal, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

interface IOptionSetCreationConfirmationModalProps {
  active: boolean
  onClose: () => void
  onCreate: () => void
}

function OptionSetCreationConfirmationModal(props: IOptionSetCreationConfirmationModalProps) {
  const { active, onClose, onCreate } = props

  const { t } = useTranslation()

  return (
    <Modal
      open={active}
      onClose={onClose}
      title={t('create-option-set')}
      primaryAction={{
        content: t('continue'),
        onAction: onClose,
      }}
      secondaryActions={[
        {
          content: t('return'),
          onAction: onCreate,
        },
      ]}
    >
      <Modal.Section>
        <Text as="p" variant="bodyMd">
          {t(
            'some-layers-lack-option-sets-do-you-want-to-continue-generating-layouts-or-return-to-creating-option-sets'
          )}
        </Text>
      </Modal.Section>
    </Modal>
  )
}

export default OptionSetCreationConfirmationModal
