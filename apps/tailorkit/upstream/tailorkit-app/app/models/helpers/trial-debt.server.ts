import type { ShopDocument } from '~/models/Shop'
import type { SubscriptionDocument } from '~/models/Subscription'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import Shop from '~/models/Shop.server'
import { createAppUsageRecord, ORDER_OVERAGE_LINE_ITEM_TERM } from '~/models/Subscription.server'
import { getFreeOrdersCount, getOverageFeePerOrder } from './pricing-utils'
// import { calculateAiCreditBalance } from './ai-credit-utils'
import { isOnActiveDaysTrial } from './trial-tracking.server'

/**
 * Calculate AI credit overage amount during trial
 * Note: Currently AI credits don't have per-credit overage fees like orders do.
 * This function tracks usage but returns $0 debt.
 * If future pricing plans add AI credit overage fees, update this function.
 */
function calculateAiCreditOverage(shop: ShopDocument, plan: PricingPlanDocument): number {
  const aiCredit = shop.usages?.aiCredit
  if (!aiCredit) return 0

  // const monthlyAllocation = plan.aiCreditsPerMonth || 0
  // const balance = calculateAiCreditBalance(aiCredit, monthlyAllocation)

  // Currently no per-credit overage fee for AI credits
  // AI credits are either:
  // 1. Included in plan (monthly allocation)
  // 2. Purchased upfront (one-time charge)
  // Unlike orders, there's no "pay per credit" overage model
  // So overage debt = $0

  return 0
}

/**
 * Calculate accumulated debt during trial
 * Does NOT charge Shopify, only calculates and stores in Shop.trialDebt
 *
 * CORRECTED calculation logic (fixes Bugs 2 & 3):
 * - Bug 2 fix: Use $set instead of $inc to REPLACE debt (not add to it)
 * - Bug 3 fix: Calculate total overage first, then subtract already-charged overage
 *
 * Example:
 * - Plan: Starter (3 free orders)
 * - Current orders: 6
 * - Charged orders: 0
 * - Total overage = max(0, 6 - 3) = 3 orders
 * - Charged overage = max(0, 0 - 3) = 0 orders
 * - NEW overage = 3 - 0 = 3 orders → debt = $1.50
 *
 * On second call (after charge fails):
 * - Current orders: 6 (same)
 * - Charged orders: 0 (same, charge failed)
 * - Total overage = 3
 * - Charged overage = 0
 * - NEW overage = 3 → debt = $1.50 (NOT $3.00!)
 */
export async function accumulateTrialDebt(
  shopDomain: string,
  subscription: SubscriptionDocument,
  plan: PricingPlanDocument
): Promise<void> {
  const shop = await Shop.findOne({ shopDomain })

  // Skip if not on trial
  if (!isOnActiveDaysTrial(shop, plan)) {
    return
  }

  const currentOrders = shop!.usages?.orders || 0
  const freeOrders = getFreeOrdersCount(plan)
  const overageFee = getOverageFeePerOrder(plan)

  // Calculate overage and debt
  const totalOverage = Math.max(0, currentOrders - freeOrders)
  const totalDebt = totalOverage * overageFee

  // Calculate AI credit overage
  const aiCreditDebt = calculateAiCreditOverage(shop!, plan)

  // Skip update if no debt
  if (totalDebt === 0 && aiCreditDebt === 0) {
    return
  }

  // Update debt using $set (REPLACE, not add)
  // This prevents double-counting when recalculating
  await Shop.updateOne(
    { shopDomain },
    {
      $set: {
        'trialDebt.orderOverage': totalDebt, // REPLACE with correct total
        'trialDebt.aiCreditOverage': aiCreditDebt,
        'trialDebt.lastCalculatedAt': new Date(),
      },
    }
  )
}

/**
 * Charge accumulated trial debt to Shopify
 * Called at trial end OR uninstall
 *
 * Returns total amount charged
 */
export async function chargeTrialDebt(
  shopDomain: string,
  subscription: SubscriptionDocument,
  reason: 'trial_end' | 'uninstall'
): Promise<number> {
  const shop = await Shop.findOne({ shopDomain })
  const debt = shop?.trialDebt

  if (!debt) {
    return 0
  }

  const orderOverage = debt.orderOverage || 0
  const aiCreditOverage = debt.aiCreditOverage || 0
  const totalDebt = orderOverage + aiCreditOverage

  if (totalDebt <= 0) {
    return 0
  }

  // Verify subscription has shopifyCharge
  if (!subscription.shopifyCharge) {
    return 0
  }

  // Submit charge to Shopify
  const ordersCount = shop!.usages?.orders || 0
  const description
    = reason === 'trial_end'
      ? `Trial period charges (${ordersCount} orders processed)`
      : `Charges before uninstall (${ordersCount} orders processed)`

  try {
    await createAppUsageRecord(
      shopDomain,
      subscription.shopifyCharge,
      totalDebt,
      description,
      ORDER_OVERAGE_LINE_ITEM_TERM
    )

    // Mark orders as charged to prevent double-charging on reinstall
    await Shop.updateOne(
      { shopDomain },
      {
        $set: {
          'trialDebt.chargedOrders': shop!.usages?.orders || 0,
          'trialDebt.orderOverage': 0,
          'trialDebt.aiCreditOverage': 0,
          'trialDebt.lastCalculatedAt': new Date(),
        },
      }
    )

    return totalDebt
  } catch (error) {
    // Don't clear debt if charge failed - will retry later
    throw error
  }
}

/**
 * Recalculate trial debt with new plan limits (called on plan change during trial)
 * Forgives old debt and starts fresh with new plan's free quota
 *
 * Example: User upgrades from Starter (3 free) to Growth (7 free) mid-trial
 * - Old debt: $2.00 (4 overage orders at $0.50)
 * - New plan: Growth has 7 free orders
 * - Current orders: 10
 * - Action: Forgive old $2.00 debt, user now has 7 free orders
 * - New debt: max(0, 10 - 7) * $0.50 = $1.50 (will be calculated by accumulateTrialDebt)
 */
export async function recalculateTrialDebtForPlanChange(
  shopDomain: string,
  newPlan: PricingPlanDocument
): Promise<void> {
  const shop = await Shop.findOne({ shopDomain })

  if (!shop) {
    return
  }

  // Only recalculate if on trial
  if (!isOnActiveDaysTrial(shop, newPlan)) {
    return
  }

  // Forgive old debt, start fresh with new plan free quota
  // User benefits from new plan's larger free quota
  await Shop.updateOne(
    { shopDomain },
    {
      $set: {
        'trialDebt.orderOverage': 0,
        'trialDebt.aiCreditOverage': 0,
        'trialDebt.chargedOrders': shop.usages?.orders || 0, // Mark current orders as baseline
        'trialDebt.lastCalculatedAt': new Date(),
      },
    }
  )
}
