import { type TFunction } from 'i18next'
import { getAnalyticsRangeOptions } from './getAnalyticsRangeOptions'
import type { DateRangeLabel } from '../types'
import { isSameDay } from 'date-fns'
import { dateRangeToLabelFormatter } from './dateRangeToLabelFormatter'

/**
 * @author KhanhNT
 * Converts a date range (startDate, endDate) to a corresponding type label.
 * If the date range matches a predefined analytics range, returns the corresponding value.
 * Otherwise, formats the range using a fallback formatter.
 *
 * @param t - Translation function from i18next for localization
 * @param startDate - The start date of the range
 * @param endDate - The end date of the range
 * @returns A DateRangeLabel or a formatted string representing the date range
 */
export const dateRangeToTypeFormatter = (t: TFunction, startDate: Date, endDate: Date): DateRangeLabel | string => {
  // Retrieve available analytics range options
  const analyticsRangeOptions = getAnalyticsRangeOptions(t)

  // Ensure options are valid
  if (!analyticsRangeOptions) return dateRangeToLabelFormatter(startDate, endDate)

  // Iterate over options to find a matching date range
  const matchingOption = Object.entries(analyticsRangeOptions).find(
    ([_, period]) => isSameDay(startDate, period.data.startDate) && isSameDay(endDate, period.data.endDate)
  )

  // Return the matching value if found, otherwise format using fallback
  return matchingOption ? matchingOption[1].value : dateRangeToLabelFormatter(startDate, endDate)
}
