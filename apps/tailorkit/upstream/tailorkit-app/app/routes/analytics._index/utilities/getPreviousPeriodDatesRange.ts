import { differenceInDays, subDays } from 'date-fns'

/**
 * @author KhanhNT
 * Calculates the start and end dates of the previous period based on the given date range.
 *
 * The function determines the duration of the current period by calculating the difference
 * in days between the provided `startDate` and `endDate` and then uses that difference to
 * calculate the equivalent previous period.
 *
 * @param {Date} startDate - The start date of the current period.
 * @param {Date} endDate - The end date of the current period.
 * @returns {{startDate: Date, endDate: Date} | undefined}
 * An object with the previous period's start and end dates or `undefined` if invalid inputs.
 */
export function getPreviousPeriodDatesRange(startDate: Date, endDate: Date) {
  // Validate that startDate and endDate are valid Date objects
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    console.error('Invalid start date provided')
    return
  }
  if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
    console.error('Invalid end date provided')
    return
  }

  // Calculate the difference in days between startDate and endDate, inclusive of both days
  const diff = differenceInDays(endDate, startDate) + 1

  return {
    // Calculate previous period start and end dates by subtracting the difference
    startDate: subDays(startDate, diff),
    endDate: subDays(endDate, diff),
  }
}
