import { useNavigate } from '@remix-run/react'
import { Modal } from '@shopify/polaris'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { EModal } from '~/constants/enum'
import { useModal } from '~/utils/hooks/useModal'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'

const MODAL_KEY = EModal.FREE_LIMIT_ORDERS_HAVE_ENDED

export default function ModalShowFreeLimitOrdersEnded() {
  const { t } = useTranslation()

  const { state, closeModal } = useModal()

  const navigate = useNavigate()

  const onClose = useCallback(() => {
    closeModal(MODAL_KEY)
  }, [closeModal])

  const active = state[MODAL_KEY]?.active

  return (
    // Prevent page scroll when modal is open
    (
      usePreventPageScroll(!!active),
      (
        <Modal
          open={active}
          onClose={onClose}
          title={t('free-limit-orders-have-ended')}
          primaryAction={{
            content: t('select-plan'),
            onAction: () => {
              // Close modal
              closeModal(MODAL_KEY)

              // Navigate to pricing screen
              navigate('/pricing')
            },
          }}
          secondaryActions={[
            {
              content: t('cancel'),
              onAction: onClose,
            },
          ]}
        >
          <Modal.Section>
            <p>{t('free-limit-orders-have-ended-description')}</p>
          </Modal.Section>
        </Modal>
      )
    )
  )
}
