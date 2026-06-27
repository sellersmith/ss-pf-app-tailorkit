/**
 * SVG Text Path Creator
 *
 * Creates SVG text elements that follow a path.
 * Uses single-element rendering approach with SVG filters:
 * - Outside stroke: feMorphology dilate + knockout (true outside stroke)
 * - Drop shadows: Knocked out from text, rendered behind stroke
 * - Inner shadows: Clipped to text area, rendered on top
 *
 * This approach works with transparent fills because:
 * - Stroke is ONLY outside the text (no overlap with text interior)
 * - Shadows don't overlap with text area (knockout technique)
 *
 * @module shared/libraries/svg
 */

import { SVG, type Svg } from '@svgdotjs/svg.js'
import type { DropShadowConfig, InnerShadowConfig } from '../konva/effects/types'
import { normalizeFontWeight, embedFontInSvg } from './svg-font-manager'
import { type EffectForPadding } from './svg-padding-calculator'
import { getTextAnchor, getTextPathStartOffset, type TextAlign } from './svg-text-layout'
import type { Paint } from '../paint/paint-types'
import { isSolidPaint, isImagePaint, isGradientPaint } from '../paint/paint-types'
import {
  resolvePaintToFill,
  getFillValue,
  addImageFillPattern,
  buildLinearGradientXML,
  buildRadialGradientXML,
  type LoadedImage,
} from '../paint/paint-renderer'
import type { StrokeConfig } from '../paint/stroke-types'
import { getStrokeEffectiveOpacity } from '../paint/stroke-types'
import { strokePercentToPixels } from '../konva/effects/relative-shadow-utils'

/**
 * Minimum initial padding for measurement.
 * This ensures we have enough space to capture effects like shadows.
 */
const MIN_INITIAL_PADDING = 100

/**
 * Calculate expanded pattern bounds for curved text
 *
 * When text follows a curved path, it extends beyond the original bounds.
 * This calculates dimensions large enough to cover the full curved text area.
 *
 * @param width - Original text width
 * @param height - Original text height
 * @param fontSize - Font size for text extension calculation
 * @param curveBend - Curve bend percentage (-100 to 100)
 * @returns Expanded pattern dimensions
 */
function calculateCurvedPatternBounds(
  width: number,
  height: number,
  fontSize: number,
  curveBend: number = 0
): { patternWidth: number; patternHeight: number } {
  // No curve = original bounds
  if (curveBend === 0) {
    return { patternWidth: width, patternHeight: height }
  }

  // Curve amplitude (how much path deviates from center)
  const amplitude = (Math.abs(curveBend) / 100) * (height / 2)

  // Text extends beyond path by approximately half font size
  const textExtension = fontSize / 2

  // Total vertical extension on each side
  const totalExtension = amplitude + textExtension

  return {
    patternWidth: width,
    patternHeight: height + totalExtension * 2,
  }
}

/**
 * Configuration for creating SVG text on a path
 */
export interface SVGTextPathConfig {
  content: string
  width: number
  height: number
  fontSize: number
  fontFamily: string
  fontWeight?: string | number
  fontStyle?: string
  fontBase64Css?: string | null
  /** Legacy color prop - use fill for new implementations */
  color: string
  /** Paint fill (takes precedence over color) */
  fill?: Paint
  /** Pre-loaded image data for ImagePaint fills */
  loadedImages?: Map<string, LoadedImage>
  letterSpacing?: number
  textDecoration?: string
  fillOpacity?: number
  pathData: string
  textBaseline?: 'top' | 'middle' | 'bottom' | 'alphabetic' | 'hanging'
  align?: TextAlign
  effects?: EffectForPadding[]
  stroke?: string
  strokeWidth?: number
  dropShadows?: DropShadowConfig[]
  innerShadows?: InnerShadowConfig[]
  /** Curve bend percentage for pattern bounds calculation (-100 to 100) */
  curveBend?: number
}

/**
 * Result of creating SVG text path
 */
export interface SVGTextPathResult {
  svg: Svg
  /** Initial padding used for measurement (content is offset by this amount) */
  initialPadding: number
}

/**
 * Create SVG container with text on path
 *
 * Uses single-element approach with combined SVG filter:
 * - Stroke is rendered via feMorphology (true outside stroke, no overlap with text)
 * - Drop shadows are knocked out from text and rendered behind stroke
 * - Inner shadows are clipped to text area and rendered on top
 * - Fill opacity is handled by feComponentTransfer in the filter
 *
 * When no effects exist, fillOpacity is applied directly to the element.
 */
export function createSVGTextPath(config: SVGTextPathConfig): SVGTextPathResult {
  const {
    content,
    width,
    height,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    fontBase64Css,
    color,
    fill,
    loadedImages,
    letterSpacing = 0,
    textDecoration,
    fillOpacity = 1,
    pathData,
    textBaseline = 'alphabetic',
    align = 'center',
    stroke,
    strokeWidth,
    dropShadows = [],
    innerShadows = [],
    curveBend = 0,
  } = config

  // Filter visible effects
  const visibleDropShadows = dropShadows.filter(s => s.visible !== false)
  const visibleInnerShadows = innerShadows.filter(s => s.visible !== false)

  // Determine rendering approach
  const hasStroke = stroke && strokeWidth && strokeWidth > 0
  const hasDropShadow = visibleDropShadows.length > 0
  const hasInnerShadow = visibleInnerShadows.length > 0

  // Check if text is italic
  const fontStyleLower = (fontStyle || '').toLowerCase()
  const isItalic = fontStyleLower.includes('italic')
  const hasBoldInStyle = fontStyleLower.includes('bold')

  // Use generous initial padding to ensure nothing is clipped during measurement
  // This will be trimmed by the orchestrator after measuring actual bounds
  const initialPadding = Math.max(fontSize * 2, MIN_INITIAL_PADDING)

  // Create SVG container with generous bounds
  const svg = SVG().size(width + initialPadding * 2, height + initialPadding * 2)

  // Set viewBox to offset the coordinate system
  svg.viewbox(-initialPadding, -initialPadding, width + initialPadding * 2, height + initialPadding * 2)

  // Embed font in SVG for standalone rendering
  embedFontInSvg(svg, fontFamily, fontBase64Css)

  // Calculate text anchor and start offset for alignment
  const textAnchor = getTextAnchor(align)
  const startOffset = getTextPathStartOffset(align)

  // Build inline CSS styles
  const inlineStyles: string[] = []
  if (fontWeight || hasBoldInStyle) {
    const weight = fontWeight ? normalizeFontWeight(fontWeight) : '700'
    inlineStyles.push(`font-weight: ${weight === '700' ? 'bold' : weight};`)
  }
  if (isItalic) inlineStyles.push('font-style: italic;')
  if (letterSpacing) inlineStyles.push(`letter-spacing: ${letterSpacing}px;`)
  if (textDecoration) inlineStyles.push(`text-decoration: ${textDecoration};`)

  /** Helper to create a text-on-path element */
  const createTextPathElement = (
    fillColor: string,
    strokeConfig: { color: string; width: number } | null,
    className: string,
    applyFillOpacity: boolean
  ) => {
    const textElement = svg.text('')
    const textPath = textElement.path(pathData)
    textPath.text(content)
    textPath.attr({ startOffset })

    textElement.fill(fillColor)
    textElement.attr({
      'text-anchor': textAnchor,
      'font-size': fontSize,
      'font-family': fontFamily,
      'dominant-baseline': textBaseline,
      class: className,
    })

    if (strokeConfig) {
      textElement.stroke({ color: strokeConfig.color, width: strokeConfig.width })
    }

    const elementStyles = [...inlineStyles]
    if (applyFillOpacity && fillOpacity < 1) {
      elementStyles.push(`fill-opacity: ${fillOpacity};`)
    }
    if (elementStyles.length > 0) {
      textElement.attr('style', elementStyles.join(' '))
    }

    return textElement
  }

  // Determine if any effects exist (stroke, drop shadow, inner shadow)
  // When effects exist, the combined filter handles everything
  const hasAnyEffects = hasStroke || hasDropShadow || hasInnerShadow

  // Resolve fill to SVG fill value
  // Paint fill takes precedence over legacy color prop
  const resolveFillValue = (): string => {
    if (fill) {
      // Calculate expanded bounds for curved text patterns
      // This ensures image fills cover the entire curved text area
      const { patternWidth, patternHeight } = calculateCurvedPatternBounds(width, height, fontSize, curveBend)

      // Calculate the curve extension for pattern positioning
      // Curves extend vertically by (amplitude + fontSize/2) in both directions
      // The pattern origin must be offset to cover this extended area
      let patternOriginY = 0
      if (curveBend !== 0) {
        const amplitude = (Math.abs(curveBend) / 100) * (height / 2)
        const textExtension = fontSize / 2
        const totalExtension = amplitude + textExtension
        // Pattern starts at the top of the extended area (negative offset)
        patternOriginY = -totalExtension
      }

      // Pattern origin: x stays at 0 (curves don't extend horizontally much)
      // y is offset by the curve extension to cover the full curved text area
      const patternOrigin = { x: 0, y: patternOriginY }

      // Use new Paint system with expanded bounds and proper origin
      const fillResult = resolvePaintToFill(
        svg,
        fill,
        `text-path-fill-${Date.now()}`,
        patternWidth,
        patternHeight,
        loadedImages,
        patternOrigin
      )
      return getFillValue(fillResult)
    }
    // Fallback to legacy color prop
    return color
  }

  const resolvedFillValue = resolveFillValue()

  // SINGLE ELEMENT APPROACH: Filter handles all effects via feMorphology
  // - Stroke: feMorphology dilate creates true outside stroke (no overlap with text)
  // - Drop shadows: Knocked out from text, rendered behind stroke
  // - Inner shadows: Clipped to text area, rendered on top
  // - Fill opacity: Handled by feComponentTransfer in filter
  createTextPathElement(
    resolvedFillValue,
    null, // No stroke on element - filter handles it via feMorphology
    'text-fill',
    !hasAnyEffects // Apply fillOpacity directly only when no effects (no filter)
  )

  return { svg, initialPadding }
}

// ============================================
// Native Stroke Rendering (No Filter Required)
// ============================================

/**
 * Extended configuration for SVG text path with native strokes
 */
export interface SVGTextPathWithNativeStrokesConfig extends SVGTextPathConfig {
  /** Multiple strokes array (TextStudio-style wrapping) */
  strokes?: StrokeConfig[]
}

/**
 * Create stroke pattern and return its ID
 *
 * @param svg - SVG element to add pattern to
 * @param stroke - Stroke configuration
 * @param patternId - Unique ID for the pattern
 * @param textWidth - Text bounds width
 * @param textHeight - Text bounds height (may be expanded for curves)
 * @param loadedImages - Pre-loaded image data
 * @param patternOrigin - Pattern origin offset for curved text
 */
function createStrokePattern(
  svg: Svg,
  stroke: StrokeConfig,
  patternId: string,
  textWidth: number,
  textHeight: number,
  loadedImages?: Map<string, LoadedImage>,
  patternOrigin?: { x: number; y: number }
): string {
  const { paint } = stroke

  if (!paint) {
    // No paint - use transparent (shouldn't happen for valid strokes)
    return 'none'
  }

  if (isSolidPaint(paint)) {
    // Solid color - return color directly
    const opacity = getStrokeEffectiveOpacity(stroke)
    if (opacity < 1) {
      // Add opacity to color using rgba
      const color = paint.color
      // Simple opacity application - could be improved to parse color properly
      return `rgba(${color}, ${opacity})`
    }
    return paint.color
  }

  if (isImagePaint(paint)) {
    // Image paint - create pattern
    const loadedImage = loadedImages?.get(paint.imageRef)
    if (!loadedImage) {
      // Image not loaded - fallback to gray
      return '#808080'
    }

    // Add pattern to SVG defs
    addImageFillPattern(svg, paint, patternId, textWidth, textHeight, loadedImage, patternOrigin)
    return `url(#${patternId})`
  }

  if (isGradientPaint(paint)) {
    // Gradient paint - create gradient
    const gradientId = `${patternId}-grad`
    let gradientXML: string

    if (paint.type === 'GRADIENT_RADIAL') {
      gradientXML = buildRadialGradientXML(paint.stops, gradientId, paint.transform)
    } else {
      // Linear, angular, diamond all use linear gradient XML
      gradientXML = buildLinearGradientXML(paint.stops, gradientId, paint.transform)
    }

    // Add gradient to SVG defs
    const defs = svg.defs()
    defs.svg(gradientXML)
    return `url(#${gradientId})`
  }

  // Unknown paint type
  return '#808080'
}

/**
 * Create SVG text path with NATIVE strokes (no filter required)
 *
 * This approach renders text multiple times with decreasing stroke widths:
 * - Outermost stroke first (behind everything)
 * - Each inner stroke next
 * - Fill layer last (on top)
 *
 * BENEFITS:
 * - No filter region needed for strokes
 * - Works at any size on Safari
 * - Pattern follows the curve automatically
 * - Better performance than filter-based approach
 *
 * NOTE: This function is for curved text with image/gradient strokes where
 * the filter-based approach would fail due to Safari's pixel limits.
 */
export function createSVGTextPathWithNativeStrokes(config: SVGTextPathWithNativeStrokesConfig): SVGTextPathResult {
  const {
    content,
    width,
    height,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    fontBase64Css,
    color,
    fill,
    loadedImages,
    letterSpacing = 0,
    textDecoration,
    fillOpacity = 1,
    pathData,
    textBaseline = 'alphabetic',
    align = 'center',
    strokes = [],
    curveBend = 0,
  } = config

  // Check if text is italic
  const fontStyleLower = (fontStyle || '').toLowerCase()
  const isItalic = fontStyleLower.includes('italic')
  const hasBoldInStyle = fontStyleLower.includes('bold')

  // Calculate expanded bounds for curved text patterns
  const { patternWidth, patternHeight } = calculateCurvedPatternBounds(width, height, fontSize, curveBend)

  // Calculate pattern origin offset for curved text
  let patternOriginY = 0
  if (curveBend !== 0) {
    const amplitude = (Math.abs(curveBend) / 100) * (height / 2)
    const textExtension = fontSize / 2
    const totalExtension = amplitude + textExtension
    patternOriginY = -totalExtension
  }
  const patternOrigin = { x: 0, y: patternOriginY }

  // Use generous initial padding for measurement
  const initialPadding = Math.max(fontSize * 2, MIN_INITIAL_PADDING)

  // Create SVG container
  const svg = SVG().size(width + initialPadding * 2, height + initialPadding * 2)
  svg.viewbox(-initialPadding, -initialPadding, width + initialPadding * 2, height + initialPadding * 2)

  // Embed font
  embedFontInSvg(svg, fontFamily, fontBase64Css)

  // Calculate text anchor and start offset
  const textAnchor = getTextAnchor(align)
  const startOffset = getTextPathStartOffset(align)

  // Build inline styles
  const inlineStyles: string[] = []
  if (fontWeight || hasBoldInStyle) {
    const weight = fontWeight ? normalizeFontWeight(fontWeight) : '700'
    inlineStyles.push(`font-weight: ${weight === '700' ? 'bold' : weight};`)
  }
  if (isItalic) inlineStyles.push('font-style: italic;')
  if (letterSpacing) inlineStyles.push(`letter-spacing: ${letterSpacing}px;`)
  if (textDecoration) inlineStyles.push(`text-decoration: ${textDecoration};`)

  // Resolve fill value
  const resolvedFillValue = (() => {
    if (fill) {
      const fillResult = resolvePaintToFill(
        svg,
        fill,
        'text-path-fill',
        patternWidth,
        patternHeight,
        loadedImages,
        patternOrigin
      )
      return getFillValue(fillResult)
    }
    return color
  })()

  // Filter visible strokes and calculate cumulative widths
  const visibleStrokes = strokes.filter(s => s.visible !== false && s.weight > 0)

  // Calculate total cumulative stroke width for shadow source
  let totalCumulativeWidth = 0
  for (const stroke of visibleStrokes) {
    totalCumulativeWidth += strokePercentToPixels(stroke.weight, fontSize)
  }

  // Create SHADOW SOURCE element for drop shadow (placed BEFORE visible layers)
  // This element:
  // - Uses solid black (no patterns) - avoids Safari bug with filters on groups containing pattern fills
  // - Has stroke-width covering full silhouette (text + all strokes)
  // - Filter outputs ONLY the shadow (no SourceGraphic) so original shape is invisible
  // - Renders behind visible text layers
  //
  // SAFARI BUG: When filter is applied to a <g> containing children with url() pattern fills,
  // Safari fails to render the patterns correctly. By using a separate shadow source element
  // with solid colors, we avoid this issue while still getting correct shadow shape.
  if (totalCumulativeWidth > 0) {
    const shadowSource = svg.text('')
    shadowSource.addClass('shadow-source')
    const shadowPath = shadowSource.path(pathData)
    shadowPath.text(content)
    shadowPath.attr({ startOffset })

    shadowSource.attr({
      'text-anchor': textAnchor,
      'font-size': fontSize,
      'font-family': fontFamily,
      'dominant-baseline': textBaseline,
      fill: 'black',
      stroke: 'black',
      'stroke-width': totalCumulativeWidth * 2,
    })

    // Apply same styles for consistent shape
    const shadowStyles = [...inlineStyles, 'paint-order: stroke fill;']
    if (shadowStyles.length > 0) {
      shadowSource.attr('style', shadowStyles.join(' '))
    }
  }

  // Create stroke knockout mask ONLY when there are visible strokes
  // This prevents strokes from bleeding into fill area when fillOpacity < 1 (e.g., deboss effect)
  // Mask has: white background (visible) + black text shape (hidden/knockout)
  const strokeMaskId = 'stroke-knockout-mask'
  if (visibleStrokes.length > 0) {
    const defs = svg.defs()
    const mask = defs.mask().id(strokeMaskId)
    mask.rect('200%', '200%').move('-50%', '-50%').fill('white')

    // Add text shape to mask (black = knockout area)
    const maskText = mask.text('')
    const maskPath = maskText.path(pathData)
    maskPath.text(content)
    maskPath.attr({ startOffset })
    maskText.attr({
      'text-anchor': textAnchor,
      'font-size': fontSize,
      'font-family': fontFamily,
      'dominant-baseline': textBaseline,
      fill: 'black',
    })
    // Apply same text styles for consistent shape
    if (inlineStyles.length > 0) {
      maskText.attr('style', inlineStyles.join(' '))
    }
  }

  // Wrap visible text layers in a group (NO filter on this group - avoids Safari pattern bug)
  const textLayersGroup = svg.group().addClass('text-layers-group')

  // Modified helper to add layers to the group instead of SVG root
  const createTextPathLayerInGroup = (
    strokeValue: string | null,
    strokeWidth: number,
    fillValue: string,
    strokeOpacity: number = 1,
    applyFillOpacity: boolean = false,
    className?: string
  ) => {
    const textElement = textLayersGroup.text('')
    if (className) {
      textElement.addClass(className)
    }
    const textPath = textElement.path(pathData)
    textPath.text(content)
    textPath.attr({ startOffset })

    textElement.attr({
      'text-anchor': textAnchor,
      'font-size': fontSize,
      'font-family': fontFamily,
      'dominant-baseline': textBaseline,
    })

    // Set fill
    textElement.fill(fillValue)

    // Build styles (copy base styles to avoid mutation)
    const elementStyles = [...inlineStyles]

    // Set stroke if provided
    if (strokeValue && strokeWidth > 0) {
      textElement.stroke({ color: strokeValue, width: strokeWidth })
      // Use paint-order to render stroke behind fill
      elementStyles.push('paint-order: stroke fill;')
      if (strokeOpacity < 1) {
        elementStyles.push(`stroke-opacity: ${strokeOpacity};`)
      }
    } else {
      textElement.stroke('none')
    }

    if (applyFillOpacity && fillOpacity < 1) {
      elementStyles.push(`fill-opacity: ${fillOpacity};`)
    }
    if (elementStyles.length > 0) {
      textElement.attr('style', elementStyles.join(' '))
    }

    return textElement
  }

  if (visibleStrokes.length === 0) {
    // No strokes - just render fill (mark as text-fill for inner shadow filter)
    createTextPathLayerInGroup(null, 0, resolvedFillValue, 1, true, 'text-fill')
  } else {
    // Calculate cumulative widths (outermost stroke = sum of all widths)
    const cumulativeWidths: number[] = []
    let totalWidth = 0
    for (const stroke of visibleStrokes) {
      const pixelWidth = strokePercentToPixels(stroke.weight, fontSize)
      totalWidth += pixelWidth
      cumulativeWidths.push(totalWidth)
    }

    // Render strokes from outermost (largest) to innermost (smallest)
    // This creates the wrapping effect where outer strokes are behind inner strokes
    for (let i = visibleStrokes.length - 1; i >= 0; i--) {
      const stroke = visibleStrokes[i]
      const cumulativeWidth = cumulativeWidths[i]
      const patternId = `stroke-pattern-${i}`

      // Create pattern for this stroke
      const strokeFillValue = createStrokePattern(
        svg,
        stroke,
        patternId,
        patternWidth,
        patternHeight,
        loadedImages,
        patternOrigin
      )

      const strokeOpacity = getStrokeEffectiveOpacity(stroke)

      // Render text with this stroke (fill=none for stroke-only layers)
      // The stroke width is DOUBLE the cumulative width because SVG stroke
      // extends half inside and half outside. We want it all outside.
      // Apply knockout mask to prevent stroke from rendering inside text shape
      // (important when fillOpacity < 1, e.g., deboss effect)
      const strokeElement = createTextPathLayerInGroup(strokeFillValue, cumulativeWidth * 2, 'none', strokeOpacity)
      strokeElement.attr('mask', `url(#${strokeMaskId})`)
    }

    // Render fill layer on top (no stroke, mark as text-fill for inner shadow filter)
    createTextPathLayerInGroup(null, 0, resolvedFillValue, 1, true, 'text-fill')
  }

  return { svg, initialPadding }
}
