/**
 * SVG Filter Primitives
 *
 * Low-level composable filter primitives for building SVG filters.
 * Each primitive returns filter XML strings and merge nodes that can be combined.
 *
 * @module shared/libraries/svg
 */

import type { Svg } from '@svgdotjs/svg.js'
import type { DropShadowConfig, InnerShadowConfig } from './svg-filter-types'
import { toFloodColor, getFloodOpacity } from './svg-color-utils'
import { isSafari } from '../../../assets/utils/devices'

/**
 * Result from a filter primitive builder
 */
export interface FilterPrimitiveResult {
  /** SVG filter primitive XML (feGaussianBlur, feOffset, etc.) */
  primitives: string
  /** feMergeNode XML for compositing order */
  mergeNode: string
}

/**
 * Options for building drop shadow primitive
 */
export interface DropShadowPrimitiveOptions {
  /**
   * Custom source input for shadow calculation.
   * - "SourceAlpha" (default): Use original text shape
   * - Custom name: Use a pre-dilated shape (for shadows that include strokes)
   */
  sourceInput?: string
  /**
   * Custom knockout source for the "out" composite.
   * - "SourceAlpha" (default): Knockout from original text
   * - Custom name: Knockout from dilated shape (for shadows that include strokes)
   */
  knockoutSource?: string
}

/**
 * Build drop shadow filter primitive
 * Creates knocked-out shadow that renders behind text
 *
 * @param shadow - Shadow configuration
 * @param prefix - Unique prefix for result names
 * @param options - Options for custom source input
 */
export function buildDropShadowPrimitive(
  shadow: DropShadowConfig,
  prefix: string,
  options: DropShadowPrimitiveOptions = {}
): FilterPrimitiveResult {
  const { sourceInput = 'SourceAlpha', knockoutSource = 'SourceAlpha' } = options
  const blurStdDev = (shadow.radius || 0) / 2 // SVG stdDeviation is roughly half of CSS blur radius
  const floodColor = toFloodColor(shadow.color)
  const floodOpacity = getFloodOpacity(shadow.color, shadow.opacity)

  const primitives = `
    <feGaussianBlur in="${sourceInput}" stdDeviation="${blurStdDev}" result="${prefix}_blur"/>
    <feOffset in="${prefix}_blur" dx="${shadow.offsetX || 0}" dy="${shadow.offsetY || 0}" result="${prefix}_offset"/>
    <feFlood flood-color="${floodColor}" flood-opacity="${floodOpacity}" result="${prefix}_color"/>
    <feComposite in="${prefix}_color" in2="${prefix}_offset" operator="in" result="${prefix}_shadow"/>
    <feComposite in="${prefix}_shadow" in2="${knockoutSource}" operator="out" result="${prefix}_knockout"/>
  `

  return {
    primitives,
    mergeNode: `<feMergeNode in="${prefix}_knockout"/>`,
  }
}

/**
 * Build inner shadow filter primitive
 * Creates shadow clipped to text interior
 */
export function buildInnerShadowPrimitive(shadow: InnerShadowConfig, prefix: string): FilterPrimitiveResult {
  const blurStdDev = (shadow.radius || 0) / 2
  const floodColor = toFloodColor(shadow.color)
  const floodOpacity = getFloodOpacity(shadow.color, shadow.opacity)

  const primitives = `
    <feFlood flood-color="${floodColor}" flood-opacity="${floodOpacity}" result="${prefix}_flood"/>
    <feComposite in="${prefix}_flood" in2="SourceAlpha" operator="out" result="${prefix}_invert"/>
    <feOffset in="${prefix}_invert" dx="${shadow.offsetX || 0}" dy="${shadow.offsetY || 0}" result="${prefix}_offset"/>
    <feGaussianBlur in="${prefix}_offset" stdDeviation="${blurStdDev}" result="${prefix}_blur"/>
    <feComposite in="${prefix}_blur" in2="SourceAlpha" operator="in" result="${prefix}_shadow"/>
  `

  return {
    primitives,
    mergeNode: `<feMergeNode in="${prefix}_shadow"/>`,
  }
}

/**
 * Build background stroke filter primitive using feMorphology
 *
 * Creates a solid color stroke that renders OUTSIDE the text shape only.
 * The text interior is knocked out so strokes don't bleed into the fill area
 * when fillOpacity < 1 (e.g., deboss effect).
 *
 * For Paint-based strokes (images, gradients), use the strokes array
 * with buildStrokesPrimitives from svg-strokes-primitives.ts instead.
 */
export function buildBackgroundStrokePrimitive(strokeColor: string, strokeWidth: number): FilterPrimitiveResult {
  const floodColor = toFloodColor(strokeColor)
  const floodOpacity = getFloodOpacity(strokeColor)

  // Background stroke with text interior knockout:
  // 1. Dilate to create stroke shape
  // 2. Apply color
  // 3. Knockout SourceAlpha (text interior) - ensures stroke only renders OUTSIDE
  // Note: vertices option (round/miter/bevel) reserved for future implementation
  const primitives = `
    <feMorphology in="SourceAlpha" operator="dilate" radius="${strokeWidth}" result="stroke_dilated"/>
    <feFlood flood-color="${floodColor}" flood-opacity="${floodOpacity}" result="stroke_color"/>
    <feComposite in="stroke_color" in2="stroke_dilated" operator="in" result="stroke_colored_temp"/>
    <feComposite in="stroke_colored_temp" in2="SourceAlpha" operator="out" result="stroke_colored"/>
  `

  return {
    primitives,
    mergeNode: `<feMergeNode in="stroke_colored"/>`,
  }
}

/**
 * Build fill opacity filter primitive
 * Adjusts source graphic alpha
 */
export function buildFillOpacityPrimitive(fillOpacity: number): FilterPrimitiveResult {
  if (fillOpacity < 1) {
    return {
      primitives: `
        <feComponentTransfer in="SourceGraphic" result="fadedSource">
          <feFuncA type="linear" slope="${fillOpacity}"/>
        </feComponentTransfer>
      `,
      mergeNode: `<feMergeNode in="fadedSource"/>`,
    }
  }

  // Full opacity - just use source graphic directly
  return {
    primitives: '',
    mergeNode: `<feMergeNode in="SourceGraphic"/>`,
  }
}

/**
 * Build blur-only filter XML (complete filter)
 * Used for standalone blur effects
 */
export function buildBlurFilterXML(blurRadius: number, filterId: string): string {
  const stdDev = blurRadius / 2
  return `
    <filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${stdDev}"/>
    </filter>
  `
}

/**
 * Add blur filter to SVG defs
 */
export function addBlurFilter(svg: Svg, blurRadius: number, filterId: string): void {
  const defs = svg.defs()
  const filterXML = buildBlurFilterXML(blurRadius, filterId)
  defs.svg(filterXML)
}

/**
 * Build inner-shadow-only filter XML (complete filter)
 * Used when drop shadows are rendered as separate elements
 */
export function buildInnerShadowFilterXML(
  innerShadows: InnerShadowConfig[],
  fillOpacity: number,
  filterId: string
): string {
  const visibleInnerShadows = innerShadows.filter(s => s.visible !== false)
  if (visibleInnerShadows.length === 0 && fillOpacity >= 1) {
    return ''
  }

  const filterPrimitives: string[] = []
  const mergeNodes: string[] = []

  // Add fill opacity primitive
  const fillResult = buildFillOpacityPrimitive(fillOpacity)
  if (fillResult.primitives) {
    filterPrimitives.push(fillResult.primitives)
  }
  mergeNodes.push(fillResult.mergeNode)

  // Add inner shadow primitives
  // Reverse order so first shadow in array renders on top (Figma behavior)
  for (let i = visibleInnerShadows.length - 1; i >= 0; i--) {
    const result = buildInnerShadowPrimitive(visibleInnerShadows[i], `inner${i}`)
    filterPrimitives.push(result.primitives)
    mergeNodes.push(result.mergeNode)
  }

  const mergeXML = `<feMerge>${mergeNodes.join('\n')}</feMerge>`

  return `
    <filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
      ${filterPrimitives.join('\n')}
      ${mergeXML}
    </filter>
  `
}

/**
 * Add inner-shadow-only filter to SVG defs
 */
export function addInnerShadowFilter(
  svg: Svg,
  innerShadows: InnerShadowConfig[],
  fillOpacity: number,
  filterId: string
): void {
  const filterXML = buildInnerShadowFilterXML(innerShadows, fillOpacity, filterId)
  if (!filterXML) return
  const defs = svg.defs()
  defs.svg(filterXML)
}

/**
 * Options for building drop shadow filter
 */
export interface DropShadowFilterOptions {
  /**
   * Include SourceGraphic in the filter output.
   * - false (default): Only output shadows (used for layered approach)
   * - true: Output shadows + SourceGraphic (used for group-based approach)
   */
  includeSourceGraphic?: boolean
}

/**
 * Build drop shadow filter XML
 *
 * Safari has a filter area limit of ~6-10 million pixels, so we cap the
 * filter bounds to avoid silent rendering failures on larger SVGs.
 *
 * @param dropShadows - Drop shadow configurations
 * @param filterId - Unique filter ID
 * @param options - Filter options
 */
export function buildDropShadowFilterXML(
  dropShadows: DropShadowConfig[],
  filterId: string,
  options: DropShadowFilterOptions = {}
): string {
  const { includeSourceGraphic = false } = options
  const visibleDropShadows = dropShadows.filter(s => s.visible !== false)

  if (visibleDropShadows.length === 0) {
    return ''
  }

  // Calculate bounds based on shadow extent
  let maxExtent = 0
  for (const shadow of visibleDropShadows) {
    const extent = (shadow.radius || 0) * 3 + Math.max(Math.abs(shadow.offsetX || 0), Math.abs(shadow.offsetY || 0))
    maxExtent = Math.max(maxExtent, extent)
  }
  const padding = maxExtent + 20
  let percent = Math.ceil((padding / 100) * 100) + 50

  // Safari: Cap filter bounds to avoid exceeding filter area limits
  // Using 100% keeps the area multiplier at 9x (3x width * 3x height)
  if (isSafari()) {
    percent = Math.min(percent, 100)
  }

  const filterPrimitives: string[] = []
  const mergeNodes: string[] = []

  // Add drop shadow primitives
  // Reverse order so first shadow in array renders on top (Figma behavior)
  for (let i = visibleDropShadows.length - 1; i >= 0; i--) {
    const result = buildDropShadowPrimitive(visibleDropShadows[i], `drop${i}`)
    filterPrimitives.push(result.primitives)
    mergeNodes.push(result.mergeNode)
  }

  // Optionally include SourceGraphic on top of shadows
  if (includeSourceGraphic) {
    mergeNodes.push('<feMergeNode in="SourceGraphic"/>')
  }

  const mergeXML = `<feMerge>${mergeNodes.join('\n')}</feMerge>`

  return `
    <filter
      id="${filterId}"
      x="-${percent}%" y="-${percent}%"
      width="${200 + percent * 2}%" height="${200 + percent * 2}%"
      color-interpolation-filters="sRGB">
      ${filterPrimitives.join('\n')}
      ${mergeXML}
    </filter>
  `
}

/**
 * Add drop shadow filter to SVG defs
 *
 * @param svg - SVG.js instance
 * @param dropShadows - Drop shadow configurations
 * @param filterId - Unique filter ID
 * @param options - Filter options (includeSourceGraphic for group-based approach)
 */
export function addDropShadowFilter(
  svg: Svg,
  dropShadows: DropShadowConfig[],
  filterId: string,
  options: DropShadowFilterOptions = {}
): void {
  const filterXML = buildDropShadowFilterXML(dropShadows, filterId, options)
  if (!filterXML) return
  const defs = svg.defs()
  defs.svg(filterXML)
}
