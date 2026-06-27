import { BlockStack, Modal, Text, TextField } from '@shopify/polaris'
import { useCallback, useState } from 'react'
import { authenticatedFetch } from '~/shopify/fns.client'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'
import { ORDER_ACTION } from '~/routes/api.orders/constants'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'

interface Props {
  open: boolean
  onClose: () => void
  onSynced: () => void
  t: (key: string) => string
}

/**
 * Modal for manually syncing a Shopify order by its ID or order number.
 * Used when an order wasn't captured by webhooks (e.g., server error during processing).
 */
export default function SyncOrderModal(props: Props) {
  const { open, onClose, onSynced, t } = props

  const [orderId, setOrderId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleOrderIdChange = useCallback(
    (val: string) => {
      setOrderId(val.replace(/[^0-9#]/g, ''))
      if (error) setError('')
    },
    [error]
  )

  const handleClose = useCallback(() => {
    setOrderId('')
    setError('')
    setLoading(false)
    onClose()
  }, [onClose])

  const handleSubmit = useCallback(async () => {
    const trimmed = orderId.trim()

    if (!trimmed) {
      setError(t('order-id-is-required'))
      return
    }

    setError('')
    setLoading(true)

    try {
      showToast(t(TOAST.ORDER.SYNCING))

      const result = await authenticatedFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: ORDER_ACTION.SYNC_ORDER,
          shopifyOrderId: trimmed,
        }),
      })

      if (result?.success) {
        showToast(t(TOAST.ORDER.SYNCED))
        handleClose()
        onSynced()
      } else {
        const message = result?.message || t('failed-to-sync-order')
        setError(message)
        showToast(t(TOAST.ORDER.SYNC_FAILED), { isError: true })
      }
    } catch {
      setError(t('an-unexpected-error-occurred-please-try-again'))
      showToast(t(TOAST.ORDER.SYNC_FAILED), { isError: true })
    } finally {
      setLoading(false)
    }
  }, [orderId, t, handleClose, onSynced])

  usePreventPageScroll(open)

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('sync-order-from-shopify')}
      primaryAction={{
        content: t('sync-order'),
        onAction: handleSubmit,
        loading,
        disabled: !orderId.trim(),
      }}
      secondaryActions={[{ content: t('cancel'), onAction: handleClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd">
            {t(
              'enter-the-shopify-order-id-or-order-number-to-sync-it-into-tailorkit-useful-when-an-order-was-not-automatically-captured'
            )}
          </Text>
          <TextField
            label={t('shopify-order-id-or-order-number')}
            value={orderId}
            onChange={handleOrderIdChange}
            placeholder="e.g. 5551234567890 or #1719"
            helpText={t('you-can-use-the-full-shopify-order-id-or-the-order-number-shown-in-shopify-e-g-1719-or-1719')}
            autoComplete="off"
            error={error}
            disabled={loading}
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
