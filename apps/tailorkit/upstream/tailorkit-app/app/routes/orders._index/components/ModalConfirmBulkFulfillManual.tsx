import type { ModalProps } from '@shopify/polaris'
import { Modal } from '@shopify/polaris'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'
import { useTranslation } from 'react-i18next'

interface IModalConfirmBulkFulfillManualProps {
  onPrimaryAction: any
  onPrimaryActionLoading: boolean
}

function ModalConfirmBulkFulfillManual(props: IModalConfirmBulkFulfillManualProps & ModalProps) {
  const { t } = useTranslation()
  // Determine open flag from incoming props to apply scroll-prevention consistently
  const open = (props as any).open ?? (props as any).active ?? false
  usePreventPageScroll(!!open)

  return (
    <Modal
      {...props}
      primaryAction={{
        content: t('request-fulfillment'),
        loading: props.onPrimaryActionLoading,
        onAction: props.onPrimaryAction,
      }}
      secondaryActions={[
        {
          content: t('cancel'),
          onAction: props.onClose,
        },
      ]}
    >
      <Modal.Section>
        <p>These orders will be fulfilling in background. You can escape this screen after fulfilling</p>
      </Modal.Section>
    </Modal>
  )
}

export default ModalConfirmBulkFulfillManual
