import mongoose from '~/bootstrap/db/connect-db.server'
import {
  type ApiUsageLogDocument,
  type ApiUsageLogInput,
  type DailyUsageStatsDocument,
  type ApiQuotaDocument,
  type CostSummary,
} from './ApiUsageLog'

// API Usage Log Schema
const ApiUsageLogSchema = new mongoose.Schema<ApiUsageLogDocument>(
  {
    // Request identification
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    sessionId: {
      type: String,
      index: true,
    },
    userId: {
      type: String,
      index: true,
    },
    conversationId: {
      type: String,
      index: true,
    },
    shopDomain: {
      type: String,
      index: true,
    },

    // API details
    apiProvider: {
      type: String,
      required: true,
      default: 'openai',
      index: true,
    },
    apiEndpoint: {
      type: String,
      required: true,
      index: true,
    },
    model: {
      type: String,
      required: true,
      index: true,
    },

    // Request details
    requestMethod: {
      type: String,
      required: true,
      index: true,
    },
    requestPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Response details
    responseStatus: {
      type: Number,
      index: true,
    },
    responsePayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Usage metrics
    promptTokens: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
    completionTokens: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
    totalTokens: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },

    // Image generation specific
    imagesGenerated: {
      type: Number,
      default: 0,
    },
    imageSize: {
      type: String,
    },

    // Cost tracking (in USD)
    inputCost: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
    outputCost: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
    totalCost: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },

    // Performance metrics
    requestDurationMs: {
      type: Number,
      index: true,
    },
    responseTimeMs: {
      type: Number,
      index: true,
    },

    // Status and metadata
    status: {
      type: String,
      required: true,
      enum: ['success', 'error', 'timeout'],
      default: 'success',
      index: true,
    },
    errorMessage: {
      type: String,
    },
    errorCode: {
      type: String,
      index: true,
    },

    // Additional timestamps
    completedAt: {
      type: Date,
      index: true,
    },

    // Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'api_usage_logs',
  }
)

// Daily Usage Stats Schema
const DailyUsageStatsSchema = new mongoose.Schema<DailyUsageStatsDocument>(
  {
    date: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      index: true,
    },
    shopDomain: {
      type: String,
      index: true,
    },

    // Request counts
    totalRequests: {
      type: Number,
      required: true,
      default: 0,
    },
    successfulRequests: {
      type: Number,
      required: true,
      default: 0,
    },
    failedRequests: {
      type: Number,
      required: true,
      default: 0,
    },

    // Token usage
    totalTokens: {
      type: Number,
      required: true,
      default: 0,
    },
    promptTokens: {
      type: Number,
      required: true,
      default: 0,
    },
    completionTokens: {
      type: Number,
      required: true,
      default: 0,
    },

    // Image generation
    imagesGenerated: {
      type: Number,
      required: true,
      default: 0,
    },

    // Costs
    totalCost: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
    inputCost: {
      type: Number,
      required: true,
      default: 0,
    },
    outputCost: {
      type: Number,
      required: true,
      default: 0,
    },

    // Performance
    avgResponseTimeMs: {
      type: Number,
      required: true,
      default: 0,
    },
    maxResponseTimeMs: {
      type: Number,
      required: true,
      default: 0,
    },
    minResponseTimeMs: {
      type: Number,
      required: true,
      default: 0,
    },

    // Metadata
    modelsUsed: {
      type: [String],
      default: [],
    },
    endpointsUsed: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'daily_usage_stats',
  }
)

// API Quota Schema
const ApiQuotaSchema = new mongoose.Schema<ApiQuotaDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    shopDomain: {
      type: String,
      index: true,
    },

    // Quota limits
    dailyRequestLimit: {
      type: Number,
      required: true,
      default: 1000,
    },
    dailyTokenLimit: {
      type: Number,
      required: true,
      default: 100000,
    },
    dailyCostLimit: {
      type: Number,
      required: true,
      default: 50.0,
    },

    // Current usage (resets daily)
    currentRequests: {
      type: Number,
      required: true,
      default: 0,
    },
    currentTokens: {
      type: Number,
      required: true,
      default: 0,
    },
    currentCost: {
      type: Number,
      required: true,
      default: 0,
    },

    // Reset tracking
    lastResetDate: {
      type: String,
      required: true,
      default: () => new Date().toISOString().split('T')[0],
    },
  },
  {
    timestamps: true,
    collection: 'api_quotas',
  }
)

// Create compound indexes
ApiUsageLogSchema.index({ userId: 1, createdAt: -1 })
ApiUsageLogSchema.index({ shopDomain: 1, createdAt: -1 })
ApiUsageLogSchema.index({ model: 1, status: 1 })
DailyUsageStatsSchema.index({ date: 1, userId: 1, shopDomain: 1 }, { unique: true })
DailyUsageStatsSchema.index({ date: 1, shopDomain: 1 })
ApiQuotaSchema.index({ userId: 1, shopDomain: 1 }, { unique: true })

// Create models
const ApiUsageLogModel
  = mongoose.models.ApiUsageLog || mongoose.model<ApiUsageLogDocument>('ApiUsageLog', ApiUsageLogSchema)
const DailyUsageStatsModel
  = mongoose.models.DailyUsageStats || mongoose.model<DailyUsageStatsDocument>('DailyUsageStats', DailyUsageStatsSchema)
const ApiQuotaModel = mongoose.models.ApiQuota || mongoose.model<ApiQuotaDocument>('ApiQuota', ApiQuotaSchema)

/**
 * API Usage Log MongoDB operations
 */
export default class ApiUsageLog {
  /**
   * Create a new API usage log entry
   */
  static create = async (logData: ApiUsageLogInput): Promise<ApiUsageLogDocument> => {
    const log = new ApiUsageLogModel(logData)
    return log.save()
  }

  /**
   * Update an existing log entry by requestId
   */
  static updateByRequestId = async (
    requestId: string,
    updateData: Partial<ApiUsageLogInput>
  ): Promise<ApiUsageLogDocument | null> => {
    return ApiUsageLogModel.findOneAndUpdate(
      { requestId },
      { ...updateData, completedAt: new Date() },
      { new: true, upsert: false }
    )
  }

  /**
   * Get recent API usage logs with filtering and pagination
   */
  static getRecentLogs = async (params: {
    userId?: string
    shopDomain?: string
    status?: string
    model?: string
    limit?: number
    page?: number
    startDate?: Date
    endDate?: Date
  }): Promise<{ logs: ApiUsageLogDocument[]; total: number; pagination: any }> => {
    const { userId, shopDomain, status, model, limit = 100, page = 1, startDate, endDate } = params

    // Build query
    const query: any = {}
    if (userId) query.userId = userId
    if (shopDomain) query.shopDomain = shopDomain
    if (status) query.status = status
    if (model) query.model = model
    if (startDate || endDate) {
      query.createdAt = {}
      if (startDate) query.createdAt.$gte = startDate
      if (endDate) query.createdAt.$lte = endDate
    }

    const skip = (page - 1) * limit

    const [logs, total] = await Promise.all([
      ApiUsageLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ApiUsageLogModel.countDocuments(query),
    ])

    return {
      logs: logs as ApiUsageLogDocument[],
      total,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Get cost summary for a date range
   */
  static getCostSummary = async (params: {
    userId?: string
    shopDomain?: string
    startDate?: Date
    endDate?: Date
  }): Promise<CostSummary> => {
    const { userId, shopDomain, startDate, endDate } = params

    // Build query
    const query: any = {}
    if (userId) query.userId = userId
    if (shopDomain) query.shopDomain = shopDomain
    if (startDate || endDate) {
      query.createdAt = {}
      if (startDate) query.createdAt.$gte = startDate
      if (endDate) query.createdAt.$lte = endDate
    }

    const logs = await ApiUsageLogModel.find(query).lean()

    if (logs.length === 0) {
      return {
        totalCost: 0,
        totalRequests: 0,
        totalTokens: 0,
        avgCostPerRequest: 0,
        mostExpensiveModel: '',
        dateRange: {
          start: startDate || new Date(),
          end: endDate || new Date(),
        },
        breakdown: {
          models: {},
          endpoints: {},
        },
      }
    }

    // Calculate totals
    const totalCost = logs.reduce((sum, log) => sum + log.totalCost, 0)
    const totalTokens = logs.reduce((sum, log) => sum + log.totalTokens, 0)
    const totalRequests = logs.length

    // Calculate breakdowns
    const models: Record<string, { cost: number; requests: number; tokens: number }> = {}
    const endpoints: Record<string, { cost: number; requests: number }> = {}

    logs.forEach(log => {
      // Model breakdown
      if (!models[log.model]) {
        models[log.model] = { cost: 0, requests: 0, tokens: 0 }
      }
      models[log.model].cost += log.totalCost
      models[log.model].requests += 1
      models[log.model].tokens += log.totalTokens

      // Endpoint breakdown
      if (!endpoints[log.apiEndpoint]) {
        endpoints[log.apiEndpoint] = { cost: 0, requests: 0 }
      }
      endpoints[log.apiEndpoint].cost += log.totalCost
      endpoints[log.apiEndpoint].requests += 1
    })

    // Find most expensive model
    const mostExpensiveModel = Object.entries(models).sort(([, a], [, b]) => b.cost - a.cost)[0]?.[0] || ''

    return {
      totalCost: Math.round(totalCost * 1000000) / 1000000,
      totalRequests,
      totalTokens,
      avgCostPerRequest: totalRequests > 0 ? Math.round((totalCost / totalRequests) * 1000000) / 1000000 : 0,
      mostExpensiveModel,
      dateRange: {
        start: startDate || new Date(logs[logs.length - 1].createdAt),
        end: endDate || new Date(logs[0].createdAt),
      },
      breakdown: {
        models,
        endpoints,
      },
    }
  }

  /**
   * Update daily usage statistics
   */
  static updateDailyStats = async (params: {
    date: string
    userId?: string
    shopDomain?: string
    tokens: number
    promptTokens: number
    completionTokens: number
    cost: number
    inputCost: number
    outputCost: number
    responseTimeMs: number
    imagesGenerated?: number
    success: boolean
    model: string
    endpoint: string
  }): Promise<void> => {
    const {
      date,
      userId,
      shopDomain,
      tokens,
      promptTokens,
      completionTokens,
      cost,
      inputCost,
      outputCost,
      responseTimeMs,
      imagesGenerated = 0,
      success,
      model,
      endpoint,
    } = params

    const filter: any = { date }
    if (userId) filter.userId = userId
    if (shopDomain) filter.shopDomain = shopDomain

    // Find existing stats
    const existingStats = await DailyUsageStatsModel.findOne(filter)

    if (existingStats) {
      // Update existing stats
      const newTotalRequests = existingStats.totalRequests + 1
      const newAvgResponseTime
        = (existingStats.avgResponseTimeMs * existingStats.totalRequests + responseTimeMs) / newTotalRequests

      const updateData = {
        totalRequests: newTotalRequests,
        successfulRequests: existingStats.successfulRequests + (success ? 1 : 0),
        failedRequests: existingStats.failedRequests + (success ? 0 : 1),
        totalTokens: existingStats.totalTokens + tokens,
        promptTokens: existingStats.promptTokens + promptTokens,
        completionTokens: existingStats.completionTokens + completionTokens,
        imagesGenerated: existingStats.imagesGenerated + imagesGenerated,
        totalCost: existingStats.totalCost + cost,
        inputCost: existingStats.inputCost + inputCost,
        outputCost: existingStats.outputCost + outputCost,
        avgResponseTimeMs: newAvgResponseTime,
        maxResponseTimeMs: Math.max(existingStats.maxResponseTimeMs, responseTimeMs),
        minResponseTimeMs: Math.min(existingStats.minResponseTimeMs, responseTimeMs),
        modelsUsed: [...new Set([...existingStats.modelsUsed, model])],
        endpointsUsed: [...new Set([...existingStats.endpointsUsed, endpoint])],
      }

      await DailyUsageStatsModel.updateOne(filter, updateData)
    } else {
      // Create new stats
      const newStats = {
        ...filter,
        totalRequests: 1,
        successfulRequests: success ? 1 : 0,
        failedRequests: success ? 0 : 1,
        totalTokens: tokens,
        promptTokens,
        completionTokens,
        imagesGenerated,
        totalCost: cost,
        inputCost,
        outputCost,
        avgResponseTimeMs: responseTimeMs,
        maxResponseTimeMs: responseTimeMs,
        minResponseTimeMs: responseTimeMs,
        modelsUsed: [model],
        endpointsUsed: [endpoint],
      }

      await DailyUsageStatsModel.create(newStats)
    }
  }

  /**
   * Get daily usage statistics
   */
  static getDailyStats = async (params: {
    userId?: string
    shopDomain?: string
    startDate?: string
    endDate?: string
    limit?: number
  }): Promise<DailyUsageStatsDocument[]> => {
    const { userId, shopDomain, startDate, endDate, limit = 30 } = params

    const query: any = {}
    if (userId) query.userId = userId
    if (shopDomain) query.shopDomain = shopDomain
    if (startDate || endDate) {
      query.date = {}
      if (startDate) query.date.$gte = startDate
      if (endDate) query.date.$lte = endDate
    }

    return DailyUsageStatsModel.find(query).sort({ date: -1 }).limit(limit).lean()
  }

  /**
   * Check and update user quota
   */
  static checkAndUpdateQuota = async (params: {
    userId: string
    shopDomain?: string
    tokens: number
    cost: number
  }): Promise<{ withinLimits: boolean; quotaStatus: ApiQuotaDocument }> => {
    const { userId, shopDomain, tokens, cost } = params
    const today = new Date().toISOString().split('T')[0]

    const filter: any = { userId }
    if (shopDomain) filter.shopDomain = shopDomain

    let quota = await ApiQuotaModel.findOne(filter)

    if (!quota) {
      // Create new quota for user
      quota = await ApiQuotaModel.create({
        userId,
        shopDomain,
        currentRequests: 1,
        currentTokens: tokens,
        currentCost: cost,
        lastResetDate: today,
      })
      return { withinLimits: true, quotaStatus: quota }
    }

    // Check if we need to reset daily counters
    if (quota.lastResetDate !== today) {
      quota.currentRequests = 1
      quota.currentTokens = tokens
      quota.currentCost = cost
      quota.lastResetDate = today
    } else {
      quota.currentRequests += 1
      quota.currentTokens += tokens
      quota.currentCost += cost
    }

    await quota.save()

    // Check limits
    const withinLimits
      = quota.currentRequests <= quota.dailyRequestLimit
      && quota.currentTokens <= quota.dailyTokenLimit
      && quota.currentCost <= quota.dailyCostLimit

    return { withinLimits, quotaStatus: quota }
  }

  /**
   * Get user quota status
   */
  static getUserQuota = async (userId: string, shopDomain?: string): Promise<ApiQuotaDocument | null> => {
    const filter: any = { userId }
    if (shopDomain) filter.shopDomain = shopDomain

    return ApiQuotaModel.findOne(filter).lean()
  }

  /**
   * Update user quota limits
   */
  static updateQuotaLimits = async (params: {
    userId: string
    shopDomain?: string
    dailyRequestLimit?: number
    dailyTokenLimit?: number
    dailyCostLimit?: number
  }): Promise<ApiQuotaDocument | null> => {
    const { userId, shopDomain, ...updates } = params

    const filter: any = { userId }
    if (shopDomain) filter.shopDomain = shopDomain

    return ApiQuotaModel.findOneAndUpdate(filter, updates, { new: true, upsert: true })
  }

  /**
   * Clean up old logs (keep only last N days)
   */
  static cleanup = async (daysToKeep: number = 90): Promise<{ deletedCount: number }> => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const result = await ApiUsageLogModel.deleteMany({
      createdAt: { $lt: cutoffDate },
    })

    return { deletedCount: result.deletedCount || 0 }
  }
}

export { ApiUsageLogModel, DailyUsageStatsModel, ApiQuotaModel }
