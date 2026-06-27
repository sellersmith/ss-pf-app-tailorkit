/**
 * SVG Render Orchestrator
 *
 * High-level orchestrator for rendering SVG text with effects.
 * Encapsulates filter strategy selection and application, following SOLID principles.
 *
 * Benefits:
 * - SRP: Single entry point for SVG rendering with effects
 * - OCP: New strategies can be added without modifying consumers
 * - DIP: React components depend on this abstraction, not filter implementations
 *
 * @module shared/libraries/svg
 */

import type { Svg } from '@svgdotjs/svg.js'
import type { DropShadowConfig, InnerShadowConfig } from '../konva/effects/types'
import { createSVGText, type SVGTextConfig } from './svg-text-creator'
import {
  createSVGTextPath,
  createSVGTextPathWithNativeStrokes,
  type SVGTextPathConfig,
  type SVGTextPathWithNativeStrokesConfig,
} from './svg-text-path-creator'
import { svgToImage } from './svg-image-converter'
import { measureSVGBounds } from './svg-bbox-calculator'
import {
  addEffectsFilter,
  addInnerShadowFilter,
  addDropShadowFilter,
  applyFilterToText,
  hasVisibleEffects,
  type EffectsFilterConfig,
  type BuildEffectsFilterOptions,
} from './svg-filter-builder'
import { calculateStrokesExtent } from './svg-strokes-primitives'
import type { LoadedImage } from '../paint/paint-renderer'
import {
  getCacheKey,
  getCachedResult,
  setCachedResult,
  type CachedTextRenderResult,
  type CachedTextPathRenderResult,
} from './svg-render-cache'
import { isIOS } from '../../../assets/utils/devices'

/** Safety margin added to measured bounds to prevent edge clipping */
const SAFETY_MARGIN = 2

/**
 * iOS Render Throttle Configuration
 *
 * During rapid interactions (resize, drag, slider), iOS Safari can crash
 * due to memory exhaustion from too many large image allocations.
 *
 * This throttle limits render frequency to prevent memory buildup.
 * - THROTTLE_INTERVAL: Minimum ms between renders (150ms = ~6-7 renders/sec)
 * - Only active on iOS where memory pressure is critical
 */
const IOS_THROTTLE_INTERVAL = 150

/** Track last render time for throttling */
let lastRenderTime = 0

/** Pending render timeout for deferred final render */
let pendingRenderTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Check if render should be throttled on iOS
 *
 * Returns true if:
 * - Running on iOS AND
 * - Last render was within throttle interval
 *
 * When throttled, the render will be skipped but a deferred render
 * will be scheduled to ensure the final state is rendered.
 */
function shouldThrottleRender(): boolean {
  if (!isIOS()) return false

  const now = Date.now()
  const elapsed = now - lastRenderTime

  return elapsed < IOS_THROTTLE_INTERVAL
}

/**
 * Update render time tracking
 */
function markRenderComplete(): void {
  lastRenderTime = Date.now()
}

/**
 * Track in-progress renders to prevent concurrent memory allocation.
 * Key: cache key, Value: Promise of the render result
 *
 * This prevents the same text element from being rendered multiple times
 * concurrently, which would multiply memory usage.
 */
const inProgressRenders = new Map<string, Promise<RenderSVGTextResult | RenderSVGTextPathResult>>()

/**
 * Store the last successful render result per element for throttle fallback.
 * When throttled, we return the last result instead of rendering.
 * Key: base config hash (without effect values), Value: last render result
 */
const lastRenderResults = new Map<string, RenderSVGTextResult | RenderSVGTextPathResult>()

/**
 * Generate a stable element ID for tracking last render results.
 * Uses content + dimensions as a stable identifier for the "same" element.
 */
function getElementId(config: { content?: string; width: number; height: number }): string {
  return `${config.content || ''}-${Math.round(config.width)}-${Math.round(config.height)}`
}

/**
 * Estimated descender padding as percentage of font size.
 * Most fonts have descenders (g, j, p, q, y) that extend below baseline.
 * Using 25% as a conservative estimate that works for most fonts.
 */
const DESCENDER_RATIO = 0.25

/**
 * Estimated ascender padding as percentage of font size.
 * Some fonts have ascenders that extend above the em-box.
 * Using 10% as a small safety margin.
 */
const ASCENDER_RATIO = 0.1

/**
 * Blur spread multiplier for Gaussian blur.
 *
 * The relationship between CSS blur radius and SVG stdDeviation:
 * - CSS blur radius = 2 × SVG stdDeviation
 * - SVG filter uses: stdDeviation = radius / 2
 *
 * Gaussian blur with stdDeviation σ has 99.7% of its effect within 3σ.
 * So blur spread = stdDeviation × 3 = (radius / 2) × 3 = radius × 1.5
 *
 * Using 2.0 for extra safety margin (handles edge cases, anti-aliasing).
 */
const BLUR_SPREAD_MULTIPLIER = 2.0

/**
 * Calculate effect padding from drop shadows and inner shadows.
 * getBBox() doesn't measure filter effects, so we need to calculate blur/offset separately.
 *
 * Note: While inner shadows technically don't extend beyond text bounds,
 * we include their blur in the calculation to account for:
 * 1. Anti-aliasing at text edges
 * 2. SVG filter rendering artifacts
 * 3. The glow-like appearance of large inner shadows
 *
 * @param dropShadows - Array of drop shadow configurations
 * @param innerShadows - Array of inner shadow configurations (optional)
 * @returns Padding for each direction { left, top, right, bottom }
 */
function calculateEffectPadding(
  dropShadows: DropShadowConfig[],
  innerShadows: InnerShadowConfig[] = []
): {
  left: number
  top: number
  right: number
  bottom: number
} {
  let maxLeft = 0
  let maxTop = 0
  let maxRight = 0
  let maxBottom = 0

  // Process drop shadows (extend outward from text)
  for (const shadow of dropShadows) {
    if (shadow.visible === false) continue

    const blur = shadow.radius || 0
    const offsetX = shadow.offsetX || 0
    const offsetY = shadow.offsetY || 0

    // Blur spreads outward: stdDeviation × 3, where stdDeviation = radius / 2
    // So: blurSpread = (radius / 2) × 3 = radius × 1.5
    // Using 2.0 multiplier for safety margin
    const blurSpread = Math.ceil(blur * BLUR_SPREAD_MULTIPLIER)

    // Shadow extends in the direction of offset, plus blur spread in all directions
    const effectLeft = blurSpread + Math.max(0, -offsetX)
    const effectRight = blurSpread + Math.max(0, offsetX)
    const effectTop = blurSpread + Math.max(0, -offsetY)
    const effectBottom = blurSpread + Math.max(0, offsetY)

    maxLeft = Math.max(maxLeft, effectLeft)
    maxTop = Math.max(maxTop, effectTop)
    maxRight = Math.max(maxRight, effectRight)
    maxBottom = Math.max(maxBottom, effectBottom)
  }

  // Process inner shadows (for anti-aliasing at text edges)
  // Inner shadows with large blur can create glow-like effects at text edges
  for (const shadow of innerShadows) {
    if (shadow.visible === false) continue

    const blur = shadow.radius || 0

    // Inner shadows need less padding since they're clipped to text area
    // But we add some for anti-aliasing and edge effects
    const edgePadding = Math.ceil(blur * 0.5)

    maxLeft = Math.max(maxLeft, edgePadding)
    maxTop = Math.max(maxTop, edgePadding)
    maxRight = Math.max(maxRight, edgePadding)
    maxBottom = Math.max(maxBottom, edgePadding)
  }

  return { left: maxLeft, top: maxTop, right: maxRight, bottom: maxBottom }
}

/**
 * Check if font style includes italic.
 * Italic text extends beyond its normal bounding box and requires measurement.
 */
function isItalicFont(fontStyle: string | undefined): boolean {
  return fontStyle?.toLowerCase().includes('italic') ?? false
}

/**
 * Check if we can skip getBBox() measurement.
 *
 * getBBox() requires DOM mounting which adds ~1-2ms overhead.
 * For simple text without italic or effects, we can use estimated bounds.
 *
 * Skip measurement when:
 * - No italic font style (italic extends beyond bounding box)
 * - No visible effects (reuses hasVisibleEffects from svg-filter-builder)
 *
 * @returns true if we can skip measurement and use estimated bounds
 */
function canSkipMeasurement(fontStyle: string | undefined, effectsConfig: EffectsFilterConfig): boolean {
  // Italic extends beyond normal bounds - must measure
  if (isItalicFont(fontStyle)) return false

  // Effects (shadows, stroke) extend bounds - must measure for accuracy
  // Reuses hasVisibleEffects to avoid duplicating visibility checks
  if (hasVisibleEffects(effectsConfig)) return false

  return true
}

/**
 * Estimate text bounds without DOM measurement.
 *
 * Used for simple text without effects to avoid getBBox() overhead.
 * Returns conservative padding estimates based on typical font metrics.
 *
 * @param fontSize - Font size in pixels
 * @returns Estimated padding for each direction
 */
function estimateTextBounds(fontSize: number): {
  contentLeft: number
  contentTop: number
  contentRight: number
  contentBottom: number
} {
  // Descenders (g, j, p, q, y) typically extend 20-25% below baseline
  const descenderPadding = Math.ceil(fontSize * DESCENDER_RATIO)

  // Ascenders might slightly exceed em-box in some fonts
  const ascenderPadding = Math.ceil(fontSize * ASCENDER_RATIO)

  return {
    contentLeft: 0, // No left extension for non-italic
    contentTop: ascenderPadding,
    contentRight: 0, // No right extension for non-italic
    contentBottom: descenderPadding,
  }
}

/**
 * Filter strategy types
 * - 'combined': Combined effects filter with outside stroke via feMorphology
 * - 'inner-shadow-only': Inner shadow filter only (when no stroke/drop shadow but has inner shadow or fillOpacity)
 * - 'none': No filter needed
 *
 * Note: The 'combined' filter now handles:
 * - Outside stroke via feMorphology (true outside stroke, no overlap with text)
 * - Drop shadows knocked out from text, rendered behind stroke
 * - Inner shadows clipped to text area, rendered on top
 * - Fill opacity via feComponentTransfer
 */
type FilterStrategy = 'combined' | 'inner-shadow-only' | 'none'

/**
 * Options for rendering SVG text with effects
 */
export interface RenderSVGTextOptions {
  config: SVGTextConfig
  effectsConfig: EffectsFilterConfig
  filterId: string
  /** Loaded images for Paint-based fills and strokes */
  loadedImages?: Map<string, LoadedImage>
}

/**
 * Options for rendering SVG text path with effects
 */
export interface RenderSVGTextPathOptions {
  config: SVGTextPathConfig
  effectsConfig: EffectsFilterConfig
  filterId: string
  /** Loaded images for Paint-based fills and strokes */
  loadedImages?: Map<string, LoadedImage>
}

/**
 * Result of rendering SVG text with effects
 * Uses CSS Box Model standard padding (left/top/right/bottom)
 */
export interface RenderSVGTextResult {
  svg: Svg
  image: HTMLImageElement
  /** Padding on the left side (content extends left of origin) */
  leftPadding: number
  /** Padding on the top side (content extends above origin) */
  topPadding: number
  /** Padding on the right side (content extends right of width) */
  rightPadding: number
  /** Padding on the bottom side (content extends below height) */
  bottomPadding: number
}

/**
 * Result of rendering SVG text path with effects
 * Uses uniform padding (text curves in any direction)
 */
export interface RenderSVGTextPathResult {
  svg: Svg
  image: HTMLImageElement
  /** Uniform padding on all sides */
  padding: number
}

/**
 * Determine the appropriate filter strategy based on effects configuration
 *
 * Strategy selection logic:
 * - Combined: Any stroke, drop shadow, or inner shadow present
 *   (feMorphology creates true outside stroke that works with transparent fills)
 * - Inner-shadow-only: Only inner shadow or fillOpacity < 1 (no stroke/drop shadow)
 * - None: No visible effects
 */
function determineFilterStrategy(
  dropShadows: DropShadowConfig[],
  innerShadows: InnerShadowConfig[],
  hasStroke: boolean,
  fillOpacity: number
): FilterStrategy {
  const visibleDropShadows = dropShadows.filter(s => s.visible !== false)
  const visibleInnerShadows = innerShadows.filter(s => s.visible !== false)

  const hasDropShadow = visibleDropShadows.length > 0
  const hasInnerShadow = visibleInnerShadows.length > 0
  const hasFillOpacityEffect = fillOpacity < 1

  // Combined approach: stroke, drop shadow, or any combination
  // The feMorphology-based filter handles:
  // - Outside stroke (no overlap with text interior)
  // - Drop shadows knocked out from text, behind stroke
  // - Inner shadows on top
  // - Fill opacity via feComponentTransfer
  if (hasStroke || hasDropShadow) {
    return 'combined'
  }

  // Inner-shadow-only approach: inner shadow only, or fillOpacity < 1
  if (hasInnerShadow || hasFillOpacityEffect) {
    return 'inner-shadow-only'
  }

  // No filter needed
  return 'none'
}

/**
 * Apply the selected filter strategy to the SVG
 */
function applyFilterStrategy(
  svg: Svg,
  strategy: FilterStrategy,
  effectsConfig: EffectsFilterConfig,
  filterId: string,
  filterOptions?: BuildEffectsFilterOptions
): void {
  const { innerShadows, fillOpacity = 1 } = effectsConfig

  switch (strategy) {
    case 'combined':
      // Apply combined effects filter with feMorphology-based outside stroke
      // Handles: outside stroke, drop shadows, source graphic, inner shadows
      if (hasVisibleEffects(effectsConfig)) {
        addEffectsFilter(svg, effectsConfig, filterId, filterOptions)
        applyFilterToText(svg, filterId)
      }
      break

    case 'inner-shadow-only':
      // Apply inner shadow filter (includes fill opacity handling)
      addInnerShadowFilter(svg, innerShadows, fillOpacity, filterId)
      applyFilterToText(svg, filterId)
      break

    case 'none':
      // No filter to apply
      break
  }
}

/**
 * Check if strokes contain any image paint that would require large filter regions
 */
function hasImageStrokeInArray(strokes: EffectsFilterConfig['strokes']): boolean {
  if (!strokes || strokes.length === 0) return false
  return strokes.some(s => s.visible !== false && s.paint && 'imageRef' in s.paint)
}

/**
 * Check if config has any unloaded image paints
 *
 * When image paints aren't loaded, the render falls back to grey (#808080).
 * We should NOT cache such results to prevent stale grey from persisting
 * after images finish loading.
 */
function hasUnloadedImagePaint(
  config: SVGTextConfig | SVGTextPathConfig,
  effectsConfig: EffectsFilterConfig,
  loadedImages?: Map<string, LoadedImage>
): boolean {
  // Check fill paint
  if (config.fill && 'imageRef' in config.fill) {
    if (!loadedImages?.has(config.fill.imageRef as string)) return true
  }
  // Check strokes array (legacy stroke only has color/width, no image support)
  if (effectsConfig.strokes) {
    for (const stroke of effectsConfig.strokes) {
      if (stroke.visible !== false && stroke.paint && 'imageRef' in stroke.paint) {
        if (!loadedImages?.has(stroke.paint.imageRef as string)) return true
      }
    }
  }
  return false
}

/**
 * Result from building stroke configuration
 */
interface StrokeConfigResult {
  /** Whether any stroke (legacy or strokes array) is visible */
  hasStroke: boolean
  /** Complete effects config with stroke configuration */
  completeEffectsConfig: EffectsFilterConfig
  /** Filter options with dimensions and loaded images */
  filterOptions: BuildEffectsFilterOptions
}

/**
 * Build stroke configuration for filter builder
 *
 * Handles both legacy stroke (color + width) and new strokes array.
 * Strokes array takes precedence over legacy stroke.
 *
 * @param stroke - Legacy stroke color
 * @param strokeWidth - Legacy stroke width
 * @param effectsConfig - Effects configuration (may contain strokes array)
 * @param width - Text bounds width
 * @param height - Text bounds height
 * @param fontSize - Font size for stroke weight % conversion
 * @param loadedImages - Loaded images for Paint-based strokes
 * @param curveBend - Curve bend percentage for expanded pattern bounds
 */
function buildStrokeConfig(
  stroke: string | undefined,
  strokeWidth: number | undefined,
  effectsConfig: EffectsFilterConfig,
  width: number,
  height: number,
  fontSize: number,
  loadedImages?: Map<string, LoadedImage>,
  curveBend?: number
): StrokeConfigResult {
  const hasLegacyStroke = Boolean(stroke && strokeWidth && strokeWidth > 0)
  const hasStrokesArray = Boolean(effectsConfig.strokes && effectsConfig.strokes.length > 0)

  // Check if any stroke uses image paint (requires absolute coordinates for curved text)
  const hasImageStroke = hasImageStrokeInArray(effectsConfig.strokes)

  // Calculate expanded bounds for curved text stroke patterns
  // This ensures image fills on strokes cover the entire curved text area
  const textWidth = width
  let textHeight = height
  let curveExtension: number | undefined
  const isCurved = curveBend && curveBend !== 0

  if (isCurved) {
    // Curve amplitude (how much path deviates from center)
    const amplitude = (Math.abs(curveBend) / 100) * (height / 2)
    // Text extends beyond path by approximately half font size
    const textExtension = fontSize / 2
    // Total vertical extension on each side
    const totalExtension = amplitude + textExtension
    textHeight = height + totalExtension * 2
    // Store the extension for pattern positioning
    curveExtension = totalExtension
  }

  // Use absolute coordinates (userSpaceOnUse) for curved text with image strokes
  // This eliminates coordinate system mismatch between filter region (%) and feImage (px)
  const useAbsoluteCoordinates = Boolean(isCurved && hasImageStroke)

  return {
    hasStroke: hasLegacyStroke || hasStrokesArray,
    completeEffectsConfig: {
      ...effectsConfig,
      strokes: hasStrokesArray ? effectsConfig.strokes : undefined,
      stroke: !hasStrokesArray && hasLegacyStroke ? { color: stroke!, width: strokeWidth! } : undefined,
    },
    filterOptions: {
      textWidth,
      textHeight,
      loadedImages,
      fontSize,
      curveExtension,
      // Pass curveBend for asymmetric filter bounds optimization
      curveBend,
      // Use absolute coordinates for curved text with image strokes
      useAbsoluteCoordinates,
    },
  }
}

/**
 * Render SVG text with effects
 *
 * High-level function that orchestrates:
 * 1. Cache lookup for instant rendering of identical configs
 * 2. SVG creation with generous initial bounds
 * 3. Filter strategy selection based on effects and stroke
 * 4. Filter application (combined filter handles stroke via feMorphology)
 * 5. Measure actual bounding box using getBBox()
 * 6. Adjust SVG viewBox to fit actual content
 * 7. Conversion to HTMLImageElement
 * 8. Cache storage for future reuse
 *
 * @param options - Render options including config, effects, and filter ID
 * @returns Promise with rendered image and CSS Box Model padding
 */
export async function renderSVGTextWithEffects(options: RenderSVGTextOptions): Promise<RenderSVGTextResult> {
  const { config, effectsConfig, filterId, loadedImages } = options

  // Check cache first for instant rendering
  // Pass loadedImages to differentiate cache keys for loaded vs unloaded IMAGE paints
  const cacheKey = getCacheKey(config, effectsConfig, loadedImages)
  const cachedResult = getCachedResult(cacheKey) as CachedTextRenderResult | undefined

  if (cachedResult) {
    return {
      svg: null as unknown as Svg, // SVG not needed when returning cached result
      ...cachedResult,
    }
  }

  // iOS THROTTLE: Prevent memory exhaustion during rapid interactions
  // If rendering too fast and we have a previous result, return it and schedule deferred render
  const elementId = getElementId(config)
  if (shouldThrottleRender()) {
    const lastResult = lastRenderResults.get(elementId) as RenderSVGTextResult | undefined
    if (lastResult) {
      // Schedule deferred render to ensure final state is rendered
      if (pendingRenderTimeout) clearTimeout(pendingRenderTimeout)
      pendingRenderTimeout = setTimeout(() => {
        pendingRenderTimeout = null
        // Re-trigger render (will check cache/throttle again)
        renderSVGTextWithEffects(options)
      }, IOS_THROTTLE_INTERVAL)

      // Return last result to keep UI responsive
      return lastResult
    }
    // No last result - must render even if throttled
  }

  // Check if render already in progress for this exact config
  const inProgress = inProgressRenders.get(cacheKey)
  if (inProgress) {
    return inProgress as Promise<RenderSVGTextResult>
  }

  const { dropShadows = [], stroke, strokeWidth, width, height, fontStyle, fontSize } = config
  const { innerShadows = [], fillOpacity = 1 } = effectsConfig

  // Build stroke configuration (handles legacy stroke and strokes array)
  const { hasStroke, completeEffectsConfig, filterOptions } = buildStrokeConfig(
    stroke,
    strokeWidth,
    effectsConfig,
    width,
    height,
    fontSize,
    loadedImages
  )

  // Determine rendering strategy
  const strategy = determineFilterStrategy(dropShadows, innerShadows, hasStroke, fillOpacity)

  // Create SVG with generous initial bounds
  const svgResult = createSVGText(config)

  // Apply appropriate filter strategy
  applyFilterStrategy(svgResult.svg, strategy, completeEffectsConfig, filterId, filterOptions)

  // OPTIMIZATION: Skip DOM measurement for simple text without effects
  // getBBox() requires DOM mounting (~1-2ms overhead)
  // For simple text, use estimated bounds instead
  const skipMeasurement = canSkipMeasurement(fontStyle, completeEffectsConfig)

  let bounds: { contentLeft: number; contentTop: number; contentRight: number; contentBottom: number }
  if (skipMeasurement) {
    // Use estimated bounds for simple text (faster, no DOM required)
    bounds = estimateTextBounds(fontSize)
  } else {
    // Measure actual bounding box of text geometry (italic, descenders, etc.)
    // Note: getBBox() doesn't measure filter effects, only the text shape
    bounds = measureSVGBounds(svgResult.svg, width, height)
  }

  // Calculate effect padding separately (blur spread + offset)
  // This is needed because getBBox() doesn't include filter effects
  const effectPadding = calculateEffectPadding(dropShadows, innerShadows)

  // Combine text geometry bounds with effect padding
  // Take the maximum of bbox extension and effect padding for each direction
  const leftPadding = Math.max(bounds.contentLeft, effectPadding.left) + SAFETY_MARGIN
  const topPadding = Math.max(bounds.contentTop, effectPadding.top) + SAFETY_MARGIN
  const rightPadding = Math.max(bounds.contentRight, effectPadding.right) + SAFETY_MARGIN
  const bottomPadding = Math.max(bounds.contentBottom, effectPadding.bottom) + SAFETY_MARGIN

  const finalWidth = width + leftPadding + rightPadding
  const finalHeight = height + topPadding + bottomPadding

  // Adjust SVG viewBox and size to fit actual content
  svgResult.svg.size(finalWidth, finalHeight)
  svgResult.svg.viewbox(-leftPadding, -topPadding, finalWidth, finalHeight)

  // Wrap the render in a trackable promise for concurrent render prevention
  const renderPromise = (async () => {
    try {
      // Convert to image
      const image = await svgToImage(svgResult.svg)

      // Cache the result for future reuse (skip if images aren't loaded to avoid caching grey fallback)
      const cacheResult: CachedTextRenderResult = {
        image,
        leftPadding,
        topPadding,
        rightPadding,
        bottomPadding,
      }
      if (!hasUnloadedImagePaint(config, effectsConfig, loadedImages)) {
        setCachedResult(cacheKey, cacheResult)
      }

      const result: RenderSVGTextResult = {
        svg: svgResult.svg,
        image,
        leftPadding,
        topPadding,
        rightPadding,
        bottomPadding,
      }

      // Store as last result for throttle fallback
      lastRenderResults.set(elementId, result)

      // Limit lastRenderResults size to prevent memory leak
      if (lastRenderResults.size > 20) {
        const firstKey = lastRenderResults.keys().next().value
        if (firstKey) lastRenderResults.delete(firstKey)
      }

      // Mark render complete for throttle tracking
      markRenderComplete()

      return result
    } finally {
      // Always clean up in-progress tracking, even on failure
      inProgressRenders.delete(cacheKey)
    }
  })()

  // Track as in-progress to prevent concurrent renders
  inProgressRenders.set(cacheKey, renderPromise)

  return renderPromise
}

/**
 * Render SVG text path with effects
 *
 * High-level function that orchestrates:
 * 1. Cache lookup for instant rendering of identical configs
 * 2. SVG creation with generous initial bounds
 * 3. Filter strategy selection based on effects and stroke
 * 4. Filter application (combined filter handles stroke via feMorphology)
 * 5. Measure actual bounding box using getBBox()
 * 6. Adjust SVG viewBox to fit actual content
 * 7. Conversion to HTMLImageElement
 * 8. Cache storage for future reuse
 *
 * NATIVE STROKE OPTIMIZATION:
 * For curved text with image/gradient strokes, uses native SVG stroke rendering
 * instead of filter-based approach. This avoids Safari's filter region pixel limits
 * and works at any size.
 *
 * @param options - Render options including config, effects, and filter ID
 * @returns Promise with rendered image and uniform padding
 */
export async function renderSVGTextPathWithEffects(
  options: RenderSVGTextPathOptions
): Promise<RenderSVGTextPathResult> {
  const { config, effectsConfig, filterId, loadedImages } = options

  // Check cache first for instant rendering
  // Pass loadedImages to differentiate cache keys for loaded vs unloaded IMAGE paints
  const cacheKey = getCacheKey(config, effectsConfig, loadedImages)
  const cachedResult = getCachedResult(cacheKey) as CachedTextPathRenderResult | undefined
  if (cachedResult) {
    return {
      svg: null as unknown as Svg, // SVG not needed when returning cached result
      ...cachedResult,
    }
  }

  // iOS THROTTLE: Prevent memory exhaustion during rapid interactions
  const elementId = getElementId(config)
  if (shouldThrottleRender()) {
    const lastResult = lastRenderResults.get(elementId) as RenderSVGTextPathResult | undefined
    if (lastResult) {
      // Schedule deferred render to ensure final state is rendered
      if (pendingRenderTimeout) clearTimeout(pendingRenderTimeout)
      pendingRenderTimeout = setTimeout(() => {
        pendingRenderTimeout = null
        renderSVGTextPathWithEffects(options)
      }, IOS_THROTTLE_INTERVAL)

      return lastResult
    }
  }

  // Check if render already in progress for this exact config
  const inProgress = inProgressRenders.get(cacheKey)
  if (inProgress) {
    return inProgress as Promise<RenderSVGTextPathResult>
  }

  const { dropShadows = [], stroke, strokeWidth, width, height, fontSize } = config
  const { innerShadows = [], fillOpacity = 1, strokes } = effectsConfig

  // Detect if we should use NATIVE STROKE rendering
  // Native strokes are better for curved text with image/gradient strokes because:
  // - No filter region needed for strokes (avoids Safari pixel limits)
  // - Pattern follows the curve automatically
  // - Works at any size
  const isCurved = config.curveBend && config.curveBend !== 0
  const hasImageStroke = hasImageStrokeInArray(strokes)
  const useNativeStrokes = isCurved && hasImageStroke && strokes && strokes.length > 0

  if (useNativeStrokes) {
    // NATIVE STROKE PATH: Render text multiple times with native SVG stroke attribute
    // This bypasses the filter-based stroke rendering entirely for curved text with image strokes

    // Create SVG with native strokes (no filter for strokes, only for shadows if any)
    const nativeStrokesConfig: SVGTextPathWithNativeStrokesConfig = {
      ...config,
      strokes,
    }
    const svgResult = createSVGTextPathWithNativeStrokes(nativeStrokesConfig)

    // Apply SEPARATE filters for drop shadows and inner shadows
    // - Drop shadow: Applied to the group (text + strokes combined silhouette)
    // - Inner shadow: Applied to the fill layer only (Figma behavior)
    const visibleDropShadows = dropShadows.filter(s => s.visible !== false)
    const visibleInnerShadows = innerShadows.filter(s => s.visible !== false)
    const hasDropShadow = visibleDropShadows.length > 0
    const hasInnerShadow = visibleInnerShadows.length > 0

    // Apply drop shadow filter to the SHADOW SOURCE element (NOT the group)
    // SAFARI BUG FIX: Applying filter to a <g> containing children with url() pattern fills
    // causes Safari to render patterns incorrectly. By using a separate shadow source element
    // with solid colors and a shadow-only filter (no SourceGraphic), we avoid this issue.
    const shadowSources = svgResult.svg.find('text.shadow-source')
    if (hasDropShadow) {
      const dropShadowFilterId = `${filterId}-drop`
      // includeSourceGraphic: false - shadow source uses solid colors, filter outputs ONLY shadow
      addDropShadowFilter(svgResult.svg, dropShadows, dropShadowFilterId, { includeSourceGraphic: false })
      // Apply to the shadow source element (solid colors, renders behind visible layers)
      for (const shadowSource of shadowSources) {
        shadowSource.attr('filter', `url(#${dropShadowFilterId})`)
      }
    } else {
      // No drop shadow - hide shadow source (it's only used for shadow calculation)
      // Without this, the black shadow source would be visible and bleed through low-opacity fills
      for (const shadowSource of shadowSources) {
        shadowSource.attr('display', 'none')
      }
    }

    // Apply inner shadow filter to the FILL LAYER only
    if (hasInnerShadow) {
      const innerShadowFilterId = `${filterId}-inner`
      addInnerShadowFilter(svgResult.svg, innerShadows, fillOpacity, innerShadowFilterId)
      // Apply to the fill layer only
      const fillElements = svgResult.svg.find('text.text-fill')
      for (const text of fillElements) {
        text.attr('filter', `url(#${innerShadowFilterId})`)
      }
    }

    // Measure bounds and finalize
    const bounds = measureSVGBounds(svgResult.svg, width, height)
    const effectPadding = calculateEffectPadding(dropShadows, innerShadows)

    // Calculate stroke extent for padding
    let strokePadding = 0
    if (strokes.length > 0) {
      strokePadding = calculateStrokesExtent(strokes, fontSize)
    }

    // Calculate curve extension for padding
    let curveExtensionPadding = 0
    if (isCurved) {
      const amplitude = (Math.abs(config.curveBend!) / 100) * (height / 2)
      const textExtension = fontSize / 2
      curveExtensionPadding = amplitude + textExtension
    }
    const totalStrokeCurvePadding = strokePadding + curveExtensionPadding

    const maxBboxPadding = Math.max(bounds.contentLeft, bounds.contentTop, bounds.contentRight, bounds.contentBottom)
    const maxEffectPadding = Math.max(effectPadding.left, effectPadding.top, effectPadding.right, effectPadding.bottom)
    const maxPadding = Math.max(maxBboxPadding, maxEffectPadding, totalStrokeCurvePadding) + SAFETY_MARGIN

    const finalWidth = width + maxPadding * 2
    const finalHeight = height + maxPadding * 2

    svgResult.svg.size(finalWidth, finalHeight)
    svgResult.svg.viewbox(-maxPadding, -maxPadding, finalWidth, finalHeight)

    // Wrap the render in a trackable promise
    const renderPromise = (async () => {
      try {
        const image = await svgToImage(svgResult.svg)

        // Cache the result (skip if images aren't loaded to avoid caching grey fallback)
        const cacheResult: CachedTextPathRenderResult = { image, padding: maxPadding }
        if (!hasUnloadedImagePaint(config, effectsConfig, loadedImages)) {
          setCachedResult(cacheKey, cacheResult)
        }

        const result: RenderSVGTextPathResult = { svg: svgResult.svg, image, padding: maxPadding }

        // Store as last result for throttle fallback
        lastRenderResults.set(elementId, result)
        if (lastRenderResults.size > 20) {
          const firstKey = lastRenderResults.keys().next().value
          if (firstKey) lastRenderResults.delete(firstKey)
        }

        markRenderComplete()

        return result
      } finally {
        // Always clean up in-progress tracking, even on failure
        inProgressRenders.delete(cacheKey)
      }
    })()

    inProgressRenders.set(cacheKey, renderPromise)
    return renderPromise
  }

  // FILTER-BASED PATH: Original approach using feMorphology for strokes
  // Used for: straight text, solid color strokes, gradient strokes on small curved text

  // Build stroke configuration (handles legacy stroke and strokes array)
  // Pass curveBend for expanded pattern bounds on curved text
  const { hasStroke, completeEffectsConfig, filterOptions } = buildStrokeConfig(
    stroke,
    strokeWidth,
    effectsConfig,
    width,
    height,
    fontSize,
    loadedImages,
    config.curveBend
  )

  // Determine rendering strategy
  const strategy = determineFilterStrategy(dropShadows, innerShadows, hasStroke, fillOpacity)

  // Create SVG with generous initial bounds
  const svgResult = createSVGTextPath(config)

  // Apply appropriate filter strategy
  applyFilterStrategy(svgResult.svg, strategy, completeEffectsConfig, filterId, filterOptions)

  // Measure actual bounding box of text geometry
  // Note: getBBox() doesn't measure filter effects, only the text shape
  const bounds = measureSVGBounds(svgResult.svg, width, height)

  // Calculate effect padding separately (blur spread + offset)
  // This is needed because getBBox() doesn't include filter effects
  const effectPadding = calculateEffectPadding(dropShadows, innerShadows)

  // Calculate stroke extent (stroke extends beyond text edge)
  // CRITICAL: For curved text with stroke, we need to add BOTH:
  // - curveExtension: how much curved text extends beyond original bounds
  // - strokeExtent: how much stroke extends beyond the text edge
  let strokePadding = 0
  if (completeEffectsConfig.strokes && completeEffectsConfig.strokes.length > 0) {
    strokePadding = calculateStrokesExtent(completeEffectsConfig.strokes, fontSize)
  } else if (completeEffectsConfig.stroke && completeEffectsConfig.stroke.width > 0) {
    strokePadding = completeEffectsConfig.stroke.width
  }

  // For curved text, add curve extension on top of stroke padding
  // because stroke wraps the curved text, which extends beyond original bounds
  const curveExtensionPadding = filterOptions.curveExtension || 0
  const totalStrokeCurvePadding = strokePadding + curveExtensionPadding

  // For text paths, use uniform padding (text can curve in any direction)
  // Combine bbox bounds with effect padding and stroke+curve padding
  const maxBboxPadding = Math.max(bounds.contentLeft, bounds.contentTop, bounds.contentRight, bounds.contentBottom)
  const maxEffectPadding = Math.max(effectPadding.left, effectPadding.top, effectPadding.right, effectPadding.bottom)
  const maxPadding = Math.max(maxBboxPadding, maxEffectPadding, totalStrokeCurvePadding) + SAFETY_MARGIN

  const finalWidth = width + maxPadding * 2
  const finalHeight = height + maxPadding * 2

  // Adjust SVG viewBox and size to fit actual content
  svgResult.svg.size(finalWidth, finalHeight)
  svgResult.svg.viewbox(-maxPadding, -maxPadding, finalWidth, finalHeight)

  // Wrap the render in a trackable promise
  const renderPromise = (async () => {
    try {
      // Convert to image
      const image = await svgToImage(svgResult.svg)

      // Cache the result for future reuse (skip if images aren't loaded to avoid caching grey fallback)
      const cacheResult: CachedTextPathRenderResult = {
        image,
        padding: maxPadding,
      }
      if (!hasUnloadedImagePaint(config, effectsConfig, loadedImages)) {
        setCachedResult(cacheKey, cacheResult)
      }

      const result: RenderSVGTextPathResult = {
        svg: svgResult.svg,
        image,
        padding: maxPadding,
      }

      // Store as last result for throttle fallback
      lastRenderResults.set(elementId, result)
      if (lastRenderResults.size > 20) {
        const firstKey = lastRenderResults.keys().next().value
        if (firstKey) lastRenderResults.delete(firstKey)
      }

      markRenderComplete()

      return result
    } finally {
      // Always clean up in-progress tracking, even on failure
      inProgressRenders.delete(cacheKey)
    }
  })()

  inProgressRenders.set(cacheKey, renderPromise)
  return renderPromise
}
