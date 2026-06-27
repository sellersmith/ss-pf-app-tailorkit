import { type TFunction } from 'i18next'
import {
  last12MonthsRange,
  last30DaysRange,
  last365DaysRange,
  last7DaysRange,
  last90DaysRange,
  lastMonthRange,
  lastYearRange,
  monthToDateRange,
  quarterToDateRange,
  todayRange,
  weekToDateRange,
  yearToDateRange,
  yesterdayRange,
} from '../constants'
import type { IAnalyticsRangeOptions } from '../types'

/**
 * @author KhanhNT
 * Generates an object containing analytics range options for various time periods.
 * Each option includes a value, title (localized using the provided translation function),
 * label (constant), and the corresponding data range.
 *
 * @param {TFunction} t - The translation function from i18next for localizing titles.
 * @returns {IAnalyticsRangeOptions} - A mapping of range keys to their metadata.
 */
export const getAnalyticsRangeOptions = (t: TFunction): IAnalyticsRangeOptions => {
  return {
    today: {
      value: 'today',
      title: t('today'),
      label: 'TODAY',
      data: todayRange,
    },
    yesterday: {
      value: 'yesterday',
      title: t('yesterday'),
      label: 'YESTERDAY',
      data: yesterdayRange,
    },
    last7Days: {
      value: 'last7Days',
      title: t('last-7-days'),
      label: 'LAST_7_DAYS',
      data: last7DaysRange,
    },
    last30Days: {
      value: 'last30Days',
      title: t('last-30-days'),
      label: 'LAST_30_DAYS',
      data: last30DaysRange,
    },
    last90Days: {
      value: 'last90Days',
      title: t('last-90-days'),
      label: 'LAST_90_DAYS',
      data: last90DaysRange,
    },
    last365Days: {
      value: 'last365Days',
      title: t('last-365-days'),
      label: 'LAST_365_DAYS',
      data: last365DaysRange,
    },
    lastMonth: {
      value: 'lastMonth',
      title: t('last-month'),
      label: 'LAST_MONTH',
      data: lastMonthRange,
    },
    last12Months: {
      value: 'last12Months',
      title: t('last-12-months'),
      label: 'LAST_12_MONTH',
      data: last12MonthsRange,
    },
    lastYear: {
      value: 'lastYear',
      title: t('last-year'),
      label: 'LAST_YEAR',
      data: lastYearRange,
    },
    weekToDate: {
      value: 'weekToDate',
      title: t('week-to-date'),
      label: 'WEEK_TO_DATE',
      data: weekToDateRange,
    },
    monthToDate: {
      value: 'monthToDate',
      title: t('month-to-date'),
      label: 'MONTH_TO_DATE',
      data: monthToDateRange,
    },
    quarterToDate: {
      value: 'quarterToDate',
      title: t('quarter-to-date'),
      label: 'QUARTER_TO_DATE',
      data: quarterToDateRange,
    },
    yearToDate: {
      value: 'yearToDate',
      title: t('year-to-date'),
      label: 'YEAR_TO_DATE',
      data: yearToDateRange,
    },
  }
}
