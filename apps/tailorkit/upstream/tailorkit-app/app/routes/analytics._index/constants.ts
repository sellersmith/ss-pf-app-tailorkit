import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  isMonday,
  lastDayOfMonth,
  lastDayOfYear,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from 'date-fns'

// Enums for chart types and comparison options
export enum ECardType {
  LINE_CHART = 'line-chart',
  BAR_CARD = 'bar-card',
}

export enum EOptionsComparing {
  NO_COMPARISON = 'NO_COMPARISON',
  PREVIOUS_PERIOD = 'PREVIOUS_PERIOD',
}

// Regex to validate date format (YYYY-MM-DD)
export const DATE_FORMAT_REGEX = /^(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

// Helper to create date ranges with standardized start and end times
const createDateRange = (start: Date, end: Date) => ({
  startDate: startOfDay(start),
  endDate: endOfDay(end),
})

// Base date constants
export const today = new Date(new Date().setUTCHours(0, 0, 0, 0))
export const yesterday = addDays(today, -1)
export const lastMonth = addMonths(today, -1)
export const last12Months = addMonths(today, -12)
export const lastYear = addYears(today, -1)

// Pre-defined date ranges for common periods
export const todayRange = createDateRange(today, today)
export const yesterdayRange = createDateRange(yesterday, yesterday)
export const last7DaysRange = createDateRange(addDays(today, -7), yesterday)
export const last30DaysRange = createDateRange(addDays(today, -30), yesterday)
export const last90DaysRange = createDateRange(addDays(today, -90), yesterday)
export const last365DaysRange = createDateRange(addDays(today, -365), yesterday)
export const lastMonthRange = createDateRange(startOfMonth(lastMonth), lastDayOfMonth(lastMonth))
export const last12MonthsRange = createDateRange(startOfMonth(last12Months), lastDayOfMonth(lastMonth))
export const lastYearRange = createDateRange(startOfYear(lastYear), lastDayOfYear(lastYear))
export const weekToDateRange = createDateRange(
  startOfWeek(isMonday(today) ? addWeeks(today, -1) : today, { weekStartsOn: 1 }),
  today
)
export const monthToDateRange = createDateRange(startOfMonth(today), today)
export const quarterToDateRange = createDateRange(startOfQuarter(today), today)
export const yearToDateRange = createDateRange(startOfYear(today), today)

export const ANALYTICS_API_PATH = '/api/analytics'
export const NO_COMPARE_LABEL_KEY = 'no-comparison'
