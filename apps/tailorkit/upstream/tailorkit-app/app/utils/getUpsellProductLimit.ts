/**
 * Shared utility for extracting upsellProductLimit from shop data.
 * Works on both server (.server.ts) and client (components) since it has no server-specific imports.
 * Handles the union types where subscription can be string | SubscriptionDocument
 * and plan can be string | PricingPlanDocument.
 */

interface ShopDataForLimit {
  subscription?:
    | string
    | {
        plan?:
          | string
          | {
              features?: {
                upsellProductLimit?: number | null
              } | null
            }
      }
}

/**
 * Extract upsellProductLimit from shop data, handling union types for subscription/plan.
 * Returns number if limited, null if unlimited.
 */
export function getUpsellProductLimit(shopData: ShopDataForLimit | null | undefined): number | null {
  const subscription = shopData?.subscription
  if (!subscription || typeof subscription === 'string') return null
  const plan = subscription.plan
  if (!plan || typeof plan === 'string') return null
  return plan.features?.upsellProductLimit ?? null
}
