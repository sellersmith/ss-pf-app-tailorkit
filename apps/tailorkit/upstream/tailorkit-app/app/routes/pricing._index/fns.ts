/**
 * Client-side data fetching functions for the pricing page
 */

import { authenticatedFetch } from '~/shopify/fns.client'
import { PRICING_ACTION } from '~/routes/api.pricing/constants'
import type { PricingPlanDocument, GroupedPricingPlanDocument } from '~/models/PricingPlan'
import type { BillingCycleDocument } from '~/models/BillingCycle'
import { isOrderBasedPlan } from '~/models/helpers/pricing-utils'

/**
 * Fetch all available pricing plans and flatten to individual plans
 *
 * @returns Array of Version 2 (order-based) pricing plans
 */
export async function fetchPricingPlansV2(): Promise<PricingPlanDocument[]> {
  try {
    const response: GroupedPricingPlanDocument[] = await authenticatedFetch('/api/pricing')

    if (!response || !Array.isArray(response)) {
      return []
    }

    // Flatten grouped plans and filter to order-based plans only
    const allPlans: PricingPlanDocument[] = []

    for (const group of response) {
      if (group.variants && Array.isArray(group.variants)) {
        for (const plan of group.variants) {
          if (isOrderBasedPlan(plan)) {
            allPlans.push(plan)
          }
        }
      }
    }

    // Sort by price (lowest first)
    allPlans.sort((a, b) => (a.price || 0) - (b.price || 0))

    return allPlans
  } catch (error) {
    console.error('Failed to fetch pricing plans:', error)
    return []
  }
}

/**
 * Subscribe to a pricing plan
 *
 * @param planId - The plan ID to subscribe to
 * @param couponCode - Optional coupon code to apply
 * @returns The subscription result with redirect URL
 */
export async function subscribeToPlan(
  planId: string,
  couponCode?: string
): Promise<{ success: boolean; confirmationUrl?: string; error?: string }> {
  try {
    const response = await authenticatedFetch('/api/pricing', {
      method: 'POST',
      body: JSON.stringify({
        action: PRICING_ACTION.SUBSCRIBE,
        plan: planId,
        coupon: couponCode,
      }),
    })

    if (response?.confirmationUrl) {
      return {
        success: true,
        confirmationUrl: response.confirmationUrl,
      }
    }

    return {
      success: false,
      error: response?.error || response?.message || 'Failed to create subscription',
    }
  } catch (error) {
    console.error('Failed to subscribe to plan:', error)
    return {
      success: false,
      error: 'Failed to create subscription',
    }
  }
}

/**
 * Get the current subscription details for the shop
 *
 * @returns The current subscription or null
 */
export async function getCurrentSubscription(): Promise<{
  plan?: PricingPlanDocument
  couponCode?: string
} | null> {
  try {
    const response = await authenticatedFetch('/api/pricing', {
      method: 'POST',
      body: JSON.stringify({
        action: PRICING_ACTION.GET_CURRENT_SUBSCRIPTION,
      }),
    })

    return response || null
  } catch (error) {
    console.error('Failed to fetch current subscription:', error)
    return null
  }
}

/**
 * Fetch trial info for the current shop
 *
 * Returns whether the shop has ever used a trial and when it started.
 * Used to show accurate remaining trial days in the UI.
 */
export async function fetchTrialInfo(): Promise<{
  hasUsedTrial: boolean
  trialStartDate?: string
  installDate?: string
}> {
  try {
    const response = await authenticatedFetch('/api/pricing', {
      method: 'POST',
      body: JSON.stringify({
        action: PRICING_ACTION.GET_REMAINING_TRIAL_DAYS,
      }),
    })

    return {
      hasUsedTrial: response?.hasUsedTrial || false,
      trialStartDate: response?.trialStartDate,
      installDate: response?.installDate,
    }
  } catch (error) {
    console.error('Failed to fetch trial info:', error)
    return { hasUsedTrial: false }
  }
}

/**
 * Fetch billing history for the CURRENT ACTIVE subscription
 *
 * Returns current billing cycle information including:
 * - Billing cycle baseline (initial order count)
 * - Current order count
 * - Charges accumulated
 *
 * @returns Billing state object with cycle information
 */
export async function fetchBillingState(): Promise<{
  billingState: any
  billingCycleBaseline: number
}> {
  try {
    const response = await authenticatedFetch('/api/pricing', {
      method: 'POST',
      body: JSON.stringify({
        action: PRICING_ACTION.GET_BILLING_STATE,
      }),
    })

    if (!response || !response.success) {
      return {
        billingState: null,
        billingCycleBaseline: 0,
      }
    }

    return {
      billingState: response.billingState,
      billingCycleBaseline: response.billingCycleBaseline || 0,
    }
  } catch (error) {
    console.error('Failed to fetch billing state:', error)
    return {
      billingState: null,
      billingCycleBaseline: 0,
    }
  }
}

/**
 * Fetch billing cycles history (for order-based billing)
 *
 * Returns array of billing cycles with charges breakdown
 * Used for displaying billing history in modal
 *
 * @param daysBack - Number of days to look back (default: 30 days = 1 billing cycle)
 * @returns Array of billing cycle documents
 */
export async function fetchBillingCycles(daysBack: number = 30): Promise<BillingCycleDocument[]> {
  try {
    const response = await authenticatedFetch('/api/pricing', {
      method: 'POST',
      body: JSON.stringify({
        action: PRICING_ACTION.GET_BILLING_CYCLES,
        daysBack,
      }),
    })

    if (!response || !response.success) {
      return []
    }

    return response.billingCycles || []
  } catch (error) {
    console.error('Failed to fetch billing cycles:', error)
    return []
  }
}

/**
 * Fetch coupon details by coupon code
 *
 * Returns coupon information including discount type and amount
 * Used for displaying accurate discount in pricing breakdown
 *
 * @param couponCode - The coupon code to fetch
 * @returns Coupon document or null if not found
 */
export async function fetchCouponByCode(couponCode: string): Promise<any | null> {
  try {
    const response = await authenticatedFetch('/api/pricing', {
      method: 'POST',
      body: JSON.stringify({
        action: PRICING_ACTION.GET_COUPON,
        couponCode,
      }),
    })

    if (!response || !response.success) {
      return null
    }

    return response.coupon || null
  } catch (error) {
    console.error('Failed to fetch coupon:', error)
    return null
  }
}

/**
 * Fetch purchased AI credits info in current billing cycle
 *
 * Returns:
 * - total: Total purchased credits at start of cycle
 * - used: Purchased credits used in cycle
 * - remaining: Purchased credits available
 *
 * Single Source of Truth: AiCreditTransaction collection
 */
export async function fetchPurchasedCreditsInCycle(): Promise<{
  total: number
  used: number
  remaining: number
}> {
  try {
    const response = await authenticatedFetch('/api/pricing', {
      method: 'POST',
      body: JSON.stringify({
        action: PRICING_ACTION.GET_PURCHASED_CREDITS_IN_CYCLE,
      }),
    })

    if (!response || !response.success) {
      return { total: 0, used: 0, remaining: 0 }
    }

    return {
      total: response.total || 0,
      used: response.used || 0,
      remaining: response.remaining || 0,
    }
  } catch (error) {
    console.error('Failed to fetch purchased credits:', error)
    return { total: 0, used: 0, remaining: 0 }
  }
}
