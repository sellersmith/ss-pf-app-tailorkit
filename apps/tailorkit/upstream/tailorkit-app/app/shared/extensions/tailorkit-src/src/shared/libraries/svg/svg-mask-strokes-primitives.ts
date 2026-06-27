/**
 * SVG Mask-Based Stroke Primitives
 *
 * Creates stroke rings using SVG masks instead of filters.
 * This approach uses native SVG masking to clip images/patterns to stroke shapes.
 *
 * Key concept:
 * - White areas in mask = visible
 * - Black areas in mask = hidden
 * - Text with stroke creates the ring boundaries
 *
 * For each stroke ring:
 * 1. Create mask with white text+stroke (outer) and black text+stroke (inner knockout)
 * 2. Apply mask to rect/image filled with pattern
 * 3. Result: Image clipped to the stroke "ring" shape
 *
 * @module shared/libraries/svg
 */

import type { StrokeConfig } from '../paint/stroke-types'
import type { Paint, PatternSize } from '../paint/paint-types'
import { isSolidPaint, isImagePaint, isGradientPaint } from '../paint/paint-types'
import type { LoadedImage } from '../paint/paint-renderer'
import { buildLinearGradientXML, buildRadialGradientXML } from '../paint/paint-renderer'
import { strokePercentToPixels } from '../konva/effects/relative-shadow-utils'
import { getStrokeEffectiveOpacity } from '../paint/stroke-types'
import { toFloodColor } from './svg-color-utils'

/** Fallback color for missing images or unknown paint types */
const FALLBACK_STROKE_COLOR = '#808080'

/**
 * Result from building mask-based strokes
 */
export interface MaskStrokesResult {
  /** SVG defs XML (masks, patterns, gradients) */
  defsXML: string
  /** Stroke layer elements in render order (outermost first) */
  strokeElements: string[]
  /** Total stroke extent for bounds calculation */
  totalExtent: number
}

/**
 * Options for building mask-based strokes
 */
export interface MaskStrokesOptions {
  /** Array of stroke configurations (order: inner to outer) */
  strokes: StrokeConfig[]
  /** Font size for weight percentage conversion */
  fontSize: number
  /** Text bounds width */
  textWidth: number
  /** Text bounds height */
  textHeight: number
  /** Unique ID prefix for masks/patterns */
  idPrefix: string
  /** Map of loaded images for image paint strokes */
  loadedImages?: Map<string, LoadedImage>
  /** For curved text: the path ID to reference */
  textPathId?: string
  /** Vertical extension for curved text patterns */
  curveExtension?: number
  /** Text attributes string to apply to mask text elements */
  textAttrsString: string
  /** The actual text content */
  textContent: string
}

/**
 * Build mask-based strokes
 *
 * Creates SVG masks and filled rects for each stroke, producing "ring" shapes
 * that can be filled with images, gradients, or solid colors.
 *
 * @param options - Configuration for building strokes
 * @returns Defs XML, stroke elements, and total extent
 */
export function buildMaskBasedStrokes(options: MaskStrokesOptions): MaskStrokesResult {
  const {
    strokes,
    fontSize,
    textWidth,
    textHeight,
    idPrefix,
    loadedImages,
    textPathId,
    curveExtension = 0,
    textAttrsString,
    textContent,
  } = options

  // Filter visible strokes with valid weight
  const visibleStrokes = strokes.filter(s => s.visible !== false && s.weight > 0)

  if (visibleStrokes.length === 0) {
    return { defsXML: '', strokeElements: [], totalExtent: 0 }
  }

  // Calculate cumulative radii (TextStudio wrapping magic!)
  const cumulativeRadii: number[] = []
  let totalRadius = 0
  for (const stroke of visibleStrokes) {
    const pixelWidth = strokePercentToPixels(stroke.weight, fontSize)
    totalRadius += pixelWidth
    cumulativeRadii.push(totalRadius)
  }

  const allDefs: string[] = []
  const strokeElements: string[] = []

  // Process strokes from outermost to innermost for correct render order
  // Outermost stroke renders first (behind), innermost stroke renders last (on top)
  for (let i = visibleStrokes.length - 1; i >= 0; i--) {
    const stroke = visibleStrokes[i]
    const outerRadius = cumulativeRadii[i]
    const innerRadius = i > 0 ? cumulativeRadii[i - 1] : 0
    const strokeId = `${idPrefix}-stroke${i}`

    const result = buildSingleMaskStroke({
      stroke,
      outerRadius,
      innerRadius,
      strokeId,
      textWidth,
      textHeight,
      curveExtension,
      textAttrsString,
      textContent,
      textPathId,
      loadedImages,
    })

    allDefs.push(result.defsXML)
    strokeElements.push(result.strokeElement)
  }

  return {
    defsXML: allDefs.join('\n'),
    strokeElements,
    totalExtent: totalRadius,
  }
}

/**
 * Options for building a single mask stroke
 */
interface SingleMaskStrokeOptions {
  stroke: StrokeConfig
  outerRadius: number
  innerRadius: number
  strokeId: string
  textWidth: number
  textHeight: number
  curveExtension: number
  textAttrsString: string
  textContent: string
  textPathId?: string
  loadedImages?: Map<string, LoadedImage>
}

/**
 * Build a single mask-based stroke
 *
 * Creates a mask with white outer boundary and black inner knockout,
 * then applies it to a rect filled with the paint pattern.
 */
function buildSingleMaskStroke(options: SingleMaskStrokeOptions): {
  defsXML: string
  strokeElement: string
} {
  const {
    stroke,
    outerRadius,
    innerRadius,
    strokeId,
    textWidth,
    textHeight,
    curveExtension,
    textAttrsString,
    textContent,
    textPathId,
    loadedImages,
  } = options

  const effectiveOpacity = getStrokeEffectiveOpacity(stroke)
  const paint = stroke.paint
  const maskId = `${strokeId}-mask`
  const patternId = `${strokeId}-pattern`

  // Calculate bounds for the stroke rect
  // Must cover the full area including curve extension and stroke radius
  const totalYOffset = curveExtension + outerRadius
  const rectBounds = {
    x: -outerRadius,
    y: -totalYOffset,
    width: textWidth + outerRadius * 2,
    height: textHeight + curveExtension * 2 + outerRadius * 2,
  }

  // Build mask XML
  const maskXML = buildStrokeMask({
    maskId,
    textContent,
    textAttrsString,
    outerStrokeWidth: outerRadius * 2,
    innerStrokeWidth: innerRadius * 2,
    textPathId,
  })

  // Build paint (pattern/gradient/solid)
  const { paintDefsXML, fillValue } = buildStrokePaint({
    paint,
    patternId,
    textWidth,
    textHeight,
    curveExtension,
    outerRadius,
    loadedImages,
  })

  // Build the masked rect element
  const opacityAttr = effectiveOpacity < 1 ? ` opacity="${effectiveOpacity}"` : ''
  const strokeElement = `<rect
    x="${rectBounds.x}"
    y="${rectBounds.y}"
    width="${rectBounds.width}"
    height="${rectBounds.height}"
    fill="${fillValue}"
    mask="url(#${maskId})"${opacityAttr}
  />`

  return {
    defsXML: `${maskXML  }\n${  paintDefsXML}`,
    strokeElement,
  }
}

/**
 * Build a stroke mask definition
 *
 * Creates mask with:
 * - White text+stroke at outerRadius (visible area)
 * - Black text+stroke at innerRadius (knockout area)
 *
 * For the innermost stroke (innerStrokeWidth=0), we still need to knock out
 * the text fill area so only the stroke ring is visible.
 */
function buildStrokeMask(options: {
  maskId: string
  textContent: string
  textAttrsString: string
  outerStrokeWidth: number
  innerStrokeWidth: number
  textPathId?: string
}): string {
  const { maskId, textContent, textAttrsString, outerStrokeWidth, innerStrokeWidth, textPathId } = options

  // Build text element with or without textPath
  const buildTextElement = (strokeWidth: number, color: string, hasStroke: boolean): string => {
    const strokeAttrs = hasStroke
      ? `stroke="${color}" stroke-width="${strokeWidth}" fill="${color}"`
      : `fill="${color}"` // No stroke for inner knockout of text fill

    if (textPathId) {
      return `<text ${textAttrsString} ${strokeAttrs}>
        <textPath href="#${textPathId}">${escapeXML(textContent)}</textPath>
      </text>`
    }

    return `<text ${textAttrsString} ${strokeAttrs}>${escapeXML(textContent)}</text>`
  }

  // White outer boundary (visible area) - text with stroke
  const outerText = buildTextElement(outerStrokeWidth, 'white', true)

  // Black inner knockout - ALWAYS needed to create the ring shape
  // For innermost stroke (innerStrokeWidth=0): knock out text fill only
  // For outer strokes: knock out text + previous cumulative stroke
  const innerText = innerStrokeWidth > 0
    ? buildTextElement(innerStrokeWidth, 'black', true)
    : buildTextElement(0, 'black', false) // Just the text fill, no stroke

  return `<mask id="${maskId}">
    ${outerText}
    ${innerText}
  </mask>`
}

/**
 * Build paint for stroke (pattern/gradient/solid)
 */
function buildStrokePaint(options: {
  paint: Paint
  patternId: string
  textWidth: number
  textHeight: number
  curveExtension: number
  outerRadius: number
  loadedImages?: Map<string, LoadedImage>
}): {
  paintDefsXML: string
  fillValue: string
} {
  const { paint, patternId, textWidth, textHeight, curveExtension, outerRadius, loadedImages } = options

  // Calculate pattern dimensions
  const patternWidth = textWidth + outerRadius * 2
  const patternHeight = textHeight + curveExtension * 2 + outerRadius * 2
  const totalYOffset = curveExtension + outerRadius

  if (isSolidPaint(paint)) {
    const color = toFloodColor(paint.color)
    return { paintDefsXML: '', fillValue: color }
  }

  if (isImagePaint(paint)) {
    const loadedImage = loadedImages?.get(paint.imageRef)
    if (!loadedImage) {
      return { paintDefsXML: '', fillValue: FALLBACK_STROKE_COLOR }
    }

    const { dataUrl, width: imgWidth, height: imgHeight } = loadedImage
    const patternSize: PatternSize = paint.patternSize ?? 'stretch'
    const { rotation = 0 } = paint.transform || {}

    // Build pattern based on patternSize mode
    const patternXML = buildImagePattern({
      patternId,
      dataUrl,
      imgWidth,
      imgHeight,
      patternWidth,
      patternHeight,
      patternSize,
      rotation,
      offsetY: -totalYOffset,
    })

    return { paintDefsXML: patternXML, fillValue: `url(#${patternId})` }
  }

  if (isGradientPaint(paint)) {
    const gradientId = `${patternId}-gradient`
    let gradientXML: string

    switch (paint.type) {
      case 'GRADIENT_LINEAR':
        gradientXML = buildLinearGradientXML(paint.stops, gradientId, paint.transform)
        break
      case 'GRADIENT_RADIAL':
        gradientXML = buildRadialGradientXML(paint.stops, gradientId, paint.transform)
        break
      default:
        gradientXML = buildLinearGradientXML(paint.stops, gradientId, paint.transform)
    }

    return { paintDefsXML: gradientXML, fillValue: `url(#${gradientId})` }
  }

  // Unknown paint type - fallback
  return { paintDefsXML: '', fillValue: FALLBACK_STROKE_COLOR }
}

/**
 * Build image pattern for stroke fill
 */
function buildImagePattern(options: {
  patternId: string
  dataUrl: string
  imgWidth: number
  imgHeight: number
  patternWidth: number
  patternHeight: number
  patternSize: PatternSize
  rotation: number
  offsetY: number
}): string {
  const { patternId, dataUrl, imgWidth, imgHeight, patternWidth, patternHeight, patternSize, rotation, offsetY }
    = options

  const rotationTransform
    = rotation !== 0 ? `transform="rotate(${rotation} ${patternWidth / 2} ${patternHeight / 2})"` : ''

  // STRETCH mode: scale image to fill entire bounds
  if (patternSize === 'stretch') {
    return `<pattern id="${patternId}" patternUnits="userSpaceOnUse"
      x="0" y="${offsetY}" width="${patternWidth}" height="${patternHeight}">
      <image href="${dataUrl}" x="0" y="0" width="${patternWidth}" height="${patternHeight}"
        preserveAspectRatio="none" ${rotationTransform}/>
    </pattern>`
  }

  // STRETCH-X mode: stretch horizontally, tile vertically
  if (patternSize === 'stretch-x') {
    const tileHeight = imgHeight
    return `<pattern id="${patternId}" patternUnits="userSpaceOnUse"
      x="0" y="${offsetY}" width="${patternWidth}" height="${tileHeight}">
      <image href="${dataUrl}" x="0" y="0" width="${patternWidth}" height="${tileHeight}"
        preserveAspectRatio="none" ${rotationTransform}/>
    </pattern>`
  }

  // STRETCH-Y mode: stretch vertically, tile horizontally
  if (patternSize === 'stretch-y') {
    const tileWidth = imgWidth
    return `<pattern id="${patternId}" patternUnits="userSpaceOnUse"
      x="0" y="${offsetY}" width="${tileWidth}" height="${patternHeight}">
      <image href="${dataUrl}" x="0" y="0" width="${tileWidth}" height="${patternHeight}"
        preserveAspectRatio="none" ${rotationTransform}/>
    </pattern>`
  }

  // PERCENTAGE mode (10-100): tile at percentage of original image size
  if (typeof patternSize === 'number') {
    const scale = patternSize / 100
    const tileWidth = imgWidth * scale
    const tileHeight = imgHeight * scale
    return `<pattern id="${patternId}" patternUnits="userSpaceOnUse"
      x="0" y="${offsetY}" width="${tileWidth}" height="${tileHeight}">
      <image href="${dataUrl}" x="0" y="0" width="${tileWidth}" height="${tileHeight}"
        preserveAspectRatio="xMidYMid meet" ${rotationTransform}/>
    </pattern>`
  }

  // Fallback: stretch
  return `<pattern id="${patternId}" patternUnits="userSpaceOnUse"
    x="0" y="${offsetY}" width="${patternWidth}" height="${patternHeight}">
    <image href="${dataUrl}" x="0" y="0" width="${patternWidth}" height="${patternHeight}"
      preserveAspectRatio="none"/>
  </pattern>`
}

/**
 * Calculate total strokes extent (for bounds calculation)
 */
export function calculateMaskStrokesExtent(strokes: StrokeConfig[], fontSize: number): number {
  let totalRadius = 0
  for (const stroke of strokes) {
    if (stroke.visible !== false && stroke.weight > 0) {
      totalRadius += strokePercentToPixels(stroke.weight, fontSize)
    }
  }
  return totalRadius
}

/**
 * Escape special XML characters in text content
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
