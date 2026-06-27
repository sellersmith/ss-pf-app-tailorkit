import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { catchAsync } from '~/utils/catchAsync'
import { calculateMRR, calculateARPU, getRevenueBreakdown } from './revenue.server'
import { getUsageDistribution, getAverageOrdersPerShop, getUpsellOpportunities } from './usage.server'
import { getTrialConversionMetrics, getCohortMetrics, getChurnMetrics, getPlanChangeFlow } from './conversion.server'
import {
  getFeatureAdoptionRate,
  getFeatureUsageByPlan,
  getFeatureRetention,
  getAllFeaturesAdoptionRates,
} from './features.server'
import type { FeatureKey } from './features.server'

/**
 * ADMIN API - Pricing V2 Analytics Dashboard
 * For internal PO/Marketing dashboards only (NOT for merchant analytics)
 * Single unified endpoint for all pricing analytics metrics
 *
 * Route: GET /api/admin/pricing-analytics
 *
 * Query Parameters:
 * - metric: Metric type (see list below)
 *   Overview: "overview"
 *   Revenue: "mrr" | "arpu" | "revenue_breakdown"
 *   Usage: "usage" | "average_orders" | "upsell"
 *   Conversion: "conversion" | "cohort" | "churn" | "plan_flow"
 *   Features: "feature_adoption" | "feature_by_plan" | "feature_retention" | "all_features"
 * - planId: Optional plan ID for plan-specific metrics
 * - feature: Feature key for feature metrics (svgExport, autoFulfillment, etc.)
 * - limit: Optional limit for top results (default: 10)
 * - months: Number of months for retention analysis (default: 6)
 * - from: ISO date string for date range start (defaults to current month for overview)
 * - to: ISO date string for date range end (defaults to now for overview)
 * - cohortMonth: YYYY-MM format for cohort analysis
 *
 * Examples:
 * - GET /api/admin/pricing-analytics?metric=overview (all metrics, current month)
 * - GET /api/admin/pricing-analytics?metric=overview&from=2026-01-01&to=2026-01-31
 * - GET /api/admin/pricing-analytics?metric=mrr
 * - GET /api/admin/pricing-analytics?metric=arpu&planId=abc123
 * - GET /api/admin/pricing-analytics?metric=upsell
 */
export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)
  const metric = url.searchParams.get('metric')
  const planId = url.searchParams.get('planId') || undefined
  const fromStr = url.searchParams.get('from')
  const toStr = url.searchParams.get('to')
  const cohortMonth = url.searchParams.get('cohortMonth')

  // Parse date range if provided
  const dateRange
    = fromStr && toStr
      ? {
          from: new Date(fromStr),
          to: new Date(toStr),
        }
      : undefined

  switch (metric) {
    case 'overview': {
      // Default to current month if not provided
      const now = new Date()
      const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
      const defaultTo = now

      const overviewDateRange = {
        from: fromStr ? new Date(fromStr) : defaultFrom,
        to: toStr ? new Date(toStr) : defaultTo,
      }

      // Fetch all metrics in parallel
      const [mrr, arpu, upsellOpportunities, trialConversion, churn] = await Promise.all([
        calculateMRR(overviewDateRange),
        calculateARPU(undefined, overviewDateRange),
        getUpsellOpportunities(),
        getTrialConversionMetrics(overviewDateRange),
        getChurnMetrics(overviewDateRange),
      ])

      return json({
        success: true,
        data: {
          period: {
            from: overviewDateRange.from.toISOString(),
            to: overviewDateRange.to.toISOString(),
          },
          highlights: {
            totalMRR: mrr.totalMRR,
            mrrGrowthRate: mrr.growthRate,
            totalShops: arpu.paidShopsCount,
            averageARPU: arpu.overallARPU,
            topUpsellOpportunities: upsellOpportunities.slice(0, 10).length,
            conversionRate: trialConversion.conversionRate,
            churnRate: churn.churnRate,
          },
          mrr: {
            total: mrr.totalMRR,
            baseSubscription: mrr.baseSubscriptionMRR,
            overage: mrr.overageMRR,
            aiCredits: mrr.aiCreditsMRR,
            byPlan: mrr.byPlan,
            growthRate: mrr.growthRate,
          },
          revenue: {
            totalShops: arpu.paidShopsCount,
            totalRevenue: arpu.totalRevenue,
            averageARPU: arpu.overallARPU,
            byPlan: arpu.byPlan,
          },
          conversion: {
            totalTrials: trialConversion.totalTrials,
            totalConverted: trialConversion.totalConverted,
            conversionRate: trialConversion.conversionRate,
            averageDaysToConversion: trialConversion.averageDaysToConversion,
            byPlan: trialConversion.byPlan,
          },
          churn: {
            totalChurned: churn.totalChurned,
            churnRate: churn.churnRate,
            averageLifetimeBeforeChurn: churn.averageLifetimeBeforeChurn,
            byPlan: churn.byPlan,
          },
          upsell: {
            totalOpportunities: upsellOpportunities.length,
            top10: upsellOpportunities.slice(0, 10),
          },
        },
      })
    }

    case 'mrr': {
      const data = await calculateMRR(dateRange)
      return json({ success: true, data })
    }

    case 'arpu': {
      const data = await calculateARPU(planId, dateRange)
      return json({ success: true, data })
    }

    case 'revenue_breakdown': {
      if (!dateRange) {
        return json({ success: false, error: 'Date range required for revenue breakdown' }, { status: 400 })
      }
      const data = await getRevenueBreakdown(dateRange)
      return json({ success: true, data })
    }

    case 'usage': {
      if (!planId) {
        return json({ success: false, error: 'Plan ID required for usage distribution' }, { status: 400 })
      }
      const data = await getUsageDistribution(planId)
      return json({ success: true, data })
    }

    case 'average_orders': {
      if (!planId) {
        return json({ success: false, error: 'Plan ID required for average orders' }, { status: 400 })
      }
      const data = await getAverageOrdersPerShop(planId, dateRange)
      return json({ success: true, data })
    }

    case 'upsell': {
      const data = await getUpsellOpportunities()
      return json({ success: true, data })
    }

    case 'conversion': {
      if (!dateRange) {
        return json({ success: false, error: 'Date range required for conversion metrics' }, { status: 400 })
      }
      const data = await getTrialConversionMetrics(dateRange)
      return json({ success: true, data })
    }

    case 'cohort': {
      if (!cohortMonth) {
        return json({ success: false, error: 'Cohort month required (format: YYYY-MM)' }, { status: 400 })
      }
      const data = await getCohortMetrics(cohortMonth)
      return json({ success: true, data })
    }

    case 'churn': {
      if (!dateRange) {
        return json({ success: false, error: 'Date range required for churn metrics' }, { status: 400 })
      }
      const data = await getChurnMetrics(dateRange)
      return json({ success: true, data })
    }

    case 'plan_flow': {
      if (!dateRange) {
        return json({ success: false, error: 'Date range required for plan flow analysis' }, { status: 400 })
      }
      const data = await getPlanChangeFlow(dateRange)
      return json({ success: true, data })
    }

    case 'feature_adoption': {
      const feature = url.searchParams.get('feature') as FeatureKey | null
      if (!feature) {
        return json({ success: false, error: 'Feature key required for adoption analysis' }, { status: 400 })
      }
      const data = await getFeatureAdoptionRate(feature, dateRange)
      return json({ success: true, data })
    }

    case 'feature_by_plan': {
      const feature = url.searchParams.get('feature') as FeatureKey | null
      if (!feature) {
        return json({ success: false, error: 'Feature key required for plan analysis' }, { status: 400 })
      }
      const data = await getFeatureUsageByPlan(feature, dateRange)
      return json({ success: true, data })
    }

    case 'feature_retention': {
      const feature = url.searchParams.get('feature') as FeatureKey | null
      if (!feature) {
        return json({ success: false, error: 'Feature key required for retention analysis' }, { status: 400 })
      }
      const monthsParam = url.searchParams.get('months')
      const monthsValue = monthsParam ? parseInt(monthsParam, 10) : 6
      const data = await getFeatureRetention(feature, monthsValue)
      return json({ success: true, data })
    }

    case 'all_features': {
      const data = await getAllFeaturesAdoptionRates(dateRange)
      return json({ success: true, data })
    }

    default:
      return json(
        {
          success: false,
          error:
            'Invalid metric. Supported: overview, mrr, arpu, revenue_breakdown, usage, average_orders, '
            + 'upsell, conversion, cohort, churn, plan_flow, feature_adoption, feature_by_plan, '
            + 'feature_retention, all_features',
        },
        { status: 400 }
      )
  }
})
