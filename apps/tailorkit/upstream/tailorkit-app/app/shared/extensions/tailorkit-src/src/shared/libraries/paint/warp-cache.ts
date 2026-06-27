/**
 * Warp Cache
 *
 * LRU cache for warped images to avoid re-rendering identical configurations.
 * Provides instant rendering for repeated configs (curve adjustments, undo/redo).
 *
 * @module shared/libraries/paint
 */

import type { PatternSize } from './paint-types'

/**
 * Cache key components for warped images
 */
export interface WarpCacheKey {
  /** Image reference (URL or asset ID) */
  imageRef: string
  /** SVG path data string */
  pathData: string
  /** Pattern size mode */
  patternSize: PatternSize
  /** Target width along path */
  targetWidth: number
  /** Target height perpendicular to path */
  targetHeight: number
  /** Optional opacity */
  opacity?: number
}

/**
 * Cached warp result
 */
interface CacheEntry {
  /** Warped canvas */
  canvas: HTMLCanvasElement
  /** Data URL of warped image (for SVG patterns) */
  dataUrl: string
  /** Bounding box */
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  /** Path bounds */
  pathBounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
  /** Last access timestamp for LRU eviction */
  lastAccessed: number
}

/** Maximum number of cached entries */
const MAX_CACHE_SIZE = 20

/** Module-level cache storage */
const cache = new Map<string, CacheEntry>()

/**
 * Fast hash function for strings (djb2 algorithm)
 */
function fastHash(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  return hash >>> 0
}

/**
 * Generate a stable cache key string from key components
 */
function generateCacheKeyString(key: WarpCacheKey): string {
  const parts = [
    key.imageRef,
    // Hash the path data since it can be very long
    fastHash(key.pathData).toString(),
    key.pathData.length.toString(),
    typeof key.patternSize === 'number' ? key.patternSize.toString() : key.patternSize,
    key.targetWidth.toString(),
    key.targetHeight.toString(),
    key.opacity?.toString() ?? '1',
  ]

  return parts.join('|')
}

/**
 * Get cached warp result if available
 *
 * Updates last accessed time on cache hit for LRU eviction.
 */
export function getCachedWarp(key: WarpCacheKey): CacheEntry | undefined {
  const keyString = generateCacheKeyString(key)
  const entry = cache.get(keyString)

  if (entry) {
    entry.lastAccessed = Date.now()
    return entry
  }

  return undefined
}

/**
 * Store warp result in cache
 *
 * Evicts least recently used entries when cache is full.
 */
export function setCachedWarp(
  key: WarpCacheKey,
  result: {
    canvas: HTMLCanvasElement
    dataUrl: string
    bounds: CacheEntry['bounds']
    pathBounds: CacheEntry['pathBounds']
  }
): void {
  // Evict LRU entry if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    let oldestKey: string | undefined
    let oldestTime = Infinity

    for (const [k, entry] of cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = k
      }
    }

    if (oldestKey) {
      cache.delete(oldestKey)
    }
  }

  const keyString = generateCacheKeyString(key)
  cache.set(keyString, {
    ...result,
    lastAccessed: Date.now(),
  })
}

/**
 * Check if a warp result is cached
 */
export function hasWarpCached(key: WarpCacheKey): boolean {
  const keyString = generateCacheKeyString(key)
  return cache.has(keyString)
}

/**
 * Clear all cached warp results
 *
 * Call when memory pressure is detected or when source images change.
 */
export function clearWarpCache(): void {
  cache.clear()
}

/**
 * Clear cached warps for a specific image
 *
 * Call when an image is updated or removed.
 */
export function clearWarpCacheForImage(imageRef: string): void {
  for (const [key] of cache) {
    if (key.startsWith(`${imageRef}|`)) {
      cache.delete(key)
    }
  }
}

/**
 * Clear cached warps for a specific path
 *
 * Call when path data changes (e.g., curve editing).
 * Uses path hash for faster lookup.
 */
export function clearWarpCacheForPath(pathData: string): void {
  const pathHash = fastHash(pathData).toString()
  const pathLength = pathData.length.toString()

  for (const [key] of cache) {
    const parts = key.split('|')
    // Check if path hash and length match (parts[1] and parts[2])
    if (parts[1] === pathHash && parts[2] === pathLength) {
      cache.delete(key)
    }
  }
}

/**
 * Get current cache size for debugging/monitoring
 */
export function getWarpCacheSize(): number {
  return cache.size
}

/**
 * Get cache statistics for debugging
 */
export function getWarpCacheStats(): {
  size: number
  maxSize: number
  oldestAge: number
  newestAge: number
} {
  const now = Date.now()
  let oldestAge = 0
  let newestAge = Infinity

  for (const entry of cache.values()) {
    const age = now - entry.lastAccessed
    oldestAge = Math.max(oldestAge, age)
    newestAge = Math.min(newestAge, age)
  }

  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    oldestAge: cache.size > 0 ? oldestAge : 0,
    newestAge: cache.size > 0 ? newestAge : 0,
  }
}
