import { BlockStack, Box, Card, EmptySearchResult, InlineStack, Spinner } from '@shopify/polaris'
import type { TasAnalyticsValues } from '../types'
import ChartCardHeader from './ChartCardHeader'
import { useTranslation } from 'react-i18next'
import Chart from './Chart'
import { useFetchAnalyticsData } from '../hooks/useFetchAnalyticsData'
import { type IDateRangePickerState } from './DateRangePicker'
import { ECardType, EOptionsComparing } from '../constants'
import { type ShopDocument } from '~/models/Shop'
import { useMemo } from 'react'

export default function ChartCard(props: {
  chartKey: string
  item: TasAnalyticsValues
  dateRange: IDateRangePickerState
  comparedToRange: IDateRangePickerState & { value: string }
  shopData: ShopDocument
}) {
  const { item, dateRange, comparedToRange, chartKey, shopData } = props
  const { cardType, url, isShowMoney } = item

  const { t } = useTranslation()
  const isComparison = comparedToRange.value !== EOptionsComparing.NO_COMPARISON && cardType === ECardType.LINE_CHART
  const { loading, data, comparedData, overallData, isEmpty } = useFetchAnalyticsData({
    url,
    chartKey,
    chartType: cardType,
    dateRange,
    comparedToRange: isComparison ? comparedToRange : undefined,
  })
  const chartData = useMemo(
    () => (isComparison ? [...data, ...comparedData] : data),
    [comparedData, data, isComparison]
  )

  return (
    <Card>
      <BlockStack gap={'400'}>
        <ChartCardHeader
          item={item}
          loading={loading}
          showMoney={chartKey === 'revenue'}
          isCompared={isComparison}
          overallData={overallData}
          shopData={shopData}
          isShowMoney={isShowMoney}
          isEmpty={chartData.length === 0 || isEmpty}
        />
        {loading ? (
          <Box padding={'1600'}>
            <InlineStack align="center">
              <Spinner size="small" />
            </InlineStack>
          </Box>
        ) : !isEmpty ? (
          <Chart
            cardType={cardType}
            data={chartData}
            dateRangePicker={dateRange}
            shopData={shopData}
            isShowMoney={isShowMoney}
          />
        ) : (
          <Box padding={'1000'}>
            <EmptySearchResult
              withIllustration
              title={t('no-data-found')}
              description={t('there-was-no-data-found-for-this-range')}
            />
          </Box>
        )}
      </BlockStack>
    </Card>
  )
}
