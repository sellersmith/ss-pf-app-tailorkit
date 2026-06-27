import type { SubscriptionDocument } from '../Subscription'
import type { ShopDocument } from '../Shop'
import { getOrderCountInBillingCycle } from '../Order.server'
import { trackPlanUpgraded, trackPlanDowngraded } from '~/bootstrap/fns/mixpanel.server'
import PricingPlan, { getBillingCycleDates } from '../PricingPlan.server'
import Subscription, { ORDER_OVERAGE_LINE_ITEM_TERM } from '../Subscription.server'
import { createPlanChangeRecord } from '../PlanChangeRecord.server'
import { calculateChargeBreakdown, isOrderBasedPlan } from './pricing-utils'
import Shop from '../Shop.server'

import { requestGraphqlApi } from '~/shopify/graphql/fns.server'
import mongoose from 'mongoose'
import { BillingStateManager } from './BillingStateManager.server'

/**
 * Get current order count in billing cycle
 *
 * Calculates the number of orders placed within the current billing cycle
 * using the billing anchor date to determine the cycle boundaries (30-day period).
 *
 * @param shopDomain - Shop domain identifier (e.g., 'shop.myshopify.com')
 * @param billingAnchorDate - Start date of current billing cycle (Date or ISO string)
 * @returns Promise resolving to order count within the billing cycle
 *
 * @example
 * ```typescript
 * const orderCount = await getCurrentOrderCount('shop.myshopify.com', new Date('2026-02-01'))
 * console.log(`Orders this cycle: ${orderCount}`)
 * ```
 */
export async function getCurrentOrderCount(shopDomain: string, billingAnchorDate: Date | string): Promise<number> {
  // Ensure Date type
  const anchorDate = billingAnchorDate instanceof Date ? billingAnchorDate : new Date(billingAnchorDate)
  const { from, to } = getBillingCycleDates(anchorDate)
  return getOrderCountInBillingCycle(shopDomain, from, to)
}

/**
 * Reset subscription usage for fresh billing cycle
 *
 * Resets all usage counters when starting a fresh billing cycle.
 * Used for Trial→Paid transitions and billing model migrations (V1→V2, fixed→order-based).
 *
 * NOTE: Billing cycle tracking (billingAnchorDate, orderCountAtPlanChange, etc.) is now
 * managed by BillingCycle collection via BillingStateManager. This function only resets
 * Shop-level usage counters for UI display.
 *
 * Resets:
 * - Shop order counter (`usages.orders`) - webhook counter for UI
 * - AI credit usage and allocation
 *
 * @param shopDomain - Shop domain identifier
 * @param subscriptionId - MongoDB subscription ID (unused, kept for backward compatibility)
 * @param newPlan - New plan with AI credit allocation settings (unused, kept for backward compatibility)
 * @param billingStartDate - Start date of new billing cycle (unused, kept for backward compatibility)
 * @returns Promise that resolves when reset is complete
 *
 * @example
 * ```typescript
 * // Trial to paid transition
 * await resetSubscriptionUsage(
 *   'shop.myshopify.com',
 *   subscriptionId,
 *   paidPlan,
 *   new Date()
 * )
 * ```
 */
export async function resetSubscriptionUsage(
  shopDomain: string,
  subscriptionId: string,
  newPlan: any,
  billingStartDate: Date
): Promise<void> {
  // Reset shop usage counters (for UI display)
  await Shop.updateOne(
    { shopDomain },
    {
      $set: {
        'usages.orders': 0,
        'usages.aiCredit.monthlyUsage': 0,
        'usages.aiCredit.startMonth': new Date(),
      },
    }
  )

  // NOTE: Billing cycle fields (billingAnchorDate, orderCountAtPlanChange, orderCountAtLastCharge)
  // are now managed by BillingCycle collection via BillingStateManager.
  // No Subscription updates needed here.
}

/**
 * Get plan display name (alias or name)
 *
 * Extracts the user-facing display name from a plan object.
 * Prefers alias over name for better readability in UI/logs.
 *
 * @param plan - Plan object with name/alias fields
 * @returns Plan display name, or 'unknown' if not found
 *
 * @example
 * ```typescript
 * const displayName = getPlanName(plan) // 'Starter' or 'Growth Plus'
 * console.log(`Current plan: ${displayName}`)
 * ```
 */
export function getPlanName(plan: any): string {
  return plan?.name || plan?.alias || 'unknown'
}

/**
 * Create a single billing history record with charge breakdown
 * (Atomic helper - used by trackPlanChange and createPlanChangeRecords)
 */
export async function createSinglePlanChangeRecord(
  shopDomain: string,
  subscriptionId: string,
  fromPlan: any,
  toPlan: any,
  orderCount: number,
  billingCycleBaseline: number,
  eventType: 'upgrade' | 'downgrade' | 'cancellation'
): Promise<void> {
  const fromPlanName = getPlanName(fromPlan)

  // Only calculate charge breakdown for order-based plans
  if (fromPlan && isOrderBasedPlan(fromPlan)) {
    const chargeBreakdown = calculateChargeBreakdown(fromPlan, orderCount, billingCycleBaseline)

    await createPlanChangeRecord({
      shopDomain,
      subscriptionId: new mongoose.Types.ObjectId(subscriptionId),
      fromPlan: fromPlan._id,
      toPlan: toPlan?._id || toPlan,
      orderCountAtEvent: orderCount,
      eventType,
      eventDate: new Date(),
      chargeDetails: {
        timeline: new Date(),
        planName: fromPlanName,
        feePerOrder: chargeBreakdown.feePerOrder,
        extraOrders: chargeBreakdown.extraOrders,
        subtotal: chargeBreakdown.subtotal,
      },
    })
  }
}

/**
 * Track plan change (upgrade or downgrade) with PlanChangeRecord and Mixpanel event
 *
 * Records plan changes in database and sends analytics events to Mixpanel.
 * Creates detailed charge breakdown for order-based plans showing fees for extra orders.
 *
 * @param subscription - Current subscription document
 * @param shopData - Shop document for Mixpanel tracking
 * @param fromPlan - Previous plan (to calculate charges from)
 * @param toPlan - New plan (target plan)
 * @param orderCount - Current order count at time of change
 * @param isUpgrade - True for upgrade, false for downgrade
 * @returns Promise that resolves when tracking is complete
 *
 * @example
 * ```typescript
 * await trackPlanChange(
 *   subscription,
 *   shopData,
 *   starterPlan,
 *   growthPlan,
 *   15,
 *   true // is upgrade
 * )
 * ```
 */
export async function trackPlanChange(
  subscription: SubscriptionDocument,
  shopData: ShopDocument,
  fromPlan: any,
  toPlan: any,
  orderCount: number,
  isUpgrade: boolean
): Promise<void> {
  const fromPlanName = getPlanName(fromPlan)
  const toPlanName = getPlanName(toPlan)
  const changeType = isUpgrade ? 'upgrade' : 'downgrade'

  // Create PlanChangeRecord
  try {
    // Get billing cycle baseline from BillingStateManager
    let billingCycleBaseline = 0
    try {
      const billingState = await BillingStateManager.getCurrentState(subscription.shopDomain)
      billingCycleBaseline = billingState?.cycle?.orderCount?.initial || 0
    } catch (error) {
      console.error('[trackPlanChange] Failed to get billing state, using 0 as baseline:', error)
    }

    await createSinglePlanChangeRecord(
      subscription.shopDomain,
      subscription._id.toString(),
      fromPlan,
      toPlan,
      orderCount,
      billingCycleBaseline,
      changeType
    )
  } catch (err) {
    console.error(`[Analytics] Failed to create PlanChangeRecord:`, err)
  }

  // Track Mixpanel event
  try {
    if (isUpgrade) {
      await trackPlanUpgraded(shopData, fromPlanName, toPlanName, orderCount, 'manual')
    } else {
      await trackPlanDowngraded(shopData, fromPlanName, toPlanName, orderCount)
    }
  } catch (err) {
    console.error(`[Analytics] Failed to track plan ${changeType}:`, err)
  }
}

/**
 * Cancel all old active subscriptions in both Shopify and MongoDB
 * Used during plan changes to ensure clean transition to new subscription
 *
 * CRITICAL: Ensures transactional consistency between Shopify and MongoDB
 * - Cancels Shopify subscription FIRST (idempotent operation)
 * - Only updates MongoDB if Shopify cancellation succeeds
 * - Tracks failed cancellations for manual review
 *
 * @param shopDomain - Shop domain
 * @param newSubscriptionId - ID of new subscription to exclude from cancellation
 * @param newPlan - New plan for analytics tracking
 * @param accessToken - Shopify access token for API calls
 */
export async function cancelAllOldSubscriptions(
  shopDomain: string,
  newSubscriptionId: string,
  newPlan: any,
  accessToken: string
): Promise<void> {
  // Step 1: Find ALL active subscriptions (excluding the new one being activated)
  // CRITICAL: Query both subscriptions with AND without Shopify charges
  // - Real subscriptions have shopifyCharge.id → cancel in both Shopify + MongoDB
  // - One-time/tracking records don't have shopifyCharge.id → cancel in MongoDB only
  // DEFENSIVE: Exclude both string and ObjectId formats
  const oldSubscriptions = await Subscription.find({
    shopDomain,
    status: 'active',
    _id: {
      $nin: [
        newSubscriptionId, // String format
        new mongoose.Types.ObjectId(newSubscriptionId), // ObjectId format
      ],
    },
  })
  // Track failed cancellations for manual review
  const failedCancellations: Array<{ subscriptionId: string; shopifyChargeId: string; reason: string }> = []
  const successfullyCancelled: string[] = []

  // Step 2: Cancel EACH subscription with proper error handling
  for (const oldSub of oldSubscriptions) {
    const subscriptionId = oldSub._id.toString()
    const shopifyChargeId = oldSub.shopifyCharge?.id

    try {
      // Cancel in Shopify FIRST (idempotent operation)
      let shopifyCancellationSucceeded = false

      if (shopifyChargeId) {
        try {
          const cancelResponse = await requestGraphqlApi({
            query: `mutation {
              appSubscriptionCancel(id: "gid://shopify/AppSubscription/${shopifyChargeId}") {
                userErrors { field message }
                appSubscription { id status }
              }
            }`,
            shopDomain,
            accessToken,
          })

          const userErrors = cancelResponse?.data?.appSubscriptionCancel?.userErrors
          if (userErrors && userErrors.length > 0) {
            const errorMessage = userErrors.map((e: any) => e.message).join(', ')
            console.error('[CancelSubscriptions] Shopify cancel error:', userErrors)
            failedCancellations.push({
              subscriptionId,
              shopifyChargeId,
              reason: `Shopify API error: ${errorMessage}`,
            })
            continue // Don't update MongoDB if Shopify fails
          }

          shopifyCancellationSucceeded = true
        } catch (shopifyError) {
          console.error('[CancelSubscriptions] Shopify cancellation failed:', {
            subscriptionId,
            shopifyChargeId,
            error: shopifyError,
          })
          failedCancellations.push({
            subscriptionId,
            shopifyChargeId,
            reason: `Network/API error: ${shopifyError instanceof Error ? shopifyError.message : 'Unknown error'}`,
          })
          continue // Don't update MongoDB if Shopify fails
        }
      } else {
        // No Shopify charge ID, can safely mark as cancelled in MongoDB
        shopifyCancellationSucceeded = true
      }

      // Only update MongoDB if Shopify cancellation succeeded
      if (shopifyCancellationSucceeded) {
        await Subscription.updateOne({ _id: oldSub._id }, { status: 'cancelled' })
        successfullyCancelled.push(subscriptionId)
      }
    } catch (error) {
      console.error('[CancelSubscriptions] Unexpected error cancelling subscription:', {
        subscriptionId,
        shopifyChargeId,
        error,
      })
      failedCancellations.push({
        subscriptionId,
        shopifyChargeId: shopifyChargeId || 'N/A',
        reason: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }

  // Step 3: Log summary of cancellation results
  // Alert if any cancellations failed (requires manual review)
  if (failedCancellations.length > 0) {
    console.error('[CancelSubscriptions] ⚠️ FAILED CANCELLATIONS - MANUAL REVIEW REQUIRED:', {
      shopDomain,
      newSubscriptionId,
      failedCancellations,
    })

    // TODO: Add Slack/email alert for critical failures
    // await alertToSlack(`Failed to cancel ${failedCancellations.length} subscriptions for shop ${shopDomain}`)
  }

  // Step 4: Update shop.subscription to null (cleanup current reference)
  await Shop.updateOne({ shopDomain }, { subscription: null })

  // Step 5: Create PlanChangeRecords for SUCCESSFULLY cancelled subscriptions only
  // Filter to only include subscriptions that were successfully cancelled
  const successfullyCancelledSubs = oldSubscriptions.filter(sub => successfullyCancelled.includes(sub._id.toString()))
  await createPlanChangeRecords(successfullyCancelledSubs, newPlan, newSubscriptionId, shopDomain)
}

/**
 * Create billing history records for multiple old subscriptions after upgrade/downgrade
 *
 * Batch creates PlanChangeRecord documents for all old subscriptions being replaced.
 * Only processes order-based plans (revenue-based plans don't have charge breakdowns).
 * Used after successful subscription cancellation to track charge history.
 *
 * @param oldSubscriptions - Array of old subscription documents being cancelled
 * @param newPlan - New plan being activated
 * @param newSubscriptionId - MongoDB ID of new subscription
 * @param shopDomain - Shop domain identifier
 * @returns Promise that resolves when all records are created
 *
 * @example
 * ```typescript
 * await createPlanChangeRecords(
 *   [oldSubscription1, oldSubscription2],
 *   newPlan,
 *   newSubscriptionId,
 *   'shop.myshopify.com'
 * )
 * ```
 */
export async function createPlanChangeRecords(
  oldSubscriptions: SubscriptionDocument[],
  newPlan: any,
  newSubscriptionId: string,
  shopDomain: string
): Promise<void> {
  if (!oldSubscriptions.length || !newPlan) return

  for (const oldSub of oldSubscriptions) {
    try {
      const oldPlan = oldSub.plan as any
      if (!oldPlan || !isOrderBasedPlan(oldPlan)) continue

      // Get order count and billing baseline from BillingStateManager
      let currentOrderCount = 0
      let billingCycleBaseline = 0

      try {
        const billingState = await BillingStateManager.getCurrentState(shopDomain)
        if (billingState) {
          currentOrderCount = billingState.cycle.orderCount.current
          billingCycleBaseline = billingState.cycle.orderCount.initial
        }
      } catch (error) {
        console.error('[createPlanChangeRecords] Failed to get billing state, using defaults:', error)
      }

      const eventType: 'upgrade' | 'downgrade' = newPlan.price >= oldPlan.price ? 'upgrade' : 'downgrade'

      // Create record using atomic helper
      await createSinglePlanChangeRecord(
        shopDomain,
        newSubscriptionId,
        oldPlan,
        newPlan,
        currentOrderCount,
        billingCycleBaseline,
        eventType
      )
    } catch (error) {
      console.error('[Analytics] Error creating PlanChangeRecord:', { oldSubId: oldSub._id, error })
    }
  }
}

/**
 * Track subscription cancellation with PlanChangeRecord
 *
 * Records subscription cancellation in database with final charge breakdown.
 * Sends cancellation event to Mixpanel for analytics tracking.
 * Calculates and stores final charges for order-based plans.
 *
 * @param subscription - Subscription being cancelled
 * @param shopData - Shop document for Mixpanel tracking
 * @param plan - Plan being cancelled (to calculate final charges)
 * @param orderCount - Final order count at time of cancellation
 * @returns Promise that resolves when tracking is complete
 *
 * @example
 * ```typescript
 * await trackCancellation(
 *   subscription,
 *   shopData,
 *   currentPlan,
 *   25 // final order count
 * )
 * ```
 */
export async function trackCancellation(
  subscription: SubscriptionDocument,
  shopData: ShopDocument,
  plan: any,
  orderCount: number
): Promise<void> {
  const planName = getPlanName(plan)

  // Create PlanChangeRecord with charge details
  try {
    // Only calculate charge breakdown for order-based plans
    if (plan && isOrderBasedPlan(plan)) {
      // Get billing cycle baseline from BillingStateManager
      let billingCycleBaseline = 0
      try {
        const billingState = await BillingStateManager.getCurrentState(subscription.shopDomain)
        billingCycleBaseline = billingState?.cycle?.orderCount?.initial || 0
      } catch (error) {
        console.error('[trackCancellation] Failed to get billing state, using 0 as baseline:', error)
      }

      const chargeBreakdown = calculateChargeBreakdown(plan, orderCount, billingCycleBaseline)

      await createPlanChangeRecord({
        shopDomain: subscription.shopDomain,
        subscriptionId: new mongoose.Types.ObjectId(subscription._id.toString()),
        fromPlan: plan._id,
        toPlan: 'cancelled',
        orderCountAtEvent: orderCount,
        eventType: 'cancellation',
        eventDate: new Date(),
        chargeDetails: {
          timeline: new Date(),
          planName,
          feePerOrder: chargeBreakdown.feePerOrder,
          extraOrders: chargeBreakdown.extraOrders,
          subtotal: chargeBreakdown.subtotal,
        },
      })

      console.log(
        `[Analytics] Created PlanChangeRecord for cancellation: ${planName}, final charges: $${chargeBreakdown.subtotal}`
      )
    } else {
      // For non-order-based plans, create record without charge details
      await createPlanChangeRecord({
        shopDomain: subscription.shopDomain,
        subscriptionId: new mongoose.Types.ObjectId(subscription._id.toString()),
        fromPlan: plan._id,
        toPlan: 'cancelled',
        orderCountAtEvent: orderCount,
        eventType: 'cancellation',
        eventDate: new Date(),
        chargeDetails: {
          timeline: new Date(),
          planName,
          feePerOrder: 0,
          extraOrders: 0,
          subtotal: 0,
        },
      })

      console.log(`[Analytics] Created PlanChangeRecord for cancellation: ${planName} (non-order-based)`)
    }
  } catch (err) {
    console.error('[Analytics] Failed to create PlanChangeRecord for cancellation:', err)
  }

  // Track Mixpanel event
  try {
    await trackPlanDowngraded(shopData, planName, 'cancelled', orderCount)
    console.log(`[Analytics] Tracked cancellation: ${planName} → cancelled`)
  } catch (err) {
    console.error('[Analytics] Failed to track cancellation:', err)
  }
}

/**
 * Find plan by webhook charge data with capability-based detection
 *
 * Uses capability-based detection (order-based vs revenue-based) instead of
 * version-based lookup to correctly identify plans when multiple plans share the same price.
 *
 * Detection strategy:
 * 1. Check line items for order usage pricing (ORDER_OVERAGE_LINE_ITEM_TERM)
 * 2. Check line items for revenue usage pricing (other AppUsagePricing)
 * 3. Fallback to price lookup with any usage capability
 * 4. Final fallback to simple price lookup
 *
 * @param price - Recurring price from webhook lineItems
 * @param pricingVersion - Deprecated parameter, kept for backward compatibility (not used)
 * @param lineItems - Shopify subscription lineItems from webhook payload
 * @returns Promise resolving to PricingPlanDocument or null if not found
 *
 * @example
 * ```typescript
 * const lineItems = payload.app_subscription.lineItems
 * const plan = await findPlanByChargeData(19, 2, lineItems)
 * if (plan) {
 *   console.log(`Found plan: ${plan.name}`)
 * }
 * ```
 */
export async function findPlanByChargeData(price: number, pricingVersion: number, lineItems: any[]): Promise<any> {
  // Check for order-based plan using line item terms
  const hasOrderUsage = lineItems?.some(
    item =>
      item.plan?.pricingDetails?.__typename === 'AppUsagePricing'
      && item.plan?.pricingDetails?.terms?.includes(ORDER_OVERAGE_LINE_ITEM_TERM)
  )

  if (hasOrderUsage) {
    const plans = await PricingPlan.find({
      price,
      'usages.orders': { $exists: true, $ne: [] },
    })

    // Prefer user-selectable plans when multiple matches exist (e.g., trial vs paid plans at same price)
    if (plans.length > 1) {
      return plans.find(p => p.userSelectable !== false) || plans[0]
    }

    return plans[0] || null
  }

  // Check for revenue-based plan
  const hasRevenueUsage = lineItems?.some(
    item =>
      item.plan?.pricingDetails?.__typename === 'AppUsagePricing'
      && !item.plan?.pricingDetails?.terms?.includes(ORDER_OVERAGE_LINE_ITEM_TERM)
  )

  if (hasRevenueUsage) {
    return PricingPlan.findOne({
      price,
      'usages.revenue': { $exists: true, $ne: [] },
    })
  }

  // Fallback to price lookup with any usage capability
  const planWithCapability = await PricingPlan.findOne({
    price,
    $or: [{ 'usages.orders': { $exists: true, $ne: [] } }, { 'usages.revenue': { $exists: true, $ne: [] } }],
  })

  if (planWithCapability) {
    return planWithCapability
  }

  // Final fallback to simple price lookup
  return PricingPlan.findOne({ price })
}

/**
 * Get billing type of a plan
 *
 * Determines the billing model used by a plan with defensive edge case handling.
 * Handles plans with multiple billing types or neither (misconfigured plans).
 *
 * @param plan - Plan object to check
 * @returns Billing type: 'order-based' | 'revenue-based' | 'fixed' | 'unknown'
 *
 * @example
 * ```typescript
 * const billingType = getBillingType(plan)
 * if (billingType === 'order-based') {
 *   // Handle order-based billing
 * }
 * ```
 */
export function getBillingType(plan: any): 'order-based' | 'revenue-based' | 'fixed' | 'unknown' {
  if (!plan) return 'unknown'

  const hasOrderBilling = plan.usages?.orders && Array.isArray(plan.usages.orders) && plan.usages.orders.length > 0
  const hasRevenueBilling = plan.usages?.revenue && Array.isArray(plan.usages.revenue) && plan.usages.revenue.length > 0

  // Edge case: Plan has BOTH billing types (misconfigured, prefer order-based)
  if (hasOrderBilling && hasRevenueBilling) {
    console.warn('[getBillingType] Plan has both order and revenue billing, using order-based:', plan._id)
    return 'order-based'
  }

  // Standard cases
  if (hasOrderBilling) return 'order-based'
  if (hasRevenueBilling) return 'revenue-based'

  // No usage-based billing (fixed price plan)
  if (plan.price !== undefined && plan.price >= 0) return 'fixed'

  return 'unknown'
}

/**
 * Detect if a plan is a trial plan
 *
 * Trial plans are characterized by:
 * - Alias/name contains "trial"
 * - Price = 0 AND userSelectable = false
 *
 * @param plan - Plan object to check
 * @returns True if plan is trial
 *
 * @example
 * ```typescript
 * if (isTrialPlan(currentPlan)) {
 *   console.log('User is on trial')
 * }
 * ```
 */
export function isTrialPlan(plan: any): boolean {
  if (!plan) return false

  // Check explicit trial markers in alias/name
  if (plan.alias?.toLowerCase().includes('trial')) return true
  if (plan.name?.toLowerCase().includes('trial')) return true

  // Check plan characteristics (price=0 + not user-selectable)
  if (plan.price === 0 && plan.userSelectable === false) return true

  return false
}

/**
 * Determine subscription change type with trial handling
 *
 * Distinguishes between:
 * - **Trial → Paid**: Conversion from trial to paid plan (not considered "upgrade")
 * - **Paid → Trial**: Moving to trial plan (not considered "downgrade")
 * - **Upgrade**: Paid plan with higher price
 * - **Downgrade**: Paid plan with lower price
 * - **Same**: No price change
 *
 * @param fromPlan - Previous plan
 * @param toPlan - New plan
 * @returns Change type: 'trial_to_paid' | 'paid_to_trial' | 'upgrade' | 'downgrade' | 'same'
 *
 * @example
 * ```typescript
 * const type = getSubscriptionChangeType(oldPlan, newPlan)
 * if (type === 'trial_to_paid') {
 *   await trackConversion(shopData)
 * } else if (type === 'upgrade') {
 *   await trackPlanUpgraded(shopData, oldPlan, newPlan)
 * }
 * ```
 */
export function getSubscriptionChangeType(
  fromPlan: any,
  toPlan: any
): 'trial_to_paid' | 'paid_to_trial' | 'upgrade' | 'downgrade' | 'same' {
  const isFromTrial = isTrialPlan(fromPlan)
  const isToTrial = isTrialPlan(toPlan)

  // Trial transitions (special handling)
  if (isFromTrial && !isToTrial) return 'trial_to_paid'
  if (!isFromTrial && isToTrial) return 'paid_to_trial'

  // Price-based for paid → paid transitions
  const fromPrice = fromPlan?.price || 0
  const toPrice = toPlan?.price || 0

  if (toPrice > fromPrice) return 'upgrade'
  if (toPrice < fromPrice) return 'downgrade'

  return 'same'
}
