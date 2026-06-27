/**
 * AI Credit Reset - Unified Logic
 *
 * Single source of truth for AI credit resets across all plan types.
 * Replaces 3 duplicate implementations that existed in Shop.server.ts and Subscription.server.ts.
 */

import { ONE_DAY_IN_MILLISECONDS } from '~/constants'
import type { ShopDocument } from '~/models/Shop'
import type { SubscriptionDocument } from '~/models/Subscription'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import Shop from '~/models/Shop.server'
import { BillingStateManager } from '~/models/helpers/BillingStateManager.server'
import {
  calculateAiCreditBalance,
  getAiCreditBalanceSummary,
  hasEnoughAiCredits,
} from '~/models/helpers/ai-credit-utils'
import { createAiCreditTransaction } from '~/models/AiCreditTransaction.server'
import { AI_CREDIT_PER_MONTH } from '~/constants/ai-assistant'
import { postEventToCustomerIo } from '~/modules/customer.io/api.server'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'

const AI_CREDIT_THRESHOLDS = [50, 80, 100] as const

const THRESHOLD_EVENT_MAP: Record<number, string> = {
  50: CUSTOMERIO_EVENTS.AI_CREDIT_REACHED_50,
  80: CUSTOMERIO_EVENTS.AI_CREDIT_REACHED_80,
  100: CUSTOMERIO_EVENTS.AI_CREDIT_REACHED_100,
}

/**
 * Check if credits should reset based on plan type and timing.
 */
async function shouldResetAiCredits(
  shopDomain: string,
  aiCredit: { startMonth: Date },
  plan: PricingPlanDocument
): Promise<boolean> {
  // V2: Order-based plans - reset at billing cycle boundary
  if (plan.usages?.orders) {
    try {
      const billingState = await BillingStateManager.getCurrentState(shopDomain)
      if (!billingState) {
        // Fallback: reset every 30 days if billing state unavailable
        const startMonthDate = new Date(aiCredit.startMonth)
        const elapsedMs = Date.now() - startMonthDate.getTime()
        return elapsedMs >= 30 * ONE_DAY_IN_MILLISECONDS
      }
      const currentCycleStart = billingState.cycle.cycleStartDate
      const creditStartMonth = new Date(aiCredit.startMonth)
      return creditStartMonth < currentCycleStart
    } catch (error) {
      console.error('[shouldResetAiCredits] Failed to get billing state:', error)
      // Fallback: reset every 30 days
      const startMonthDate = new Date(aiCredit.startMonth)
      const elapsedMs = Date.now() - startMonthDate.getTime()
      return elapsedMs >= 30 * ONE_DAY_IN_MILLISECONDS
    }
  }

  // V1: Revenue-based plans - reset every 30 days (fixed interval)
  if (plan.usages?.revenue) {
    const startMonthDate = new Date(aiCredit.startMonth)
    const elapsedMs = Date.now() - startMonthDate.getTime()
    return elapsedMs >= 30 * ONE_DAY_IN_MILLISECONDS
  }

  return false
}

/**
 * Check if any AI credit usage thresholds were crossed and send Customer.io events.
 *
 * Thresholds: 50%, 80%, 100% of monthly allocation.
 * Uses atomic $addToSet to prevent duplicate emails under concurrent requests.
 * Runs fire-and-forget to avoid blocking credit consumption.
 */
async function checkAndSendAiCreditThresholdEmails(
  shopDomain: string,
  newMonthlyUsage: number,
  monthlyAllocation: number,
  purchasedCredits: number
): Promise<void> {
  if (monthlyAllocation <= 0) return

  const usagePercent = (newMonthlyUsage / monthlyAllocation) * 100

  // Find thresholds that are crossed
  const crossedThresholds = AI_CREDIT_THRESHOLDS.filter(threshold => usagePercent >= threshold)
  if (crossedThresholds.length === 0) return

  const { remainingMonthly } = calculateAiCreditBalance(
    { monthlyUsage: newMonthlyUsage, purchasedCredits },
    monthlyAllocation
  )

  for (const threshold of crossedThresholds) {
    // Atomically claim this threshold: only proceeds if NOT already in sentThresholds.
    // This prevents duplicate emails under concurrent requests.
    const result = await Shop.updateOne(
      { shopDomain, 'usages.aiCredit.sentThresholds': { $nin: [threshold] } },
      { $addToSet: { 'usages.aiCredit.sentThresholds': threshold } }
    )

    // Another request already claimed this threshold — skip
    if (result.modifiedCount === 0) continue

    const eventName = THRESHOLD_EVENT_MAP[threshold]
    if (!eventName) continue

    await postEventToCustomerIo({
      shopDomain,
      eventName,
      eventData: {
        threshold,
        monthlyUsage: newMonthlyUsage,
        monthlyAllocation,
        remainingMonthly,
        purchasedCredits,
        usagePercent: Math.min(Math.round(usagePercent), 100),
        storeHandle: shopDomain.replace('.myshopify.com', ''),
      },
    })
  }
}

/**
 * Increase AI credit usage (consumes monthly credits first, then purchased)
 *
 * **ATOMIC OPERATION** - Uses MongoDB aggregation pipeline to prevent race conditions.
 *
 * Logic:
 * 1. Consume from monthly allocation first (free credits from plan)
 * 2. If monthly exhausted, consume from purchased credits
 * 3. If insufficient credits, throws error (caller must handle)
 * 4. Logs consumption to AiCreditTransaction for history tracking
 * 5. Sends Customer.io email notifications at threshold crossings (fire-and-forget)
 *
 * Race condition protection:
 * - Single atomic findOneAndUpdate with aggregation pipeline
 * - Calculates consumption within database (no read-modify-write window)
 * - Guard clause ensures sufficient total credits before consumption
 *
 * @param {string} shopDomain
 * @param {number} incNumber - Number of credits to consume
 * @param {string} feature - Feature name for tracking (default: 'other')
 * @param {object} metadata - Optional metadata for usage log
 * @param {number} allocation - Monthly allocation from plan.aiCreditsPerMonth
 *
 * @returns {Promise<void>}
 * @throws {Error} If insufficient credits or shop not found
 */
export const increaseAiCreditPerMonth = async (
  shopDomain: string,
  incNumber = 1,
  feature = 'other',
  metadata?: Record<string, any>,
  allocation: number = AI_CREDIT_PER_MONTH
) => {
  if (incNumber <= 0) {
    throw new Error('Credit amount must be positive')
  }

  // Get current balance for transaction logging (before consumption)
  const shopBefore = await Shop.findOne({ shopDomain })
  if (!shopBefore) {
    throw new Error(`Shop not found: ${shopDomain}`)
  }

  const balanceBefore = getAiCreditBalanceSummary(shopBefore.usages?.aiCredit, allocation)

  // Atomic operation using aggregation pipeline
  // This prevents race conditions by calculating consumption within the database
  const result = await Shop.findOneAndUpdate(
    {
      shopDomain,
      // Guard: Ensure sufficient total credits (monthly remaining + purchased)
      $expr: {
        $gte: [
          {
            $add: [
              // Remaining monthly credits (allocation - usage, min 0)
              {
                $max: [
                  0,
                  {
                    $subtract: [allocation, { $ifNull: ['$usages.aiCredit.monthlyUsage', 0] }],
                  },
                ],
              },
              // Purchased credits
              { $ifNull: ['$usages.aiCredit.purchasedCredits', 0] },
            ],
          },
          incNumber,
        ],
      },
    },
    [
      {
        $set: {
          // Calculate remaining monthly credits
          'usages.aiCredit.remainingMonthly': {
            $max: [
              0,
              {
                $subtract: [allocation, { $ifNull: ['$usages.aiCredit.monthlyUsage', 0] }],
              },
            ],
          },
          // Consume from monthly first (capped at allocation)
          'usages.aiCredit.monthlyUsage': {
            $min: [
              {
                $add: [{ $ifNull: ['$usages.aiCredit.monthlyUsage', 0] }, incNumber],
              },
              allocation,
            ],
          },
          // Consume remainder from purchased (if monthly exhausted)
          'usages.aiCredit.purchasedCredits': {
            $subtract: [
              { $ifNull: ['$usages.aiCredit.purchasedCredits', 0] },
              {
                $max: [
                  0,
                  {
                    $subtract: [
                      incNumber,
                      {
                        $max: [
                          0,
                          {
                            $subtract: [allocation, { $ifNull: ['$usages.aiCredit.monthlyUsage', 0] }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          // Initialize startMonth if not exists
          'usages.aiCredit.startMonth': {
            $ifNull: ['$usages.aiCredit.startMonth', new Date()],
          },
        },
      },
    ],
    { new: true } // Return updated document
  )

  if (!result) {
    throw new Error(`Insufficient AI credits. Required: ${incNumber}, Available: ${balanceBefore.total}`)
  }

  // Calculate actual consumption from each pool (for transaction logging)
  const balanceAfter = getAiCreditBalanceSummary(result.usages?.aiCredit, allocation)
  const consumedFromMonthly = balanceBefore.monthly - balanceAfter.monthly
  const consumedFromPurchased = balanceBefore.purchased - balanceAfter.purchased

  // Create transaction logs based on which pools were consumed
  if (consumedFromMonthly > 0 && consumedFromPurchased > 0) {
    // Case 2: Consumed from both pools
    await createAiCreditTransaction({
      shopDomain,
      type: 'debit',
      amount: consumedFromMonthly,
      source: 'monthly',
      reason: 'usage',
      feature,
      balanceBefore,
      balanceAfter: {
        monthly: 0,
        purchased: balanceBefore.purchased,
        total: balanceBefore.purchased,
      },
      description: `Used ${consumedFromMonthly} credits (monthly) for ${feature}`,
      metadata,
    })

    await createAiCreditTransaction({
      shopDomain,
      type: 'debit',
      amount: consumedFromPurchased,
      source: 'purchased',
      reason: 'usage',
      feature,
      balanceBefore: {
        monthly: 0,
        purchased: balanceBefore.purchased,
        total: balanceBefore.purchased,
      },
      balanceAfter,
      description: `Used ${consumedFromPurchased} credits (purchased) for ${feature}`,
      metadata,
    })
  } else if (consumedFromPurchased > 0) {
    // Case 3: Consumed only from purchased
    await createAiCreditTransaction({
      shopDomain,
      type: 'debit',
      amount: consumedFromPurchased,
      source: 'purchased',
      reason: 'usage',
      feature,
      balanceBefore,
      balanceAfter,
      description: `Used ${consumedFromPurchased} credits (purchased) for ${feature}`,
      metadata,
    })
  } else if (consumedFromMonthly > 0) {
    // Case 1: Consumed only from monthly
    await createAiCreditTransaction({
      shopDomain,
      type: 'debit',
      amount: consumedFromMonthly,
      source: 'monthly',
      reason: 'usage',
      feature,
      balanceBefore,
      balanceAfter,
      description: `Used ${consumedFromMonthly} credits for ${feature}`,
      metadata,
    })
  }

  // Send Customer.io email notifications at threshold crossings (fire-and-forget)
  const newMonthlyUsage = result.usages?.aiCredit?.monthlyUsage || 0
  const purchasedCredits = result.usages?.aiCredit?.purchasedCredits || 0

  checkAndSendAiCreditThresholdEmails(shopDomain, newMonthlyUsage, allocation, purchasedCredits).catch(console.error)
}

/**
 * Validate the ai credit per month
 *
 * @param {ShopDocument} shopData
 *
 * @returns {Promise<boolean>}
 */
/**
 * Check if shop has sufficient AI credits for the requested operation
 *
 * Logic:
 * - Total available = Remaining monthly + Purchased credits
 * - Returns true if totalAvailable >= incNumber
 * - Derives allocation from shopData.subscription.plan.aiCreditsPerMonth
 *
 * @param {ShopDocument} shopData - Shop document (with populated subscription.plan)
 * @param {number} incNumber - Number of credits needed
 *
 * @returns {boolean} - True if shop has sufficient credits
 */
export const checkAiCreditPerMonthExceeded = (shopData: ShopDocument, incNumber = 1) => {
  const plan = (shopData?.subscription as any)?.plan as PricingPlanDocument | undefined
  const allocation = plan?.aiCreditsPerMonth || AI_CREDIT_PER_MONTH
  return hasEnoughAiCredits(shopData?.usages?.aiCredit, incNumber, allocation)
}

/**
 * Reset monthly AI credits allocation (preserves purchased credits)
 *
 * **IDEMPOTENT OPERATION** - Uses optimistic locking to prevent concurrent resets.
 *
 * Logic:
 * - Monthly usage resets to 0
 * - Purchased credits remain unchanged (carry over to next month)
 * - Updates startMonth to next billing cycle start
 * - Clears sent threshold notifications for new cycle
 *
 * Concurrency protection:
 * - Uses optimistic lock on startMonth (match current value in query)
 * - If another process already reset, this update silently succeeds (no-op)
 * - Prevents double-reset when multiple cron jobs/webhooks trigger simultaneously
 *
 * @param {string} shopDomain
 *
 * @returns {Promise<boolean>} - True if reset performed, false if already reset by another process
 */
export const resetAiCreditPerMonth = async (shopDomain: string): Promise<boolean> => {
  // Get shop with subscription and plan to determine billing cycle
  const shopData = await Shop.findOne({ shopDomain }).populate({
    path: 'subscription',
    populate: { path: 'plan' },
  })

  if (!shopData?.usages?.aiCredit?.startMonth) {
    return false
  }

  const currentStartMonth = shopData.usages.aiCredit.startMonth
  const subscription = shopData.subscription as SubscriptionDocument
  const plan = subscription?.plan as PricingPlanDocument

  // Calculate new startMonth based on billing type
  let newStartMonth: Date

  if (plan?.usages?.orders) {
    // V2: Order-based plans - reset aligns with billing cycle from BillingStateManager
    try {
      const billingState = await BillingStateManager.getCurrentState(shopDomain)
      if (billingState) {
        // Ensure cycleStartDate is a Date object
        newStartMonth
          = billingState.cycle.cycleStartDate instanceof Date
            ? billingState.cycle.cycleStartDate
            : new Date(billingState.cycle.cycleStartDate)
      } else {
        // Fallback: reset 30 days from current
        const BILLING_CYCLE_MILLISECONDS = 30 * ONE_DAY_IN_MILLISECONDS
        newStartMonth = new Date(currentStartMonth.getTime() + BILLING_CYCLE_MILLISECONDS)
      }
    } catch (error) {
      console.error('[ResetAICredit] Failed to get billing state, using fallback:', error)
      // Fallback: reset 30 days from current
      const BILLING_CYCLE_MILLISECONDS = 30 * ONE_DAY_IN_MILLISECONDS
      newStartMonth = new Date(currentStartMonth.getTime() + BILLING_CYCLE_MILLISECONDS)
    }
  } else {
    // V1: Revenue-based plans - reset every 30 days
    const BILLING_CYCLE_MILLISECONDS = 30 * ONE_DAY_IN_MILLISECONDS
    newStartMonth = new Date(currentStartMonth.getTime() + BILLING_CYCLE_MILLISECONDS)
  }

  // Optimistic lock: Only reset if startMonth hasn't changed
  const result = await Shop.updateOne(
    {
      shopDomain,
      'usages.aiCredit.startMonth': currentStartMonth, // Lock
    },
    {
      $set: {
        'usages.aiCredit.monthlyUsage': 0, // Reset monthly usage to 0
        'usages.aiCredit.startMonth': newStartMonth, // Advance to next billing cycle
        'usages.aiCredit.sentThresholds': [], // Reset threshold notifications for new cycle
        // purchasedCredits is NOT touched - it carries over
      },
    }
  )

  if (result.modifiedCount === 0) {
    console.log(`[ResetAICredit] Already reset by another process for shop ${shopDomain}`)
    return false
  }

  return true
}

/**
 * Check if AI credits need reset and reset them.
 *
 * Reset conditions:
 * - V2 (order-based): When billing cycle changes (via BillingCycle.cycleStartDate)
 * - V1 (revenue-based): Every 30 days from last reset
 */
export async function checkAndResetAiCreditsIfNeeded(
  shopDomain: string,
  shop: ShopDocument,
  subscription: SubscriptionDocument
): Promise<void> {
  const aiCredit = shop.usages?.aiCredit
  if (!aiCredit?.startMonth) return

  const plan = subscription.plan as PricingPlanDocument
  const shouldReset = await shouldResetAiCredits(shopDomain, aiCredit, plan)

  if (shouldReset) {
    await resetAiCreditPerMonth(shopDomain)
  }
}

/**
 * Query purchased credits in current billing cycle from AiCreditTransaction (Single Source of Truth)
 *
 * Returns: {
 *   total: Total purchased credits at start of current cycle
 *   used: Purchased credits used in current cycle
 *   remaining: Purchased credits still available
 * }
 *
 * @param shopDomain - Shop domain
 * @param cycleStartDate - Start of current billing cycle
 * @param currentRemaining - Current remaining purchased credits from Shop.usages.aiCredit
 */
export async function getPurchasedCreditsInCycle(
  shopDomain: string,
  cycleStartDate: Date,
  currentRemaining: number
): Promise<{ total: number; used: number; remaining: number }> {
  const AiCreditTransaction = (await import('../AiCreditTransaction.server')).default

  // Sum all purchased credits added since cycle start
  const purchasesInCycle = await AiCreditTransaction.aggregate([
    {
      $match: {
        shopDomain,
        type: 'credit',
        source: 'purchased',
        createdAt: { $gte: cycleStartDate },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
      },
    },
  ])

  const totalPurchasedInCycle = purchasesInCycle[0]?.total || 0
  const usedPurchased = totalPurchasedInCycle - currentRemaining

  const result = {
    total: totalPurchasedInCycle,
    used: Math.max(0, usedPurchased), // Prevent negative
    remaining: currentRemaining,
  }

  return result
}
