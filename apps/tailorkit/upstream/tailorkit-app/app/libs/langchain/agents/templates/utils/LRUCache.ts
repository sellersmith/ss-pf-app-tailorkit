/**
 * Memory-efficient LRU (Least Recently Used) Cache implementation.
 * Prevents memory leaks by automatically evicting old entries with TTL support.
 */
import { CACHE_CONFIG } from '../constants/style.constants'

/** Configuration options for LRU cache */
export interface CacheOptions {
  maxSize: number
  ttl?: number // Time to live in milliseconds
}

/** Cache entry with value and timestamp for TTL */
export interface CacheEntry<V> {
  value: V
  timestamp: number
}

export class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>()
  private readonly maxSize: number
  private readonly ttl?: number

  constructor(options: CacheOptions) {
    this.maxSize = options.maxSize
    this.ttl = options.ttl
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key)

    if (!entry) {
      this.recordAccess(false)
      return undefined
    }

    // Check TTL expiration
    if (this.ttl && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      this.recordAccess(false)
      return undefined
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, { ...entry, timestamp: Date.now() })
    this.recordAccess(true)

    return entry.value
  }

  set(key: K, value: V): void {
    const entry: CacheEntry<V> = {
      value,
      timestamp: Date.now(),
    }

    // If key already exists, delete it first
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, entry)
  }

  has(key: K): boolean {
    const entry = this.cache.get(key)

    if (!entry) {
      return false
    }

    // Check TTL expiration
    if (this.ttl && Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    this.cleanupExpired()
    return this.cache.size
  }

  keys(): IterableIterator<K> {
    this.cleanupExpired()
    return this.cache.keys()
  }

  values(): V[] {
    this.cleanupExpired()
    return Array.from(this.cache.values()).map(entry => entry.value)
  }

  /**
   * Remove expired entries based on TTL.
   */
  private cleanupExpired(): void {
    if (!this.ttl) return

    const now = Date.now()
    const expiredKeys: K[] = []

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        expiredKeys.push(key)
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key))
  }

  /**
   * Get cache statistics for monitoring performance.
   * @returns Cache statistics including size, hit rate, and memory usage
   */
  getStats(): {
    size: number
    maxSize: number
    hitRate: number
    memoryUsage: number
  } {
    this.cleanupExpired()

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.hitCount / Math.max(this.accessCount, 1),
      memoryUsage: this.cache.size / this.maxSize,
    }
  }

  // Statistics tracking
  private hitCount = 0
  private accessCount = 0

  private recordAccess(hit: boolean): void {
    this.accessCount++
    if (hit) {
      this.hitCount++
    }
  }
}

/**
 * No-op cache implementation for environments where caching is disabled.
 * Exposes the same API but never stores values.
 */
export class NoopCache<K, V> {
  // Match public API of LRUCache
  get(_key: K): V | undefined {
    return undefined
  }

  set(_key: K, _value: V): void {
    // no-op
  }

  has(_key: K): boolean {
    return false
  }

  delete(_key: K): boolean {
    return false
  }

  clear(): void {
    // no-op
  }

  size(): number {
    return 0
  }

  keys(): IterableIterator<K> {
    return new Map<K, V>().keys()
  }

  values(): V[] {
    return []
  }

  getStats() {
    return { size: 0, maxSize: 0, hitRate: 0, memoryUsage: 0 }
  }
}

/**
 * Cache manager for coordinating multiple caches.
 * Provides centralized cache management and cleanup.
 */
export class CacheManager {
  private static instance: CacheManager
  private caches = new Set<{ clear(): void; getStats?(): any }>()

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }

  registerCache(cache: { clear(): void; getStats?(): any }): void {
    this.caches.add(cache)
  }

  unregisterCache(cache: { clear(): void; getStats?(): any }): void {
    this.caches.delete(cache)
  }

  clearAllCaches(): void {
    this.caches.forEach(cache => cache.clear())
  }

  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {}
    let index = 0

    this.caches.forEach(cache => {
      if (cache.getStats) {
        stats[`cache_${index}`] = cache.getStats()
      }
      index++
    })

    return stats
  }

  /**
   * Schedule periodic cleanup of all caches.
   * @param intervalMs - Cleanup interval in milliseconds (default 1 hour)
   */
  schedulePeriodicCleanup(intervalMs: number = 3600000): void {
    // 1 hour default
    setInterval(() => {
      console.log('Performing scheduled cache cleanup...')
      this.clearAllCaches()
    }, intervalMs)
  }
}

/**
 * Factory function for creating commonly used cache configurations.
 * @param type - Cache type (intent, context, style, product)
 * @param customOptions - Custom cache options to override defaults
 * @returns Configured LRU cache instance
 */
export function createCache<K, V>(
  type: 'intent' | 'context' | 'style' | 'product',
  customOptions?: Partial<CacheOptions>
): LRUCache<K, V> {
  const envToggle = typeof process !== 'undefined' ? process.env.TEMPLATE_AGENT_CACHE_ENABLED : undefined
  const isEnabled
    = envToggle === undefined || envToggle === null ? CACHE_CONFIG.ENABLED : !(envToggle === 'false' || envToggle === '0')

  if (!isEnabled) {
    // Return a no-op cache without registering it
    return new NoopCache<K, V>() as unknown as LRUCache<K, V>
  }

  const defaultConfigs = {
    intent: { maxSize: 50, ttl: 1800000 }, // 30 minutes
    context: { maxSize: 30, ttl: 3600000 }, // 1 hour
    style: { maxSize: 100, ttl: 7200000 }, // 2 hours
    product: { maxSize: 20, ttl: 1800000 }, // 30 minutes
  }

  const config = { ...defaultConfigs[type], ...customOptions }
  const cache = new LRUCache<K, V>(config)

  // Register with cache manager
  CacheManager.getInstance().registerCache(cache)

  return cache
}
