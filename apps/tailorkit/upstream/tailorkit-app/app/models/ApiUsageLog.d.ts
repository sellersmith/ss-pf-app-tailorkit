/**
 * API Usage Log Document interface for MongoDB
 */
export interface ApiUsageLogDocument {
  // Request identification
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

  // Cost tracking (in USD)
  inputCost: number
  outputCost: number
  totalCost: number

  // Performance metrics
  requestDurationMs?: number
  responseTimeMs?: number

  // Status and metadata
  status: 'success' | 'error' | 'timeout'
  errorMessage?: string
  errorCode?: string

  // Timestamps
  createdAt: Date
  updatedAt: Date
  completedAt?: Date

  // Additional metadata
  metadata?: Record<string, any>
}

/**
 * Input interface for creating API usage logs
 */
export interface ApiUsageLogInput {
  requestId: string
  sessionId?: string
  userId?: string
  conversationId?: string
  shopDomain?: string
  apiProvider: string
  apiEndpoint: string
  model: string
  requestMethod: string
  requestPayload?: any
  responseStatus?: number
  responsePayload?: any
  promptTokens: number
  completionTokens: number
  totalTokens: number
  imagesGenerated?: number
  imageSize?: string
  inputCost: number
  outputCost: number
  totalCost: number
  requestDurationMs?: number
  responseTimeMs?: number
  status: 'success' | 'error' | 'timeout'
  errorMessage?: string
  errorCode?: string
  completedAt?: Date
  metadata?: Record<string, any>
}

/**
 * Daily usage statistics document
 */
export interface DailyUsageStatsDocument {
  date: string // YYYY-MM-DD format
  userId?: string
  shopDomain?: string

  // Request counts
  totalRequests: number
  successfulRequests: number
  failedRequests: number

  // Token usage
  totalTokens: number
  promptTokens: number
  completionTokens: number

  // Image generation
  imagesGenerated: number

  // Costs
  totalCost: number
  inputCost: number
  outputCost: number

  // Performance
  avgResponseTimeMs: number
  maxResponseTimeMs: number
  minResponseTimeMs: number

  // Metadata
  modelsUsed: string[]
  endpointsUsed: string[]

  createdAt: Date
  updatedAt: Date
}

/**
 * API quota tracking document
 */
export interface ApiQuotaDocument {
  userId: string
  shopDomain?: string

  // Quota limits
  dailyRequestLimit: number
  dailyTokenLimit: number
  dailyCostLimit: number

  // Current usage (resets daily)
  currentRequests: number
  currentTokens: number
  currentCost: number

  // Reset tracking
  lastResetDate: string // YYYY-MM-DD format

  createdAt: Date
  updatedAt: Date
}

/**
 * Cost summary interface
 */
export interface CostSummary {
  totalCost: number
  totalRequests: number
  totalTokens: number
  avgCostPerRequest: number
  mostExpensiveModel: string
  dateRange: {
    start: Date
    end: Date
  }
  breakdown: {
    models: Record<string, { cost: number; requests: number; tokens: number }>
    endpoints: Record<string, { cost: number; requests: number }>
  }
}
