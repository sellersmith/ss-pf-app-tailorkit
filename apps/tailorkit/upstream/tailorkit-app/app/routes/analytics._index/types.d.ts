type TasAnalyticsLineChartKey = 'numberOfOrders' | 'revenue'

type TasAnalyticsBarChartKey = 'templatesByOrders' | 'templatesByRevenue' | 'productsByOrders' | 'productsByRevenue'

type TasAnalyticsValues = {
  title: string
  url: string
  cardType: any
  isShowMoney?: boolean
}

type DateRangeLabel =
  | 'today'
  | 'yesterday'
  | 'last7Days'
  | 'last30Days'
  | 'last90Days'
  | 'last365Days'
  | 'lastMonth'
  | 'last12Months'
  | 'lastYear'
  | 'weekToDate'
  | 'monthToDate'
  | 'quarterToDate'
  | 'yearToDate'

type IAnalyticsRangeOptions = {
  [key in DateRangeLabel]: {
    value: DateRangeLabel
    title: string
    label: string
    data: Omit<IRange, 'label'>
  }
}

type IRange = {
  startDate: Date
  endDate: Date
  label: DateRangeLabel | undefined
}

export type {
  TasAnalyticsLineChartKey,
  TasAnalyticsBarChartKey,
  TasAnalyticsValues,
  DateRangeLabel,
  IAnalyticsRangeOptions,
  IRange,
}
