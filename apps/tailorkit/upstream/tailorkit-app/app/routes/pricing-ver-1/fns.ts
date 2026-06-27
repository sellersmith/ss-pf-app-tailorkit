import { authenticatedFetch } from '~/shopify/fns.client'
import { PRICING_ACTION } from '~/routes/api.pricing/constants'
import type { GroupedPricingPlanDocument } from '~/models/PricingPlan'

/**
 * Method to fetch pricing plans.
 *
 * @return {Promise<GroupedPricingPlanDocument[]>}
 */
export async function fetchPricingPlans(): Promise<GroupedPricingPlanDocument[]> {
  try {
    const response = await authenticatedFetch('/api/pricing')
    return response || []
  } catch (error) {
    console.error('Failed to fetch pricing plans:', error)
    return []
  }
}

/**
 * Method to fetch coupons.
 *
 * @param couponCode - The coupon code to validate. Optional.
 * @return {Promise<any | null>}
 */
export async function fetchCoupons(couponCode?: string): Promise<any | null> {
  try {
    const [couponResponse, currentCouponResponse] = await Promise.all([
      couponCode
        ? authenticatedFetch(`/api/pricing`, {
            method: 'POST',
            body: JSON.stringify({
              coupon: couponCode,
              action: PRICING_ACTION.VALIDATE_COUPON,
            }),
          })
        : Promise.resolve(null),

      authenticatedFetch(`/api/pricing`, {
        method: 'POST',
        body: JSON.stringify({
          action: PRICING_ACTION.GET_CURRENT_COUPON_BY_SHOP_DOMAIN,
        }),
      }),
    ])

    return couponResponse?.validatedCoupon || currentCouponResponse?.coupon || null
  } catch (error) {
    console.error('Failed to fetch coupons:', error)
    return null
  }
}
