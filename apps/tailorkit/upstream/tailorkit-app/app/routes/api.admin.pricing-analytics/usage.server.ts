import type { DateRange } from './revenue.server'
import Subscription from '~/models/Subscription.server'
import { getOrderCountInBillingCycle } from '~/models/Order.server'
import { getBillingCycleDates } from '~/models/PricingPlan.server'

/**
 * Usage analytics service for pricing model V2
 * Provides usage distribution, average orders, and upsell opportunity analysis
 *
 * KEY CONCEPTS:
 *
 * - Usage Distribution: How shops utilize their plan limits
 *   Example: Growth plan (300 orders/month):
 *   - 40 shops use < 80% (under 240 orders) → could downgrade
 *   - 30 shops use 80-100% (240-300 orders) → approaching limit
 *   - 20 shops exceed limit → paying overage fees, should upgrade
 *
 * - Upsell Opportunities: Shops at 80-100% utilization
 *   These shops are good candidates for upgrading to avoid overage fees
 *   Target: Shops consistently near their limit but not yet exceeding
 *
 * - Average Orders: Statistical analysis of order volume per shop
 *   Uses average, median, and 95th percentile for complete picture
 */

/**
 * Usage Distribution Structure
 *
 * Categorizes shops by how much of their plan limit they use:
 * - Under Limit (<80%): Could potentially downgrade to save money
 * - Near Limit (80-100%): Prime upsell candidates, approaching their limit
 * - Over Limit (>100%): Already paying overage fees, should upgrade
 *
 * Utilization Rate = (Current Orders / Plan Limit) × 100
 * Example: 250 orders / 300 limit = 83.3% utilization (near limit)
 */
export interface UsageDistribution {
  planName: string
  planId: string
  planLimit: number
  underLimit: {
    count: number
    percentage: number
    avgUtilization: number // 0-100%
  }
  nearLimit: {
    // 80-100% of limit
    count: number
    percentage: number
    avgUtilization: number
  }
  overLimit: {
    count: number
    percentage: number
    avgOverage: number // Average orders over limit
  }
  totalShops: number
}

/**
 * Average Orders Metrics Structure
 *
 * Statistical analysis of order volume per shop in a plan:
 *
 * - Average: Mean orders across all shops (can be skewed by outliers)
 * - Median: Middle value when sorted (better for typical shop behavior)
 * - P95 (95th percentile): Top 5% of shops' order volume
 *
 * Why track all three?
 * - If average >> median → a few high-volume shops are skewing data
 * - P95 shows maximum realistic usage (for capacity planning)
 * - Median shows typical shop behavior (for marketing messaging)
 *
 * Example:
 * - Average: 200 orders (affected by a few huge shops)
 * - Median: 150 orders (typical shop)
 * - P95: 450 orders (top performers)
 */
export interface AverageOrdersMetrics {
  planName: string
  planId: string
  planLimit: number
  averageOrders: number
  medianOrders: number
  p95Orders: number // 95th percentile
  totalShops: number
}

/**
 * Upsell Opportunity Structure
 *
 * Identifies shops that should upgrade to avoid overage fees.
 * Target: Shops at 80-100% of their plan limit (consistently near threshold).
 *
 * Why 80-100% range?
 * - Below 80%: Comfortable with current plan, unlikely to upgrade
 * - Above 100%: Already paying overage, should have upgraded earlier
 * - 80-100%: Sweet spot - aware they're approaching limit, proactive upgrade
 *
 * Potential Savings Calculation:
 * - Projected overage cost if they stay on current plan
 * - Minus: Additional cost of upgrading to next tier
 * - Result: Money they'd save by upgrading now
 *
 * Example:
 * - Current plan: Growth ($39, 300 orders)
 * - Order count: 280 (93% utilization)
 * - Projected overage: 30 orders × $0.50 = $15
 * - Upgrade cost: Enterprise $79 - Growth $39 = $40 more
 * - Savings: $15 - $40 = -$25 (not worth it yet, but close to breakeven)
 */
export interface UpsellOpportunity {
  shopDomain: string
  shopId: string
  currentPlan: string
  currentPlanPrice: number
  orderCount: number
  planLimit: number
  utilizationRate: number // Percentage (e.g., 92.5)
  suggestedPlan: string
  suggestedPlanPrice: number
  potentialOverageSavings: number
  lastAccess: Date
}

/**
 * Get usage distribution for a plan (under/near/over limit percentages)
 *
 * Analyzes how shops in a plan utilize their order limits:
 * - Under 80%: Comfortable usage, unlikely to upgrade
 * - 80-100%: Approaching limit, prime upsell candidates
 * - Over 100%: Exceeding limit, paying overage fees
 *
 * Business use cases:
 * - High "under limit" % → plan limits may be too generous
 * - High "over limit" % → limits too restrictive, losing money to overage
 * - High "near limit" % → good upsell opportunity pipeline
 *
 * @param planId - Plan ID to analyze
 * @returns Usage distribution metrics with utilization percentages
 */
export async function getUsageDistribution(planId: string): Promise<UsageDistribution> {
  // Get plan details
  const subscriptions = await Subscription.aggregate([
    {
      $match: {
        plan: planId,
        status: 'active',
      },
    },
    {
      $lookup: {
        from: 'pricingplans',
        localField: 'plan',
        foreignField: '_id',
        as: 'planDetails',
      },
    },
    {
      $unwind: {
        path: '$planDetails',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $match: {
        'planDetails.pricingVersion': 2,
      },
    },
    {
      $project: {
        shopDomain: 1,
        billingAnchorDate: 1,
        planName: { $ifNull: ['$planDetails.alias', '$planDetails.name'] },
        planLimit: '$planDetails.includedOrders',
      },
    },
  ])

  if (subscriptions.length === 0) {
    return {
      planName: 'Unknown',
      planId,
      planLimit: 0,
      underLimit: { count: 0, percentage: 0, avgUtilization: 0 },
      nearLimit: { count: 0, percentage: 0, avgUtilization: 0 },
      overLimit: { count: 0, percentage: 0, avgOverage: 0 },
      totalShops: 0,
    }
  }

  const planName = subscriptions[0].planName
  const planLimit = subscriptions[0].planLimit

  // Calculate order counts for each shop
  const shopUsages = await Promise.all(
    subscriptions.map(async sub => {
      if (!sub.billingAnchorDate) {
        return { shopDomain: sub.shopDomain, orderCount: 0, utilizationRate: 0 }
      }

      const anchorDate = sub.billingAnchorDate instanceof Date ? sub.billingAnchorDate : new Date(sub.billingAnchorDate)
      const { from, to } = getBillingCycleDates(anchorDate)
      const orderCount = await getOrderCountInBillingCycle(sub.shopDomain, from, to)
      const utilizationRate = planLimit > 0 ? (orderCount / planLimit) * 100 : 0

      return {
        shopDomain: sub.shopDomain,
        orderCount,
        utilizationRate,
      }
    })
  )

  // Categorize shops
  const underLimit = shopUsages.filter(s => s.utilizationRate < 80)
  const nearLimit = shopUsages.filter(s => s.utilizationRate >= 80 && s.utilizationRate <= 100)
  const overLimit = shopUsages.filter(s => s.utilizationRate > 100)

  const totalShops = shopUsages.length

  return {
    planName,
    planId,
    planLimit,
    underLimit: {
      count: underLimit.length,
      percentage: totalShops > 0 ? (underLimit.length / totalShops) * 100 : 0,
      avgUtilization:
        underLimit.length > 0 ? underLimit.reduce((sum, s) => sum + s.utilizationRate, 0) / underLimit.length : 0,
    },
    nearLimit: {
      count: nearLimit.length,
      percentage: totalShops > 0 ? (nearLimit.length / totalShops) * 100 : 0,
      avgUtilization:
        nearLimit.length > 0 ? nearLimit.reduce((sum, s) => sum + s.utilizationRate, 0) / nearLimit.length : 0,
    },
    overLimit: {
      count: overLimit.length,
      percentage: totalShops > 0 ? (overLimit.length / totalShops) * 100 : 0,
      avgOverage:
        overLimit.length > 0 ? overLimit.reduce((sum, s) => sum + (s.orderCount - planLimit), 0) / overLimit.length : 0,
    },
    totalShops,
  }
}

/**
 * Get average orders per shop for a plan
 *
 * Provides statistical analysis of order volume to understand typical usage:
 * - Average: Mean orders (can be skewed by outliers)
 * - Median: Middle value (better representation of typical shop)
 * - P95: 95th percentile (shows high-volume users)
 *
 * Why all three metrics matter:
 * - If average >> median: A few power users are skewing average up
 * - Median: Best for understanding typical shop behavior
 * - P95: Helps plan for capacity and understand max realistic usage
 *
 * Business decisions:
 * - Set plan limits based on median + buffer (avoid too many overages)
 * - Marketing messaging targets median shop behavior
 * - Enterprise tier targets P95+ users
 *
 * @param planId - Plan ID to analyze
 * @param dateRange - Optional date range for historical data
 * @returns Average, median, and p95 order counts
 */
export async function getAverageOrdersPerShop(planId: string, dateRange?: DateRange): Promise<AverageOrdersMetrics> {
  const matchStage: any = {
    plan: planId,
    status: 'active',
  }

  if (dateRange) {
    matchStage.createdAt = { $gte: dateRange.from, $lte: dateRange.to }
  }

  // Get subscriptions
  const subscriptions = await Subscription.aggregate([
    {
      $match: matchStage,
    },
    {
      $lookup: {
        from: 'pricingplans',
        localField: 'plan',
        foreignField: '_id',
        as: 'planDetails',
      },
    },
    {
      $unwind: {
        path: '$planDetails',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $match: {
        'planDetails.pricingVersion': 2,
      },
    },
    {
      $project: {
        shopDomain: 1,
        billingAnchorDate: 1,
        planName: { $ifNull: ['$planDetails.alias', '$planDetails.name'] },
        planLimit: '$planDetails.includedOrders',
      },
    },
  ])

  if (subscriptions.length === 0) {
    return {
      planName: 'Unknown',
      planId,
      planLimit: 0,
      averageOrders: 0,
      medianOrders: 0,
      p95Orders: 0,
      totalShops: 0,
    }
  }

  const planName = subscriptions[0].planName
  const planLimit = subscriptions[0].planLimit

  // Get order counts
  const orderCounts = await Promise.all(
    subscriptions.map(async sub => {
      if (!sub.billingAnchorDate) return 0

      const anchorDate = sub.billingAnchorDate instanceof Date ? sub.billingAnchorDate : new Date(sub.billingAnchorDate)
      const { from, to } = getBillingCycleDates(anchorDate)
      return getOrderCountInBillingCycle(sub.shopDomain, from, to)
    })
  )

  // Calculate statistics
  const totalOrders = orderCounts.reduce((sum, count) => sum + count, 0)
  const averageOrders = subscriptions.length > 0 ? totalOrders / subscriptions.length : 0

  // Median
  const sortedCounts = [...orderCounts].sort((a, b) => a - b)
  const midpoint = Math.floor(sortedCounts.length / 2)
  const medianOrders
    = sortedCounts.length % 2 === 0 ? (sortedCounts[midpoint - 1] + sortedCounts[midpoint]) / 2 : sortedCounts[midpoint]

  // 95th percentile
  const p95Index = Math.floor(sortedCounts.length * 0.95)
  const p95Orders = sortedCounts[p95Index] || 0

  return {
    planName,
    planId,
    planLimit,
    averageOrders,
    medianOrders,
    p95Orders,
    totalShops: subscriptions.length,
  }
}

/**
 * Identify shops at 80-100% of their plan limit (upsell opportunities)
 *
 * Finds shops that are consistently approaching their plan limits.
 * These are prime candidates for proactive upgrade outreach.
 *
 * Why target 80-100% utilization?
 * - They're experiencing growth (good sign for retention)
 * - They're aware they're approaching limit (receptive to upgrade message)
 * - They haven't exceeded yet (can frame as proactive vs reactive)
 *
 * Outreach strategy:
 * - 90-100%: High priority, reach out immediately
 * - 85-90%: Medium priority, send automated upgrade reminder
 * - 80-85%: Low priority, include in marketing email campaigns
 *
 * Sorts by utilization rate (highest first) to prioritize outreach.
 *
 * @returns List of shops that should consider upgrading, sorted by urgency
 */
export async function getUpsellOpportunities(): Promise<UpsellOpportunity[]> {
  // Get all active V2 subscriptions
  const subscriptions = await Subscription.aggregate([
    {
      $match: {
        status: 'active',
      },
    },
    {
      $lookup: {
        from: 'pricingplans',
        localField: 'plan',
        foreignField: '_id',
        as: 'planDetails',
      },
    },
    {
      $unwind: {
        path: '$planDetails',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $match: {
        'planDetails.pricingVersion': 2,
      },
    },
    {
      $lookup: {
        from: 'shops',
        localField: 'shopDomain',
        foreignField: 'shopDomain',
        as: 'shopDetails',
      },
    },
    {
      $unwind: {
        path: '$shopDetails',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $project: {
        shopDomain: 1,
        shopId: '$shopDetails._id',
        lastAccess: '$shopDetails.lastAccess',
        billingAnchorDate: 1,
        currentPlan: { $ifNull: ['$planDetails.alias', '$planDetails.name'] },
        currentPlanPrice: '$planDetails.price',
        planLimit: '$planDetails.includedOrders',
        overageFee: '$planDetails.overageFeePerOrder',
      },
    },
  ])

  // Calculate order counts and find upsell opportunities
  const opportunities: UpsellOpportunity[] = []

  for (const sub of subscriptions) {
    if (!sub.billingAnchorDate) continue

    const anchorDate = sub.billingAnchorDate instanceof Date ? sub.billingAnchorDate : new Date(sub.billingAnchorDate)
    const { from, to } = getBillingCycleDates(anchorDate)
    const orderCount = await getOrderCountInBillingCycle(sub.shopDomain, from, to)
    const utilizationRate = sub.planLimit > 0 ? (orderCount / sub.planLimit) * 100 : 0

    // Only shops at 80-100% utilization (prime upsell candidates)
    // Below 80%: Comfortable with current plan
    // Above 100%: Already exceeding, should have upgraded earlier
    if (utilizationRate >= 80 && utilizationRate <= 100) {
      // Find next tier plan (higher price = higher limits)
      const nextPlan = await findNextTierPlan(sub.currentPlanPrice)

      if (nextPlan) {
        // Calculate potential savings if they upgrade now vs paying overage later
        // Projected overage: How many orders they'll likely exceed by
        const potentialOverage = Math.max(0, orderCount - sub.planLimit)
        // Cost of those overage orders at current plan's fee
        const potentialOverageCost = potentialOverage * sub.overageFee
        // Additional monthly cost to upgrade to next tier
        const upgradeAdditionalCost = nextPlan.price - sub.currentPlanPrice
        // Net savings (or cost) of upgrading
        // Positive = save money by upgrading, Negative = costs more to upgrade
        const potentialSavings = potentialOverageCost - upgradeAdditionalCost

        opportunities.push({
          shopDomain: sub.shopDomain,
          shopId: sub.shopId.toString(),
          currentPlan: sub.currentPlan,
          currentPlanPrice: sub.currentPlanPrice,
          orderCount,
          planLimit: sub.planLimit,
          utilizationRate,
          suggestedPlan: nextPlan.alias || nextPlan.name,
          suggestedPlanPrice: nextPlan.price,
          potentialOverageSavings: potentialSavings,
          lastAccess: sub.lastAccess,
        })
      }
    }
  }

  // Sort by utilization rate descending (highest first)
  return opportunities.sort((a, b) => b.utilizationRate - a.utilizationRate)
}

/**
 * Helper: Find next tier plan based on current price
 */
async function findNextTierPlan(currentPrice: number): Promise<any> {
  const PricingPlan = (await import('~/models/PricingPlan.server')).default

  return PricingPlan.findOne({
    pricingVersion: 2,
    status: 'active',
    price: { $gt: currentPrice },
  })
    .sort({ price: 1 })
    .limit(1)
}
