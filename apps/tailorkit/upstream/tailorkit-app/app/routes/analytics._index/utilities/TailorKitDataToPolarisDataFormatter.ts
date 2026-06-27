import { type DataSeries, type DataPoint } from '@shopify/polaris-viz'
import { formatDate, isSameDay } from 'date-fns'
import { generateDateRange } from './calculateDateOnRange/generateDateRange'
import { ECardType } from '../constants'
import { getIntervalsOfBarChart } from './getIntervalsOfBarChart'

/**
 * @author KhanhNT
 * Class for formatting TailorKit data to Polaris-compatible data.
 * Converts raw analytics data into a format suitable for Polaris charts.
 */
export class TailorKitDataToPolarisDataFormatter {
  private startDate: Date
  private endDate: Date
  private dateRange: Date[]
  private analyticsDataMap: Record<string, Map<string, DataPoint[]>>

  /**
   * Initializes date range and analytics map for data aggregation.
   * @param args - Object containing chart key and date range.
   */
  constructor(args: { chartKey: string; chartType: string; dateRange: { startDate: Date; endDate: Date } }) {
    const {
      chartKey,
      chartType,
      dateRange: { startDate, endDate },
    } = args

    // Validate date range
    if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
      console.error('Invalid start or end date')
    }

    const intervalsForBarChart = chartType === ECardType.BAR_CARD ? getIntervalsOfBarChart({ startDate, endDate }) : 0

    this.startDate = startDate
    this.endDate = endDate
    this.dateRange = generateDateRange(startDate, endDate, intervalsForBarChart)
    this.analyticsDataMap = { [chartKey]: new Map<string, DataPoint[]>() }
  }

  /**
   * Filters items within the specified date range.
   * @param items - Array of items with date and value.
   * @param startDate - Start date of the range.
   * @param endDate - End date of the range.
   * @returns Filtered list of items.
   */
  private filterByDateRange(items: { createdAt: string; value: number; data?: any }[], startDate: Date, endDate: Date) {
    const startISO = startDate.toISOString()
    const endISO = endDate.toISOString()

    return items?.filter(item => item.createdAt >= startISO && item.createdAt < endISO)
  }

  /**
   * Returns a formatted name for the date range.
   * @returns Formatted date range string.
   */
  public getName(): string {
    return isSameDay(this.startDate, this.endDate)
      ? formatDate(this.endDate, 'MMM d, yyyy')
      : `${formatDate(this.startDate, 'MMM d')} - ${formatDate(this.endDate, 'MMM d, yyyy')}`
  }

  /**
   * Calculates the sum of values within a date range.
   * @param items - Array of items with created date and value.
   * @returns Sum of values within the date range.
   */
  private calculateDateRangeValue(
    items: { createdAt: string; value: number }[],
    startDate: Date,
    endDate: Date
  ): number {
    return this.filterByDateRange(items, startDate, endDate).reduce((sum, item) => sum + item.value, 0)
  }

  /**
   * Aggregates data points based on the date range.
   * @param chartKey - Key for storing data points.
   * @param items - Array of items to aggregate.
   * @param isComparison - Flag to indicate comparison.
   * @param isBarChart - Flag for bar chart aggregation.
   * @returns Array of aggregated data series.
   */
  private aggregateDataPoints(chartKey: string, items: any[], isComparison: boolean, isBarChart = false): DataSeries[] {
    const { dateRange, analyticsDataMap } = this
    const dataPointMap = analyticsDataMap[chartKey]
    const name = this.getName()

    dateRange.forEach((startDate, index) => {
      const endDate = dateRange[index + 1]
      if (!endDate) return

      const dateKey = startDate.toISOString()
      let value = 0

      if (isBarChart) {
        items.forEach(item => {
          value = this.calculateDateRangeValue(item.data, startDate, endDate)
          this.updateDataPointMap(dataPointMap, item.name, dateKey, Math.round(value * 100) / 100)
        })
      } else {
        value = this.calculateDateRangeValue(items, startDate, endDate)
        this.updateDataPointMap(dataPointMap, name, dateKey, Math.round(value * 100) / 100)
      }
    })

    return Array.from(dataPointMap.entries()).map(([name, data]) => ({ name, data, isComparison }))
  }

  /**
   * Updates the data point map with a new data point.
   * @param dataPointMap - Map to store data points.
   * @param name - Name of the series.
   * @param dateKey - Date key for the data point.
   * @param value - Value to add to the data point.
   */
  private updateDataPointMap(
    dataPointMap: Map<string, DataPoint[]>,
    name: string,
    dateKey: string,
    value: number
  ): void {
    const dataPoints = dataPointMap.get(name) || []
    dataPoints.push({ key: dateKey, value })
    dataPointMap.set(name, dataPoints)
  }

  private analyticsDataFormatted(
    chartKey: string,
    items: { createdAt: string; value: number }[],
    isComparison = false
  ): DataSeries[] {
    return this.aggregateDataPoints(chartKey, items, isComparison)
  }

  private analyticsDataFormattedForBarChart(
    chartKey: string,
    items: { name: string; data: { createdAt: string; value: number }[] }[],
    isComparison = false
  ): DataSeries[] {
    return this.aggregateDataPoints(chartKey, items, isComparison, true)
  }

  /**
   * Aggregates analytics data based on chart type.
   * @param args - Object containing chart type, key, items, and comparison flag.
   * @returns Aggregated data series for the specified chart type.
   */
  public aggregateAnalyticsData(args: {
    chartKey: string
    chartType: ECardType
    items: any[]
    isComparison?: boolean
  }): DataSeries[] {
    const { chartType, chartKey, items, isComparison = false } = args
    return chartType === ECardType.LINE_CHART
      ? this.analyticsDataFormatted(chartKey, items, isComparison)
      : this.analyticsDataFormattedForBarChart(chartKey, items, isComparison)
  }
}
