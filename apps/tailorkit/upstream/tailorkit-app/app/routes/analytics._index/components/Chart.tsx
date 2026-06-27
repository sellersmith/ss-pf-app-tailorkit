import { BarChart, type DataSeries, LineChart } from '@shopify/polaris-viz'
import { ECardType } from '../constants'
import { useCallback, useMemo } from 'react'
import { differenceInDays, formatDate } from 'date-fns'
import { type IDateRangePickerState } from './DateRangePicker'
import { type ShopDocument } from '~/models/Shop'
import { formatShopifyPrice } from '~/shopify/fns'
import { useTranslation } from 'react-i18next'
import { BlockStack, InlineStack, Text } from '@shopify/polaris'
import { getTotalValuesFromDateRange } from '../utilities/getTotalValuesFromDateRange'

export default function Chart(props: {
  cardType: ECardType.BAR_CARD | ECardType.LINE_CHART
  data: DataSeries[]
  dateRangePicker: IDateRangePickerState
  shopData: ShopDocument
  isShowMoney?: boolean
}) {
  const { cardType, data, dateRangePicker, shopData, isShowMoney } = props
  const { startDate, endDate } = dateRangePicker
  const shopifyMoneyFormat = shopData?.shopConfig?.money_format || ''
  const { t } = useTranslation()
  const barChartData = useMemo(() => data.slice(-3), [data])

  const getFormatIndex = useCallback((differenceDays: number) => {
    if (differenceDays <= 3) return 0
    if (differenceDays <= 90) return 1
    return 2
  }, [])

  const formatDateLabelWrapper = useCallback(
    (label: string | number | null, formatType: 'tooltip' | 'label') => {
      try {
        if (!label) return ''

        const differenceDays = differenceInDays(endDate, startDate)
        const date = new Date(label)

        const formats = {
          tooltip: ['MMM d, hh:mm a', 'MMM d, yyyy', 'MMM, yyyy'],
          label: ['hh:mm a', 'MMM d', 'MMM yyyy'],
        }

        const formatIndex = getFormatIndex(differenceDays)
        return formatDate(date, formats[formatType][formatIndex])
      } catch (err) {
        return `${label}`
      }
    },
    [endDate, startDate, getFormatIndex]
  )

  const formatValue = useCallback(
    (value: number): string => {
      if (isShowMoney) {
        return formatShopifyPrice(shopifyMoneyFormat, value)
      }

      return `${value || 0}`
    },
    [isShowMoney, shopifyMoneyFormat]
  )

  if (cardType === ECardType.LINE_CHART) {
    return (
      <LineChart
        hideLegendOverflow
        data={data}
        tooltipOptions={{
          valueFormatter: value => {
            const _value = !isNaN(Number(value)) ? Number(value) : 0
            return formatValue(_value)
          },
          titleFormatter: title => {
            return formatDateLabelWrapper(title, 'tooltip')
          },
        }}
        xAxisOptions={{
          labelFormatter: value => formatDateLabelWrapper(value, 'label'),
        }}
      />
    )
  }

  return (
    <BarChart
      data={barChartData}
      type="stacked"
      seriesNameFormatter={value => `${value}`.split('(compared)')[0]}
      tooltipOptions={{
        keyFormatter: key => {
          return `${key}`
        },
        valueFormatter: value => {
          return formatValue(Number(value))
        },
        // @ts-ignore
        titleFormatter: title => {
          const totalValuesData = getTotalValuesFromDateRange(data, { startDate, endDate })
          const totalByTitle = totalValuesData.find(d => d?.dateKey === title)?.totalValues || 0

          const totalValuesTopData = getTotalValuesFromDateRange(barChartData, { startDate, endDate })
          const totalValuesTopDataByTitle = totalValuesTopData.find(d => d?.dateKey === title)?.totalValues || 0

          return (
            <BlockStack gap={'100'}>
              <InlineStack align="space-between">
                <Text as="p" variant="bodySm" tone="subdued" fontWeight="medium">
                  {formatDateLabelWrapper(title, 'label')}
                </Text>
                <Text
                  as="p"
                  variant="bodySm"
                  tone="subdued"
                  fontWeight="medium"
                >{`${t('total')} ${formatValue(totalByTitle)}`}</Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text as="p" variant="bodySm" tone="subdued">
                  {t('top-03')}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {formatValue(totalValuesTopDataByTitle)}
                </Text>
              </InlineStack>
            </BlockStack>
          )
        },
      }}
      xAxisOptions={{
        labelFormatter: value => formatDateLabelWrapper(value, 'label'),
        allowLineWrap: true,
      }}
    />
  )
}
