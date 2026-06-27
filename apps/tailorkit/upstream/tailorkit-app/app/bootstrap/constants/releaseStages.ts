import { compareDesc } from 'date-fns'

/**
 *  Constant representing the release date of Pricing Plan V1
 */
export const V1_PRICING_PLAN_RELEASE_DATE = '2024-12-05'

/**
 * Check if customer installed app before releasing v1 pricing plan
 *
 * @param date
 * @returns
 */
export const isInstalledBeforeReleasingV1PricingPlan = (date?: Date | string): Boolean => {
  // return true for fall back if date is not existed (for some dev stores which don't have created_at property)
  if (!date) return true

  // Compare the two dates and return -1 if the first date is after the second,
  // 1 if the first date is before the second or 0 if dates are equal.
  const compared = compareDesc(date, V1_PRICING_PLAN_RELEASE_DATE)

  if (compared === -1) return false

  return true
}

export const ACHIEVE_FIRST_SALE_EVENT_RELEASE_DATE = '2025-01-31'
