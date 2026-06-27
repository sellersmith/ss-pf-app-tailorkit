import { differenceInDays } from 'date-fns'

/**
 * @author KhanhNT
 * Calculates the number of intervals between two dates.
 *
 * @param {Date} startDate - The start date.
 * @param {Date} endDate - The end date.
 * @returns {number} The number of intervals between the two dates.
 */
export function calculateIntervalsDateRange(startDate: Date, endDate: Date): number {
  // Check if the start date is after the end date and throw an error if true
  if (startDate > endDate) {
    console.error('startDate must be before endDate')
    return 0
  }

  // Calculate the difference in days between the start and end dates
  const differenceDays = Math.abs(differenceInDays(endDate, startDate))

  // If the difference in days is less than or equal to 1, return 24 intervals (1 interval per hour)
  if (differenceDays <= 1) {
    return 24
  }

  // If the difference in days is exactly 2, return 48 intervals (2 intervals per hour)
  if (differenceDays === 2) {
    return 48
  }

  // If the difference in days is exactly 3, return 72 intervals (3 intervals per hour)
  if (differenceDays === 3) {
    return 72
  }

  // If the difference in days is less than or equal to 90, return the difference in days as the number of intervals
  if (differenceDays <= 90) {
    return differenceDays
  }

  // For differences greater than 90 days, return the number of months (approximately) as the number of intervals
  return Math.floor(differenceDays / 30.5)
}
