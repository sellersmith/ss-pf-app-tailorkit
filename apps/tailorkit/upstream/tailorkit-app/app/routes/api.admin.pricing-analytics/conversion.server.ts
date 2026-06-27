import type { DateRange } from './revenue.server'
import Subscription from '~/models/Subscription.server'
import PlanChangeRecord from '~/models/PlanChangeRecord.server'

/**
 * Conversion analytics service for pricing model V2
 * Provides trial-to-paid conversion, cohort analysis, and churn tracking
 *
 * KEY CONCEPTS:
 *
 * - Trial Conversion: Percentage of shops that go from free trial → paid subscription
 *   Example: 100 shops start trial → 30 convert to paid = 30% conversion rate
 *   Tracks: which plans they choose, how many days to convert
 *
 * - Cohort Analysis: Group customers by start month, track retention over time
 *   Example: "January 2026 cohort" = all shops that started paying in Jan 2026
 *   Track: After 1 month, 3 months, 6 months → how many are still active?
 *
 * - Churn: Rate at which customers cancel their subscription
 *   Example: 200 active shops → 10 cancel in a month = 5% monthly churn rate
 *   Tracks: reasons for cancellation, which plans churn most, lifetime before churn
 *
 * - Plan Change Flow: Patterns of upgrades/downgrades between pricing tiers
 *   Example: 50 shops upgraded Starter → Growth, 10 downgraded Growth → Starter
 *   Tracks: when changes happen (after how many orders)
 */

/**
 * Trial Conversion Metrics Structure
 *
 * Measures effectiveness of trial period in converting to paid customers:
 *
 * Conversion Rate = (Total Converted / Total Trials) × 100
 * Example: 30 converted / 100 trials = 30% conversion rate
 *
 * Why track this?
 * - Low conversion (<20%): Trial experience may need improvement
 * - High conversion (>40%): Trial period is effective, product-market fit
 * - Days to conversion: Optimal trial length (if converting in 3 days, 14-day trial too long)
 *
 * By plan breakdown shows which tier is most popular among new customers.
 */
export interface TrialConversionMetrics {
  totalTrials: number
  convertedToStarted: number
  convertedToGrowth: number
  convertedToEnterprise: number
  totalConverted: number
  conversionRate: number
  averageDaysToConversion: number
  byPlan: {
    planName: string
    planId: string
    conversions: number
    percentage: number
  }[]
}

/**
 * Cohort Metrics Structure
 *
 * Cohort = Group of customers who started in the same month
 *
 * Purpose: Track how well we retain customers over time
 * Example: "2026-01" cohort = all shops that started paying in January 2026
 *
 * Retention Rate = (Retained Shops / Total Shops) × 100
 * Example: 80 still active / 100 started = 80% retention rate
 *
 * Why cohort analysis matters:
 * - Compare retention across different time periods
 * - Identify if recent cohorts retain better (product improvements working?)
 * - Calculate Customer Lifetime Value (CLV) based on retention curves
 *
 * Average revenue & orders show if cohort is growing or shrinking in value over time.
 * Good sign: Retained shops have increasing revenue (expansion revenue)
 * Bad sign: Retained shops have flat/declining revenue (not growing with product)
 */
export interface CohortMetrics {
  cohortMonth: string // YYYY-MM format (e.g., "2026-01")
  totalShops: number
  retainedShops: number
  churnedShops: number
  retentionRate: number
  averageRevenue: number
  averageOrders: number
}

/**
 * Churn Metrics Structure
 *
 * Churn = When customers cancel their subscription
 *
 * Churn Rate = (Churned Customers / Total Active Customers) × 100
 * Example: 10 cancellations / 200 active = 5% monthly churn rate
 *
 * Industry benchmarks:
 * - Good SaaS churn: <5% monthly (<60% annually)
 * - Acceptable: 5-7% monthly
 * - Problem: >7% monthly (need immediate attention)
 *
 * Why track churn reasons?
 * - Cost: Pricing is too high → consider value-add features or adjust pricing
 * - Seasonality: Business is seasonal → offer pause/hibernate option
 * - Business closed: Nothing we can do, natural attrition
 * - Other: Investigate patterns (lack of features, poor support, etc.)
 *
 * By plan analysis shows which tiers have highest churn (may indicate poor fit).
 *
 * Average lifetime: How long customers stay before churning
 * Example: 180 days = 6 months average lifetime
 * Used to calculate Customer Lifetime Value (CLV) = Lifetime × ARPU
 */
export interface ChurnMetrics {
  totalChurned: number
  churnRate: number
  byPlan: {
    planName: string
    planId: string
    churned: number
    churnRate: number
  }[]
  averageLifetimeBeforeChurn: number // Days
}

/**
 * Plan Change Flow Structure
 *
 * Tracks upgrade and downgrade patterns between pricing tiers.
 *
 * Purpose: Understand customer journey through pricing tiers
 * - Which upgrade path is most common? (Starter → Growth → Enterprise?)
 * - Do customers skip tiers? (Starter → Enterprise directly?)
 * - What triggers plan changes? (order count threshold?)
 *
 * Example insights:
 * - 50 shops upgraded Starter → Growth after ~200 orders
 * - 10 shops downgraded Growth → Starter (investigate why)
 * - 5 shops jumped Starter → Enterprise (high-growth customers)
 *
 * Business decisions:
 * - Set tier limits based on when upgrades typically happen
 * - Proactively reach out at trigger points (e.g., 180 orders if typical upgrade at 200)
 * - Investigate downgrades (pricing too high? missing features?)
 */
export interface PlanChangeFlow {
  fromPlan: string
  toPlan: string
  count: number
  percentage: number
  averageOrderCountAtChange: number
}

/**
 * Calculate trial-to-paid conversion metrics
 *
 * Measures how effectively trial period converts to paying customers.
 *
 * Conversion Rate = (Shops that started paying / Total trial shops) × 100
 *
 * What makes a good conversion rate?
 * - Below 20%: Trial needs improvement (confusing onboarding, missing features)
 * - 20-40%: Industry standard for SaaS products
 * - Above 40%: Excellent product-market fit
 *
 * Days to conversion analysis helps optimize trial length:
 * - If most convert in 3-5 days → 14-day trial may be too long
 * - If conversions happen throughout trial → current length is appropriate
 * - If many convert on last day → trial period creates urgency (good)
 *
 * By plan breakdown shows which tier appeals most to new customers.
 *
 * @param dateRange - Date range for trial start dates (filter trials that started in this period)
 * @returns Conversion metrics by plan with average days to conversion
 */
export async function getTrialConversionMetrics(dateRange: DateRange): Promise<TrialConversionMetrics> {
  const Shop = (await import('~/models/Shop.server')).default

  // Find all shops that started V2 active-days trial in date range
  // Join with subscription to get plan details and conversion status
  const subscriptions = await Shop.aggregate([
    {
      // Match shops that started trial in date range
      $match: {
        trialStartedAt: { $gte: dateRange.from, $lte: dateRange.to },
      },
    },
    {
      // Lookup current subscription
      $lookup: {
        from: 'subscriptions',
        localField: 'subscription',
        foreignField: '_id',
        as: 'subscriptionDetails',
      },
    },
    {
      $unwind: {
        path: '$subscriptionDetails',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      // Lookup plan details
      $lookup: {
        from: 'pricingplans',
        localField: 'subscriptionDetails.plan',
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
      // Filter for V2 order-based pricing only
      $match: {
        'planDetails.pricingVersion': 2,
      },
    },
    {
      $project: {
        trialStartDate: '$trialStartedAt',
        // Conversion date = when trial completed (trialCompletedAt)
        // If null, they haven't converted yet (still on trial or abandoned)
        firstPaidDate: '$trialCompletedAt',
        planName: { $ifNull: ['$planDetails.alias', '$planDetails.name'] },
        planId: '$subscriptionDetails.plan',
        subscriptionStatus: '$subscriptionDetails.status',
        daysToConversion: {
          $cond: {
            if: { $ne: ['$trialCompletedAt', null] },
            then: {
              $divide: [
                { $subtract: ['$trialCompletedAt', '$trialStartedAt'] },
                1000 * 60 * 60 * 24, // Convert ms to days
              ],
            },
            else: null,
          },
        },
      },
    },
  ])

  const totalTrials = subscriptions.length
  const converted = subscriptions.filter(s => s.firstPaidDate !== null)
  const totalConverted = converted.length

  // Group by plan
  const planCounts: Record<string, { planName: string; count: number }> = {}
  for (const sub of converted) {
    const planId = sub.planId.toString()
    if (!planCounts[planId]) {
      planCounts[planId] = { planName: sub.planName, count: 0 }
    }
    planCounts[planId].count++
  }

  // Calculate averages
  const daysToConversionList = converted.map(s => s.daysToConversion).filter(d => d !== null)
  const averageDaysToConversion
    = daysToConversionList.length > 0
      ? daysToConversionList.reduce((sum, days) => sum + days, 0) / daysToConversionList.length
      : 0

  const byPlan = Object.entries(planCounts).map(([planId, data]) => ({
    planName: data.planName,
    planId,
    conversions: data.count,
    percentage: totalConverted > 0 ? (data.count / totalConverted) * 100 : 0,
  }))

  // Separate by tier names (assuming naming convention)
  const convertedToStarted = converted.filter(s => s.planName.toLowerCase().includes('starter')).length
  const convertedToGrowth = converted.filter(s => s.planName.toLowerCase().includes('growth')).length
  const convertedToEnterprise = converted.filter(s => s.planName.toLowerCase().includes('enterprise')).length

  return {
    totalTrials,
    convertedToStarted,
    convertedToGrowth,
    convertedToEnterprise,
    totalConverted,
    conversionRate: totalTrials > 0 ? (totalConverted / totalTrials) * 100 : 0,
    averageDaysToConversion,
    byPlan,
  }
}

/**
 * Get cohort retention metrics for a specific month
 *
 * Cohort = All shops that started paying in the same month
 * Retention = Percentage of cohort still active today
 *
 * Why cohort analysis matters:
 * - Compare cohorts across months (are we getting better at retention?)
 * - Forecast revenue (if January cohort has 80% retention at 3 months, expect similar for future cohorts)
 * - Calculate Customer Lifetime Value (CLV) from retention curves
 *
 * Example usage:
 * - Track "2026-01" cohort monthly: Month 0 (100 shops), Month 1 (85), Month 2 (75), Month 3 (70)
 * - Retention rates: 85%, 75%, 70% → retention curve flattening (good sign)
 * - Compare to "2025-12" cohort to see if retention is improving
 *
 * Average revenue & orders per shop show if retained customers are growing in value.
 *
 * @param cohortMonth - Cohort month in YYYY-MM format (e.g., "2026-01")
 * @returns Retention metrics for the cohort
 */
export async function getCohortMetrics(cohortMonth: string): Promise<CohortMetrics> {
  // Parse cohort month
  const [year, month] = cohortMonth.split('-').map(Number)
  const cohortStart = new Date(year, month - 1, 1)
  const cohortEnd = new Date(year, month, 0, 23, 59, 59, 999)

  // Find shops that joined in this cohort
  const cohortShops = await Subscription.aggregate([
    {
      $match: {
        firstPaidDate: { $gte: cohortStart, $lte: cohortEnd },
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
        status: 1,
        firstPaidDate: 1,
        planPrice: '$planDetails.price',
        tierUsageFee: { $ifNull: ['$shopDetails.usages.tierUsageFee', 0] },
        orders: { $ifNull: ['$shopDetails.usages.orders', 0] },
      },
    },
  ])

  const totalShops = cohortShops.length
  const retainedShops = cohortShops.filter(s => s.status === 'active').length
  const churnedShops = totalShops - retainedShops

  const totalRevenue = cohortShops.reduce((sum, s) => sum + s.planPrice + s.tierUsageFee, 0)
  const averageRevenue = totalShops > 0 ? totalRevenue / totalShops : 0

  const totalOrders = cohortShops.reduce((sum, s) => sum + s.orders, 0)
  const averageOrders = totalShops > 0 ? totalOrders / totalShops : 0

  return {
    cohortMonth,
    totalShops,
    retainedShops,
    churnedShops,
    retentionRate: totalShops > 0 ? (retainedShops / totalShops) * 100 : 0,
    averageRevenue,
    averageOrders,
  }
}

/**
 * Calculate churn metrics for pricing V2
 *
 * Churn = Customers canceling their subscription
 * Churn Rate = (Cancellations / Total Active) × 100
 *
 * What's a healthy churn rate?
 * - Excellent: <3% monthly (<36% annually)
 * - Good: 3-5% monthly (<60% annually)
 * - Acceptable: 5-7% monthly
 * - Problem: >7% monthly (need urgent investigation)
 *
 * Churn reasons help prioritize fixes:
 * - High cost churn → pricing strategy issue or lack of value demonstration
 * - High seasonality churn → consider seasonal discounts or pause feature
 * - High "other" churn → need better exit surveys to understand real reasons
 *
 * By plan breakdown identifies problem tiers:
 * - High churn on entry tier (Starter) → onboarding issue
 * - High churn on top tier (Enterprise) → pricing not justified for features
 * - Even churn across tiers → systemic product/support issue
 *
 * Average lifetime shows Customer Lifetime Value (CLV) = Lifetime × ARPU
 * Example: 180 days × $50 ARPU = $9,000 CLV
 *
 * @param dateRange - Date range for churn analysis (shops that churned in this period)
 * @returns Churn metrics with reasons and by-plan breakdown
 */
export async function getChurnMetrics(dateRange: DateRange): Promise<ChurnMetrics> {
  // Find all cancellations in date range
  const subscriptions = await Subscription.aggregate([
    {
      $match: {
        status: 'inactive',
        updatedAt: { $gte: dateRange.from, $lte: dateRange.to },
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
        plan: 1,
        planName: { $ifNull: ['$planDetails.alias', '$planDetails.name'] },
        firstPaidDate: 1,
        updatedAt: 1,
        lifetimeDays: {
          $cond: {
            if: { $ne: ['$firstPaidDate', null] },
            then: {
              $divide: [
                { $subtract: ['$updatedAt', '$firstPaidDate'] },
                1000 * 60 * 60 * 24, // Convert ms to days
              ],
            },
            else: null,
          },
        },
      },
    },
  ])

  const totalChurned = subscriptions.length

  // Group by plan
  const planGroups: Record<string, { planName: string; churned: number }> = {}
  for (const sub of subscriptions) {
    const planId = sub.plan.toString()
    if (!planGroups[planId]) {
      planGroups[planId] = { planName: sub.planName, churned: 0 }
    }
    planGroups[planId].churned++
  }

  // Get total active subscriptions for churn rate calculation
  const totalActive = await Subscription.countDocuments({
    status: 'active',
  })

  const byPlan = Object.entries(planGroups).map(([planId, data]) => ({
    planName: data.planName,
    planId,
    churned: data.churned,
    churnRate: totalActive > 0 ? (data.churned / totalActive) * 100 : 0,
  }))

  // Calculate average lifetime
  const lifetimeDaysList = subscriptions.map(s => s.lifetimeDays).filter(d => d !== null)
  const averageLifetimeBeforeChurn
    = lifetimeDaysList.length > 0 ? lifetimeDaysList.reduce((sum, days) => sum + days, 0) / lifetimeDaysList.length : 0

  return {
    totalChurned,
    churnRate: totalActive > 0 ? (totalChurned / totalActive) * 100 : 0,
    byPlan,
    averageLifetimeBeforeChurn,
  }
}

/**
 * Get plan change flow analysis (upgrade/downgrade patterns)
 *
 * Analyzes how customers move between pricing tiers over time.
 * Uses PlanChangeRecord to track upgrade/downgrade events.
 *
 * Key insights:
 * - Upgrade paths: Which tiers do customers grow into?
 *   Example: 80% Starter → Growth, 20% Starter → Enterprise (most take gradual path)
 *
 * - Downgrade patterns: Why are customers moving to cheaper plans?
 *   May indicate: seasonal business, pricing too high, or lack of features justifying cost
 *
 * - Order count at change: When do upgrades typically happen?
 *   Example: Average 250 orders when upgrading Starter → Growth
 *   → Proactively reach out at 200 orders to encourage upgrade
 *
 * Business applications:
 * - Set plan limits based on typical upgrade thresholds
 * - Build automated upgrade prompts at trigger points
 * - Investigate downgrade patterns (exit interviews, feature gaps)
 * - Identify "power users" who skip tiers (direct upgrade Starter → Enterprise)
 *
 * @param dateRange - Date range for analysis (billing events that occurred in this period)
 * @returns Plan change flows with order counts at time of change
 */
export async function getPlanChangeFlow(dateRange: DateRange): Promise<PlanChangeFlow[]> {
  // Query PlanChangeRecord collection directly (cleaner and more scalable)
  const planChangeEvents = await PlanChangeRecord.aggregate([
    {
      $match: {
        eventDate: { $gte: dateRange.from, $lte: dateRange.to },
        eventType: { $in: ['upgrade', 'downgrade'] },
      },
    },
    {
      $lookup: {
        from: 'pricingplans',
        localField: 'fromPlan',
        foreignField: '_id',
        as: 'fromPlanDetails',
      },
    },
    {
      $lookup: {
        from: 'pricingplans',
        localField: 'toPlan',
        foreignField: '_id',
        as: 'toPlanDetails',
      },
    },
    {
      $unwind: {
        path: '$fromPlanDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: '$toPlanDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        fromPlan: { $ifNull: ['$fromPlanDetails.alias', '$fromPlanDetails.name', 'unknown'] },
        toPlan: { $ifNull: ['$toPlanDetails.alias', '$toPlanDetails.name', 'unknown'] },
        orderCount: '$orderCountAtEvent',
      },
    },
    {
      $group: {
        _id: {
          fromPlan: '$fromPlan',
          toPlan: '$toPlan',
        },
        count: { $sum: 1 },
        avgOrderCount: { $avg: '$orderCount' },
      },
    },
    {
      $sort: { count: -1 },
    },
  ])

  const totalChanges = planChangeEvents.reduce((sum, item) => sum + item.count, 0)

  return planChangeEvents.map(item => ({
    fromPlan: item._id.fromPlan,
    toPlan: item._id.toPlan,
    count: item.count,
    percentage: totalChanges > 0 ? (item.count / totalChanges) * 100 : 0,
    averageOrderCountAtChange: item.avgOrderCount || 0,
  }))
}
