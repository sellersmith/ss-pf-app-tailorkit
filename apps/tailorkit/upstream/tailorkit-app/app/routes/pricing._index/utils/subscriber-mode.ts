import type { ShopDocument } from '~/models/Shop'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import { hasActivePlan } from '~/models/PricingPlan.fns'

/**
 * Subscriber-mode gate for the /pricing route.
 *
 * Returns true when the merchant should see the Billing/account-management view
 * instead of the Pricing/comparison view.
 *
 * Migration users (V1-era still pending V2 conversion) keep the prospect UI
 * because they still need to convert.
 */
export function isSubscriberView(shopData: ShopDocument | null | undefined, isOldPricingMigration: boolean): boolean {
  return hasActivePlan(shopData) && !isOldPricingMigration
}

/**
 * Top-tier plan detection. Used to suppress upgrade UI for merchants who are
 * already on the highest tier.
 *
 * Currently Growth is the top tier (audit §5 resolved 5). When Enterprise/custom
 * tiers land, expand the set here.
 */
export function isTopTierPlan(plan: PricingPlanDocument | string | undefined, v2Plans: PricingPlanDocument[]): boolean {
  if (!plan || typeof plan === 'string' || !v2Plans.length) return false
  const maxPrice = Math.max(...v2Plans.map(p => p.price || 0))
  if (maxPrice <= 0) return false
  return (plan.price || 0) >= maxPrice
}

/** Find the highest-priced plan in `v2Plans`. Returns undefined when none. */
export function findTopTierPlan(v2Plans: PricingPlanDocument[]): PricingPlanDocument | undefined {
  if (!v2Plans.length) return undefined
  return [...v2Plans].sort((a, b) => (b.price || 0) - (a.price || 0))[0]
}
