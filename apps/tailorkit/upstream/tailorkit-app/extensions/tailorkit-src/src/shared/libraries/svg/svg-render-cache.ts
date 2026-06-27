/**
 * SVG Render Cache
 *
 * LRU cache for rendered SVG text images to avoid re-rendering identical configurations.
 * Provides instant rendering for repeated configs (undo/redo, zoom, etc.)
 *
 * @module shared/libraries/svg
 */

import { isIOS } from '../../../assets/utils/devices'
import type { SVGTextConfig } from './svg-text-creator'
import type { SVGTextPathConfig } from './svg-text-path-creator'
import type { EffectsFilterConfig } from './svg-filter-builder'
import type { LoadedImage } from '../paint/paint-renderer'

/**
 * Cached render result for regular text (CSS Box Model padding)
 */
export interface CachedTextRenderResult {
  image: HTMLImageElement
  /** Padding on the left side */
  leftPadding: number
  /** Padding on the top side */
  topPadding: number
  /** Padding on the right side */
  rightPadding: number
  /** Padding on the bottom side */
  bottomPadding: number
}

/**
 * Cached render result for text path (uniform padding)
 */
export interface CachedTextPathRenderResult {
  image: HTMLImageElement
  /** Uniform padding on all sides */
  padding: number
}

/**
 * Combined cache result type for both text and text path
 */
export type CachedRenderResult = CachedTextRenderResult | CachedTextPathRenderResult

/**
 * Cache entry with metadata
 */
interface CacheEntry {
  result: CachedRenderResult
  lastAccessed: number
}

/**
 * Maximum number of cached entries.
 * iOS has stricter memory limits (~100-150MB for web content), so we use a smaller cache
 * to prevent memory pressure during rapid interactions like slider dragging.
 */
const MAX_CACHE_SIZE = isIOS() ? 15 : 50

/** Module-level cache storage */
const cache = new Map<string, CacheEntry>()

/**
 * Fast hash function for strings (djb2 algorithm)
 * Produces a numeric hash that's faster to compare than full strings
 */
function fastHash(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i)
  }
  return hash >>> 0 // Convert to unsigned 32-bit integer
}

/**
 * Shadow config shape for serialization
 */
interface ShadowForSerialization {
  visible?: boolean
  color?: string
  radius?: number
  offsetX?: number
  offsetY?: number
}

/**
 * Serialize shadow config array efficiently
 * Only includes fields that affect rendering
 */
function serializeShadows(shadows: ShadowForSerialization[] | undefined): string {
  if (!shadows || shadows.length === 0) return ''
  return shadows
    .filter(s => s.visible !== false)
    .map(s => `${s.color}|${s.radius ?? 0}|${s.offsetX ?? 0}|${s.offsetY ?? 0}`)
    .join(';')
}

/**
 * Paint type for serialization
 */
interface PaintForSerialization {
  type?: string
  color?: string
  imageRef?: string
  scaleMode?: string
  patternSize?: string | number // Pattern size: 'stretch', 'stretch-x', 'stretch-y', or number (10-100)
  opacity?: number
  visible?: boolean
  stops?: Array<{ position: number; color: string }>
  transform?: Record<string, unknown>
  filters?: Record<string, number>
}

/**
 * StrokeConfig type for serialization (from strokes array)
 */
interface StrokeConfigForSerialization {
  _id?: string
  paint?: PaintForSerialization
  weight?: number
  opacity?: number
  visible?: boolean
}

/**
 * Serialize Paint fill efficiently for cache key
 * Only includes fields that affect rendering
 *
 * @param paint - Paint configuration to serialize
 * @param loadedImages - Map of loaded images (used to differentiate loaded vs unloaded IMAGE paints)
 */
function serializePaint(paint: PaintForSerialization | undefined, loadedImages?: Map<string, LoadedImage>): string {
  if (!paint) return ''
  if (paint.visible === false) return ''

  switch (paint.type) {
    case 'SOLID':
      return `SOLID:${paint.color}:${paint.opacity ?? 1}`
    case 'IMAGE': {
      const transform = JSON.stringify(paint.transform ?? {})
      const filters = JSON.stringify(paint.filters ?? {})
      const patternSize = paint.patternSize ?? 100 // Default to 100% tiling
      // Include loaded state to prevent cache collisions between loaded/unloaded renders
      const isLoaded = loadedImages?.has(paint.imageRef as string) ?? false
      return `IMAGE:${paint.imageRef}:${paint.scaleMode}:${patternSize}:${paint.opacity ?? 1}:${transform}:${filters}:${isLoaded}`
    }
    case 'GRADIENT_LINEAR':
    case 'GRADIENT_RADIAL':
    case 'GRADIENT_ANGULAR':
    case 'GRADIENT_DIAMOND': {
      const stops = paint.stops?.map(s => `${s.position}:${s.color}`).join(',') ?? ''
      return `${paint.type}:${stops}:${paint.opacity ?? 1}:${JSON.stringify(paint.transform ?? {})}`
    }
    default:
      return JSON.stringify(paint)
  }
}

/**
 * Serialize strokes array (TextStudio-style multiple strokes) for cache key
 * Each stroke has independent paint, weight, opacity, visibility
 *
 * @param strokes - Array of stroke configurations
 * @param loadedImages - Map of loaded images (passed to serializePaint for IMAGE paints)
 */
function serializeStrokes(
  strokes: StrokeConfigForSerialization[] | undefined,
  loadedImages?: Map<string, LoadedImage>
): string {
  if (!strokes || strokes.length === 0) return ''
  return strokes
    .map(s => {
      if (s.visible === false) return ''
      const paintStr = serializePaint(s.paint, loadedImages)
      return `${s._id ?? ''}|${paintStr}|${s.weight ?? 0}|${s.opacity ?? 1}`
    })
    .filter(Boolean)
    .join(';')
}

/**
 * Generate a stable cache key from config objects
 *
 * OPTIMIZATION: Uses a fast approach that:
 * 1. Only includes fields that affect rendering output
 * 2. Uses simple string concatenation instead of recursive JSON
 * 3. Produces a numeric hash for faster Map lookups
 *
 * This is ~3-5x faster than the previous stableStringify approach
 * for typical text configurations.
 *
 * @param config - Text or text path configuration
 * @param effectsConfig - Effects configuration (shadows, strokes)
 * @param loadedImages - Map of loaded images (used to differentiate loaded vs unloaded IMAGE paints)
 */
export function getCacheKey(
  config: SVGTextConfig | SVGTextPathConfig,
  effectsConfig: EffectsFilterConfig,
  loadedImages?: Map<string, LoadedImage>
): string {
  // Build key from essential rendering fields only
  // Order matters for consistency, but we use a fixed order
  const parts: (string | number | undefined | null)[] = [
    // Text content and dimensions
    config.content,
    config.width,
    config.height,
    config.fontSize,
    // Font properties
    config.fontFamily,
    config.fontWeight,
    config.fontStyle,
    config.fontBase64Css, // CRITICAL: Include font data to differentiate fonts with same family name
    config.color,
    // Paint fill (takes precedence over color) - CRITICAL: Include fill to differentiate fill types
    // Pass loadedImages to differentiate loaded vs unloaded IMAGE paints
    serializePaint(config.fill as PaintForSerialization, loadedImages),
    // Spacing and layout
    config.letterSpacing,
    (config as SVGTextConfig).lineHeight,
    (config as SVGTextConfig).align,
    (config as SVGTextConfig).verticalAlign,
    (config as SVGTextConfig).wrap,
    // Decoration
    config.textDecoration,
    config.fillOpacity,
    // Stroke
    config.stroke,
    config.strokeWidth,
    // Text path specific
    (config as SVGTextPathConfig).pathData,
    (config as SVGTextPathConfig).textBaseline,
    // Effects - serialize shadow arrays
    serializeShadows(config.dropShadows),
    serializeShadows(config.innerShadows),
    // Effects config
    effectsConfig.fillOpacity,
    effectsConfig.textColor,
    serializeShadows(effectsConfig.dropShadows),
    serializeShadows(effectsConfig.innerShadows),
    // Legacy stroke
    effectsConfig.stroke?.color,
    effectsConfig.stroke?.width,
    // Multiple strokes array (TextStudio-style wrapping)
    // Pass loadedImages to differentiate loaded vs unloaded IMAGE strokes
    serializeStrokes(effectsConfig.strokes as StrokeConfigForSerialization[], loadedImages),
  ]

  // Join with delimiter and hash for compact key
  const keyString = parts.map(p => p ?? '').join('|')
  return `${fastHash(keyString)}-${keyString.length}`
}

/**
 * Get cached render result if available
 *
 * Updates last accessed time on cache hit for LRU eviction.
 */
export function getCachedResult(key: string): CachedRenderResult | undefined {
  const entry = cache.get(key)
  if (entry) {
    entry.lastAccessed = Date.now()
    return entry.result
  }
  return undefined
}

/**
 * Release image memory to help garbage collection.
 * Setting src to empty string releases the decoded image data from GPU memory.
 */
function releaseImageMemory(image: HTMLImageElement | undefined): void {
  if (!image) return
  try {
    image.src = ''
    image.onload = null
    image.onerror = null
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Store render result in cache
 *
 * Evicts least recently used entries when cache is full.
 * Explicitly releases image memory on eviction to prevent memory accumulation on iOS.
 */
export function setCachedResult(key: string, result: CachedRenderResult): void {
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
      // Release image memory before eviction to help GC reclaim memory
      const evicted = cache.get(oldestKey)
      if (evicted?.result?.image) {
        releaseImageMemory(evicted.result.image)
      }
      cache.delete(oldestKey)
    }
  }

  cache.set(key, {
    result,
    lastAccessed: Date.now(),
  })
}

/**
 * Clear all cached render results
 *
 * Call when font changes or when memory pressure is detected.
 * Releases all image memory before clearing to prevent memory leaks.
 */
export function clearRenderCache(): void {
  // Release all image memory before clearing
  for (const entry of cache.values()) {
    if (entry.result?.image) {
      releaseImageMemory(entry.result.image)
    }
  }
  cache.clear()
}

/**
 * Get current cache size for debugging/monitoring
 */
export function getRenderCacheSize(): number {
  return cache.size
}

/**
 * Check if a result is cached
 */
export function hasCachedResult(key: string): boolean {
  return cache.has(key)
}
