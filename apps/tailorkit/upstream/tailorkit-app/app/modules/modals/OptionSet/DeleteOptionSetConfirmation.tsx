import { Modal } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import type { OptionSet } from '~/types/psd'

interface IDeleteOptionSetConfirmationProps {
  confirmDelete: boolean
  optionSet: OptionSet
  setConfirmDelete: (value: boolean) => void
  handleDelete: (confirmed?: boolean) => void
}

export const DeleteOptionSetConfirmationModal = ({
  confirmDelete,
  optionSet,
  setConfirmDelete,
  handleDelete,
}: IDeleteOptionSetConfirmationProps) => {
  const { t } = useTranslation()

  return (
    <Modal
      open={confirmDelete}
      title={t('delete-option-set')}
      onClose={() => setConfirmDelete(false)}
      primaryAction={{
        destructive: true,
        content: t('delete'),
        onAction: () => handleDelete(true),
      }}
      secondaryActions={[
        {
          content: t('cancel'),
          onAction: () => setConfirmDelete(false),
        },
      ]}
    >
      <Modal.Section>
        {t('are-you-sure-you-want-to-delete-the-option-set-name', { name: optionSet.label })}
      </Modal.Section>
    </Modal>
  )
}
