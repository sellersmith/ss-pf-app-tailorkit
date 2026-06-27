import Subscription from '~/models/Subscription.server'
import AiCreditPurchase from '~/models/AiCreditPurchase.server'

/**
 * Revenue analytics service for pricing model V2
 * Provides MRR, ARPU, and revenue breakdown calculations for admin dashboard
 *
 * KEY CONCEPTS:
 *
 * - MRR (Monthly Recurring Revenue): Predictable monthly revenue from all active subscriptions
 *   Example: 100 shops × $29/month = $2,900 MRR
 *   Split into: base subscription fees + overage fees + AI credits
 *
 * - ARPU (Average Revenue Per User): Total revenue ÷ Number of paying customers
 *   Example: $10,000 revenue / 200 shops = $50 ARPU
 *   Helps compare value across different pricing tiers
 *
 * - Revenue Breakdown: Shows where money comes from (base vs overage vs add-ons)
 *   Critical for understanding which revenue streams are growing/shrinking
 */

export interface DateRange {
  from: Date
  to: Date
}

/**
 * MRR Breakdown Structure
 *
 * MRR = Monthly Recurring Revenue (predictable monthly income)
 * Components:
 * - Base Subscription: Fixed monthly plan fees (Starter $19, Growth $39, Enterprise $79)
 * - Overage: Additional fees when shops exceed their order limits
 * - AI Credits: Recurring AI feature purchases
 *
 * Growth Rate: Month-over-month percentage change in MRR
 * Example: $10,000 → $11,000 = 10% growth rate
 */
export interface MRRBreakdown {
  totalMRR: number
  baseSubscriptionMRR: number
  overageMRR: number
  aiCreditsMRR: number
  byPlan: {
    planName: string
    planId: string
    shopCount: number
    baseMRR: number
    overageMRR: number
    totalMRR: number
  }[]
  growthRate?: number // Month-over-month growth percentage
}

/**
 * ARPU Metrics Structure
 *
 * ARPU = Average Revenue Per User
 * Formula: Total Revenue ÷ Number of Paying Customers
 *
 * Use cases:
 * - Compare value between pricing tiers (Growth ARPU vs Enterprise ARPU)
 * - Track if revenue per customer is increasing over time
 * - Identify which plans generate most value
 *
 * Example: If Growth plan has 50 shops generating $2,500/month
 * → Growth plan ARPU = $50 per shop
 */
export interface ARPUMetrics {
  overallARPU: number
  byPlan: {
    planName: string
    planId: string
    shopCount: number
    arpu: number
  }[]
  paidShopsCount: number
  totalRevenue: number
}

/**
 * Revenue Breakdown Structure
 *
 * Shows composition of total revenue by source:
 * - Base Subscription: Fixed monthly fees from each plan tier
 * - Overage: Extra charges when shops exceed order limits
 * - AI Credits: Additional AI feature purchases
 *
 * Why important:
 * - If overage revenue is high → pricing tiers may be too restrictive
 * - If base subscription dominates → predictable revenue stream
 * - Track which plans contribute most to bottom line
 *
 * Example breakdown:
 * - 60% from base subscriptions ($6,000)
 * - 30% from overage fees ($3,000)
 * - 10% from AI credits ($1,000)
 */
export interface RevenueBreakdown {
  totalRevenue: number
  baseSubscriptionRevenue: number
  overageRevenue: number
  aiCreditsRevenue: number
  percentages: {
    baseSubscription: number
    overage: number
    aiCredits: number
  }
  byPlan: {
    planName: string
    planId: string
    revenue: number
    percentage: number
  }[]
}

/**
 * Calculate Monthly Recurring Revenue (MRR) for pricing V2
 *
 * MRR represents predictable monthly income from all active subscriptions.
 * This is a key SaaS metric for forecasting and business health tracking.
 *
 * Calculation method:
 * 1. Sum all base subscription fees from active V2 pricing plans
 * 2. Add average overage fees (from shops exceeding order limits)
 * 3. Add recurring AI credit purchases
 * 4. Calculate month-over-month growth rate if date range provided
 *
 * @param dateRange - Optional date range for historical MRR (for growth rate calculation)
 * @returns MRR breakdown by plan and revenue source with growth metrics
 */
export async function calculateMRR(dateRange?: DateRange): Promise<MRRBreakdown> {
  const matchStage: any = {
    status: 'active',
  }

  // Filter by date range if provided
  if (dateRange) {
    matchStage.createdAt = { $lte: dateRange.to }
  }

  // Aggregate subscriptions by plan
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
        'planDetails.pricingVersion': 2, // Only V2 pricing
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
      $group: {
        _id: '$plan',
        planName: { $first: '$planDetails.name' },
        planAlias: { $first: '$planDetails.alias' },
        planPrice: { $first: '$planDetails.price' },
        shopCount: { $sum: 1 },
        totalBaseMRR: { $sum: '$planDetails.price' },
        // Overage MRR approximation (average from usages.tierUsageFee)
        totalOverageMRR: { $sum: { $ifNull: ['$shopDetails.usages.tierUsageFee', 0] } },
      },
    },
    {
      $sort: { planPrice: 1 },
    },
  ])

  // Calculate totals
  let totalBaseMRR = 0
  let totalOverageMRR = 0
  const byPlan: MRRBreakdown['byPlan'] = []

  for (const sub of subscriptions) {
    totalBaseMRR += sub.totalBaseMRR
    totalOverageMRR += sub.totalOverageMRR

    byPlan.push({
      planName: sub.planAlias || sub.planName,
      planId: sub._id.toString(),
      shopCount: sub.shopCount,
      baseMRR: sub.totalBaseMRR,
      overageMRR: sub.totalOverageMRR,
      totalMRR: sub.totalBaseMRR + sub.totalOverageMRR,
    })
  }

  // AI Credits MRR (estimated from purchase frequency)
  // Calculate average monthly revenue from completed AI credit purchases
  // MRR = (Total completed purchases revenue in last 3 months) / 3
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const recentAiPurchases = await AiCreditPurchase.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: threeMonthsAgo },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$finalPrice' },
      },
    },
  ])

  const aiCreditsMRR = recentAiPurchases.length > 0 ? recentAiPurchases[0].totalRevenue / 3 : 0

  const totalMRR = totalBaseMRR + totalOverageMRR + aiCreditsMRR

  // Calculate growth rate if previous period data available
  // Growth rate = ((Current MRR - Previous MRR) / Previous MRR) × 100
  // Example: ($11,000 - $10,000) / $10,000 × 100 = 10% growth
  let growthRate: number | undefined
  if (dateRange) {
    // Get MRR from same period last month for comparison
    const previousPeriodStart = new Date(dateRange.from)
    previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1)
    const previousPeriodEnd = new Date(dateRange.to)
    previousPeriodEnd.setMonth(previousPeriodEnd.getMonth() - 1)

    const previousMRR = await calculateMRR({
      from: previousPeriodStart,
      to: previousPeriodEnd,
    })

    if (previousMRR.totalMRR > 0) {
      growthRate = ((totalMRR - previousMRR.totalMRR) / previousMRR.totalMRR) * 100
    }
  }

  return {
    totalMRR,
    baseSubscriptionMRR: totalBaseMRR,
    overageMRR: totalOverageMRR,
    aiCreditsMRR,
    byPlan,
    growthRate,
  }
}

/**
 * Calculate Average Revenue Per User (ARPU) for pricing V2
 *
 * ARPU = Total Revenue ÷ Number of Paying Customers
 *
 * This metric helps answer:
 * - How much revenue does each customer generate on average?
 * - Which pricing tier has highest value customers?
 * - Is ARPU trending up (customers spending more) or down?
 *
 * Example calculation:
 * - Total revenue: $15,000
 * - Paying shops: 300
 * - ARPU = $15,000 / 300 = $50 per shop
 *
 * Revenue includes: base subscription + overage fees
 * (AI credits tracked separately)
 *
 * @param planId - Optional plan ID to filter by specific plan
 * @param dateRange - Optional date range for historical ARPU
 * @returns ARPU metrics by plan and overall
 */
export async function calculateARPU(planId?: string, dateRange?: DateRange): Promise<ARPUMetrics> {
  const matchStage: any = {
    status: 'active',
  }

  if (planId) {
    matchStage.plan = planId
  }

  if (dateRange) {
    matchStage.createdAt = { $lte: dateRange.to }
  }

  // Get all V2 subscriptions with shop data
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
        plan: '$planDetails._id',
        planName: { $ifNull: ['$planDetails.alias', '$planDetails.name'] },
        planPrice: '$planDetails.price',
        overageFee: { $ifNull: ['$shopDetails.usages.tierUsageFee', 0] },
        totalRevenue: {
          $add: ['$planDetails.price', { $ifNull: ['$shopDetails.usages.tierUsageFee', 0] }],
        },
      },
    },
  ])

  const paidShopsCount = subscriptions.length
  const totalRevenue = subscriptions.reduce((sum, sub) => sum + sub.totalRevenue, 0)
  const overallARPU = paidShopsCount > 0 ? totalRevenue / paidShopsCount : 0

  // Group by plan
  const planGroups = subscriptions.reduce(
    (acc, sub) => {
      const planId = sub.plan.toString()
      if (!acc[planId]) {
        acc[planId] = {
          planName: sub.planName,
          planId,
          shopCount: 0,
          totalRevenue: 0,
        }
      }
      acc[planId].shopCount++
      acc[planId].totalRevenue += sub.totalRevenue
      return acc
    },
    {} as Record<string, { planName: string; planId: string; shopCount: number; totalRevenue: number }>
  )

  const byPlan = Object.values(planGroups).map((group: any) => ({
    planName: group.planName,
    planId: group.planId,
    shopCount: group.shopCount,
    arpu: group.shopCount > 0 ? group.totalRevenue / group.shopCount : 0,
  }))

  return {
    overallARPU,
    byPlan,
    paidShopsCount,
    totalRevenue,
  }
}

/**
 * Get revenue breakdown by source (base subscription, overage, AI credits)
 *
 * This analysis shows revenue composition to understand:
 * - Is revenue predictable (high % from base subscriptions)?
 * - Are overage fees too high (may indicate pricing tiers are too restrictive)?
 * - Which plans contribute most to total revenue?
 *
 * Business insights:
 * - High overage % → consider adjusting tier limits or encouraging upgrades
 * - Low base subscription % → pricing may be too low
 * - Uneven plan distribution → marketing may need to focus on specific tiers
 *
 * @param dateRange - Date range for revenue calculation
 * @returns Revenue breakdown with percentages by source and by plan
 */
export async function getRevenueBreakdown(dateRange: DateRange): Promise<RevenueBreakdown> {
  // Get all V2 subscriptions in date range
  const subscriptions = await Subscription.aggregate([
    {
      $match: {
        status: 'active',
        createdAt: { $gte: dateRange.from, $lte: dateRange.to },
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
      $group: {
        _id: '$plan',
        planName: { $first: { $ifNull: ['$planDetails.alias', '$planDetails.name'] } },
        baseRevenue: { $sum: '$planDetails.price' },
        overageRevenue: { $sum: { $ifNull: ['$shopDetails.usages.tierUsageFee', 0] } },
      },
    },
    {
      $sort: { baseRevenue: -1 },
    },
  ])

  const baseSubscriptionRevenue = subscriptions.reduce((sum, s) => sum + s.baseRevenue, 0)
  const overageRevenue = subscriptions.reduce((sum, s) => sum + s.overageRevenue, 0)

  // Calculate AI credits revenue from completed purchases in date range
  const aiPurchases = await AiCreditPurchase.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: dateRange.from, $lte: dateRange.to },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$finalPrice' },
      },
    },
  ])

  const aiCreditsRevenue = aiPurchases.length > 0 ? aiPurchases[0].totalRevenue : 0

  const totalRevenue = baseSubscriptionRevenue + overageRevenue + aiCreditsRevenue

  const byPlan = subscriptions.map(s => ({
    planName: s.planName,
    planId: s._id.toString(),
    revenue: s.baseRevenue + s.overageRevenue,
    percentage: totalRevenue > 0 ? ((s.baseRevenue + s.overageRevenue) / totalRevenue) * 100 : 0,
  }))

  return {
    totalRevenue,
    baseSubscriptionRevenue,
    overageRevenue,
    aiCreditsRevenue,
    percentages: {
      baseSubscription: totalRevenue > 0 ? (baseSubscriptionRevenue / totalRevenue) * 100 : 0,
      overage: totalRevenue > 0 ? (overageRevenue / totalRevenue) * 100 : 0,
      aiCredits: totalRevenue > 0 ? (aiCreditsRevenue / totalRevenue) * 100 : 0,
    },
    byPlan,
  }
}
