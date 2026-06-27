import type { TFunction } from 'i18next'
import type { CouponDocument } from '~/models/Coupon'
import type { ColumnContentType } from '@shopify/polaris'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import numeral from 'numeral'
import { useMemo } from 'react'
import { UsageFeeComponent } from './UsageFee'
import { Card, DataTable, Text } from '@shopify/polaris'

export default function PricingTable(props: {
  t: TFunction
  plan: PricingPlanDocument
  coupon?: null | CouponDocument
}) {
  const { t, plan, coupon } = props

  // Generate rows for data table
  const rows = useMemo(
    () =>
      plan.usages.revenue?.map((item: any, idx: number) => [
        <Text as="span" key={`revenue-${idx}`}>
          {item.from
            ? item.to
              ? t('over-from-to-to', {
                  from: numeral(Math.floor(item.from)).format('$0,0'),
                  to: numeral(item.to).format('$0,0'),
                })
              : t('over-from', { from: numeral(item.from).format('$0,0') })
            : t('up-to-to', { to: numeral(item.to).format('$0,0') })}
        </Text>,
        <UsageFeeComponent t={t} tier={item} fee={item.totalFee} key={`usage-fee-${idx}`} inlineAlign="start" />,
        ...(coupon
          ? [
              <UsageFeeComponent
                t={t}
                tier={item}
                coupon={coupon}
                fee={item.totalFee}
                inlineAlign="start"
                showDiscountedOnly={true}
                key={`discounted-usage-fee-${idx}`}
              />,
            ]
          : []),
      ]),
    [coupon, plan, t]
  )

  return (
    <Card padding="0">
      <DataTable
        stickyHeader
        rows={rows}
        firstColumnMinWidth="200px"
        columnContentTypes={['text', 'text', ...(coupon ? (['text'] as ColumnContentType[]) : [])]}
        headings={[
          <Text as="strong" key="revenue">
            {t('monthly-app-generated-revenue')}
          </Text>,
          <div key="usage-fee" style={{ width: '205px' }}>
            <Text as="strong">{t('monthly-charge')}</Text>
          </div>,
          ...(coupon
            ? [
                <Text as="strong" key="usage-fee">
                  {t('discount')}
                </Text>,
              ]
            : []),
        ]}
      />
    </Card>
  )
}
