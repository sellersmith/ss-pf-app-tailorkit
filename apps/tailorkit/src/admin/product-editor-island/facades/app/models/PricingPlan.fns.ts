import type { ShopDocument } from './Shop'
import type { SubscriptionDocument } from './Subscription'

/**
 * Copied from TailorKit `PricingPlan.fns.ts` and narrowed to the only ProductEditor import.
 * Keep broader pricing/trial helpers out of the PageFly admin island until they have host facades.
 */
export function isApprovedCharge(shopData: ShopDocument) {
  const subscription = shopData.subscription as SubscriptionDocument | undefined

  if (!subscription) {
    return false
  }

  const { shopifyCharge, status } = subscription

  return status === 'active' && shopifyCharge?.status === 'active'
}
