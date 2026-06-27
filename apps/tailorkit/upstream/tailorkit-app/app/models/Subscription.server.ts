import type { SubscriptionDocument } from './Subscription'
import mongoose from '~/bootstrap/db/connect-db.server'
import ShopifySession from './ShopifySession.server'
import Shop, { getShopData } from './Shop.server'
import { requestGraphqlApi } from '~/shopify/graphql/fns.server'
import { verifyResponse } from '~/shopify/graphql/api.server'
import type { ShopDocument } from './Shop'
import { trackChargeUsageFees } from '~/bootstrap/fns/mixpanel.server'
import { USAGE_FEE_TYPES } from '~/bootstrap/constants/eventsTracking'
import { getTrialStatus } from './PricingPlan.fns'
import BillingStateManager from './helpers/BillingStateManager.server'
import { getOverageFeePerOrder } from '~/models/helpers/pricing-utils'
import { getCurrentOrderCount, getPlanName } from '~/models/helpers/subscription-analytics.server'
import { isOnActiveDaysTrial } from './helpers/trial-tracking.server'
import { accumulateTrialDebt } from './helpers/trial-debt.server'
import {
  verifyCancellation,
  recordCancellationExecuted,
  isBroadCancelEnabled,
  logCancellationEvent,
} from './helpers/cancellation-guard.server'
import type { CancellationReason, CancellationContext } from './helpers/cancellation-guard.server'

/**
 * Usage Line Item Constants
 * Used to match Shopify subscription line items for usage charges
 */
export const AI_CREDITS_LINE_ITEM_TERM = 'AI Credits'
export const ORDER_OVERAGE_LINE_ITEM_TERM = 'per order'

/**
 * Get usage line item ID from subscription
 * @param subscription - Shopify subscription with lineItems
 * @param termMatch - Optional term to match
 * @returns Line item ID or undefined
 */
export function getUsageLineItemId(subscription: any, termMatch?: string): string | undefined {
  if (!subscription?.lineItems) {
    return undefined
  }

  if (termMatch) {
    return subscription.lineItems.find((item: any) => {
      return (
        item.plan?.pricingDetails?.__typename === 'AppUsagePricing'
        && item.plan?.pricingDetails?.terms?.includes(termMatch)
      )
    })?.id
  }

  return subscription.lineItems.find((item: any) => {
    return item.plan?.pricingDetails?.__typename === 'AppUsagePricing'
  })?.id
}

const subscriptionSchema = new mongoose.Schema<SubscriptionDocument>(
  {
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    /**
     * `plan` is the `_id` of a document in the `plans` collection.
     */
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PricingPlan',
      index: true,
      required: true,
    },
    /**
     * `couponCode` is the `code` of a document in the `coupons` collection. If
     * `couponCode` is defined, the affected coupon will be used to calculate the
     * final price of the affected plan.
     */
    couponCode: {
      type: String,
      index: true,
    },
    couponAppliedOn: String,
    finalPrice: {
      type: Number,
      index: true,
      required: true,
    },
    periodical: {
      type: String,
      index: true,
      default: 'monthly',
      enum: ['monthly', 'annually', 'one-time'],
    },
    from: {
      type: Date,
      index: true,
      default: null,
    },
    to: {
      type: Date,
      index: true,
      default: null,
    },
    status: {
      type: String,
      index: true,
      default: 'pending',
      enum: ['pending', 'active', 'inactive', 'cancelled'],
    },
    coupon: mongoose.Schema.Types.Mixed,
    usageStats: mongoose.Schema.Types.Mixed,
    shopifyCharge: mongoose.Schema.Types.Mixed,
    userCappedAmount: Number,
    reachedUserCappedAmount: Boolean,
    /**
     * Reference to active billing cycle
     * Points to the current 30-day billing cycle in BillingCycle collection
     * Used by BillingStateManager for all billing operations
     */
    activeBillingCycle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BillingCycle',
      index: true,
    },
  },
  { timestamps: true }
)

// Compound indexes for analytics queries optimization
subscriptionSchema.index({ status: 1, createdAt: 1 }) // MRR, ARPU, revenue calculations
subscriptionSchema.index({ status: 1, periodical: 1 }) // Active subscription queries by period
subscriptionSchema.index({ shopDomain: 1, status: 1 }) // Per-shop subscription queries

const Subscription
  = mongoose.models.Subscription || mongoose.model<SubscriptionDocument>('Subscription', subscriptionSchema)

export default Subscription

/**
 * Get the active subscription by shop domain.
 * @param shopDomain - The shop domain to get the active subscription for.
 * @returns The active subscription or null if not found.
 */
export async function getActiveSubscriptionByShopDomain(shopDomain: string): Promise<SubscriptionDocument | null> {
  return Subscription.findOne({ shopDomain, status: 'active' })
}

/**
 * Method to create a new subscription.
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/mutations/appSubscriptionCreate
 * @param shopDomain   This is the domain end with `.myshopify.com`.
 * @param payload      An object containing `planId` and `couponCode`.
 *                     - planId: id of plan
 *                     - couponCode: discount code
 * @param isAutomation Whether a new subscription is being created automatically?
 *                     If this is an automation then new app subscription at Shopify
 *                     will not be created.
 *
 * @return {Promise<*>}
 */
// Re-export subscription creation function from helper
export { createSubscription } from './helpers/subscription-creation.server'

/**
 * Method to create an app usage record.
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/mutations/appUsageRecordCreate
 * @param shopDomain   This is the domain end with `.myshopify.com`.
 * @param subscription Shopify subscription charge object.
 * @param amount       The amount to charge.
 * @param description  A description that describes this charge.
 * @param lineItemTermsMatch Optional string to match specific line item by terms (e.g., "AI Credits", "per order")
 *
 * @return {Promise<*>}
 */
export async function createAppUsageRecord(
  shopDomain: string,
  subscription: any,
  amount: number,
  description: string,
  lineItemTermsMatch?: string
): Promise<any> {
  const session = await ShopifySession.findOne({ shop: shopDomain })

  // Find the correct usage line item using helper
  const subscriptionLineItemId = getUsageLineItemId(subscription, lineItemTermsMatch)

  if (!subscriptionLineItemId) {
    const errorMsg = lineItemTermsMatch
      ? `Usage line item with terms matching "${lineItemTermsMatch}" not found in subscription`
      : 'No usage line item found in subscription'
    throw new Error(errorMsg)
  }

  return verifyResponse(
    await requestGraphqlApi({
      query: `mutation {
      appUsageRecordCreate(
        description: "${description}"
        price: { amount: ${amount}, currencyCode: USD }
        subscriptionLineItemId: "${subscriptionLineItemId}"
      ) {
        appUsageRecord {
          id
          createdAt
          description
          price {
            amount
            currencyCode
          }
          subscriptionLineItem {
            id
            plan {
              pricingDetails {
                ... on AppUsagePricing {
                  terms
                  balanceUsed {
                    amount
                    currencyCode
                  }
                  cappedAmount {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }`,
      shopDomain,
      accessToken: session.accessToken,
    }),
    'appUsageRecordCreate'
  )
}

/**
 * Update order count for real-time display (lightweight)
 * Called from webhook when orders arrive - updates shop.usages.orders immediately
 * Does NOT charge Shopify (charging happens separately via submitDailyUsageCharge)
 *
 * @param shopDomain - Shop domain to update
 * @returns Promise resolving to updated order count or null
 */
export async function updateOrderCount(shopDomain: string): Promise<number | null> {
  // Get active subscription
  const subscription = await Subscription.findOne({ shopDomain, status: 'active' }).populate('plan')
  if (!subscription) {
    return null
  }

  const plan = subscription.plan as any
  // Only process order-based plans (has usages.orders)
  if (!plan || !plan.usages?.orders || plan.usages.orders.length === 0) {
    return null
  }

  // Ensure billing cycle exists (required for billing tracking)
  let billingState = await BillingStateManager.getCurrentState(shopDomain)
  if (!billingState) {
    // Create initial billing cycle if missing
    console.log(`[updateOrderCount] Creating initial billing cycle for ${shopDomain}`)
    await BillingStateManager.createCycle(subscription, plan, {
      isFirstCycle: true,
    })
    billingState = await BillingStateManager.getCurrentState(shopDomain)
  }

  // Use atomic increment to update order count in Shop collection
  // This is safe for concurrent webhooks - MongoDB guarantees atomicity
  // Used for UI display (performance optimization - no DB query needed)
  await Shop.updateOne({ shopDomain }, { $inc: { 'usages.orders': 1 } })

  // Update order count in BillingCycle for accurate billing
  // Get current count from Shop after increment
  const shopData = await Shop.findOne({ shopDomain }, 'usages.orders')
  const newOrderCount = shopData?.usages?.orders || 0

  // Update BillingCycle with new order count
  await BillingStateManager.updateOrderCount(shopDomain, newOrderCount)

  // Return updated count for logging
  return newOrderCount
}

/**
 * Submit daily usage charges for order-based pricing (runs once per day)
 * Uses incremental charging: only bills the DELTA since last charge
 * This prevents double-charging and creates clean invoice line items
 *
 * Flow: Cron (23:00 daily) → syncShopUsage() → submitDailyUsageCharge()
 * - Updates shop.usages.orders (ensures consistency)
 * - Calculates incremental fee (delta from last charge)
 * - Charges Shopify if new overage exists
 *
 * @param shopDomain - Shop domain to process
 * @returns Promise resolving to usage record or null if no overage
 */
export async function submitDailyUsageCharge(shopDomain: string): Promise<any> {
  // Get active recurring subscription (exclude one-time charge records)
  const subscription = await Subscription.findOne({
    shopDomain,
    status: 'active',
    periodical: { $ne: 'one-time' }, // Exclude one-time charge tracking records
  }).populate('plan')
  if (!subscription) {
    return null
  }

  const plan = subscription.plan as any
  // Only process order-based plans (has usages.orders)
  if (!plan || !plan.usages?.orders || plan.usages.orders.length === 0) {
    return null
  }

  // NEW: Check active-days trial status
  // If shop is on trial, accumulate debt instead of charging Shopify
  const shop = await Shop.findOne({ shopDomain })
  if (isOnActiveDaysTrial(shop, plan)) {
    console.log(`[submitDailyUsageCharge] Shop ${shopDomain} on active-days trial, accumulating debt`)

    // Accumulate debt instead of charging
    await accumulateTrialDebt(shopDomain, subscription, plan)
    return null // Skip Shopify charge
  }

  // Get billing state from BillingStateManager
  let billingState = await BillingStateManager.getCurrentState(shopDomain)
  if (!billingState) {
    console.log(`[submitDailyUsageCharge] No active billing cycle found for ${shopDomain}, creating one...`)

    // Create initial billing cycle (backfill for existing subscriptions)
    // Use subscription.from date as cycle start, or current date if not available
    const billingStartDate = subscription.from ? new Date(subscription.from) : new Date()
    const currentOrderCount = await getCurrentOrderCount(shopDomain, billingStartDate)

    await BillingStateManager.createCycle(subscription, plan, {
      isFirstCycle: false, // Not truly first cycle, just backfilling
      cycleStartDate: billingStartDate,
      initialOrderCount: currentOrderCount,
    })

    // Get fresh billing state after creation
    billingState = await BillingStateManager.getCurrentState(shopDomain)
    if (!billingState) {
      console.error(`[submitDailyUsageCharge] Failed to create billing cycle for ${shopDomain}`)
      return null
    }

    console.log(`[submitDailyUsageCharge] ✅ Created initial billing cycle for ${shopDomain}`)
  }

  // Check for billing cycle rollover (30-day cycle completed)
  const now = new Date()
  const cycleEndDate = new Date(billingState.cycle.cycleEndDate)
  if (now >= cycleEndDate) {
    console.log(`[submitDailyUsageCharge] New billing cycle detected for ${shopDomain}, rolling over cycle`)

    // Rollover to new cycle using BillingStateManager
    await BillingStateManager.rolloverCycle(shopDomain, subscription, plan)

    // Get fresh billing state after rollover
    billingState = await BillingStateManager.getCurrentState(shopDomain)
    if (!billingState) {
      console.error(`[submitDailyUsageCharge] Failed to get billing state after rollover for ${shopDomain}`)
      return null
    }
  }

  // Get current order count from billing state
  const orderCount = billingState.cycle.orderCount.current

  // Get order counts from billing state
  // initial = orderCountAtPlanChange (baseline when cycle started or plan changed)
  // current = current order count
  const orderCountAtPlanChange = billingState.cycle.orderCount.initial

  // Get last charged order count from most recent usage fee (if any)
  // This prevents double-charging by tracking the checkpoint of last charge
  const usageFees = billingState.cycle.charges.usageFees
  const orderCountAtLastCharge
    = usageFees.length > 0
      ? Math.max(...usageFees.map(fee => fee.orderCount)) // Get highest order count (most recent)
      : orderCountAtPlanChange

  // Use helper functions to extract plan limits
  const planLimit = billingState.freeOrders
  const overageFee = getOverageFeePerOrder(plan)

  let incrementalFee = 0
  let newOverageOrders = 0

  // Case 1: Already over limit at plan change (quota exhausted)
  // Example: Downgrade to Starter (50 limit) at 420 orders
  // → 370 orders already over limit, quota fully used
  // → ALL new orders (421+) are charged at overage rate
  if (orderCountAtPlanChange >= planLimit) {
    newOverageOrders = orderCount - orderCountAtLastCharge
    incrementalFee = newOverageOrders * overageFee
  }
  // Case 2: Not over limit at plan change (quota still available)
  // Example: Upgrade to Growth (350 limit) at 60 orders
  // → 290 orders remaining in quota
  // → Only charge for orders that exceed the 350 limit
  else {
    const currentOrdersSincePlanChange = orderCount - orderCountAtPlanChange
    const previousOrdersSincePlanChange = orderCountAtLastCharge - orderCountAtPlanChange

    const currentOverage = Math.max(0, currentOrdersSincePlanChange - planLimit)
    const previousOverage = Math.max(0, previousOrdersSincePlanChange - planLimit)

    newOverageOrders = currentOverage - previousOverage
    incrementalFee = newOverageOrders * overageFee
  }

  // No new overage - skip charge
  // This check also prevents duplicate charges: if we already charged today,
  // orderCountAtLastCharge checkpoint ensures incrementalFee = 0
  if (incrementalFee <= 0) {
    return null
  }

  // During Shopify-managed trial: usage is counted above, but don't submit charge
  const trialStatus = getTrialStatus(subscription)
  if (trialStatus?.isOnTrial) {
    console.log(
      `[submitDailyUsageCharge] Shop ${shopDomain} in trial (ends ${trialStatus.trialEndDate?.toISOString()}), charge skipped`
    )
    return null
  }

  // Get today's date for description
  const today = new Date().toISOString().split('T')[0]
  const { from, to } = { from: billingState.cycle.cycleStartDate, to: billingState.cycle.cycleEndDate }

  // Build description for Shopify invoice
  const description
    = orderCountAtLastCharge > orderCountAtPlanChange
      ? `${newOverageOrders} additional orders processed (as of ${today})`
      : `${newOverageOrders} orders over ${planLimit} included limit (as of ${today})`

  // Submit INCREMENTAL usage charge to Shopify
  try {
    // Pass ORDER_OVERAGE_LINE_ITEM_TERM to ensure we charge the correct line item (not AI Credits)
    const usageRecord = await createAppUsageRecord(
      shopDomain,
      subscription.shopifyCharge,
      incrementalFee, // Only charge the delta
      description,
      ORDER_OVERAGE_LINE_ITEM_TERM // Match order overage line item specifically
    )

    // Save charge record to database for tracking
    await Subscription.create({
      shopDomain,
      plan: plan._id,
      periodical: 'one-time',
      finalPrice: incrementalFee,
      status: 'active',
      from,
      to,
      shopifyCharge: usageRecord,
    })

    // Record charge in BillingCycle using BillingStateManager
    await BillingStateManager.recordUsageCharge(shopDomain, {
      orderCount,
      extraOrders: newOverageOrders,
      amount: incrementalFee,
      shopifyChargeId: usageRecord.id,
    })

    // Track Mixpanel analytics events
    const shopData = await getShopData(shopDomain)
    if (shopData) {
      const planName = getPlanName(plan)
      const planPrice = plan.price || 0
      // Use subscription's finalPrice which includes discount from coupon
      const planPriceAfterDiscount = subscription.finalPrice || planPrice

      // Usage fees typically don't have separate discounts
      // Discount is applied at plan level, not usage level
      const usageFees = incrementalFee
      const usageFeesAfterDiscount = usageFees

      // Track usage fees event
      await trackChargeUsageFees(
        shopData,
        planName,
        planPrice,
        planPriceAfterDiscount,
        USAGE_FEE_TYPES.ORDER_OVERAGE,
        usageFees,
        usageFeesAfterDiscount,
        {
          numIncludedOrders: planLimit,
          numOverageOrders: newOverageOrders,
        }
      )
    } else {
      console.log('  ⚠️  Shop data not found - skipping analytics')
    }

    return usageRecord
  } catch (error) {
    console.error(`[submitDailyUsageCharge] Error for ${shopDomain}:`, error)
    throw error
  }
}

/**
 * Method to cancel the current subscription of a shop.
 *
 * HARDENED: Added pre-cancellation verification, structured audit logging,
 * cooldown rate-limiting, and gated broad updateMany behind env flag.
 *
 * @param shop                      Shop domain string or ShopDocument.
 * @param cancelShopifySubscription Whether to cancel at Shopify. Set false if app already uninstalled.
 * @param rememberLastSubscription  Whether to save lastSubscription reference on shop document.
 * @param cancellationReason        Structured reason for audit trail. Defaults to 'app_uninstalled'.
 * @param caller                    Caller identifier for traceability.
 */
export async function cancelCurrentSubscription(
  shop: null | string | ShopDocument,
  cancelShopifySubscription = true,
  rememberLastSubscription = true,
  cancellationReason: CancellationReason = 'app_uninstalled',
  caller = 'unknown'
): Promise<void> {
  shop = typeof shop === 'string' ? await getShopData(shop) : shop

  if (!shop) {
    return
  }

  const shopDomain = shop.shopDomain
  const subscriptionId = (shop.subscription as SubscriptionDocument)?._id || shop.subscription

  // Build cancellation context for audit trail
  const ctx: CancellationContext = {
    reason: cancellationReason,
    shopDomain,
    targetSubscriptionId: subscriptionId?.toString(),
    caller,
  }

  // Pre-cancellation verification (cooldown + active check)
  const verification = await verifyCancellation(ctx)
  if (!verification.allowed) {
    logCancellationEvent('BLOCKED_BY_GUARD', ctx, {
      denialReason: verification.denialReason,
    })
    return
  }

  logCancellationEvent('EXECUTING', ctx, {
    cancelShopifySubscription,
    rememberLastSubscription,
    activeSubscriptionCount: verification.activeSubscriptionCount,
  })

  // Cancel the specific subscription by _id
  const { _id, shopifyCharge }
    = (await Subscription.findOneAndUpdate({ _id: subscriptionId }, { status: 'inactive' })) || {}

  // GUARDED: Broad updateMany only runs if explicitly enabled.
  // Without env flag, only the targeted subscription is cancelled — prevents mass-cancel.
  if (isBroadCancelEnabled()) {
    const broadResult = await Subscription.updateMany(
      { shopDomain, status: 'active', periodical: { $ne: 'one-time' } },
      { status: 'inactive' }
    )
    logCancellationEvent('BROAD_CANCEL_EXECUTED', ctx, {
      matchedCount: broadResult.matchedCount,
      modifiedCount: broadResult.modifiedCount,
    })
  } else {
    logCancellationEvent('BROAD_CANCEL_SKIPPED', ctx, {
      note: 'ENABLE_BROAD_SUBSCRIPTION_CANCEL not set; only targeted subscription cancelled',
    })
  }

  // Update shop subscription reference
  await Shop.updateOne(
    { shopDomain },
    { subscription: null, ...(rememberLastSubscription ? { lastSubscription: _id } : {}) }
  )

  // Cancel active Shopify charge if present
  if (shopifyCharge?.id) {
    ctx.shopifyChargeId = shopifyCharge.id
    let res

    if (cancelShopifySubscription) {
      const session = await ShopifySession.findOne({ shop: shopDomain })

      res = await requestGraphqlApi({
        query: `mutation {
          appSubscriptionCancel(
            id: "gid://shopify/AppSubscription/${shopifyCharge.id}"
          ) {
            appSubscription {
              status
            }
            userErrors {
              field
              message
            }
          }
        }`,
        shopDomain,
        accessToken: session.accessToken,
      })

      logCancellationEvent('SHOPIFY_CANCEL_RESPONSE', ctx, {
        response: res?.appSubscriptionCancel,
      })
    }

    // Update Shopify charge data
    await Subscription.updateOne(
      { _id },
      {
        shopifyCharge: {
          ...shopifyCharge,
          cancelled_on: new Date().toISOString().substring(0, 10),
          ...(res?.appSubscriptionCancel?.appSubscription || { status: 'CANCELLED' }),
        },
      }
    )
  }

  // Record execution for cooldown
  recordCancellationExecuted(shopDomain)

  logCancellationEvent('COMPLETED', ctx, { cancelledId: _id?.toString() })
}

/**
 * Get the total charged usage fees for a shop
 *
 * @param shopDomain string
 * @param from Date
 * @param to Date
 * @returns number
 */
export async function getTotalChargedUsageFees(shopDomain: string, from: Date, to: Date): Promise<number> {
  const subscriptions = await Subscription.aggregate([
    {
      $match: {
        $and: [
          { shopDomain },
          { status: 'active' },
          { periodical: 'one-time' },
          { createdAt: { $lte: to } },
          { createdAt: { $gte: from } },
        ],
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$finalPrice' },
      },
    },
  ])

  const totalChargedUsageFees = subscriptions[0]?.total || 0

  return totalChargedUsageFees
}
