import { Modal, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'

export const UnfinishedImportNotification = (props: {
  active: boolean
  onContinueToEdit: () => void
  onContinueToImport: () => void
  onClose: () => void
}) => {
  const { active, onContinueToEdit, onContinueToImport, onClose } = props
  const { t } = useTranslation()

  return (
    <Modal
      open={active}
      title={t('confirm-import')}
      onClose={onClose}
      primaryAction={{
        content: t('continue'),
        onAction: onContinueToEdit,
      }}
      secondaryActions={[
        {
          content: t('discard'),
          onAction: onContinueToImport,
          destructive: true,
          plain: true,
        },
      ]}
    >
      <Modal.Section>
        <Text as="p" variant="bodyMd">
          {t(
            'you-have-unfinished-imported-products-would-you-like-to-continue-with-these-products-or-start-a-new-import'
          )}
        </Text>
      </Modal.Section>
    </Modal>
  )
}
