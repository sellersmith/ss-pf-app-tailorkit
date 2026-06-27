import { format as formatDate } from 'date-fns'

/**
 * @author KhanhNT
 * Formats a date range into a human-readable string.
 * Example: "Jan 1, 24 - Jan 10, 24"
 *
 * @param {Date} start - The start date of the range.
 * @param {Date} end - The end date of the range.
 * @returns {string} - Formatted date range string.
 * @throws {TypeError} - If start or end is not a valid Date object.
 */
export const dateRangeToLabelFormatter = (start: Date, end: Date): string => {
  if (!(start instanceof Date) || isNaN(start.getTime())) {
    console.error('Invalid start date provided.')
    return ''
  }

  if (!(end instanceof Date) || isNaN(end.getTime())) {
    console.error('Invalid end date provided.')
    return ''
  }

  return `${formatDate(start, 'MMM d, yy')} - ${formatDate(end, 'MMM d, yy')}`
}
