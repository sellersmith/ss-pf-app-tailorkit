import { type TFunction } from 'i18next'
import { type IDateRangePickerState } from '../components/DateRangePicker'
import { getAnalyticsRangeOptions } from './getAnalyticsRangeOptions'
import { todayRange } from '../constants'

/**
 * Returns the initial state for the DateRangePicker component.
 *
 * @param t - A translation function typically used for i18n, takes a key and returns the translated string.
 * @param location - An object representing the current navigation state, possibly containing the previous date range selection.
 * @returns IDateRangePickerState - An object representing the initial state for the DateRangePicker, including startDate, endDate, and label.
 */
export const getInitialDateRangePicker = (t: TFunction, location: any): IDateRangePickerState => {
  const fallbackRange = {
    value: 'today',
    title: t('today'),
    label: 'TODAY',
    data: todayRange,
  }
  const defaultRange = getAnalyticsRangeOptions(t)?.today || fallbackRange

  return (
    location.state?.dateRangePicker || {
      startDate: defaultRange.data.startDate,
      endDate: defaultRange.data.endDate,
      label: defaultRange.value,
    }
  )
}
