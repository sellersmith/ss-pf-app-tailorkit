import { type DataSeries } from '@shopify/polaris-viz'
import { generateDateRange } from './calculateDateOnRange/generateDateRange'
import { getIntervalsOfBarChart } from './getIntervalsOfBarChart'

/**
 * @author KhanhNT
 * Computes the total values for each date range interval within a specified date range.
 *
 * @param {DataSeries[]} dataSeries - An array of data series, where each series contains data points with `key` (date string)
 * and `value` (numeric value).
 * @param {Object} dateRangePicker - An object containing the start and end dates for the desired date range.
 * @param {Date} dateRangePicker.startDate - The start date of the date range.
 * @param {Date} dateRangePicker.endDate - The end date of the date range.
 *
 * @returns {Array<{ dateKey: string, totalValues: number }>} An array of objects where each object contains:
 *  - `dateKey`: The ISO string representation of the start date for each interval.
 *  - `totalValues`: The sum of `value` fields from all data series for the given date key.
 *
 * The function divides the given date range into intervals (each 7 days long by default) and calculates the total value
 * of data points within each interval. It uses `generateDateRange` to create the intervals and aggregates the values
 * from `dataSeries` based on matching date keys.
 */
export const getTotalValuesFromDateRange = (
  dataSeries: DataSeries[],
  dateRangePicker: { startDate: Date; endDate: Date }
) => {
  const { startDate, endDate } = dateRangePicker

  const intervalsForBarChart = getIntervalsOfBarChart({ startDate, endDate })
  const dateRange = generateDateRange(startDate, endDate, intervalsForBarChart)

  return dateRange.map((startDate, index) => {
    const endDate = dateRange[index + 1]
    if (!endDate) return

    const dateKey = startDate.toISOString()
    let totalValues = 0

    for (const data of dataSeries) {
      const { data: dataPoints } = data
      const point = dataPoints.find(d => d.key === dateKey)
      totalValues += point?.value || 0
    }

    return { dateKey, totalValues }
  })
}
