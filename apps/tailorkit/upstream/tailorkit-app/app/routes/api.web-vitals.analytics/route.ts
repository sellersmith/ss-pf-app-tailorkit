import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import {
  getWebVitalsStats,
  getWorstPerformingPages,
  getPerformanceTrends,
  getWebVitalsAggregatedByPage,
} from '~/models/WebVitals.server'
import { formatErrorMessage } from '~/utils/formatErrorMessage'

/**
 * Handle GET requests to fetch web vitals analytics
 * Note: This route is public for debugging purposes - no authentication required
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url)
    const action = url.searchParams.get('action')
    const type = url.searchParams.get('type') as 'LCP' | 'CLS' | 'FID' | undefined
    const pathname = url.searchParams.get('pathname') || undefined
    const days = parseInt(url.searchParams.get('days') || '7')
    const limit = parseInt(url.searchParams.get('limit') || '10')

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Optional shopDomain filter for specific shop debugging
    const shopDomain = url.searchParams.get('shopDomain') || undefined

    switch (action) {
      case 'stats': {
        const stats = await getWebVitalsStats(shopDomain, {
          startDate,
          endDate,
          pathname,
          type,
          limit,
        })

        return json({
          success: true,
          data: stats,
          filters: { days, pathname, type, limit, shopDomain },
        })
      }

      case 'worst-pages': {
        if (!type) {
          return json({ error: 'Type parameter is required for worst-pages action' }, { status: 400 })
        }

        const worstPages = await getWorstPerformingPages(shopDomain, type, limit)

        return json({
          success: true,
          data: worstPages,
          filters: { type, limit, shopDomain },
        })
      }

      case 'trends': {
        if (!type) {
          return json({ error: 'Type parameter is required for trends action' }, { status: 400 })
        }

        const trends = await getPerformanceTrends(shopDomain, type, days)

        return json({
          success: true,
          data: trends,
          filters: { type, days, shopDomain },
        })
      }

      case 'page-analysis': {
        const aggregatedData = await getWebVitalsAggregatedByPage(shopDomain, {
          startDate,
          endDate,
          type,
        })

        // Group by page and provide comprehensive analysis
        const pageAnalysis = aggregatedData.map((item: any) => {
          const { _id, avgValue, minValue, maxValue, count, values } = item

          // Calculate percentiles from values
          const sortedValues = (values || []).sort((a: number, b: number) => a - b)
          const p50 = calculatePercentile(sortedValues, 50)
          const p75 = calculatePercentile(sortedValues, 75)
          const p90 = calculatePercentile(sortedValues, 90)
          const p95 = calculatePercentile(sortedValues, 95)

          // Determine performance rating
          const performanceRating = getPerformanceRating(_id.type, avgValue)

          return {
            pathname: _id.pathname,
            type: _id.type,
            metrics: {
              count,
              average: Math.round(avgValue),
              minimum: Math.round(minValue),
              maximum: Math.round(maxValue),
              p50: Math.round(p50),
              p75: Math.round(p75),
              p90: Math.round(p90),
              p95: Math.round(p95),
            },
            performanceRating,
            isProblematic: performanceRating === 'poor',
          }
        })

        // Sort by performance impact (worse performance first)
        pageAnalysis.sort((a, b) => {
          if (a.performanceRating === 'poor' && b.performanceRating !== 'poor') return -1
          if (a.performanceRating !== 'poor' && b.performanceRating === 'poor') return 1
          return b.metrics.average - a.metrics.average
        })

        return json({
          success: true,
          data: pageAnalysis,
          summary: {
            totalPages: pageAnalysis.length,
            problematicPages: pageAnalysis.filter(p => p.isProblematic).length,
            avgPerformance: pageAnalysis.reduce((acc, p) => acc + p.metrics.average, 0) / pageAnalysis.length,
          },
          filters: { days, type },
        })
      }

      case 'performance-summary': {
        // Get summary for all metric types
        const metricTypes: Array<'LCP' | 'CLS' | 'FID'> = ['LCP', 'CLS', 'FID']
        const summary = await Promise.all(
          metricTypes.map(async metricType => {
            const stats = await getWebVitalsStats(shopDomain, {
              startDate,
              endDate,
              type: metricType,
              limit: 1000, // Get more data for accurate summary
            })

            if (!stats.length) {
              return {
                type: metricType,
                count: 0,
                average: 0,
                performanceRating: 'unknown',
              }
            }

            const values = stats.map((s: any) => s.value)
            const average = values.reduce((acc: number, val: number) => acc + val, 0) / values.length
            const performanceRating = getPerformanceRating(metricType, average)

            return {
              type: metricType,
              count: stats.length,
              average: Math.round(average),
              performanceRating,
            }
          })
        )

        return json({
          success: true,
          data: summary,
          period: { startDate, endDate, days },
          filters: { shopDomain },
        })
      }

      default: {
        return json({ error: 'Invalid action parameter' }, { status: 400 })
      }
    }
  } catch (error) {
    console.error('Error fetching web vitals analytics:', formatErrorMessage(error))
    return json({ error: 'Failed to fetch web vitals analytics' }, { status: 500 })
  }
}

/**
 * Calculate percentile from sorted array
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (!values.length) return 0
  const index = Math.ceil((percentile / 100) * values.length) - 1
  return values[Math.max(0, index)] || 0
}

/**
 * Get performance rating based on metric type and value
 */
function getPerformanceRating(type: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = {
    LCP: { good: 2500, poor: 4000 },
    CLS: { good: 0.1, poor: 0.25 },
    FID: { good: 100, poor: 300 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 800, poor: 1800 },
  }

  const threshold = thresholds[type as keyof typeof thresholds]
  if (!threshold) return 'good'

  if (value <= threshold.good) return 'good'
  if (value <= threshold.poor) return 'needs-improvement'
  return 'poor'
}
