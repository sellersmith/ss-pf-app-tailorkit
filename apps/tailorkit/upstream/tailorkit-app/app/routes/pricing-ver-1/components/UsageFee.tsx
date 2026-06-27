import type { InlineStackProps, TextProps } from '@shopify/polaris'
import { BlockStack, InlineStack, Text } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import numeral from 'numeral'
import type { CouponDocument } from '~/models/Coupon'
import { calculateCouponDiscount } from '../../api.pricing/utils/fns'

export function UsageFeeComponent(props: {
  t: TFunction
  fee?: number
  tier?: any
  coupon?: CouponDocument | null
  tone?: TextProps['tone']
  fontWeight?: TextProps['fontWeight']
  discountTone?: TextProps['tone']
  discountFontWeight?: TextProps['fontWeight']
  inlineAlign?: InlineStackProps['align']
  showDiscountedOnly?: boolean
}) {
  const {
    t,
    fee,
    tier,
    coupon,
    tone,
    fontWeight,
    discountTone,
    discountFontWeight,
    inlineAlign = 'end',
    showDiscountedOnly = false,
  } = props

  return (
    <BlockStack gap="100">
      <InlineStack gap="100" align={inlineAlign}>
        {!coupon || (coupon && !showDiscountedOnly) ? (
          <Text
            as="span"
            tone={tone}
            key="usage-fee"
            fontWeight={fontWeight}
            {...(coupon ? { textDecorationLine: 'line-through' } : {})}
          >
            {numeral(fee).format('$0,0.00')}
          </Text>
        ) : null}
        {coupon ? (
          fee ? (
            <Text
              as="h3"
              key="usage-fee-discount"
              tone={discountTone || (showDiscountedOnly ? undefined : 'success')}
              fontWeight={discountFontWeight || (showDiscountedOnly ? undefined : 'bold')}
            >
              {t('amount-duration', {
                amount: numeral(calculateCouponDiscount(coupon, fee)).format('$0,0.00'),
                duration:
                  fee && coupon?.limit?.discountEndsAfter
                    ? coupon.limit.discountEndsAfter === 1
                      ? t('first-month')
                      : t('num-months', { num: coupon.limit.discountEndsAfter })
                    : '',
              })}
            </Text>
          ) : (
            '—'
          )
        ) : null}
      </InlineStack>
      {tier?.revenueShare && !showDiscountedOnly && (
        <div style={{ maxWidth: '205px', whiteSpace: 'initial' }}>
          {t('percent-on-revenue-over-threshold-capped-at-amount', {
            percent: tier.revenueShare,
            threshold: numeral(tier.from).format('$0,0'),
            amount: numeral(tier.cappedAmount).format('$0,0'),
          })}
        </div>
      )}
    </BlockStack>
  )
}
