/**
 * Plan Recommendation Utilities
 *
 * Provides functions to recommend the best pricing plan based on order count
 * and feature requirements, as well as calculate total plan costs.
 */

import type { PricingPlanDocument } from '~/models/PricingPlan'
import type { CouponDocument } from '~/models/Coupon'
import { getFreeOrdersCount, getOverageFeePerOrder, isOrderBasedPlan } from '~/models/helpers/pricing-utils'

/**
 * Calculated price breakdown for a plan
 */
export interface CalculatedPrice {
  subscriptionFee: number
  extraOrderFee: number
  subtotal: number
  discount: number
  total: number
  discountCode?: string
  discountPercentage?: number
  includedOrders: number
  overageFeePerOrder: number
}

/**
 * Discount validation status
 */
export type DiscountStatus = 'idle' | 'checking' | 'valid' | 'invalid'

/**
 * Recommend the best plan based on order count and API access requirements
 *
 * Algorithm:
 * 1. Filter plans by pricingVersion: 2 (order-based)
 * 2. If needsApiAccess is true, filter plans with fulfillment3rdPartyApi feature
 * 3. Calculate total cost for each plan
 * 4. Return the plan with the lowest total cost
 *
 * @param orderCount - Average monthly order count
 * @param needsApiAccess - Whether the user needs 3rd-party API access
 * @param plans - Available pricing plans
 * @returns The recommended plan, or null if no suitable plan found
 */
export function recommendPlan(
  orderCount: number,
  needsApiAccess: boolean,
  plans: PricingPlanDocument[]
): PricingPlanDocument | null {
  // Filter to order-based plans only (has usages.orders)
  let eligiblePlans = plans.filter(plan => isOrderBasedPlan(plan))

  // If no order-based plans available, return null
  if (eligiblePlans.length === 0) {
    return null
  }

  // If API access is needed, filter to plans with fulfillment3rdPartyApi feature
  if (needsApiAccess) {
    const plansWithApi = eligiblePlans.filter(plan => plan.features?.fulfillment3rdPartyApi === true)

    // If no plans with API access, return the most expensive plan (likely has all features)
    if (plansWithApi.length === 0) {
      return eligiblePlans.sort((a, b) => b.price - a.price)[0]
    }
    eligiblePlans = plansWithApi
  }

  // Handle edge case: orderCount <= 0 - recommend cheapest plan
  if (orderCount <= 0) {
    return eligiblePlans.sort((a, b) => a.price - b.price)[0]
  }

  // Calculate total cost for each plan
  const planCosts = eligiblePlans.map(plan => {
    const totalCost = calculateTotalCost(plan, orderCount)
    return { plan, totalCost }
  })

  // Sort by total cost (ascending)
  planCosts.sort((a, b) => a.totalCost - b.totalCost)

  // Apply slight preference for higher tier if close to threshold
  // This accounts for growth trajectory
  const cheapestPlan = planCosts[0]
  const nextPlan = planCosts[1]

  // Guard against division by zero (free plans have totalCost of 0)
  if (nextPlan && cheapestPlan.totalCost > 0) {
    const costDifference = nextPlan.totalCost - cheapestPlan.totalCost
    const percentDifference = costDifference / cheapestPlan.totalCost

    // If the next plan is within 10% cost difference and has more included orders,
    // recommend the higher tier for growth headroom
    if (percentDifference <= 0.1 && getFreeOrdersCount(nextPlan.plan) > getFreeOrdersCount(cheapestPlan.plan)) {
      return nextPlan.plan
    }
  }

  return cheapestPlan.plan
}

/**
 * Calculate total monthly cost for a plan given an order count
 *
 * @param plan - The pricing plan
 * @param orderCount - Number of orders per month
 * @returns Total monthly cost
 */
export function calculateTotalCost(plan: PricingPlanDocument, orderCount: number): number {
  const basePrice = plan.price || 0
  const includedOrders = getFreeOrdersCount(plan)
  const overageFeePerOrder = getOverageFeePerOrder(plan)

  const overageOrders = Math.max(0, orderCount - includedOrders)
  const overageFee = overageOrders * overageFeePerOrder

  return basePrice + overageFee
}

/**
 * Calculate the full price breakdown for a plan
 *
 * @param plan - The pricing plan
 * @param orderCount - Number of orders per month
 * @param coupon - Optional validated coupon to apply
 * @returns Full price breakdown
 */
export function calculatePlanPrice(
  plan: PricingPlanDocument,
  orderCount: number,
  coupon?: CouponDocument | null
): CalculatedPrice {
  const subscriptionFee = plan.price || 0
  const includedOrders = getFreeOrdersCount(plan)
  const overageFeePerOrder = getOverageFeePerOrder(plan)

  // Calculate extra order fee
  const overageOrders = Math.max(0, orderCount - includedOrders)
  const extraOrderFee = overageOrders * overageFeePerOrder

  // Calculate subtotal (before discount)
  const subtotal = subscriptionFee + extraOrderFee

  // Calculate discount
  let discount = 0
  let discountPercentage: number | undefined

  if (coupon?.discount) {
    const { type, amount } = coupon.discount

    if (type === 'percent') {
      // Percentage discount applies to subscription fee only (not overage)
      discount = subscriptionFee * (amount / 100)
      discountPercentage = amount
    } else if (type === 'fixed') {
      // Fixed discount, capped at subscription fee
      discount = Math.min(amount, subscriptionFee)
    }
  }

  // Calculate total
  const total = Math.max(0, subtotal - discount)

  return {
    subscriptionFee,
    extraOrderFee,
    subtotal,
    discount,
    total,
    discountCode: coupon?.code,
    discountPercentage,
    includedOrders,
    overageFeePerOrder,
  }
}

/**
 * Format a number as USD currency (Shopify app charges are always in USD)
 *
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "$19.00")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Get the display name for a plan (uses alias if available)
 *
 * @param plan - The pricing plan
 * @returns Display name
 */
export function getPlanDisplayName(plan: PricingPlanDocument): string {
  return plan.name || plan.alias || 'Unknown plan'
}

/**
 * Calculate the monthly fee for a V1 revenue-based plan given a revenue amount
 *
 * Iterates through the plan's revenue tiers to find the matching tier
 * and returns the corresponding totalFee. For the highest tier, applies
 * the revenue share percentage on revenue exceeding the tier threshold.
 *
 * @param revenue - Monthly revenue amount
 * @param v1Plan - The V1 revenue-based pricing plan
 * @returns Monthly fee for the given revenue
 */
export function calculateV1Fee(revenue: number, v1Plan: PricingPlanDocument): number {
  const tiers = v1Plan?.usages?.revenue
  if (!tiers?.length) return 0

  for (const tier of tiers) {
    if (revenue >= (tier.from || 0) && revenue <= (tier.to || Infinity)) {
      // Handle high-volume tier with percentage-based revenue share
      if (tier.revenueShare && tier.from) {
        const baseAmount = tier.totalFee || 0
        const overRevenue = Math.max(0, revenue - tier.from)
        const sharePercent = parseFloat(tier.revenueShare) / 100
        return baseAmount + overRevenue * sharePercent
      }
      return tier.totalFee || 0
    }
  }

  return 0
}

/**
 * Find the plan with the lowest total cost for a given order count
 *
 * Used to highlight the "Best price" column in the comparison table.
 *
 * @param plans - Available pricing plans
 * @param orderCount - Number of orders per month
 * @returns The plan ID with the lowest total cost, or null if no V2 plans found
 */
export function findBestPricePlan(plans: PricingPlanDocument[], orderCount: number): string | null {
  // Filter to order-based plans only (has usages.orders)
  const v2Plans = plans.filter(plan => isOrderBasedPlan(plan))

  if (v2Plans.length === 0) {
    return null
  }

  let bestPlanId: string | null = null
  let lowestCost = Infinity

  for (const plan of v2Plans) {
    const totalCost = calculateTotalCost(plan, orderCount)
    if (totalCost < lowestCost) {
      lowestCost = totalCost
      bestPlanId = plan._id
    }
  }

  return bestPlanId
}
