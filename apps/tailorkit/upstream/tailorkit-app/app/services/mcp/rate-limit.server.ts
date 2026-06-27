import { json } from '~/bootstrap/fns/fetch.server'
import { MCP_ERROR_CODES_MAP } from '~/routes/api.mcp.$tool/constants'

// Type definitions
export interface RateLimitConfig {
  readonly windowMs: number
  readonly maxRequests: number
  readonly cleanupIntervalMs: number
  readonly maxCacheSize: number
}

interface CacheItem {
  count: number
  expiresAt: number
  lastUpdated: number
}

/**
 * Enhanced in-memory cache for rate limiting with improved performance
 * and memory management
 */
export class RateLimiter {
  private readonly cache = new Map<string, CacheItem>()
  private readonly config: RateLimitConfig
  private readonly cleanupInterval: NodeJS.Timeout

  // Stats for monitoring
  private stats = {
    totalRequests: 0,
    limitExceeded: 0,
    cacheSize: 0,
    lastCleanup: Date.now(),
    lastCleanupCount: 0,
  }

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      windowMs: config?.windowMs || 60 * 1000, // 1 minute
      maxRequests: config?.maxRequests || 100,
      cleanupIntervalMs: config?.cleanupIntervalMs || 5 * 60 * 1000, // 5 minutes
      maxCacheSize: config?.maxCacheSize || 10000,
    }

    // Schedule cleanup at interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupIntervalMs)

    // Handle graceful shutdowns
    process.on('SIGTERM', () => this.dispose())
    process.on('SIGINT', () => this.dispose())
  }

  /**
   * Check if a request exceeds rate limits
   * @param key - Unique identifier for the client
   * @returns Object containing limit status and remaining requests
   */
  check(key: string): { limited: boolean; remaining: number; reset: number } {
    this.stats.totalRequests++
    const now = Date.now()

    // Get or create cache entry
    let item = this.cache.get(key)

    if (!item || now > item.expiresAt) {
      // Create new entry if expired or not found
      item = {
        count: 1,
        expiresAt: now + this.config.windowMs,
        lastUpdated: now,
      }
      this.cache.set(key, item)
      this.stats.cacheSize = this.cache.size

      return {
        limited: false,
        remaining: this.config.maxRequests - 1,
        reset: item.expiresAt,
      }
    }

    // Increment existing entry
    item.count++
    item.lastUpdated = now

    const limited = item.count > this.config.maxRequests
    if (limited) {
      this.stats.limitExceeded++
    }

    return {
      limited,
      remaining: Math.max(0, this.config.maxRequests - item.count),
      reset: item.expiresAt,
    }
  }

  /**
   * Clean up expired entries and trim cache if needed
   */
  private cleanup(): void {
    const now = Date.now()
    let removedEntries = 0

    // First pass: remove expired entries
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key)
        removedEntries++
      }
    }

    // Second pass: trim cache if still too large by removing oldest entries
    if (this.cache.size > this.config.maxCacheSize) {
      const entriesToRemove = this.cache.size - this.config.maxCacheSize
      const entries = [...this.cache.entries()]
        .sort((a, b) => a[1].lastUpdated - b[1].lastUpdated)
        .slice(0, entriesToRemove)

      for (const [key] of entries) {
        this.cache.delete(key)
        removedEntries++
      }
    }

    // Update stats with cleanup information
    this.stats = {
      ...this.stats,
      cacheSize: this.cache.size,
      lastCleanup: now,
      lastCleanupCount: removedEntries,
    }
  }

  /**
   * Get current statistics about rate limiter usage
   */
  getStats(): Readonly<typeof this.stats> {
    return { ...this.stats }
  }

  /**
   * Get the current rate limit configuration
   */
  getConfig(): Readonly<RateLimitConfig> {
    return { ...this.config }
  }

  /**
   * Release resources when shutting down
   */
  dispose(): void {
    clearInterval(this.cleanupInterval)
  }
}

// Singleton pattern with lazy initialization
let rateLimiterInstance: RateLimiter | null = null

/**
 * Get the singleton RateLimiter instance
 */
export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100, // 100 requests per minute
      cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
      maxCacheSize: 10000,
    })

    // Handle module reloads in development
    if (process.env.NODE_ENV === 'development') {
      // Clean up previous instance if it exists
      if (global.__previousRateLimiter) {
        global.__previousRateLimiter.dispose()
      }

      // Store reference for cleanup during reloads
      global.__previousRateLimiter = rateLimiterInstance
    }
  }

  return rateLimiterInstance
}

/**
 * Generate a unique key for a client based on shop domain and IP
 */
export function generateClientKey(shopDomain: string, request: Request): string {
  const clientIp
    = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'

  return `mcp:${shopDomain}:${clientIp}`
}

/**
 * Middleware to enforce rate limits on API requests
 * @param request - The HTTP request
 * @param shopDomain - The shop's domain
 * @returns Response if rate limited, null otherwise
 */
export function rateLimitMiddleware(request: Request, shopDomain: string): Response | null {
  const limiter = getRateLimiter()
  const clientKey = generateClientKey(shopDomain, request)

  const { limited, remaining, reset } = limiter.check(clientKey)

  // Set rate limit headers on all responses
  const headers = new Headers({
    'X-RateLimit-Limit': String(limiter.getConfig().maxRequests),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(reset / 1000)), // Unix timestamp in seconds
  })

  if (limited) {
    const { code, message, status } = MCP_ERROR_CODES_MAP.RATE_LIMIT_EXCEEDED

    // Add Retry-After header (in seconds)
    headers.set('Retry-After', String(Math.ceil((reset - Date.now()) / 1000)))

    return json(
      {
        error: {
          code,
          message,
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
        },
      },
      {
        status,
        headers,
      }
    )
  }

  // This middleware doesn't modify the response if not rate limited
  return null
}

// Type declaration for HMR in development
declare global {
  // eslint-disable-next-line no-var
  var __previousRateLimiter: RateLimiter | undefined
}
