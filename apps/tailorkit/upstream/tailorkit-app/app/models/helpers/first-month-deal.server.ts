/**
 * First Month Deal Helper
 *
 * Manages the "$1 for first month" promotional deal for TailorKit paid plans.
 *
 * DEAL RULES:
 * - Active only before FIRST_MONTH_DEAL_DEADLINE (June 25, 2026)
 * - Eligible only for shops that have NEVER had any subscription (new installs only)
 * - Applies Shopify-native discount so Shopify handles month-1→month-2 price transition
 *
 * JIRA: EMTLKIT-5304
 */

import type { ShopDocument } from '../Shop'
import type { PricingPlanDocument } from '../PricingPlan'
import Subscription from '../Subscription.server'
import { FIRST_MONTH_DEAL_DEADLINE, FIRST_MONTH_DEAL_PRICE } from '~/constants/first-month-deal'
import { trackFeatureEvent } from '~/bootstrap/fns/feature-tracking.server'

// Re-export for backward compatibility with existing imports
export { FIRST_MONTH_DEAL_DEADLINE, FIRST_MONTH_DEAL_PRICE }

/**
 * Returns true if the $1 promotional deal window is still open.
 * Pure function — no side effects.
 */
export function isDealActive(): boolean {
  return new Date() < FIRST_MONTH_DEAL_DEADLINE
}

/**
 * Returns true if the shop has never had any approved subscription.
 *
 * Eligibility criteria:
 * - Deal must be active (isDealActive() = true)
 * - Shop has zero non-pending Subscription records
 *
 * Pending subscriptions are excluded: user clicked "Subscribe" but hasn't
 * approved the Shopify charge yet. If they click Back, deal UI should persist.
 *
 * This excludes both:
 * - V1 revenue-based users (have active/inactive subscription records)
 * - V2 users who previously subscribed and approved
 */
export async function isDealEligible(shopDomain: string): Promise<boolean> {
  if (!isDealActive()) return false

  const count = await Subscription.countDocuments({
    shopDomain,
    status: { $ne: 'pending' },
  })

  return count === 0
}

/**
 * Builds the discount object for Shopify's AppSubscriptionCreate mutation.
 *
 * Uses durationLimitInIntervals: 1 so Shopify charges $1 for month 1,
 * then automatically reverts to the full plan price from month 2.
 *
 * @param planPrice - Full price of the plan (e.g. 19 for Starter, 49 for Growth)
 * @returns Discount input object compatible with AppRecurringPricingInput.discount
 */
export function buildDealDiscount(planPrice: number): { durationLimitInIntervals: number; value: { amount: number } } {
  return {
    durationLimitInIntervals: 1,
    value: { amount: planPrice - FIRST_MONTH_DEAL_PRICE },
  }
}

/**
 * Builds the GraphQL discount string for Shopify's AppSubscriptionCreate mutation.
 * Returns empty string when deal is not applicable.
 */
export function buildDealDiscountGraphQL(isDealApplicable: boolean, baseFinalPrice: number): string {
  if (!isDealApplicable) return ''
  return `discount: { durationLimitInIntervals: 1, value: { amount: ${baseFinalPrice - FIRST_MONTH_DEAL_PRICE} } }`
}

/**
 * Computes deal pricing: checks eligibility and returns finalPrice.
 * Centralizes the deal pricing logic used across billing types.
 */
export async function computeDealPricing(
  shopDomain: string,
  baseFinalPrice: number
): Promise<{ isDealApplicable: boolean; finalPrice: number }> {
  const isDealApplicable = baseFinalPrice > 0 && (await isDealEligible(shopDomain))
  const finalPrice = isDealApplicable ? FIRST_MONTH_DEAL_PRICE : baseFinalPrice
  return { isDealApplicable, finalPrice }
}

// Re-export client-safe helper for server-side usage
export { isFirstMonthDealSubscription } from '~/constants/first-month-deal'

/**
 * Track deal subscription event. Extracted to avoid duplication across billing types.
 */
export async function trackDealSubscription(
  shopData: ShopDocument,
  plan: PricingPlanDocument,
  baseFinalPrice: number
): Promise<void> {
  await trackFeatureEvent(shopData, 'first_month_deal', 'deal_subscribed', {
    plan_name: plan.name,
    original_price: baseFinalPrice,
    deal_price: FIRST_MONTH_DEAL_PRICE,
  })
}
