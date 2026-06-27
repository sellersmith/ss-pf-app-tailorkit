import { randomUUID } from 'crypto'
import ApiUsageLog from '~/models/ApiUsageLog.server'
import type { ApiUsageLogInput } from '~/models/ApiUsageLog'

/**
 * Interface for API usage log entry
 */
export interface ApiUsageLogData {
  id?: string
  requestId: string
  sessionId?: string
  userId?: string
  conversationId?: string
  shopDomain?: string

  // API details
  apiProvider: string
  apiEndpoint: string
  model: string

  // Request details
  requestMethod: string
  requestPayload?: any

  // Response details
  responseStatus?: number
  responsePayload?: any

  // Usage metrics
  promptTokens: number
  completionTokens: number
  totalTokens: number

  // Image generation specific
  imagesGenerated?: number
  imageSize?: string

  // Cost tracking
  inputCost: number
  outputCost: number
  totalCost: number

  // Performance metrics
  requestDurationMs?: number
  responseTimeMs?: number

  // Status
  status: 'success' | 'error' | 'timeout'
  errorMessage?: string
  errorCode?: string

  // Timestamps
  createdAt?: Date
  completedAt?: Date

  // Metadata
  metadata?: Record<string, any>
}

/**
 * Interface for daily usage statistics
 */
export interface DailyUsageStats {
  date: Date
  userId?: string
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  imagesGenerated: number
  totalCost: number
  inputCost: number
  outputCost: number
  avgResponseTimeMs: number
  maxResponseTimeMs: number
  minResponseTimeMs: number
  modelsUsed: string[]
  endpointsUsed: string[]
}

/**
 * Interface for API quota tracking
 */
export interface ApiQuota {
  userId: string
  dailyRequestLimit: number
  dailyTokenLimit: number
  dailyCostLimit: number
  currentRequests: number
  currentTokens: number
  currentCost: number
  lastResetDate: Date
}

/**
 * Configuration for the API Logger
 */
export interface ApiLoggerConfig {
  enableLogging?: boolean
  enableQuotaChecking?: boolean
  logLevel?: 'minimal' | 'standard' | 'detailed'
  shopDomain?: string
}

/**
 * Model pricing configuration (per 1K tokens)
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-5-mini': { input: 0.00025, output: 0.002 },
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.0004, output: 0.0006 },
  'gpt-4.1-mini': { input: 0.00015, output: 0.0016 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-4-vision-preview': { input: 0.01, output: 0.03 },
  'dall-e-3': { input: 0.04, output: 0 }, // Per image for 1024x1024
  'dall-e-2': { input: 0.02, output: 0 }, // Per image for 1024x1024
  // Gemini 2.5 Flash Image (aka Nano Banana) – token-priced images: ~$30 per 1M tokens ≈ $0.03 per 1K tokens
  // We use per-1K token pricing for both input and output tokens
  'gemini-2.5-flash-image': { input: 0.03, output: 0.03 },
}

/**
 * Comprehensive API Logger Service for tracking OpenAI usage and costs with MongoDB
 */
export class ApiLogger {
  private config: ApiLoggerConfig
  private pendingLogs: Map<string, { startTime: number; log: Partial<ApiUsageLogData> }> = new Map()

  constructor(config: ApiLoggerConfig = {}) {
    this.config = {
      enableLogging: true,
      enableQuotaChecking: true,
      logLevel: 'standard',
      ...config,
    }
  }

  /**
   * Start logging an API request
   */
  async startLog(params: {
    requestMethod: string
    model: string
    apiEndpoint: string
    userId?: string
    sessionId?: string
    conversationId?: string
    shopDomain?: string
    requestPayload?: any
    metadata?: Record<string, any>
  }): Promise<string> {
    if (!this.config.enableLogging) return ''

    const requestId = randomUUID()
    const startTime = Date.now()

    const logEntry: Partial<ApiUsageLogData> = {
      requestId,
      apiProvider: 'openai',
      apiEndpoint: params.apiEndpoint,
      model: params.model,
      requestMethod: params.requestMethod,
      userId: params.userId,
      sessionId: params.sessionId,
      conversationId: params.conversationId,
      shopDomain: params.shopDomain || this.config.shopDomain,
      requestPayload: this.config.logLevel === 'detailed' ? params.requestPayload : undefined,
      status: 'success',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      inputCost: 0,
      outputCost: 0,
      totalCost: 0,
      createdAt: new Date(),
      metadata: params.metadata || {},
    }

    this.pendingLogs.set(requestId, { startTime, log: logEntry })

    // Check quotas if enabled
    if (this.config.enableQuotaChecking && params.userId) {
      try {
        await this.checkQuotas(params.userId, params.shopDomain || this.config.shopDomain)
      } catch (error) {
        // Remove pending log if quota check fails
        this.pendingLogs.delete(requestId)
        throw error
      }
    }

    return requestId
  }

  /**
   * Complete and save the API log
   */
  async completeLog(params: {
    requestId: string
    responseStatus?: number
    responsePayload?: any
    promptTokens?: number
    completionTokens?: number
    imagesGenerated?: number
    imageSize?: string
    aspectRatio?: string
    status?: 'success' | 'error' | 'timeout'
    errorMessage?: string
    errorCode?: string
    metadata?: Record<string, any>
  }): Promise<void> {
    if (!this.config.enableLogging || !params.requestId) return

    const pendingLog = this.pendingLogs.get(params.requestId)
    if (!pendingLog) {
      console.warn(`No pending log found for requestId: ${params.requestId}`)
      return
    }

    const { startTime, log } = pendingLog
    const endTime = Date.now()
    const responseTimeMs = endTime - startTime

    // Calculate token costs
    const promptTokens = params.promptTokens || 0
    const completionTokens = params.completionTokens || 0
    const totalTokens = promptTokens + completionTokens

    const costs = this.calculateCosts(log.model!, promptTokens, completionTokens, params.imagesGenerated)

    // Complete the log entry
    const completedLogData: ApiUsageLogInput = {
      requestId: log.requestId!,
      sessionId: log.sessionId,
      userId: log.userId,
      conversationId: log.conversationId,
      shopDomain: log.shopDomain,
      apiProvider: log.apiProvider!,
      apiEndpoint: log.apiEndpoint!,
      model: log.model!,
      requestMethod: log.requestMethod!,
      requestPayload: log.requestPayload,
      responseStatus: params.responseStatus,
      responsePayload: this.config.logLevel === 'detailed' ? params.responsePayload : undefined,
      promptTokens,
      completionTokens,
      totalTokens,
      imagesGenerated: params.imagesGenerated || 0,
      imageSize: params.imageSize,
      inputCost: costs.inputCost,
      outputCost: costs.outputCost,
      totalCost: costs.totalCost,
      responseTimeMs,
      requestDurationMs: responseTimeMs,
      status: params.status || 'success',
      errorMessage: params.errorMessage,
      errorCode: params.errorCode,
      completedAt: new Date(),
      metadata: { ...log.metadata, ...params.metadata },
    }

    try {
      // Save to MongoDB
      await ApiUsageLog.create(completedLogData)

      // Update daily statistics
      const today = new Date().toISOString().split('T')[0]
      await ApiUsageLog.updateDailyStats({
        date: today,
        userId: log.userId,
        shopDomain: log.shopDomain,
        tokens: totalTokens,
        promptTokens,
        completionTokens,
        cost: costs.totalCost,
        inputCost: costs.inputCost,
        outputCost: costs.outputCost,
        responseTimeMs,
        imagesGenerated: params.imagesGenerated || 0,
        success: (params.status || 'success') === 'success',
        model: log.model!,
        endpoint: log.apiEndpoint!,
      })

      // Update user quotas
      if (log.userId) {
        await ApiUsageLog.checkAndUpdateQuota({
          userId: log.userId,
          shopDomain: log.shopDomain,
          tokens: totalTokens,
          cost: costs.totalCost,
        })
      }

      console.log(`✅ API call logged: ${log.requestMethod} - $${costs.totalCost.toFixed(6)} USD`)
    } catch (error) {
      console.error('❌ Failed to save API log:', error)
    } finally {
      // Clean up pending log
      this.pendingLogs.delete(params.requestId)
    }
  }

  /**
   * Log an error for a failed API request
   */
  async logError(params: {
    requestId: string
    errorMessage: string
    errorCode?: string
    responseStatus?: number
  }): Promise<void> {
    await this.completeLog({
      ...params,
      status: 'error',
    })
  }

  /**
   * Calculate costs based on model and usage
   */
  private calculateCosts(
    model: string,
    promptTokens: number,
    completionTokens: number,
    imagesGenerated?: number
  ): { inputCost: number; outputCost: number; totalCost: number } {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-3.5-turbo'] // Default fallback

    let inputCost = 0
    let outputCost = 0

    if (model.includes('dall-e')) {
      // DALL·E: per-image pricing on input side
      inputCost = (imagesGenerated || 0) * pricing.input
    } else if (model.startsWith('gemini-2.5-flash-image')) {
      // Gemini image: token-based pricing; image output is tokenized (~1290 tokens/img at 1024x1024)
      const estimatedImageTokens = (imagesGenerated || 0) * 1290
      inputCost = (promptTokens / 1000) * pricing.input
      outputCost = ((completionTokens + estimatedImageTokens) / 1000) * pricing.output
    } else {
      // Generic text models
      inputCost = (promptTokens / 1000) * pricing.input
      outputCost = (completionTokens / 1000) * pricing.output
    }

    return {
      inputCost: Math.round(inputCost * 1000000) / 1000000, // Round to 6 decimal places
      outputCost: Math.round(outputCost * 1000000) / 1000000,
      totalCost: Math.round((inputCost + outputCost) * 1000000) / 1000000,
    }
  }

  /**
   * Check if user has exceeded quotas
   */
  private async checkQuotas(userId: string, shopDomain?: string): Promise<void> {
    try {
      const quota = await ApiUsageLog.getUserQuota(userId, shopDomain)

      if (quota) {
        const today = new Date().toISOString().split('T')[0]

        // Reset quotas if it's a new day
        if (quota.lastResetDate !== today) {
          await ApiUsageLog.updateQuotaLimits({
            userId,
            shopDomain,
            // Reset will happen in checkAndUpdateQuota
          })
          return // Allow request after reset
        }

        if (quota.currentRequests >= quota.dailyRequestLimit) {
          throw new Error(`Daily request limit exceeded (${quota.dailyRequestLimit})`)
        }
        if (quota.currentTokens >= quota.dailyTokenLimit) {
          throw new Error(`Daily token limit exceeded (${quota.dailyTokenLimit})`)
        }
        if (quota.currentCost >= quota.dailyCostLimit) {
          throw new Error(`Daily cost limit exceeded ($${quota.dailyCostLimit})`)
        }
      }
    } catch (error) {
      console.error('Failed to check quota:', error)
      throw error
    }
  }

  /**
   * Get usage statistics for a user
   */
  async getUserUsageStats(userId: string, shopDomain?: string, days: number = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    return ApiUsageLog.getDailyStats({
      userId,
      shopDomain,
      startDate: startDateStr,
      limit: days,
    })
  }

  /**
   * Get current user quota status
   */
  async getUserQuota(userId: string, shopDomain?: string) {
    return ApiUsageLog.getUserQuota(userId, shopDomain)
  }

  /**
   * Get recent API usage logs
   */
  async getRecentLogs(params: {
    userId?: string
    shopDomain?: string
    status?: string
    model?: string
    limit?: number
    page?: number
    startDate?: Date
    endDate?: Date
  }) {
    return ApiUsageLog.getRecentLogs(params)
  }

  /**
   * Get cost summary for a date range
   */
  async getCostSummary(params: { userId?: string; shopDomain?: string; startDate?: Date; endDate?: Date }) {
    return ApiUsageLog.getCostSummary(params)
  }

  /**
   * Update user quota limits
   */
  async updateUserQuota(params: {
    userId: string
    shopDomain?: string
    dailyRequestLimit?: number
    dailyTokenLimit?: number
    dailyCostLimit?: number
  }) {
    return ApiUsageLog.updateQuotaLimits(params)
  }

  /**
   * Clean up old logs
   */
  async cleanup(daysToKeep: number = 90) {
    return ApiUsageLog.cleanup(daysToKeep)
  }
}

/**
 * Create a singleton instance of the API Logger
 */
let apiLoggerInstance: ApiLogger | null = null

export function createApiLogger(config: ApiLoggerConfig = {}): ApiLogger {
  if (!apiLoggerInstance) {
    apiLoggerInstance = new ApiLogger(config)
  }
  return apiLoggerInstance
}

export function getApiLogger(): ApiLogger | null {
  return apiLoggerInstance
}
