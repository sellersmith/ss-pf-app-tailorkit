import mongoose from '~/bootstrap/db/connect-db.server'

export interface WebVitalsDocument extends mongoose.Document {
  shopDomain: string
  type: 'LCP' | 'CLS' | 'FID' | 'FCP' | 'TTFB' | 'INP'
  value: number
  url: string
  pathname: string
  browserInfo: string
  userAgent: string
  viewport: {
    width: number
    height: number
  }
  deviceType: 'mobile' | 'tablet' | 'desktop'
  connectionType?: string
  navigationTiming?: {
    domContentLoaded: number
    loadComplete: number
    firstPaint: number
    firstContentfulPaint: number
  }
  elementInfo?: {
    tagName?: string
    className?: string
    id?: string
    selector?: string
  }
  sessionId?: string
  userId?: string
  timestamp: Date
  additionalMetrics?: {
    memoryUsage?: number
    jsHeapSize?: number
    totalJSHeapSize?: number
  }
  createdAt: Date
  updatedAt: Date
}

const WebVitalsSchema = new mongoose.Schema<WebVitalsDocument>(
  {
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    type: {
      type: String,
      enum: ['LCP', 'CLS', 'FID', 'FCP', 'TTFB', 'INP'],
      index: true,
      required: true,
    },
    value: {
      type: Number,
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      index: true,
    },
    pathname: {
      type: String,
      required: true,
      index: true,
    },
    browserInfo: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      required: true,
    },
    viewport: {
      width: { type: Number },
      height: { type: Number },
    },
    deviceType: {
      type: String,
      enum: ['mobile', 'tablet', 'desktop'],
      index: true,
    },
    connectionType: {
      type: String,
    },
    navigationTiming: {
      domContentLoaded: { type: Number },
      loadComplete: { type: Number },
      firstPaint: { type: Number },
      firstContentfulPaint: { type: Number },
    },
    elementInfo: {
      tagName: { type: String },
      className: { type: String },
      id: { type: String },
      selector: { type: String },
    },
    sessionId: {
      type: String,
      index: true,
    },
    userId: {
      type: String,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    additionalMetrics: {
      memoryUsage: { type: Number },
      jsHeapSize: { type: Number },
      totalJSHeapSize: { type: Number },
    },
  },
  {
    timestamps: true,
  }
)

// Create compound indexes for better query performance
WebVitalsSchema.index({ shopDomain: 1, type: 1, timestamp: -1 })
WebVitalsSchema.index({ shopDomain: 1, pathname: 1, type: 1 })
WebVitalsSchema.index({ shopDomain: 1, value: -1, type: 1 })

const WebVitals = mongoose.models.WebVitals || mongoose.model<WebVitalsDocument>('WebVitals', WebVitalsSchema)

export default WebVitals

/**
 * Save web vitals data to the database
 */
export async function saveWebVitalsData(data: Partial<WebVitalsDocument>): Promise<WebVitalsDocument> {
  const webVital = new WebVitals(data)
  return webVital.save()
}

/**
 * Get web vitals statistics for a shop (or all shops if shopDomain is undefined)
 */
export async function getWebVitalsStats(
  shopDomain: string | undefined,
  options: {
    startDate?: Date
    endDate?: Date
    pathname?: string
    type?: string
    limit?: number
  } = {}
) {
  const { startDate, endDate, pathname, type, limit = 100 } = options

  const filter: any = {}

  // Only filter by shopDomain if provided
  if (shopDomain) {
    filter.shopDomain = shopDomain
  }

  if (startDate || endDate) {
    filter.timestamp = {}
    if (startDate) filter.timestamp.$gte = startDate
    if (endDate) filter.timestamp.$lte = endDate
  }

  if (pathname) filter.pathname = pathname
  if (type) filter.type = type

  return WebVitals.find(filter).sort({ timestamp: -1 }).limit(limit).lean()
}

/**
 * Get aggregated web vitals metrics by page (or all shops if shopDomain is undefined)
 */
export async function getWebVitalsAggregatedByPage(
  shopDomain: string | undefined,
  options: {
    startDate?: Date
    endDate?: Date
    type?: 'LCP' | 'CLS' | 'FID'
  } = {}
) {
  const { startDate, endDate, type } = options

  const matchFilter: any = {}

  // Only filter by shopDomain if provided
  if (shopDomain) {
    matchFilter.shopDomain = shopDomain
  }

  if (startDate || endDate) {
    matchFilter.timestamp = {}
    if (startDate) matchFilter.timestamp.$gte = startDate
    if (endDate) matchFilter.timestamp.$lte = endDate
  }

  if (type) matchFilter.type = type

  return WebVitals.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: {
          pathname: '$pathname',
          type: '$type',
          shopDomain: '$shopDomain', // Include shopDomain in grouping
        },
        avgValue: { $avg: '$value' },
        minValue: { $min: '$value' },
        maxValue: { $max: '$value' },
        count: { $sum: 1 },
        values: { $push: '$value' },
      },
    },
    {
      $sort: { avgValue: -1 },
    },
  ])
}

/**
 * Calculate percentile from sorted array
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (!values.length) return 0
  const sorted = values.sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

/**
 * Get worst performing pages (or all shops if shopDomain is undefined)
 */
export async function getWorstPerformingPages(shopDomain: string | undefined, type: 'LCP' | 'CLS' | 'FID', limit = 10) {
  const stats = await getWebVitalsAggregatedByPage(shopDomain, { type })

  return stats
    .filter((stat: any) => stat._id.type === type)
    .sort((a: any, b: any) => b.avgValue - a.avgValue)
    .slice(0, limit)
    .map((stat: any) => {
      const values = stat.values || []
      return {
        shopDomain: stat._id.shopDomain,
        pathname: stat._id.pathname,
        type: stat._id.type,
        avgValue: stat.avgValue,
        maxValue: stat.maxValue,
        count: stat.count,
        p75: calculatePercentile(values, 75),
        p90: calculatePercentile(values, 90),
        p95: calculatePercentile(values, 95),
      }
    })
}

/**
 * Get performance trends over time (or all shops if shopDomain is undefined)
 */
export async function getPerformanceTrends(shopDomain: string | undefined, type: 'LCP' | 'CLS' | 'FID', days = 7) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const matchFilter: any = {
    type,
    timestamp: { $gte: startDate },
  }

  // Only filter by shopDomain if provided
  if (shopDomain) {
    matchFilter.shopDomain = shopDomain
  }

  const trends = await WebVitals.aggregate([
    {
      $match: matchFilter,
    },
    {
      $group: {
        _id: {
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timestamp',
            },
          },
        },
        avgValue: { $avg: '$value' },
        count: { $sum: 1 },
        values: { $push: '$value' },
      },
    },
    {
      $sort: { '_id.date': 1 },
    },
  ])

  return trends.map((trend: any) => ({
    date: trend._id.date,
    avgValue: trend.avgValue,
    count: trend.count,
    p75: calculatePercentile(trend.values || [], 75),
  }))
}

/**
 * Clean up old web vitals data (removes records older than specified days)
 */
export async function cleanupOldWebVitalsData(maxAgeDays = 90): Promise<{
  success: boolean
  deletedCount: number
  cutoffDate: Date
  error?: string
}> {
  try {
    const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)

    console.log(`[WebVitals Cleanup] Starting cleanup of records older than ${maxAgeDays} days`)
    console.log(`[WebVitals Cleanup] Cutoff date: ${cutoffDate.toISOString()}`)

    // First, count records to be deleted for logging
    const countToDelete = await WebVitals.countDocuments({
      timestamp: { $lt: cutoffDate },
    })

    console.log(`[WebVitals Cleanup] Found ${countToDelete} records to delete`)

    if (countToDelete === 0) {
      return {
        success: true,
        deletedCount: 0,
        cutoffDate,
      }
    }

    // Delete old records
    const deleteResult = await WebVitals.deleteMany({
      timestamp: { $lt: cutoffDate },
    })

    console.log(`[WebVitals Cleanup] Successfully deleted ${deleteResult.deletedCount} records`)

    return {
      success: true,
      deletedCount: deleteResult.deletedCount,
      cutoffDate,
    }
  } catch (error) {
    console.error('[WebVitals Cleanup] Error during cleanup:', error)
    return {
      success: false,
      deletedCount: 0,
      cutoffDate: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get database statistics for monitoring
 */
export async function getWebVitalsDBStats(): Promise<{
  totalRecords: number
  recordsByAge: Array<{ days: number; count: number }>
  oldestRecord: Date | null
  newestRecord: Date | null
  recordsByType: Array<{ type: string; count: number }>
  dbSizeEstimate: string
}> {
  try {
    // Get total count
    const totalRecords = await WebVitals.countDocuments()

    // Get records by age brackets
    const now = new Date()
    const ageBrackets = [1, 7, 30, 90, 180, 365]

    const recordsByAge = await Promise.all(
      ageBrackets.map(async days => {
        const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
        const count = await WebVitals.countDocuments({
          timestamp: { $gte: cutoffDate },
        })
        return { days, count }
      })
    )

    // Get oldest and newest records
    const oldestRecord = await WebVitals.findOne().sort({ timestamp: 1 }).select('timestamp')
    const newestRecord = await WebVitals.findOne().sort({ timestamp: -1 }).select('timestamp')

    // Get records by type
    const recordsByType = await WebVitals.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          type: '$_id',
          count: 1,
          _id: 0,
        },
      },
      {
        $sort: { type: 1 },
      },
    ])

    // Estimate database size (rough calculation)
    const avgDocumentSize = 512 // bytes (estimated)
    const estimatedSizeBytes = totalRecords * avgDocumentSize
    const dbSizeEstimate = formatBytes(estimatedSizeBytes)

    return {
      totalRecords,
      recordsByAge,
      oldestRecord: oldestRecord?.timestamp || null,
      newestRecord: newestRecord?.timestamp || null,
      recordsByType,
      dbSizeEstimate,
    }
  } catch (error) {
    console.error('[WebVitals Stats] Error getting database stats:', error)
    throw error
  }
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}
