import { calculateIntervalsDateRange } from './calculateIntervalsDateRange'

// Constants for date rounding logic (explain purpose)
const ROUNDING_MINUTES = 30

/**
 * @author KhanhNT
 * Generates a range of dates between the start and end dates, broken into intervals.
 * The range is calculated by dividing the time difference into a number of intervals.
 * @param {Date} startDate - The start date for the range.
 * @param {Date} endDate - The end date for the range.
 * @returns {Date[]} An array of Date objects representing the range of dates.
 */
export function generateDateRange(startDate: Date, _endDate: Date, intervalsFromParam = 0): Date[] {
  // Validate inputs
  if (!(startDate instanceof Date) || !(_endDate instanceof Date)) {
    console.error('Both startDate and endDate must be valid Date objects.')
    return []
  }

  // Copy the end date difference to avoid updating the original variables because we call the setMinutes function below
  const endDate = new Date(_endDate)

  if (startDate > endDate) {
    console.error('startDate must not be later than endDate.')
    return []
  }

  // Round the end date to the next hour if the minutes are >= 30
  if (endDate.getMinutes() >= ROUNDING_MINUTES) {
    endDate.setMinutes(60, 0, 0) // Rounds to the start of the next hour
  }

  // Calculate number of intervals (using a utility function)
  const intervals = intervalsFromParam > 0 ? intervalsFromParam : calculateIntervalsDateRange(startDate, endDate)

  // Handle edge case where intervals might be zero or negative
  if (intervals <= 0) {
    console.error('The number of intervals must be greater than zero.')
    return []
  }

  const dates: Date[] = []
  const startTime = startDate.getTime()
  const endTime = endDate.getTime()
  const interval = (endTime - startTime) / intervals

  // Generate dates for the range based on calculated intervals
  for (let i = 0; i < intervals; i++) {
    const currentDate = new Date(startTime + interval * i)
    dates.push(currentDate)
  }

  // Add the end date as the final date in the range
  dates.push(endDate)

  return dates
}
