export const CLIPART_ACTIONS = {
  GET_CLICK_COUNTS: 'get_click_counts',
  TRACK_CLICK: 'track_click',
} as const

export type ClipartAction = (typeof CLIPART_ACTIONS)[keyof typeof CLIPART_ACTIONS]

/**
 * Metrics and analytics constants
 */

/**
 * Base click count for display purposes
 * Formula: Uses = BASE_CLICK_COUNT + actual clicks
 *
 * Example:
 * - 0 actual clicks → 100 uses
 * - 5 actual clicks → 105 uses
 * - 150 actual clicks → 250 uses
 */
export const BASE_CLICK_COUNT = 0

/**
 * Email domains to exclude from click count tracking
 *
 * Users with email addresses ending with these domains will have their
 * clipart/asset clicks excluded from analytics tracking.
 *
 * This is used to exclude internal team members or test accounts from
 * affecting usage statistics and metrics.
 *
 * Format: Array of email domain suffixes (e.g., '@bravebits.vn')
 * The check is performed using `email.endsWith(domain)` for each domain in the array.
 *
 * @example
 * // User email: 'john@bravebits.vn'
 * // Will be excluded because it ends with '@bravebits.vn'
 *
 * // User email: 'jane@example.com'
 * // Will NOT be excluded
 */
export const EMAIL_DOMAINS_TO_EXCLUDE_CLICK_COUNT = [] as const
