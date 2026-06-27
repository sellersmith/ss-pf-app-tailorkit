/**
 * SVG Text Creator
 *
 * Creates SVG text elements with single-element rendering approach.
 * All effects (stroke, shadows) are handled by SVG filters:
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
import {
  wrapText,
  getTextAnchor,
  getXPosition,
  getVerticalOffset,
  type TextAlign,
  type VerticalAlign,
  type TextWrap,
} from './svg-text-layout'
import type { Paint } from '../paint/paint-types'
import { resolvePaintToFill, getFillValue, type LoadedImage } from '../paint/paint-renderer'

/**
 * Minimum initial padding for measurement.
 * This ensures we have enough space to capture effects like shadows.
 */
const MIN_INITIAL_PADDING = 100

/**
 * Configuration for creating SVG text
 */
export interface SVGTextConfig {
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
  lineHeight?: number
  align?: TextAlign
  verticalAlign?: VerticalAlign
  wrap?: TextWrap
  textDecoration?: string
  fillOpacity?: number
  padding?: number
  stroke?: string
  strokeWidth?: number
  dropShadows?: DropShadowConfig[]
  innerShadows?: InnerShadowConfig[]
}

/**
 * Result of creating SVG text
 */
export interface SVGTextResult {
  svg: Svg
  /** Initial padding used for measurement (content is offset by this amount) */
  initialPadding: number
}

/**
 * Create SVG container with text
 *
 * Uses single-element approach with combined SVG filter:
 * - Stroke is rendered via feMorphology (true outside stroke, no overlap with text)
 * - Drop shadows are knocked out from text and rendered behind stroke
 * - Inner shadows are clipped to text area and rendered on top
 * - Fill opacity is handled by feComponentTransfer in the filter
 *
 * When no effects exist, fillOpacity is applied directly to the element.
 */
export function createSVGText(config: SVGTextConfig): SVGTextResult {
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
    lineHeight = 1.2,
    align = 'left',
    verticalAlign = 'top',
    wrap = 'word',
    textDecoration,
    fillOpacity = 1,
    padding = 0,
    stroke,
    strokeWidth,
    dropShadows = [],
    innerShadows = [],
  } = config

  // Filter visible effects
  const visibleDropShadows = dropShadows.filter(s => s.visible !== false)
  const visibleInnerShadows = innerShadows.filter(s => s.visible !== false)

  // Determine rendering approach
  const hasStroke = stroke && strokeWidth && strokeWidth > 0
  const hasDropShadow = visibleDropShadows.length > 0
  const hasInnerShadow = visibleInnerShadows.length > 0

  // Parse fontStyle for bold/italic
  const fontStyleLower = (fontStyle || '').toLowerCase()
  const hasBoldInStyle = fontStyleLower.includes('bold')
  const hasItalicInStyle = fontStyleLower.includes('italic')

  // Use generous initial padding to ensure nothing is clipped during measurement
  // This will be trimmed by the orchestrator after measuring actual bounds
  const initialPadding = Math.max(fontSize * 2, MIN_INITIAL_PADDING)

  // Create SVG container with generous bounds
  const svgWidth = width + initialPadding * 2
  const svgHeight = height + initialPadding * 2
  const svg = SVG().size(svgWidth, svgHeight)

  // Set viewbox to position content with padding offset
  svg.viewbox(-initialPadding, -initialPadding, svgWidth, svgHeight)

  embedFontInSvg(svg, fontFamily, fontBase64Css)

  // Calculate text layout
  const effectiveWidth = width - padding * 2
  const lines = wrapText(content, effectiveWidth, fontSize, fontFamily, fontWeight, wrap, letterSpacing)
  const lineHeightPx = fontSize * lineHeight
  const totalTextHeight = fontSize + (lines.length - 1) * lineHeightPx
  const yOffset = getVerticalOffset(verticalAlign, height, totalTextHeight, padding, fontSize, fontFamily, fontWeight)
  const xPos = getXPosition(align, width, padding)
  const textAnchor = getTextAnchor(align)

  // Build inline styles
  const inlineStyles: string[] = []
  if (fontWeight || hasBoldInStyle) {
    const weight = fontWeight ? normalizeFontWeight(fontWeight) : '700'
    inlineStyles.push(`font-weight: ${weight === '700' ? 'bold' : weight};`)
  }
  if (hasItalicInStyle) inlineStyles.push('font-style: italic;')
  if (letterSpacing) inlineStyles.push(`letter-spacing: ${letterSpacing}px;`)
  if (textDecoration) inlineStyles.push(`text-decoration: ${textDecoration};`)

  /** Helper to create a text element */
  const createTextElement = (
    fillValue: string,
    strokeConfig: { color: string; width: number } | null,
    className: string,
    applyFillOpacity: boolean
  ) => {
    const textElement = svg.text(add => {
      lines.forEach((line, index) => {
        add.tspan(line).attr({ x: xPos, dy: index === 0 ? 0 : lineHeightPx })
      })
    })
    textElement.fill(fillValue)
    textElement.attr({
      'text-anchor': textAnchor,
      'font-size': fontSize,
      'font-family': fontFamily,
      'dominant-baseline': 'text-before-edge',
      class: className,
    })
    if (strokeConfig) textElement.stroke({ color: strokeConfig.color, width: strokeConfig.width })
    textElement.move(0, yOffset)

    const elementStyles = [...inlineStyles]
    if (applyFillOpacity && fillOpacity < 1) elementStyles.push(`fill-opacity: ${fillOpacity};`)
    if (elementStyles.length > 0) textElement.attr('style', elementStyles.join(' '))
    return textElement
  }

  // Determine if any effects exist (stroke, drop shadow, inner shadow)
  // When effects exist, the combined filter handles everything
  const hasAnyEffects = hasStroke || hasDropShadow || hasInnerShadow

  // Resolve fill to SVG fill value
  // Paint fill takes precedence over legacy color prop
  const resolveFillValue = (): string => {
    if (fill) {
      // Use new Paint system
      const fillResult = resolvePaintToFill(svg, fill, `text-fill-${Date.now()}`, width, height, loadedImages)
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
  createTextElement(
    resolvedFillValue,
    null, // No stroke on element - filter handles it via feMorphology
    'text-fill',
    !hasAnyEffects // Apply fillOpacity directly only when no effects (no filter)
  )

  return { svg, initialPadding }
}
