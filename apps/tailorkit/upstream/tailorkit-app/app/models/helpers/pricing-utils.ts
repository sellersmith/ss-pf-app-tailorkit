/**
 * Shared Pricing Utilities
 *
 * Pure utility functions that can be used on both client and server side.
 * These functions have no dependencies on server-only modules.
 */

import type { PricingPlanDocument } from '~/models/PricingPlan'

/**
 * Calculates number of free orders from plan structure
 *
 * @param plan - Pricing plan document
 * @returns Number of free orders (0 if not order-based)
 *
 * @example
 * ```typescript
 * const freeOrders = getFreeOrdersCount(plan)
 * console.log(`First ${freeOrders} orders are free`)
 * ```
 */
export function getFreeOrdersCount(plan: PricingPlanDocument): number {
  if (plan.usages?.orders) {
    const freeRule = plan.usages.orders.find(rule => !rule.transactionFee || rule.transactionFee === 0)
    if (freeRule) {
      return freeRule.to
    }
  }

  return 0
}

/**
 * Gets overage fee per order from plan structure
 *
 * @param plan - Pricing plan document
 * @returns Per-order fee for orders exceeding included amount (0 if not order-based)
 *
 * @example
 * ```typescript
 * const overageFee = getOverageFeePerOrder(plan)
 * console.log(`Orders after included: $${overageFee} each`)
 * ```
 */
export function getOverageFeePerOrder(plan: PricingPlanDocument): number {
  if (plan.usages?.orders) {
    const paidRule = plan.usages.orders.find(rule => rule.transactionFee && rule.transactionFee > 0)
    if (paidRule) {
      return paidRule.transactionFee
    }
  }

  return 0
}

/**
 * Checks if a plan is order-based
 *
 * @param plan - Pricing plan document
 * @returns True if plan uses order-based billing
 */
export function isOrderBasedPlan(plan: PricingPlanDocument): boolean {
  return Boolean(plan.usages?.orders && plan.usages.orders.length > 0)
}

/**
 * Gets usage terms description for order-based plans
 *
 * Used in Shopify subscription line item creation.
 *
 * @param plan - Pricing plan document
 * @returns Human-readable usage terms (e.g., "$0.50 per order after 50 orders")
 */
export function getOrderUsageTerms(plan: PricingPlanDocument): string {
  const freeOrders = getFreeOrdersCount(plan)
  const overageFee = getOverageFeePerOrder(plan)

  return `$${overageFee} per order after ${freeOrders} orders`
}

/**
 * Gets usage terms description for revenue-based plans
 *
 * Used in Shopify subscription line item creation.
 *
 * @param plan - Pricing plan document
 * @returns Human-readable usage terms (e.g., "$1 for every $1 in revenue generated")
 */
export function getRevenueUsageTerms(plan: PricingPlanDocument): string {
  // Extract revenue share from plan if defined
  const revenueRule = plan.usages?.revenue?.find(rule => rule.revenueShare)

  if (revenueRule?.revenueShare) {
    // Parse percentage like "0.9%" to rate
    const rate = parseFloat(revenueRule.revenueShare.replace('%', '')) / 100
    return `$${rate.toFixed(2)} for every $1 in revenue generated`
  }

  // Default: 1:1 revenue share
  return '$1 for every $1 in revenue generated'
}

/**
 * Calculates charge breakdown for a plan based on order usage
 *
 * @param plan - Pricing plan document
 * @param totalOrders - Total number of orders at time of calculation
 * @param baselineOrders - Orders at baseline (e.g., billing cycle start)
 * @returns Charge breakdown object
 *
 * @example
 * ```typescript
 * const breakdown = calculateChargeBreakdown(starterPlan, 5, 0)
 * // Returns: { feePerOrder: 0.5, extraOrders: 2, subtotal: 1.00 }
 * ```
 */
export function calculateChargeBreakdown(
  plan: PricingPlanDocument,
  totalOrders: number,
  baselineOrders: number = 0
): {
  feePerOrder: number
  extraOrders: number
  subtotal: number
} {
  const freeOrders = getFreeOrdersCount(plan)
  const overageFee = getOverageFeePerOrder(plan)

  const ordersSinceBaseline = totalOrders - baselineOrders
  const extraOrders = Math.max(0, ordersSinceBaseline - freeOrders)
  const subtotal = extraOrders * overageFee

  return {
    feePerOrder: overageFee,
    extraOrders,
    subtotal,
  }
}

/**
 * Gets badge color for a plan
 *
 * Maps plan names to Polaris badge colors for consistent UI display
 *
 * @param planName - Plan name (e.g., "Starter", "Growth", "Premium")
 * @returns Badge color tone
 */
export function getPlanBadgeColor(planName: string): 'success' | 'caution' | 'info' | 'warning' | 'critical' {
  const normalizedName = planName.toLowerCase()

  if (normalizedName.includes('starter') || normalizedName.includes('basic')) {
    return 'success'
  }

  if (normalizedName.includes('growth') || normalizedName.includes('pro')) {
    return 'caution'
  }

  if (normalizedName.includes('premium') || normalizedName.includes('enterprise')) {
    return 'info'
  }

  // Default fallback
  return 'info'
}

/**
 * Generates subscription name with plan-specific suffix
 *
 * @param appName - Application name (optional, defaults to 'App')
 * @param plan - Pricing plan document
 * @returns Formatted subscription name
 */
export function getSubscriptionName(appName: string | undefined, plan: PricingPlanDocument): string {
  const name = appName || 'App'
  const baseName = `${name} ${plan.name}${plan.optionName ? ` (${plan.optionName})` : ''}`

  // Add revenue-based plan suffix if applicable
  if (plan.usages?.revenue && plan.usages.revenue.length > 0) {
    const firstTier = plan.usages.revenue[0]
    if (firstTier && firstTier.to !== undefined) {
      return `${baseName} (FREE until you generate $${firstTier.to} in revenue with the app)`
    }
  }

  return baseName
}
