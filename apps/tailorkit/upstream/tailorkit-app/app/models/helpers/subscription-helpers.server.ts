/**
 * Shared Subscription Helper Functions
 *
 * This module contains reusable helper functions for subscription management
 * that are shared between order-based and revenue-based billing.
 *
 * ARCHITECTURE PRINCIPLE:
 * - Use field existence (usages.orders vs usages.revenue) to determine billing type
 * - DO NOT check pricingVersion for business logic (violates Open/Closed Principle)
 * - Keep these functions small, focused, and testable (Single Responsibility Principle)
 */

import type { PricingPlanDocument } from '~/models/PricingPlan'
import Subscription from '~/models/Subscription.server'
import Shop from '~/models/Shop.server'
import { requestGraphqlApi } from '~/shopify/graphql/fns.server'
import {
  getFreeOrdersCount as getFreeOrdersCountShared,
  getOverageFeePerOrder as getOverageFeePerOrderShared,
  isOrderBasedPlan as isOrderBasedPlanShared,
  getOrderUsageTerms as getOrderUsageTermsShared,
  getRevenueUsageTerms as getRevenueUsageTermsShared,
  getSubscriptionName as getSubscriptionNameShared,
} from './pricing-utils'
import PricingPlan from '../PricingPlan.server'

/**
 * Billing type determination
 */
export type BillingType = 'order-based' | 'revenue-based' | 'free'

/**
 * Determines billing type based on plan structure (NOT version number)
 *
 * @param plan - Pricing plan document
 * @returns Billing type based on field existence
 *
 * @example
 * ```typescript
 * const billingType = getBillingType(plan)
 * if (billingType === 'order-based') {
 *   // Handle order-based logic
 * }
 * ```
 */
export function getBillingType(plan: PricingPlanDocument): BillingType {
  // Check for order-based billing (includes V2, future V3/V4/V5 with orders)
  if (isOrderBasedPlanShared(plan)) {
    return 'order-based'
  }

  // Check for revenue-based billing (includes V1, future variations)
  if (plan.usages?.revenue && plan.usages.revenue.length > 0) {
    return 'revenue-based'
  }

  // Free plan (no billing)
  return 'free'
}

/**
 * Cancels existing active subscription
 *
 * This function is shared by both order-based and revenue-based subscription creation
 * to avoid code duplication. It performs the following steps:
 * 1. Finds the most recent active subscription
 * 2. Calls Shopify API to cancel it
 * 3. Updates local database status to 'cancelled'
 *
 * @param shopDomain - Shop domain name
 * @param accessToken - Shopify access token
 * @throws Error if cancellation fails
 */
export async function cancelExistingSubscription(shopDomain: string, accessToken: string): Promise<void> {
  // Find most recent active subscription with Shopify charge
  const existingSubscription = await Subscription.findOne({
    shopDomain,
    status: 'active',
    'shopifyCharge.id': { $exists: true },
  }).sort({ createdAt: -1 })

  // No active subscription to cancel
  if (!existingSubscription?.shopifyCharge?.id) {
    return
  }

  try {
    // Call Shopify GraphQL API to cancel
    const cancelResponse = await requestGraphqlApi({
      query: `mutation {
        appSubscriptionCancel(id: "gid://shopify/AppSubscription/${existingSubscription.shopifyCharge.id}") {
          userErrors { field message }
          appSubscription { id status }
        }
      }`,
      shopDomain,
      accessToken,
    })

    // Check for errors
    const userErrors = cancelResponse?.data?.appSubscriptionCancel?.userErrors
    if (userErrors && userErrors.length > 0) {
      throw new Error(`Failed to cancel: ${userErrors[0].message}`)
    }

    // Update local database
    const cancelledSubscription = cancelResponse?.data?.appSubscriptionCancel?.appSubscription
    if (cancelledSubscription) {
      await Subscription.updateOne({ _id: existingSubscription._id }, { status: 'cancelled' })
    }
  } catch (error) {
    throw error
  }
}

/**
 * Re-export shared utility functions for backward compatibility
 * Actual implementations are in pricing-utils.ts
 */
export const getFreeOrdersCount = getFreeOrdersCountShared
export const getOverageFeePerOrder = getOverageFeePerOrderShared
export const isOrderBasedPlan = isOrderBasedPlanShared
export const getOrderUsageTerms = getOrderUsageTermsShared
export const getRevenueUsageTerms = getRevenueUsageTermsShared
export const getSubscriptionName = getSubscriptionNameShared

/**
 * Determines if Shopify subscription creation is needed
 *
 * Shopify charge is required when:
 * - Plan has a price (not free)
 * - Plan requires charge approval
 * - User has exceeded free order allowance
 *
 * @param params - Configuration object
 * @returns True if Shopify charge should be created
 */
export function shouldCreateShopifyCharge(params: {
  plan: PricingPlanDocument
  finalPrice: number
  shopOrdersCount: number
  isAutomation: boolean
}): boolean {
  const { plan, finalPrice, shopOrdersCount, isAutomation } = params

  // Don't create charge for automated processes (e.g., auto-assignment on install)
  if (isAutomation) {
    return false
  }

  // Create charge if plan has price
  if (finalPrice > 0) {
    return true
  }

  // Create charge if plan requires approval
  if (plan.chargeApprovalRequired) {
    return true
  }

  // Create charge if user exceeded free orders
  const freeOrders = getFreeOrdersCount(plan)
  if (shopOrdersCount > freeOrders) {
    return true
  }

  return false
}

/**
 * Checks if a plan is revenue-based
 *
 * @param plan - Pricing plan document
 * @returns True if plan uses revenue-based billing
 */
export function isRevenueBasedPlan(plan: PricingPlanDocument): boolean {
  return getBillingType(plan) === 'revenue-based'
}

/**
 * Find all plan IDs with the same billing type as the given plan
 * Used to query subscriptions by capability (NOT version number)
 *
 * @param plan - Current pricing plan
 * @returns Array of plan ObjectIds with same billing capability
 *
 * @example
 * ```typescript
 * const planIds = await findPlanIdsByBillingType(plan)
 * const oldSub = await Subscription.findOne({ shopDomain, plan: { $in: planIds } })
 * ```
 */
/**
 * Find the earliest trial start date for V2 active-days trial
 *
 * Used to prevent trial abuse via uninstall/reinstall.
 * Returns Shop.trialStartedAt if exists (V2 pricing), null otherwise.
 *
 * For V1 pricing, trial dates are managed by Shopify via subscription.shopifyCharge.trial_ends_on
 */
export async function findEarliestTrialStartDate(shopDomain: string): Promise<Date | null> {
  const shop = (await Shop.findOne({ shopDomain }).select('trialStartedAt').lean()) as {
    trialStartedAt?: Date | string
  } | null

  if (shop?.trialStartedAt) {
    return new Date(shop.trialStartedAt)
  }

  return null
}

export async function findPlanIdsByBillingType(plan: PricingPlanDocument): Promise<any[]> {
  const billingType = getBillingType(plan)

  let query: any

  if (billingType === 'order-based') {
    // Find all plans with order-based billing
    query = { 'usages.orders': { $exists: true, $ne: [] } }
  } else if (billingType === 'revenue-based') {
    // Find all plans with revenue-based billing
    query = { 'usages.revenue': { $exists: true, $ne: [] } }
  } else {
    // Free plans
    query = {
      $and: [{ 'usages.orders': { $exists: false } }, { 'usages.revenue': { $exists: false } }],
    }
  }

  const plans = await PricingPlan.find(query).select('_id')
  return plans.map(p => p._id)
}
