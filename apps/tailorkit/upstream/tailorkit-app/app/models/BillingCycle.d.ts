import type { PricingPlanDocument } from './PricingPlan'
import type { SubscriptionDocument } from './Subscription'

/**
 * Usage Fee Record
 * Represents a single usage charge within a billing cycle
 */
export interface UsageFeeRecord {
  /** Date when the charge was submitted to Shopify */
  chargedAt: Date | string
  /** Total order count at the time of charge */
  orderCount: number
  /** Number of orders charged (orders - included orders) */
  extraOrders: number
  /** Charge amount in USD */
  amount: number
  /** Shopify AppUsageRecord ID for reference */
  shopifyChargeId?: string
}

/**
 * Billing Cycle Document
 *
 * Represents a complete 30-day billing cycle with immutable history.
 * Each cycle tracks orders, charges, and plan limits for a single subscription.
 *
 * Key Concepts:
 * - One cycle = 30 days (from cycleStartDate to cycleEndDate)
 * - Immutable after completion (status = 'completed')
 * - Self-contained (all context in one document)
 * - Plan limits snapshot preserved for historical accuracy
 *
 * Lifecycle:
 * 1. Created when subscription starts or cycle rolls over
 * 2. Updated daily with order count and usage charges
 * 3. Completed when cycle ends or plan changes
 *
 * Example:
 * ```typescript
 * const cycle = await BillingCycle.findOne({
 *   shopDomain: 'test-shop.myshopify.com',
 *   status: 'active'
 * })
 * console.log(`Orders: ${cycle.orderCount.current}/${cycle.planLimits.includedOrders}`)
 * console.log(`Charges: $${cycle.charges.totalCharges}`)
 * ```
 */
export interface BillingCycleDocument {
  _id: string

  /** Shopify store domain */
  shopDomain: string

  /** Reference to subscription */
  subscriptionId: string | SubscriptionDocument

  /** Reference to pricing plan */
  planId: string | PricingPlanDocument

  // Cycle boundaries

  /** Start date of billing cycle (30-day period) */
  cycleStartDate: Date | string

  /** End date of billing cycle (cycleStartDate + 30 days) */
  cycleEndDate: Date | string

  /** Cycle status: active (current), completed (ended), cancelled (subscription cancelled) */
  status: 'active' | 'completed' | 'cancelled'

  // Order tracking (snapshot at cycle boundaries)

  orderCount: {
    /** Orders at cycle start (baseline for calculations) */
    initial: number
    /** Current order count (updated daily or on order webhooks) */
    current: number
    /** Final order count when cycle completed (null until status = 'completed') */
    final: number | null
  }

  // Plan limits (snapshot for historical accuracy)

  planLimits: {
    /** Number of free orders included in plan */
    includedOrders: number
    /** Fee per order after included orders */
    overageFeePerOrder: number
    /** Monthly subscription fee */
    monthlyFee: number
  }

  // Charges accumulated in this cycle

  charges: {
    /** Monthly subscription fee (charged once at cycle start) */
    subscriptionFee: number
    /** Array of usage charges (daily submissions) */
    usageFees: UsageFeeRecord[]
    /** Sum of all usage fees */
    totalUsageFees: number
    /** subscriptionFee + totalUsageFees */
    totalCharges: number
  }

  // Metadata

  metadata: {
    /** True if this is the first cycle for the subscription */
    isFirstCycle?: boolean
    /** True if this cycle is during trial period */
    isTrialCycle?: boolean
    /** True if plan changed during this cycle */
    planChangeInCycle?: boolean
    /** Reference to previous cycle (for cycle history chain) */
    previousCycleId?: string
  }

  /** Auto-generated timestamps */
  createdAt: Date | string
  updatedAt: Date | string
}

/**
 * Billing State Response
 * Returned by BillingStateManager.getCurrentState()
 *
 * Provides complete billing state for UI display
 */
export interface BillingState {
  /** Current active cycle */
  cycle: BillingCycleDocument
  /** Total orders in current cycle */
  totalOrders: number
  /** Orders included in plan (free) */
  freeOrders: number
  /** Orders exceeding free quota */
  extraOrders: number
  /** Current pending charges not yet submitted */
  pendingCharges: {
    extraOrders: number
    amount: number
  }
  /** Total charges accumulated in cycle */
  totalCharges: number
}

/**
 * Billing History Response
 * Returned by BillingStateManager.getBillingHistory()
 *
 * Combines billing cycles with detailed charge records
 */
export interface BillingHistoryResponse {
  /** Array of billing cycles (newest first) */
  cycles: BillingCycleDocument[]
  /** Total charges across all returned cycles */
  totalCharges: number
  /** Date range queried */
  dateRange: {
    from: Date | string
    to: Date | string
  }
}

/**
 * Charge Details for recording usage
 * Used by BillingStateManager.recordUsageCharge()
 */
export interface ChargeDetails {
  /** Order count at time of charge */
  orderCount: number
  /** Extra orders charged */
  extraOrders: number
  /** Charge amount in USD */
  amount: number
  /** Shopify AppUsageRecord ID */
  shopifyChargeId: string
}
