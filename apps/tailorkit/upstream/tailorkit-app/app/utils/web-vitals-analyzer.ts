/**
 * Web Vitals Analyzer Utility
 * Use this in the browser console to analyze performance data
 */

export interface WebVitalsAnalysis {
  pathname: string
  type: 'LCP' | 'CLS' | 'FID' | 'FCP' | 'TTFB'
  metrics: {
    count: number
    average: number
    minimum: number
    maximum: number
    p50: number
    p75: number
    p90: number
    p95: number
  }
  performanceRating: 'good' | 'needs-improvement' | 'poor'
  isProblematic: boolean
}

/**
 * Fetch and analyze web vitals data
 */
export class WebVitalsAnalyzer {
  private baseUrl = '/api/web-vitals.analytics'

  /**
   * Get performance summary for all metrics
   */
  async getPerformanceSummary(days = 7) {
    try {
      const response = await fetch(`${this.baseUrl}?action=performance-summary&days=${days}`)
      const result = await response.json()

      if (!result.success) {
        console.error('Failed to fetch performance summary:', result.error)
        return null
      }

      console.table(result.data)
      return result.data
    } catch (error) {
      console.error('Error fetching performance summary:', error)
      return null
    }
  }

  /**
   * Get worst performing pages for a specific metric
   */
  async getWorstPages(type: 'LCP' | 'CLS' | 'FID', limit = 10) {
    try {
      const response = await fetch(`${this.baseUrl}?action=worst-pages&type=${type}&limit=${limit}`)
      const result = await response.json()

      if (!result.success) {
        console.error('Failed to fetch worst pages:', result.error)
        return null
      }

      console.log(`\n📊 Worst ${type} Performance Pages:`)
      console.table(result.data)

      return result.data
    } catch (error) {
      console.error('Error fetching worst pages:', error)
      return null
    }
  }

  /**
   * Run comprehensive analysis
   */
  async runFullAnalysis(days = 7) {
    console.log('🔍 Running Comprehensive Web Vitals Analysis...\n')

    // Get overall summary
    await this.getPerformanceSummary(days)

    // Analyze each metric
    const metrics: Array<'LCP' | 'CLS' | 'FID'> = ['LCP', 'CLS', 'FID']

    for (const metric of metrics) {
      console.log(`\n${'='.repeat(50)}`)
      console.log(`📊 ${metric} Analysis`)
      console.log(`${'='.repeat(50)}`)

      await this.getWorstPages(metric, 5)
    }

    console.log('\n✅ Analysis Complete!')
  }
}

// Global instance for easy console access
declare global {
  interface Window {
    webVitalsAnalyzer: WebVitalsAnalyzer
  }
}

// Auto-initialize if in browser
if (typeof window !== 'undefined') {
  window.webVitalsAnalyzer = new WebVitalsAnalyzer()

  console.log('🔧 Web Vitals Analyzer loaded!')
  console.log('Use: webVitalsAnalyzer.runFullAnalysis() to start')
}
