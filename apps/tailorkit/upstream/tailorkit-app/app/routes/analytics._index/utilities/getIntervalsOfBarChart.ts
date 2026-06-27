import { differenceInDays } from 'date-fns'

/**
 * @author KhanhNT
 * Calculates the number of intervals for a bar chart based on the difference between two dates.
 *
 * @param {Object} params - Parameters for the function.
 * @param {Date} params.startDate - The start date.
 * @param {Date} params.endDate - The end date.
 * @returns {number} The number of intervals for the bar chart: 8 if the date difference is <= 90 days, otherwise 0.
 */
export const getIntervalsOfBarChart = ({ startDate, endDate }: { startDate: Date; endDate: Date }) => {
  // Validate inputs
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
    console.error('Both startDate and endDate must be valid Date objects.')
    return 0
  }

  // Calculate the difference in days between the start and end dates
  const differenceDays = Math.abs(differenceInDays(endDate, startDate))
  const intervalsForBarChart = differenceDays <= 90 ? 8 : 0

  return intervalsForBarChart
}
