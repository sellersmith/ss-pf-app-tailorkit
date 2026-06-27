/**
 * Billing State Manager
 *
 * Centralized manager for all billing operations.
 * Encapsulates complexity and coordinates between BillingCycle, Subscription, Shop, and Order models.
 *
 * Core Responsibilities:
 * - Create and manage billing cycles
 * - Record usage charges
 * - Handle cycle rollovers
 * - Manage plan changes
 * - Provide billing state for UI
 *
 * Architecture:
 * - BillingCycle: Authoritative billing state (30-day cycles)
 * - Shop.usages.orders: Fast UI display counter (updated by webhooks)
 * - Order collection: Source of truth for actual orders
 *
 * Usage:
 * ```typescript
 * // Get current billing state for UI
 * const state = await BillingStateManager.getCurrentState('shop.myshopify.com')
 *
 * // Create new cycle (subscription start or rollover)
 * await BillingStateManager.createCycle(subscription, plan)
 *
 * // Record usage charge
 * await BillingStateManager.recordUsageCharge('shop.myshopify.com', chargeDetails)
 * ```
 */

import type { BillingState, BillingHistoryResponse, ChargeDetails, UsageFeeRecord } from '../BillingCycle'
import type { SubscriptionDocument } from '../Subscription'
import type { ShopDocument } from '../Shop'
import type { PricingPlanDocument } from '../PricingPlan'

import {
  getActiveCycle,
  getBillingCycles,
  createBillingCycle,
  updateCycleOrderCount,
  addUsageFee,
  completeCycle,
  markPlanChange,
  cancelCycle,
} from '../BillingCycle.server'
import Shop from '../Shop.server'
import Subscription from '../Subscription.server'
import { getOrderCountInBillingCycle } from '../Order.server'
import { getBillingCycleDates } from '../PricingPlan.server'
import { trackPlanUpgraded, trackPlanDowngraded } from '~/bootstrap/fns/mixpanel.server'

/**
 * Pricing utility functions
 * (Copied from pricing-utils.ts to avoid circular dependencies)
 */
function getFreeOrdersCount(plan: PricingPlanDocument): number {
  if (plan.usages?.orders) {
    const freeRule = plan.usages.orders.find(rule => !rule.transactionFee || rule.transactionFee === 0)
    if (freeRule) {
      return freeRule.to
    }
  }
  return 0
}

function getOverageFeePerOrder(plan: PricingPlanDocument): number {
  if (plan.usages?.orders) {
    const paidRule = plan.usages.orders.find(rule => rule.transactionFee && rule.transactionFee > 0)
    if (paidRule) {
      return paidRule.transactionFee
    }
  }
  return 0
}

function isOrderBasedPlan(plan: PricingPlanDocument): boolean {
  return Boolean(plan.usages?.orders && plan.usages.orders.length > 0)
}

function getPlanName(plan: any): string {
  return plan?.alias || plan?.name || 'unknown'
}

export class BillingStateManager {
  /**
   * Get current billing state for a shop
   *
   * Returns complete billing state including current cycle, order counts, and charges.
   * Used by UI components to display billing information.
   *
   * @param shopDomain - Shopify store domain
   * @returns Complete billing state or null if no active cycle
   *
   * @example
   * ```typescript
   * const state = await BillingStateManager.getCurrentState('shop.myshopify.com')
   * console.log(`Orders: ${state.totalOrders}/${state.freeOrders}`)
   * console.log(`Extra: ${state.extraOrders}, Charges: $${state.totalCharges}`)
   * ```
   */
  static async getCurrentState(shopDomain: string): Promise<BillingState | null> {
    try {
      const cycle = await getActiveCycle(shopDomain)
      if (!cycle) {
        console.log(`[BillingStateManager] No active cycle for shop: ${shopDomain}`)
        return null
      }

      const totalOrders = cycle.orderCount.current
      const freeOrders = cycle.planLimits.includedOrders
      const extraOrders = Math.max(0, totalOrders - cycle.orderCount.initial - freeOrders)

      // Calculate pending charges (not yet submitted to Shopify)
      const lastChargedOrders
        = cycle.charges.usageFees.length > 0
          ? cycle.charges.usageFees[cycle.charges.usageFees.length - 1].orderCount
          : cycle.orderCount.initial
      const newOrdersSinceLastCharge = Math.max(0, totalOrders - lastChargedOrders)
      const newExtraOrders = Math.max(
        0,
        newOrdersSinceLastCharge - (lastChargedOrders === cycle.orderCount.initial ? freeOrders : 0)
      )
      const pendingChargeAmount = newExtraOrders * cycle.planLimits.overageFeePerOrder

      return {
        cycle,
        totalOrders,
        freeOrders,
        extraOrders,
        pendingCharges: {
          extraOrders: newExtraOrders,
          amount: pendingChargeAmount,
        },
        totalCharges: cycle.charges.totalCharges + pendingChargeAmount,
      }
    } catch (error) {
      console.error(`[BillingStateManager] Failed to get current state for ${shopDomain}:`, error)
      throw error
    }
  }

  /**
   * Create new billing cycle
   *
   * Creates a new 30-day billing cycle when subscription starts or cycle rolls over.
   * Queries Order collection for accurate order count baseline.
   *
   * @param subscription - Subscription document
   * @param plan - Pricing plan document
   * @param options - Optional cycle creation options
   * @returns Newly created billing cycle
   *
   * @example
   * ```typescript
   * // New subscription
   * await BillingStateManager.createCycle(subscription, plan, { isFirstCycle: true })
   *
   * // Cycle rollover
   * await BillingStateManager.createCycle(subscription, plan, { previousCycleId: oldCycle._id })
   * ```
   */
  static async createCycle(
    subscription: SubscriptionDocument,
    plan: PricingPlanDocument,
    options?: {
      previousCycleId?: string
      isFirstCycle?: boolean
      isTrialCycle?: boolean
      cycleStartDate?: Date
      initialOrderCount?: number // Allow custom baseline for plan changes
    }
  ): Promise<any> {
    try {
      // Validate plan is order-based
      if (!isOrderBasedPlan(plan)) {
        throw new Error(`Cannot create billing cycle for non-order-based plan: ${getPlanName(plan)}`)
      }

      const cycleStartDate = options?.cycleStartDate || new Date()
      const { from, to } = getBillingCycleDates(cycleStartDate)

      // Use custom initialOrderCount if provided (for plan changes with conditional baseline)
      // Otherwise query Order collection for accurate baseline
      const initialOrderCount
        = options?.initialOrderCount !== undefined
          ? options.initialOrderCount
          : await getOrderCountInBillingCycle(subscription.shopDomain, from, to)

      const cycle = await createBillingCycle({
        shopDomain: subscription.shopDomain,
        subscriptionId: subscription._id.toString(),
        planId: (plan._id as any).toString(),
        cycleStartDate: from,
        cycleEndDate: to,
        initialOrderCount,
        planLimits: {
          includedOrders: getFreeOrdersCount(plan),
          overageFeePerOrder: getOverageFeePerOrder(plan),
          monthlyFee: plan.price || 0,
        },
        metadata: {
          isFirstCycle: options?.isFirstCycle || false,
          isTrialCycle: options?.isTrialCycle || false,
          previousCycleId: options?.previousCycleId,
        },
      })

      // Update Subscription with reference to active cycle
      await Subscription.updateOne({ _id: subscription._id }, { $set: { activeBillingCycle: cycle._id } })

      console.log(`[BillingStateManager] Created cycle for ${subscription.shopDomain}:`, {
        cycleId: cycle._id,
        cycleStartDate: from,
        cycleEndDate: to,
        initialOrderCount,
        plan: getPlanName(plan),
      })

      return cycle
    } catch (error) {
      console.error(`[BillingStateManager] Failed to create cycle for ${subscription.shopDomain}:`, error)
      throw error
    }
  }

  /**
   * Record usage charge in current cycle
   *
   * Adds usage charge to active cycle's charge history.
   * Called after successfully submitting charge to Shopify.
   *
   * @param shopDomain - Shopify store domain
   * @param chargeDetails - Charge details from Shopify
   *
   * @example
   * ```typescript
   * await BillingStateManager.recordUsageCharge('shop.myshopify.com', {
   *   orderCount: 15,
   *   extraOrders: 5,
   *   amount: 2.50,
   *   shopifyChargeId: 'gid://shopify/AppUsageRecord/123'
   * })
   * ```
   */
  static async recordUsageCharge(shopDomain: string, chargeDetails: ChargeDetails): Promise<void> {
    try {
      const usageFee: UsageFeeRecord = {
        chargedAt: new Date(),
        orderCount: chargeDetails.orderCount,
        extraOrders: chargeDetails.extraOrders,
        amount: chargeDetails.amount,
        shopifyChargeId: chargeDetails.shopifyChargeId,
      }

      await addUsageFee(shopDomain, usageFee)

      console.log(`[BillingStateManager] Recorded usage charge for ${shopDomain}:`, {
        extraOrders: chargeDetails.extraOrders,
        amount: chargeDetails.amount,
      })
    } catch (error) {
      console.error(`[BillingStateManager] Failed to record usage charge for ${shopDomain}:`, error)
      throw error
    }
  }

  /**
   * Complete current cycle and start new one (30-day rollover)
   *
   * Completes active cycle, creates new cycle for next 30 days.
   * Resets Shop.usages.orders counter for fresh cycle.
   *
   * @param shopDomain - Shopify store domain
   * @param subscription - Subscription document
   * @param plan - Current pricing plan
   * @returns Newly created cycle
   *
   * @example
   * ```typescript
   * // Daily cron job checks if cycle needs rollover
   * if (cycleEndDate <= new Date()) {
   *   await BillingStateManager.rolloverCycle(shopDomain, subscription, plan)
   * }
   * ```
   */
  static async rolloverCycle(
    shopDomain: string,
    subscription: SubscriptionDocument,
    plan: PricingPlanDocument
  ): Promise<any> {
    try {
      const oldCycle = await getActiveCycle(shopDomain)
      if (!oldCycle) {
        throw new Error(`No active cycle to rollover for shop: ${shopDomain}`)
      }

      // Get final order count from Order collection
      const finalOrderCount = await getOrderCountInBillingCycle(
        shopDomain,
        new Date(oldCycle.cycleStartDate),
        new Date(oldCycle.cycleEndDate)
      )

      // Complete old cycle
      await completeCycle(shopDomain, finalOrderCount)

      // Reset Shop counter for new cycle
      await Shop.updateOne({ shopDomain }, { $set: { 'usages.orders': 0 } })

      // Create new cycle
      const newCycle = await this.createCycle(subscription, plan, {
        previousCycleId: oldCycle._id.toString(),
      })

      console.log(`[BillingStateManager] Rolled over cycle for ${shopDomain}:`, {
        oldCycleId: oldCycle._id,
        newCycleId: newCycle._id,
        finalOrderCount,
      })

      return newCycle
    } catch (error) {
      console.error(`[BillingStateManager] Failed to rollover cycle for ${shopDomain}:`, error)
      throw error
    }
  }

  /**
   * Handle plan change mid-cycle (upgrade/downgrade)
   *
   * Completes current cycle with charges from old plan, creates new cycle with new plan.
   * Preserves Shop counter (no reset - continues in same billing cycle).
   *
   * @param shopDomain - Shopify store domain
   * @param oldSubscription - Previous subscription
   * @param newSubscription - New subscription
   * @param oldPlan - Previous plan
   * @param newPlan - New plan
   * @param isUpgrade - True for upgrade, false for downgrade
   * @returns Newly created cycle
   *
   * @example
   * ```typescript
   * await BillingStateManager.handlePlanChange(
   *   'shop.myshopify.com',
   *   oldSubscription,
   *   newSubscription,
   *   starterPlan,
   *   growthPlan,
   *   true // is upgrade
   * )
   * ```
   */
  static async handlePlanChange(
    shopDomain: string,
    oldSubscription: SubscriptionDocument,
    newSubscription: SubscriptionDocument,
    oldPlan: PricingPlanDocument,
    newPlan: PricingPlanDocument,
    isUpgrade: boolean,
    shopData?: ShopDocument
  ): Promise<any> {
    try {
      const oldCycle = await getActiveCycle(shopDomain)
      if (!oldCycle) {
        console.log(`[BillingStateManager] No active cycle for plan change, creating new cycle`)
        return await this.createCycle(newSubscription, newPlan, { isFirstCycle: true })
      }

      // Get current order count
      const currentOrderCount = await getOrderCountInBillingCycle(
        shopDomain,
        new Date(oldCycle.cycleStartDate),
        new Date(oldCycle.cycleEndDate)
      )

      // Mark plan change in old cycle
      await markPlanChange(shopDomain)

      // Complete old cycle with final charges
      await completeCycle(shopDomain, currentOrderCount)

      // Determine baseline for new cycle
      // CRITICAL: Always preserve billing cycle baseline regardless of upgrade/downgrade
      // Baseline only resets at end of 30-day cycle, never on plan changes
      // This ensures orders consumed in the cycle count consistently against new limits
      const oldBaseline = oldCycle.orderCount.initial
      const newBaseline = oldBaseline

      // Create new cycle with new plan (DON'T reset Shop counter - same billing cycle)
      const newCycle = await this.createCycle(newSubscription, newPlan, {
        previousCycleId: oldCycle._id.toString(),
        cycleStartDate: new Date(oldCycle.cycleStartDate), // Inherit billing cycle start
        initialOrderCount: newBaseline, // Conditional baseline
      })

      // Track analytics
      if (shopData) {
        const fromPlanName = getPlanName(oldPlan)
        const toPlanName = getPlanName(newPlan)

        try {
          if (isUpgrade) {
            await trackPlanUpgraded(shopData, fromPlanName, toPlanName, currentOrderCount, 'manual')
          } else {
            await trackPlanDowngraded(shopData, fromPlanName, toPlanName, currentOrderCount)
          }
        } catch (err) {
          console.error(`[BillingStateManager] Failed to track plan ${isUpgrade ? 'upgrade' : 'downgrade'}:`, err)
        }
      }

      console.log(`[BillingStateManager] Handled plan change for ${shopDomain}:`, {
        from: getPlanName(oldPlan),
        to: getPlanName(newPlan),
        isUpgrade,
        oldCycleId: oldCycle._id,
        newCycleId: newCycle._id,
        currentOrderCount,
      })

      return newCycle
    } catch (error) {
      console.error(`[BillingStateManager] Failed to handle plan change for ${shopDomain}:`, error)
      throw error
    }
  }

  /**
   * Reset for trial→paid transition
   *
   * Resets BOTH counter and baseline to 0, starts fresh billing cycle.
   * Trial orders DON'T count towards paid plan limits.
   *
   * @param shopDomain - Shopify store domain
   * @param subscription - Subscription document
   * @param plan - New paid plan
   *
   * @example
   * ```typescript
   * // When trial ends and user activates paid plan
   * await BillingStateManager.resetForTrialToPaid('shop.myshopify.com', subscription, paidPlan)
   * ```
   */
  static async resetForTrialToPaid(
    shopDomain: string,
    subscription: SubscriptionDocument,
    plan: PricingPlanDocument
  ): Promise<any> {
    try {
      // Cancel old trial cycle if exists
      const oldCycle = await getActiveCycle(shopDomain)
      if (oldCycle) {
        await cancelCycle(shopDomain)
      }

      // Reset Shop counter to 0
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

      // Create fresh cycle with 0 baseline (trial orders don't count)
      const newCycle = await this.createCycle(subscription, plan, {
        isFirstCycle: true,
        cycleStartDate: new Date(), // Fresh billing cycle start
        initialOrderCount: 0, // EXPLICIT: Trial orders don't count, start from 0
      })

      console.log(`[BillingStateManager] Reset for trial→paid transition for ${shopDomain}:`, {
        newCycleId: newCycle._id,
        plan: getPlanName(plan),
      })

      return newCycle
    } catch (error) {
      console.error(`[BillingStateManager] Failed to reset for trial→paid for ${shopDomain}:`, error)
      throw error
    }
  }

  /**
   * Get billing history (cycles + charges)
   *
   * Returns historical billing cycles with detailed charge records.
   * Used by UI to display billing history modal.
   *
   * @param shopDomain - Shopify store domain
   * @param daysBack - Number of days to look back (default: 90)
   * @returns Billing history response
   *
   * @example
   * ```typescript
   * const history = await BillingStateManager.getBillingHistory('shop.myshopify.com', 90)
   * console.log(`Total charges: $${history.totalCharges}`)
   * ```
   */
  static async getBillingHistory(shopDomain: string, daysBack: number = 90): Promise<BillingHistoryResponse> {
    try {
      const cycles = await getBillingCycles(shopDomain, daysBack)

      const totalCharges = cycles.reduce((sum, cycle) => sum + cycle.charges.totalCharges, 0)

      const startDate = new Date()
      startDate.setDate(startDate.getDate() - daysBack)

      return {
        cycles,
        totalCharges,
        dateRange: {
          from: startDate,
          to: new Date(),
        },
      }
    } catch (error) {
      console.error(`[BillingStateManager] Failed to get billing history for ${shopDomain}:`, error)
      throw error
    }
  }

  /**
   * Update order count in active cycle
   *
   * Updates current order count when orders are created.
   * Called from order webhooks or daily sync.
   *
   * @param shopDomain - Shopify store domain
   * @param orderCount - New order count
   *
   * @example
   * ```typescript
   * // Order webhook handler
   * await BillingStateManager.updateOrderCount('shop.myshopify.com', 15)
   * ```
   */
  static async updateOrderCount(shopDomain: string, orderCount: number): Promise<void> {
    try {
      await updateCycleOrderCount(shopDomain, orderCount)

      console.log(`[BillingStateManager] Updated order count for ${shopDomain}: ${orderCount}`)
    } catch (error) {
      console.error(`[BillingStateManager] Failed to update order count for ${shopDomain}:`, error)
      throw error
    }
  }

  /**
   * Cancel active cycle
   *
   * Cancels active cycle when subscription is cancelled.
   *
   * @param shopDomain - Shopify store domain
   *
   * @example
   * ```typescript
   * await BillingStateManager.cancelActiveCycle('shop.myshopify.com')
   * ```
   */
  static async cancelActiveCycle(shopDomain: string): Promise<void> {
    try {
      await cancelCycle(shopDomain)

      console.log(`[BillingStateManager] Cancelled active cycle for ${shopDomain}`)
    } catch (error) {
      console.error(`[BillingStateManager] Failed to cancel cycle for ${shopDomain}:`, error)
      throw error
    }
  }
}

export default BillingStateManager
