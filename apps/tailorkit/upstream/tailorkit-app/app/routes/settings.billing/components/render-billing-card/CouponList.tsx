import { BlockStack, Card, InlineStack, Text, Button, Badge, Tooltip } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import type { CouponDocument } from '~/models/Coupon'
import { APP_CHARGE_CURRENCY } from '~/constants/pricing'

interface ICouponListProps {
  coupons: CouponDocument[]
  appliedCouponCode: string | null | undefined
  onApplyCoupon: (coupon: CouponDocument) => void
  hasValidAppliedCoupon: boolean
  t: TFunction
}

export default function CouponList(props: ICouponListProps) {
  const { coupons, appliedCouponCode, onApplyCoupon, hasValidAppliedCoupon, t } = props

  return (
    <BlockStack gap="300">
      {coupons.map(coupon => {
        const isApplied = coupon.code === appliedCouponCode
        const isDisabled = hasValidAppliedCoupon && !isApplied
        const { type, amount = 0 } = coupon.discount || {}
        const { limit } = coupon

        const durationText = limit?.discountEndsAfter
          ? limit.discountEndsAfter > 1
            ? t('num-months', { num: limit.discountEndsAfter })
            : t('the-first-month')
          : t('lifetime')

        const actionButton = isApplied ? (
          <Badge tone="success">{t('applied')}</Badge>
        ) : (
          <Button size="slim" onClick={() => onApplyCoupon(coupon)} disabled={isDisabled}>
            {t('apply-coupon')}
          </Button>
        )

        return (
          <Card key={coupon.code}>
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="h3" variant="headingSm">
                    {coupon.code}
                  </Text>
                  {coupon.name && (
                    <Text as="span" variant="bodySm" tone="subdued">
                      - {coupon.name}
                    </Text>
                  )}
                </InlineStack>
                <Text as="p" variant="bodySm">
                  {t('amount-off-coupon-for-lifetime', {
                    amount: type === 'percent' ? `${amount}%` : `${APP_CHARGE_CURRENCY}${amount}`,
                    lifetime: durationText,
                  })}
                </Text>
              </BlockStack>

              {isDisabled ? (
                <Tooltip content={t('coupon-already-applied')} preferredPosition="above">
                  <div>{actionButton}</div>
                </Tooltip>
              ) : (
                actionButton
              )}
            </InlineStack>
          </Card>
        )
      })}
    </BlockStack>
  )
}
