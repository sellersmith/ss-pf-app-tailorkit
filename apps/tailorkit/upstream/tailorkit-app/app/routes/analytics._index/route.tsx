import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import withNavMenu from '~/bootstrap/hoc/withNavMenu'
import { BlockStack, InlineGrid, Page } from '@shopify/polaris'
import { HydrateFallback } from '~/routes/dashboard/route'
import polarisVizStyles from '@shopify/polaris-viz/build/esm/styles.css?url'
import analyticsStyles from './styles.css?url'
import { useTranslation } from 'react-i18next'
import { PolarisVizProvider } from '@shopify/polaris-viz'
import ChartCard from './components/ChartCard'
import { getChartEntriesDataByChartType } from './utilities/initialChartData'
import { useLocation } from '@remix-run/react'
import { useLayoutEffect, useMemo, useState } from 'react'
import { type IDateRangePickerState } from './components/DateRangePicker'
import AnalyticsChartHeader from './components/AnalyticsChartHeader'
import { ECardType, EOptionsComparing, NO_COMPARE_LABEL_KEY, todayRange } from './constants'
import { getInitialDateRangePicker } from './utilities/getInitialDateRangePicker'
import { useRootLoaderData } from '~/root'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'

export { HydrateFallback }
export const links = () => [
  { rel: 'stylesheet', href: polarisVizStyles },
  { rel: 'stylesheet', href: analyticsStyles },
]

const Index = withNavMenu(function Index(props: WithTranslationProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const { shopData } = useRootLoaderData()
  const initDateRangePicker = useMemo(() => getInitialDateRangePicker(t, location), [t, location])

  const lineChartDataEntries = useMemo(() => {
    return getChartEntriesDataByChartType(ECardType.LINE_CHART) || []
  }, [])

  const barChartDataEntries = useMemo(() => {
    return getChartEntriesDataByChartType(ECardType.BAR_CARD) || []
  }, [])

  const [comparedToRange, setComparedToRange] = useState<IDateRangePickerState & { value: string }>({
    ...todayRange,
    label: t(NO_COMPARE_LABEL_KEY),
    value: EOptionsComparing.NO_COMPARISON,
  })
  const [dateRangePicker, setDateRangePicker] = useState<IDateRangePickerState>(initDateRangePicker)

  const { trackEvent } = useEventsTracking()

  useLayoutEffect(() => {
    trackEvent(EVENTS_TRACKING.OPEN_ANALYTICS_INDEX)
  }, [trackEvent])

  return (
    <PolarisVizProvider>
      <Page title={t('analytics')} fullWidth>
        <BlockStack gap={'400'}>
          <AnalyticsChartHeader
            dateRangePicker={dateRangePicker}
            setDateRangePicker={setDateRangePicker}
            compared={comparedToRange}
            setCompared={setComparedToRange}
          />
          <InlineGrid columns={{ xs: 1, md: 'repeat(2, 1fr)' }} gap="500">
            {lineChartDataEntries.map(([chartKey, chartValue]) => {
              return (
                chartKey
                && chartValue && (
                  <ChartCard
                    key={chartKey}
                    chartKey={chartKey}
                    item={chartValue}
                    dateRange={dateRangePicker}
                    comparedToRange={comparedToRange}
                    shopData={shopData}
                  />
                )
              )
            })}
          </InlineGrid>
          <InlineGrid columns={{ xs: 1, md: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }} gap="500">
            {barChartDataEntries.map(([chartKey, chartValue]) => {
              return (
                chartKey
                && chartValue && (
                  <ChartCard
                    key={chartKey}
                    chartKey={chartKey}
                    item={chartValue}
                    dateRange={dateRangePicker}
                    comparedToRange={comparedToRange}
                    shopData={shopData}
                  />
                )
              )
            })}
          </InlineGrid>
        </BlockStack>
        {/* <FooterHelp>
          <Trans
            i18nKey={t('learn-more-about-url-tailorkit-analytics-url')}
            components={{
              //   TODO: Update link later
              url: <Button variant="plain" target="_blank" url={''} />,
            }}
          />
        </FooterHelp> */}
      </Page>
    </PolarisVizProvider>
  )
})

export default withInteractiveChat(Index)
