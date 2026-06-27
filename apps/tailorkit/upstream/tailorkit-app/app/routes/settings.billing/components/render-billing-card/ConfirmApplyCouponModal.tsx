import { Modal, BlockStack, Text, InlineStack } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import type { CouponDocument } from '~/models/Coupon'
import { APP_CHARGE_CURRENCY } from '~/constants/pricing'

interface IConfirmApplyCouponModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  coupon: CouponDocument | null
  loading: boolean
  t: TFunction
}

export default function ConfirmApplyCouponModal(props: IConfirmApplyCouponModalProps) {
  const { open, onClose, onConfirm, coupon, loading, t } = props

  if (!coupon) {
    return null
  }

  const { type, amount = 0 } = coupon.discount || {}
  const { limit } = coupon

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('confirm-apply-coupon')}
      primaryAction={{
        content: t('confirm-apply'),
        onAction: onConfirm,
        loading,
        destructive: false,
      }}
      secondaryActions={[
        {
          content: t('cancel'),
          onAction: onClose,
          disabled: loading,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd">
            {t('confirm-apply-coupon-message')}
          </Text>

          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text as="span" fontWeight="semibold">
                {t('coupon')}:
              </Text>
              <Text as="span">{coupon.code}</Text>
            </InlineStack>

            <InlineStack align="space-between">
              <Text as="span" fontWeight="semibold">
                {t('discount')}:
              </Text>
              <Text as="span">{type === 'percent' ? `${amount}%` : `${APP_CHARGE_CURRENCY}${amount}`}</Text>
            </InlineStack>

            {limit?.discountEndsAfter && (
              <InlineStack align="space-between">
                <Text as="span" fontWeight="semibold">
                  {t('duration')}:
                </Text>
                <Text as="span">
                  {limit.discountEndsAfter > 1
                    ? t('num-months', { num: limit.discountEndsAfter })
                    : t('the-first-month')}
                </Text>
              </InlineStack>
            )}
          </BlockStack>
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
