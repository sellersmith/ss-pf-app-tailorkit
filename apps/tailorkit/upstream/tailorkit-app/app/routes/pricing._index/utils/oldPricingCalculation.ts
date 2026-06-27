/**
 * Old vs New Pricing Calculation Utilities
 *
 * Pure utility functions for comparing V1 (revenue-based) and V2 (order-based)
 * pricing plans, including migration discount calculations.
 */

import type { PricingPlanDocument } from '~/models/PricingPlan'
import { getFreeOrdersCount, getOverageFeePerOrder } from '~/models/helpers/pricing-utils'
import { calculateV1Fee, recommendPlan } from './planRecommendation'

export interface PricingBreakdown {
  aiCredits: number
  subscriptionFee: number
  extraOrderFee: number
  discount: number
  total: number
}

/**
 * Migration coupon code for V1 -> V2 migration (50% off first month).
 * Must stay in sync with the 'TLKMIG50' coupon defined in Coupon.server.ts.
 */
export const MIGRATION_COUPON_CODE = 'TLKMIG50'

/**
 * Migration discount rate (50% off subscription fee only).
 * Must stay in sync with the TLKMIG50 coupon's discount.amount (50%) in Coupon.server.ts.
 */
const MIGRATION_DISCOUNT_RATE = 0.5

const V1_DEFAULT_AI_CREDITS = 500

/**
 * Calculate full V1 pricing breakdown.
 *
 * Uses the actual V1 plan document to derive subscription fee from revenue tiers,
 * avoiding hardcoded values that could drift from the database.
 *
 * @param monthlyRevenue - Monthly revenue amount
 * @param v1Plan - The V1 revenue-based pricing plan (optional, falls back to default AI credits)
 */
export function calculateV1Breakdown(monthlyRevenue: number, v1Plan?: PricingPlanDocument): PricingBreakdown {
  const subscriptionFee = v1Plan ? calculateV1Fee(monthlyRevenue, v1Plan) : 0
  const aiCredits = v1Plan?.aiCreditsPerMonth || V1_DEFAULT_AI_CREDITS

  return {
    aiCredits,
    subscriptionFee,
    extraOrderFee: 0,
    discount: 0,
    total: subscriptionFee,
  }
}

/**
 * Calculate V2 pricing breakdown with 50% migration discount on subscription fee only.
 * Extra order fees are NOT discounted.
 */
export function calculateV2MigrationBreakdown(plan: PricingPlanDocument, orderCount: number): PricingBreakdown {
  const subscriptionFee = plan.price || 0
  const includedOrders = getFreeOrdersCount(plan)
  const overageFeePerOrder = getOverageFeePerOrder(plan)

  const overageOrders = Math.max(0, orderCount - includedOrders)
  const extraOrderFee = overageOrders * overageFeePerOrder

  const discount = subscriptionFee * MIGRATION_DISCOUNT_RATE
  const total = Math.max(0, subscriptionFee + extraOrderFee - discount)

  return {
    aiCredits: plan.aiCreditsPerMonth || 0,
    subscriptionFee,
    extraOrderFee,
    discount,
    total,
  }
}

/**
 * Recommend the best V2 migration plan based on order count.
 * Delegates to the cost-based recommendPlan() utility which finds the
 * cheapest plan for the given order volume.
 */
export function recommendMigrationPlan(orderCount: number, v2Plans: PricingPlanDocument[]): PricingPlanDocument | null {
  return recommendPlan(orderCount, false, v2Plans)
}
