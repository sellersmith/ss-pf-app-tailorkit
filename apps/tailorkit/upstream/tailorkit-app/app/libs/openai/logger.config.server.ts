import { createApiLogger } from '~/services/ApiLogger.server'

/**
 * Initialize the API Logger service for OpenAI usage tracking
 * Call this once during application startup
 */
export function initializeApiLogger(shopDomain?: string) {
  const logger = createApiLogger({
    enableLogging: true,
    enableQuotaChecking: true,
    logLevel: 'standard', // 'minimal' | 'standard' | 'detailed'
    shopDomain,
  })

  console.log('✅ API Logger initialized with MongoDB storage')
  return logger
}

/**
 * Get environment-specific logger configuration
 */
export function getLoggerConfig() {
  return {
    enableLogging: process.env.NODE_ENV !== 'test', // Disable in test environment
    enableQuotaChecking: process.env.ENABLE_API_QUOTAS !== 'false',
    logLevel: (process.env.API_LOG_LEVEL as 'minimal' | 'standard' | 'detailed') || 'standard',
  }
}

/**
 * Initialize logger with environment configuration
 */
export function initializeLoggerWithEnv(shopDomain?: string) {
  const config = getLoggerConfig()
  return createApiLogger({
    ...config,
    shopDomain,
  })
}
