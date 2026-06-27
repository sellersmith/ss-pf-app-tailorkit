import { BlockStack, Box, InlineStack, Text } from '@shopify/polaris'
import type { TasAnalyticsValues } from '../types'
import { useMemo } from 'react'
import { MinusIcon } from '@shopify/polaris-icons'
import { TrendIndicator } from '@shopify/polaris-viz'
import { type ShopDocument } from '~/models/Shop'
import { formatShopifyPrice } from '~/shopify/fns'
import { useTranslation } from 'react-i18next'

export default function ChartCardHeader(props: {
  item: TasAnalyticsValues
  loading: boolean
  showMoney: boolean
  isCompared: boolean
  overallData: { sum: number; percent: number }
  shopData: ShopDocument
  isShowMoney?: boolean
  isEmpty?: boolean
}) {
  const { t } = useTranslation()
  const { item, loading, isCompared, overallData, shopData, isShowMoney, isEmpty } = props
  const { title } = item
  const shopifyMoneyFormat = shopData?.shopConfig?.money_format || ''

  const renderComparison = useMemo(() => {
    if (!isCompared) return null

    if (!overallData.percent) {
      return <MinusIcon width={20} height={20} fill="var(--p-color-icon-secondary)" />
    }

    const isDesc = overallData.percent < 0
    const direction = isDesc ? 'downward' : 'upward'

    return (
      <div className={`analytics-TrendIndicator ${direction}`}>
        <TrendIndicator
          value={`${overallData.percent}%`}
          direction={direction}
          trend={isDesc ? 'negative' : 'positive'}
        />
      </div>
    )
  }, [isCompared, overallData.percent])

  const renderTotalValue = useMemo(() => {
    const total = overallData.sum
    if (!total) {
      return <MinusIcon width={20} height={20} fill="var(--p-color-icon-secondary)" />
    }

    return (
      <Text variant="headingLg" as="h3">
        {isShowMoney ? formatShopifyPrice(shopifyMoneyFormat, total) : total}
      </Text>
    )
  }, [isShowMoney, overallData.sum, shopifyMoneyFormat])

  return (
    <BlockStack gap={'200'}>
      <InlineStack>
        <Text variant="headingMd" as="h6">
          <Box borderBlockEndWidth="025" borderColor="border" borderStyle="dashed">
            {t(title)}
          </Box>
        </Text>
      </InlineStack>
      {!loading && !isEmpty && (
        <InlineStack blockAlign="center" gap={'200'}>
          {renderTotalValue}
          {renderComparison}
        </InlineStack>
      )}
    </BlockStack>
  )
}
