/**
 * SVG Filter Builder
 *
 * Builds native SVG filters for text effects (drop shadows, inner shadows, stroke).
 * These filters work natively in Safari without polyfills.
 *
 * @module shared/libraries/svg
 */

import type { Svg } from '@svgdotjs/svg.js'
import type { EffectsFilterConfig } from './svg-filter-types'
import type { LoadedImage } from '../paint/paint-renderer'
import {
  buildDropShadowPrimitive,
  buildInnerShadowPrimitive,
  buildBackgroundStrokePrimitive,
  buildFillOpacityPrimitive,
} from './svg-filter-primitives'
import { buildStrokesPrimitives, calculateStrokesExtent } from './svg-strokes-primitives'
import { resolveColor } from '../konva/effects/utils'
import { isSafari } from '../../../assets/utils/devices'

// Filter bounds constants
/** Safety padding added to filter bounds calculation */
const FILTER_BOUNDS_PADDING = 50
/**
 * Safari maximum filter bounds percentage
 * Safari has a filter area limit of ~6-10 million pixels.
 * iOS Safari can be even more restrictive.
 * 75% means filter bounds of -75% to +175% (2.5x each dimension, 6.25x area)
 * For a 1000x500 text: 6.25 * 1000 * 500 = 3.1 million pixels (safe)
 */
const SAFARI_MAX_FILTER_PERCENT = 75
/** Chrome/Firefox maximum filter bounds percentage */
const DEFAULT_MAX_FILTER_PERCENT = 200
/** Blur spread multiplier (blur extends ~1.5x radius due to Gaussian distribution) */
const BLUR_EXTENT_MULTIPLIER = 1.5

// Re-export types for consumers
export type {
  StrokeConfig,
  EffectsFilterConfig,
  DropShadowConfig,
  InnerShadowConfig,
  LegacyStrokeConfig,
} from './svg-filter-types'

// Re-export primitives for consumers
export {
  buildDropShadowPrimitive,
  buildInnerShadowPrimitive,
  buildBackgroundStrokePrimitive,
  buildFillOpacityPrimitive,
  buildBlurFilterXML,
  addBlurFilter,
  buildInnerShadowFilterXML,
  addInnerShadowFilter,
  buildDropShadowFilterXML,
  addDropShadowFilter,
  type FilterPrimitiveResult,
  type DropShadowFilterOptions,
} from './svg-filter-primitives'

/**
 * Filter visible shadow configurations
 */
function filterVisibleShadows<T extends { visible?: boolean }>(shadows: T[]): T[] {
  return shadows.filter(s => s.visible !== false)
}

/**
 * Calculate directional shadow extent (for asymmetric bounds)
 * Returns separate above/below/horizontal extents based on shadow offset direction
 */
function calculateDirectionalShadowExtent(
  radius: number,
  offsetX: number,
  offsetY: number
): { above: number; below: number; horizontal: number } {
  const blurExtent = radius * BLUR_EXTENT_MULTIPLIER
  // Horizontal extent: blur + absolute offsetX
  const horizontal = blurExtent + Math.abs(offsetX)
  // Shadow with negative offsetY casts upward (extends above)
  // Shadow with positive offsetY casts downward (extends below)
  if (offsetY < 0) {
    return { above: blurExtent + Math.abs(offsetY), below: blurExtent, horizontal }
  }
  if (offsetY > 0) {
    return { above: blurExtent, below: blurExtent + offsetY, horizontal }
  }
  // No offset - extends equally
  return { above: blurExtent, below: blurExtent, horizontal }
}

/**
 * Calculate filter bounds to accommodate shadow offsets, blur, and stroke
 *
 * Safari has a filter area limit of ~6-10 million pixels. We calculate bounds
 * dynamically based on actual effect sizes, but cap them for Safari to avoid
 * exceeding the limit.
 *
 * ASYMMETRIC BOUNDS OPTIMIZATION:
 * For curved text, the curve extends in ONE direction (up for positive bend,
 * down for negative bend). Instead of uniform expansion, we calculate
 * directional padding to reduce total filter area by ~30-50%.
 *
 * - curveBend > 0 (arc UP): more padding above, less below
 * - curveBend < 0 (arc DOWN): less padding above, more below
 * - curveBend = 0 (straight): symmetric padding
 *
 * For Chrome/Firefox, we use generous bounds to ensure effects are never clipped.
 */
export function calculateFilterBounds(
  config: EffectsFilterConfig,
  fontSize?: number,
  curveExtension?: number,
  curveBend?: number
): {
  x: string
  y: string
  width: string
  height: string
} {
  const { dropShadows, innerShadows, stroke, strokes } = config

  // Calculate directional shadow extents (above/below/horizontal)
  let shadowExtentAbove = 0
  let shadowExtentBelow = 0
  let shadowExtentHorizontal = 0

  // Check drop shadows (blur + offset extends directionally)
  for (const shadow of filterVisibleShadows(dropShadows)) {
    const blurRadius = shadow.radius || 0
    const offsetX = shadow.offsetX || 0
    const offsetY = shadow.offsetY || 0
    const { above, below, horizontal } = calculateDirectionalShadowExtent(blurRadius, offsetX, offsetY)
    shadowExtentAbove = Math.max(shadowExtentAbove, above)
    shadowExtentBelow = Math.max(shadowExtentBelow, below)
    shadowExtentHorizontal = Math.max(shadowExtentHorizontal, horizontal)
  }

  // Check inner shadows (only blur extends, stays within bounds - symmetric)
  for (const shadow of filterVisibleShadows(innerShadows)) {
    const blurExtent = (shadow.radius || 0) * BLUR_EXTENT_MULTIPLIER
    shadowExtentAbove = Math.max(shadowExtentAbove, blurExtent)
    shadowExtentBelow = Math.max(shadowExtentBelow, blurExtent)
    shadowExtentHorizontal = Math.max(shadowExtentHorizontal, blurExtent)
  }

  // Calculate stroke extent (separate from shadows)
  let strokeExtent = 0
  if (strokes && strokes.length > 0 && fontSize) {
    strokeExtent = calculateStrokesExtent(strokes, fontSize)
  } else if (stroke && stroke.width > 0) {
    // Legacy: single stroke
    strokeExtent = stroke.width
  }

  // Calculate horizontal extent (includes shadow offsetX)
  const horizontalExtent = Math.max(shadowExtentHorizontal, strokeExtent + (curveExtension || 0))

  // Calculate vertical extents based on curve direction
  let paddingAbove = shadowExtentAbove
  let paddingBelow = shadowExtentBelow

  // Text baseline extension (half of fontSize for descenders/ascenders)
  const textExtension = fontSize ? fontSize / 2 : 0

  if (curveBend !== undefined && curveBend !== 0 && curveExtension && curveExtension > 0) {
    // ASYMMETRIC: Expand more in curve direction
    if (curveBend > 0) {
      // Positive bend = arc UP: more space needed above
      paddingAbove = Math.max(paddingAbove, curveExtension + strokeExtent + textExtension)
      paddingBelow = Math.max(paddingBelow, textExtension + strokeExtent)
    } else {
      // Negative bend = arc DOWN: more space needed below
      paddingAbove = Math.max(paddingAbove, textExtension + strokeExtent)
      paddingBelow = Math.max(paddingBelow, curveExtension + strokeExtent + textExtension)
    }
  } else if (curveExtension && curveExtension > 0) {
    // Symmetric curve extension (no bend direction info - fallback)
    const totalCurveStroke = curveExtension + strokeExtent
    paddingAbove = Math.max(paddingAbove, totalCurveStroke)
    paddingBelow = Math.max(paddingBelow, totalCurveStroke)
  } else if (strokeExtent > 0) {
    // No curve, just stroke (symmetric)
    paddingAbove = Math.max(paddingAbove, strokeExtent)
    paddingBelow = Math.max(paddingBelow, strokeExtent)
  }

  // Convert to percentage (assuming ~100px base size) and add safety padding
  const maxPercent = isSafari() ? SAFARI_MAX_FILTER_PERCENT : DEFAULT_MAX_FILTER_PERCENT

  const xPercent = Math.min(Math.ceil((horizontalExtent / 100) * 100) + FILTER_BOUNDS_PADDING, maxPercent)
  const topPercent = Math.min(Math.ceil((paddingAbove / 100) * 100) + FILTER_BOUNDS_PADDING, maxPercent)
  const bottomPercent = Math.min(Math.ceil((paddingBelow / 100) * 100) + FILTER_BOUNDS_PADDING, maxPercent)

  const bounds = {
    x: `-${xPercent}%`,
    y: `-${topPercent}%`,
    width: `${100 + xPercent * 2}%`,
    height: `${100 + topPercent + bottomPercent}%`,
  }

  return bounds
}

/**
 * Calculate absolute filter bounds in pixels (userSpaceOnUse coordinates)
 *
 * This is used when we need precise alignment between filter primitives like feImage
 * and the filter region. Percentage-based bounds can misalign due to browser bbox calculations.
 *
 * Coordinate system for curved text:
 * - Text path origin is at (0, 0) to (textWidth, pathHeight)
 * - For curveBend > 0 (arc UP): curve apex is at y=0, path ends at y=pathHeight
 * - For curveBend < 0 (arc DOWN): curve apex is at y=pathHeight+curveExtension
 *
 * @returns Filter region in absolute pixel coordinates
 */
export function calculateAbsoluteFilterBounds(
  options: BuildEffectsFilterOptions,
  config: EffectsFilterConfig
): {
  x: number
  y: number
  width: number
  height: number
} {
  const { textWidth = 100, textHeight = 100, fontSize = 16, curveExtension = 0, curveBend } = options
  const { strokes, stroke } = config

  // Calculate stroke extent
  let strokeExtent = 0
  if (strokes && strokes.length > 0 && fontSize) {
    strokeExtent = calculateStrokesExtent(strokes, fontSize)
  } else if (stroke && stroke.width > 0) {
    strokeExtent = stroke.width
  }

  // Calculate shadow extents (for filter padding)
  let shadowPadding = 0
  const visibleDropShadows = filterVisibleShadows(config.dropShadows)
  for (const shadow of visibleDropShadows) {
    const blurRadius = shadow.radius || 0
    const offset = Math.max(Math.abs(shadow.offsetX || 0), Math.abs(shadow.offsetY || 0))
    shadowPadding = Math.max(shadowPadding, blurRadius * BLUR_EXTENT_MULTIPLIER + offset)
  }
  const visibleInnerShadows = filterVisibleShadows(config.innerShadows)
  for (const shadow of visibleInnerShadows) {
    shadowPadding = Math.max(shadowPadding, (shadow.radius || 0) * BLUR_EXTENT_MULTIPLIER)
  }

  // Parse curveBend as number
  const curveBendNum = curveBend !== undefined ? Number(curveBend) : 0

  // For curved text, add horizontal padding for text centering and glyph rotation
  // This must match the horizontalPadding calculated in svg-strokes-primitives.ts
  // The rotation angle at curve ends depends on curveBend:
  // - curveBend 100 = 90° rotation, characters extend by full fontSize
  // - curveBend 50 = 45° rotation, characters extend by fontSize * sin(45°) ≈ 0.7
  // For Safari, cap the padding to prevent filter region from being too large
  let horizontalPadding = 0
  if (curveExtension > 0) {
    // Calculate actual rotation at curve ends: curveBend 100 = 90 degrees
    const rotationRadians = (Math.abs(curveBendNum) * Math.PI) / 200
    const rotationFactor = Math.sin(rotationRadians)
    horizontalPadding = fontSize * rotationFactor

    // Safari has strict limits - cap horizontal padding to prevent total filter area exceeding limits
    if (isSafari()) {
      const maxSafeHorizontalPadding = fontSize * 0.6 // Cap at 60% of fontSize for Safari
      horizontalPadding = Math.min(horizontalPadding, maxSafeHorizontalPadding)
    }
  }

  // Total padding = stroke + shadow + safety margin + horizontal padding for curves
  const verticalPadding = strokeExtent + shadowPadding + FILTER_BOUNDS_PADDING
  const xPadding = verticalPadding + horizontalPadding

  // Calculate bounds based on curve direction
  // Text position: x from -xPadding to textWidth+xPadding
  // Y depends on curve direction
  let yStart: number
  let yEnd: number

  if (curveExtension > 0 && curveBendNum !== 0) {
    if (curveBendNum > 0) {
      // Arc UP: curve extends above, y from -curveExtension-padding to textHeight-curveExtension+padding
      // textHeight includes 2*curveExtension, so original height = textHeight - 2*curveExtension
      yStart = -curveExtension - verticalPadding
      yEnd = textHeight - curveExtension + verticalPadding
    } else {
      // Arc DOWN: curve extends below, y from -padding to textHeight-curveExtension+padding
      yStart = -verticalPadding
      yEnd = textHeight - curveExtension + verticalPadding
    }
  } else {
    // No curve: symmetric around the text
    yStart = -verticalPadding
    yEnd = textHeight + verticalPadding
  }

  const bounds = {
    x: -xPadding,
    y: yStart,
    width: textWidth + xPadding * 2,
    height: yEnd - yStart,
  }

  return bounds
}

/**
 * Extended configuration for building effects filter with Paint support
 */
export interface BuildEffectsFilterOptions {
  /** Text width for image pattern sizing */
  textWidth?: number
  /** Text height for image pattern sizing (may be expanded for curved text) */
  textHeight?: number
  /** Map of loaded images for image paint strokes */
  loadedImages?: Map<string, LoadedImage>
  /** Font size for stroke weight percentage conversion */
  fontSize?: number
  /** Vertical extension for curved text patterns (pattern starts at -curveExtension) */
  curveExtension?: number
  /** Curve bend percentage (-100 to 100) for asymmetric filter bounds optimization */
  curveBend?: number
  /**
   * Use absolute coordinates (userSpaceOnUse) for filter region instead of percentages.
   * This is required for curved text with image strokes to ensure feImage aligns correctly.
   * When true, filter region is calculated based on textWidth/textHeight + extensions.
   */
  useAbsoluteCoordinates?: boolean
}

/**
 * Build SVG filter XML string for all effects
 *
 * Render order (bottom to top):
 * 1. Drop shadows (knocked out from text)
 * 2. Outside stroke (feMorphology dilate + knockout) - if stroke exists
 * 3. Source graphic (with fill opacity)
 * 4. Inner shadows
 *
 * @param config - Effects filter configuration
 * @param filterId - Unique ID for the filter
 * @param options - Optional parameters for Paint-based strokes
 */
export function buildEffectsFilterXML(
  config: EffectsFilterConfig,
  filterId: string,
  options?: BuildEffectsFilterOptions
): string {
  const { dropShadows, innerShadows, fillOpacity = 1, stroke, strokes, textColor } = config
  const {
    textWidth = 100,
    textHeight = 100,
    loadedImages,
    fontSize,
    curveExtension,
    curveBend,
    useAbsoluteCoordinates,
  } = options || {}

  // Filter visible shadows and resolve colors
  const resolvedDropShadows = filterVisibleShadows(dropShadows).map(s => ({
    ...s,
    color: resolveColor(s.color, textColor),
  }))
  const resolvedInnerShadows = filterVisibleShadows(innerShadows).map(s => ({
    ...s,
    color: resolveColor(s.color, textColor),
  }))

  // Calculate filter bounds
  // Use absolute coordinates (userSpaceOnUse) for curved text with image strokes
  // to ensure feImage aligns correctly with the filter region
  let filterAttrs: string
  if (useAbsoluteCoordinates) {
    const absBounds = calculateAbsoluteFilterBounds(options || {}, config)
    filterAttrs = `x="${absBounds.x}" y="${absBounds.y}" width="${absBounds.width}" height="${absBounds.height}" filterUnits="userSpaceOnUse"`
  } else {
    const bounds = calculateFilterBounds(config, fontSize, curveExtension, curveBend)
    filterAttrs = `x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}"`
  }

  const defsXML: string[] = [] // For stroke patterns/gradients
  const filterPrimitives: string[] = []
  const mergeNodes: string[] = []

  // Calculate total stroke extent for drop shadow source
  // Drop shadow should be cast by the combined silhouette of (text + all strokes)
  let totalStrokeRadius = 0
  let hasVisibleStrokes = false
  if (strokes && strokes.length > 0 && fontSize) {
    hasVisibleStrokes = strokes.some(s => s.visible !== false && s.weight > 0)
    if (hasVisibleStrokes) {
      totalStrokeRadius = calculateStrokesExtent(strokes, fontSize)
    }
  } else if (stroke && stroke.width > 0) {
    totalStrokeRadius = stroke.width
    hasVisibleStrokes = true
  }

  // If there are strokes AND drop shadows, create a dilated silhouette first
  // This ensures drop shadow is cast by (text + strokes), not just text
  const useStrokeDilatedShadow = hasVisibleStrokes && resolvedDropShadows.length > 0 && totalStrokeRadius > 0
  if (useStrokeDilatedShadow) {
    // Create dilated silhouette for drop shadow calculation
    filterPrimitives.push(`
      <feMorphology in="SourceAlpha" operator="dilate" radius="${totalStrokeRadius}" result="stroke_dilated"/>
    `)
  }

  // Build drop shadow primitives (rendered first, behind everything including stroke)
  // Reverse order so first shadow in array renders on top (Figma behavior)
  // When strokes exist, use the dilated silhouette for shadow calculation
  const shadowSourceInput = useStrokeDilatedShadow ? 'stroke_dilated' : 'SourceAlpha'
  const shadowKnockoutSource = useStrokeDilatedShadow ? 'stroke_dilated' : 'SourceAlpha'
  for (let i = resolvedDropShadows.length - 1; i >= 0; i--) {
    const result = buildDropShadowPrimitive(resolvedDropShadows[i], `drop${i}`, {
      sourceInput: shadowSourceInput,
      knockoutSource: shadowKnockoutSource,
    })
    filterPrimitives.push(result.primitives)
    mergeNodes.push(result.mergeNode)
  }

  // Build strokes (TextStudio-style wrapping - each stroke wraps previous)
  // Strokes array takes precedence over legacy stroke
  if (strokes && strokes.length > 0 && fontSize) {
    const result = buildStrokesPrimitives(
      strokes,
      fontSize,
      filterId,
      textWidth,
      textHeight,
      loadedImages,
      curveExtension,
      curveBend
    )
    if (result.defsXML) {
      defsXML.push(result.defsXML)
    }
    filterPrimitives.push(result.primitives)
    mergeNodes.push(...result.mergeNodes)
  } else if (stroke && stroke.width > 0) {
    // Legacy stroke support
    const result = buildBackgroundStrokePrimitive(resolveColor(stroke.color), stroke.width)
    filterPrimitives.push(result.primitives)
    mergeNodes.push(result.mergeNode)
  }

  // Build fill opacity primitive (source graphic with opacity)
  const fillResult = buildFillOpacityPrimitive(fillOpacity)
  if (fillResult.primitives) {
    filterPrimitives.push(fillResult.primitives)
  }
  mergeNodes.push(fillResult.mergeNode)

  // Build inner shadow primitives (rendered on top of source)
  // Reverse order so first shadow in array renders on top (Figma behavior)
  for (let i = resolvedInnerShadows.length - 1; i >= 0; i--) {
    const result = buildInnerShadowPrimitive(resolvedInnerShadows[i], `inner${i}`)
    filterPrimitives.push(result.primitives)
    mergeNodes.push(result.mergeNode)
  }

  // Build final merge
  const mergeXML = mergeNodes.length > 0 ? `<feMerge>${mergeNodes.join('\n')}</feMerge>` : ''

  // Combine defs and filter
  // Note: defsXML contains patterns/gradients that must be siblings of the filter, not inside it
  const defsContent = defsXML.join('\n')

  // color-interpolation-filters="sRGB" ensures consistent color blending across browsers
  // Safari may use linearRGB by default which causes different blending results
  const filterXML = `
    <filter id="${filterId}" ${filterAttrs} color-interpolation-filters="sRGB">
      ${filterPrimitives.join('\n')}
      ${mergeXML}
    </filter>
  `

  // Return defs first, then filter (defs must be parsed before filter references them)
  return defsContent ? `${defsContent}\n${filterXML}` : filterXML
}

/**
 * Add effects filter to SVG defs
 * Only call this when there are visible effects (use hasVisibleEffects to check)
 * fillOpacity is handled within the filter when effects exist
 *
 * @param svg - SVG.js instance
 * @param config - Effects filter configuration
 * @param filterId - Unique ID for the filter
 * @param options - Optional parameters for Paint-based strokes
 */
export function addEffectsFilter(
  svg: Svg,
  config: EffectsFilterConfig,
  filterId: string,
  options?: BuildEffectsFilterOptions
): void {
  // Check if we need any effects (defensive check)
  if (!hasVisibleEffects(config)) {
    return // No effects needed
  }

  // Get or create defs
  const defs = svg.defs()

  // Build filter XML (includes stroke pattern/gradient defs if needed)
  const filterXML = buildEffectsFilterXML(config, filterId, options)

  // Add filter using raw SVG
  defs.svg(filterXML)
}

/**
 * Apply filter to text element(s)
 *
 * Filter application priority:
 * 1. .text-layers-group - Native stroke rendering wraps all layers in a group
 *    Applying filter to the group ensures drop shadow is cast by the combined
 *    silhouette of (text + all strokes), not by each layer separately.
 * 2. .text-fill - When stroke is separated from fill (for Figma-like behavior)
 * 3. All text elements - Backwards compatibility fallback
 */
export function applyFilterToText(svg: Svg, filterId: string): void {
  // Priority 1: Native stroke group (unified shadow for text + strokes)
  // When all text layers are wrapped in a group, apply filter to the group
  // so drop shadow is cast by the combined silhouette
  const textLayersGroup = svg.find('g.text-layers-group')
  if (textLayersGroup.length > 0) {
    for (const group of textLayersGroup) {
      group.attr('filter', `url(#${filterId})`)
    }
    return
  }

  // Priority 2: Try to find fill-only elements (when stroke is separated)
  const fillElements = svg.find('text.text-fill')
  if (fillElements.length > 0) {
    // Apply filter only to fill elements, stroke elements remain unaffected
    for (const text of fillElements) {
      text.attr('filter', `url(#${filterId})`)
    }
    return
  }

  // Priority 3: Fallback to all text elements (backwards compatibility)
  const textElements = svg.find('text')
  for (const text of textElements) {
    text.attr('filter', `url(#${filterId})`)
  }
}

/**
 * Check if config has any visible effects (shadows or stroke)
 * Note: fillOpacity is handled separately - only via filter when effects exist,
 * otherwise via fill-opacity attribute on text element
 */
export function hasVisibleEffects(config: EffectsFilterConfig): boolean {
  const { dropShadows, innerShadows, stroke, strokes } = config

  const hasDropShadow = filterVisibleShadows(dropShadows).length > 0
  const hasInnerShadow = filterVisibleShadows(innerShadows).length > 0

  // Check for strokes array (TextStudio-style)
  const hasStrokesArray = strokes?.some(s => s.visible !== false && s.weight > 0) ?? false

  // Check for legacy stroke (simple color + width)
  const hasLegacyStroke = Boolean(stroke && stroke.width > 0)

  // Return true for shadows or any stroke
  return hasDropShadow || hasInnerShadow || hasStrokesArray || hasLegacyStroke
}
