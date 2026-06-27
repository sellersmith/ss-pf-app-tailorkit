/**
 * Seasonal theme configuration
 * Toggle CHRISTMAS_ENABLED to enable/disable Christmas theme across the app
 */

/** Christmas season date constants */
const CHRISTMAS_MONTH = 11 // December (0-indexed)
const CHRISTMAS_START_DATE = 1
const CHRISTMAS_END_DATE = 25

const now = new Date()
const isChristmasSeason
  = now.getMonth() === CHRISTMAS_MONTH && now.getDate() >= CHRISTMAS_START_DATE && now.getDate() <= CHRISTMAS_END_DATE

/**
 * Seasonal theme type definition
 */
export interface SeasonalTheme {
  CHRISTMAS_ENABLED: boolean
}

/**
 * Seasonal theme configuration
 * @property {boolean} CHRISTMAS_ENABLED - true if the current date is in the Christmas season
 */
export const SEASONAL_THEME: SeasonalTheme = {
  CHRISTMAS_ENABLED: isChristmasSeason,
}

/**
 * Checks if the current date falls within any configured seasonal theme period
 *
 * @returns True if currently in a seasonal period, false otherwise
 * @example
 * if (isInAnySeason()) {
 *   // Show seasonal decorations
 * }
 */
export const isInAnySeason = (): boolean => {
  return isChristmasSeason
}
