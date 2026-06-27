/**
 * Paint Renderer
 *
 * Creates SVG pattern/gradient definitions for Paint types.
 * Handles image patterns, linear/radial gradients for text fills.
 *
 * @module shared/libraries/paint
 */

import type { Svg } from '@svgdotjs/svg.js'
import type {
  Paint,
  ImagePaint,
  GradientPaint,
  ImageScaleMode,
  ImageFilters,
  ColorStop,
  GradientTransform,
  PatternSize,
} from './paint-types'
import { isSolidPaint, isImagePaint, isGradientPaint } from './paint-types'
import { buildImageFilterPrimitives } from './image-filter-primitives'

// ============================================
// Types
// ============================================

/**
 * Loaded image data for pattern rendering
 */
export interface LoadedImage {
  /** Original image URL */
  imageRef: string
  /** Data URL for SVG embedding (CORS-safe) */
  dataUrl: string
  /** Natural width */
  width: number
  /** Natural height */
  height: number
}

/**
 * Result of building an image fill pattern
 */
export interface ImageFillResult {
  /** Pattern ID to reference in fill attribute */
  patternId: string
  /** Optional filter ID for image adjustments */
  filterId?: string
  /** Fill attribute value: url(#patternId) */
  fillValue: string
}

/**
 * Result of building a gradient fill
 */
export interface GradientFillResult {
  /** Gradient ID to reference in fill attribute */
  gradientId: string
  /** Fill attribute value: url(#gradientId) */
  fillValue: string
}

/**
 * Unified fill result
 */
export type FillResult =
  | { type: 'solid'; fillValue: string }
  | { type: 'image'; result: ImageFillResult }
  | { type: 'gradient'; result: GradientFillResult }

// ============================================
// Helper Functions
// ============================================

/**
 * Map scale mode to SVG preserveAspectRatio
 */
function getPreserveAspectRatio(scaleMode: ImageScaleMode): string {
  switch (scaleMode) {
    case 'FILL':
      return 'xMidYMid slice' // Cover, may crop
    case 'FIT':
      return 'xMidYMid meet' // Contain, letterboxed
    case 'CROP':
      return 'none' // User-controlled, stretched
    case 'TILE':
      return 'xMinYMin meet' // Tile from top-left
    default:
      return 'xMidYMid slice'
  }
}

/**
 * Calculate image dimensions for pattern based on patternSize
 *
 * @param patternSize - Pattern size mode: 'stretch', 'stretch-x', 'stretch-y', or number (10-100)
 * @param textWidth - Text bounds width
 * @param textHeight - Text bounds height
 * @param imageWidth - Original image width
 * @param imageHeight - Original image height
 */
function calculateImageDimensionsFromPatternSize(
  patternSize: PatternSize | undefined,
  textWidth: number,
  textHeight: number,
  imageWidth: number,
  imageHeight: number
): { width: number; height: number; patternWidth: number; patternHeight: number; preserveAspectRatio: string } {
  // Default to 100% tiling if patternSize is undefined
  const size = patternSize ?? 100

  // STRETCH mode: scale image to fill entire bounds
  if (size === 'stretch') {
    return {
      width: textWidth,
      height: textHeight,
      patternWidth: textWidth,
      patternHeight: textHeight,
      preserveAspectRatio: 'none',
    }
  }

  // STRETCH-X mode: stretch horizontally, tile vertically
  if (size === 'stretch-x') {
    return {
      width: textWidth,
      height: imageHeight,
      patternWidth: textWidth,
      patternHeight: imageHeight,
      preserveAspectRatio: 'none',
    }
  }

  // STRETCH-Y mode: stretch vertically, tile horizontally
  if (size === 'stretch-y') {
    return {
      width: imageWidth,
      height: textHeight,
      patternWidth: imageWidth,
      patternHeight: textHeight,
      preserveAspectRatio: 'none',
    }
  }

  // PERCENTAGE mode (10-100): tile at percentage of original image size
  if (typeof size === 'number') {
    const scale = size / 100
    const scaledImageW = imageWidth * scale
    const scaledImageH = imageHeight * scale
    return {
      width: scaledImageW,
      height: scaledImageH,
      patternWidth: scaledImageW,
      patternHeight: scaledImageH,
      preserveAspectRatio: 'xMidYMid meet',
    }
  }

  // Fallback: stretch to fill
  return {
    width: textWidth,
    height: textHeight,
    patternWidth: textWidth,
    patternHeight: textHeight,
    preserveAspectRatio: 'none',
  }
}

/**
 * Calculate image dimensions for pattern (legacy - uses scaleMode)
 * @deprecated Use calculateImageDimensionsFromPatternSize instead
 */
function calculateImageDimensions(
  scaleMode: ImageScaleMode,
  textWidth: number,
  textHeight: number,
  imageWidth: number,
  imageHeight: number,
  scale: number = 1
): { width: number; height: number; patternWidth: number; patternHeight: number } {
  const scaledImageW = imageWidth * scale
  const scaledImageH = imageHeight * scale

  switch (scaleMode) {
    case 'TILE':
      // Tile: pattern size = scaled image size
      return {
        width: scaledImageW,
        height: scaledImageH,
        patternWidth: scaledImageW,
        patternHeight: scaledImageH,
      }
    case 'FILL':
    case 'FIT':
    case 'CROP':
    default:
      // Non-tile: pattern size = text bounds
      return {
        width: textWidth,
        height: textHeight,
        patternWidth: textWidth,
        patternHeight: textHeight,
      }
  }
}

// ============================================
// Image Fill Functions
// ============================================

/**
 * Build SVG filter for image adjustments
 * Supports: blur, brightness, exposure, contrast, saturation, temperature, tint, highlights, shadows, sharpness
 *
 * Uses shared buildImageFilterPrimitives for consistency with stroke filters.
 */
export function buildImageFilterXML(filters: ImageFilters, filterId: string): string {
  const result = buildImageFilterPrimitives(filters)

  if (!result.hasAdjustments) {
    return ''
  }

  return `
    <filter id="${filterId}" color-interpolation-filters="sRGB">
      ${result.primitives.join('\n')}
    </filter>
  `
}

/**
 * Options for pattern origin positioning
 * Used for curved text where content extends into negative coordinate space
 */
export interface PatternOriginOptions {
  /** X offset for pattern origin (negative to cover negative coordinates) */
  x?: number
  /** Y offset for pattern origin (negative to cover negative coordinates) */
  y?: number
}

/**
 * Build SVG pattern XML for image fill
 *
 * Uses patternSize when available (preferred), falls back to scaleMode for legacy compatibility.
 *
 * @param imagePaint - The image paint configuration
 * @param patternId - Unique ID for the pattern
 * @param textWidth - Text bounds width
 * @param textHeight - Text bounds height
 * @param loadedImage - Pre-loaded image data
 * @param imageFilterId - Optional filter ID for image adjustments
 * @param patternOrigin - Optional origin offset for curved text (default: 0, 0)
 */
export function buildImagePatternXML(
  imagePaint: ImagePaint,
  patternId: string,
  textWidth: number,
  textHeight: number,
  loadedImage: LoadedImage,
  imageFilterId?: string,
  patternOrigin?: PatternOriginOptions
): string {
  const { patternSize, scaleMode, transform, opacity = 1 } = imagePaint
  const { rotation = 0 } = transform || {}

  // Use patternSize if available (preferred), otherwise fall back to scaleMode
  let dims: { width: number; height: number; patternWidth: number; patternHeight: number }
  let preserveAspectRatio: string
  let isTiling: boolean

  if (patternSize !== undefined) {
    // New patternSize-based calculation
    const result = calculateImageDimensionsFromPatternSize(
      patternSize,
      textWidth,
      textHeight,
      loadedImage.width,
      loadedImage.height
    )
    dims = result
    preserveAspectRatio = result.preserveAspectRatio
    // Tiling happens when patternSize is not 'stretch'
    isTiling = patternSize !== 'stretch'
  } else {
    // Legacy scaleMode-based calculation
    const { scale = 1 } = transform || {}
    dims = calculateImageDimensions(scaleMode, textWidth, textHeight, loadedImage.width, loadedImage.height, scale)
    preserveAspectRatio = getPreserveAspectRatio(scaleMode)
    isTiling = scaleMode === 'TILE'
  }

  // Calculate offset based on normalized position (0-1)
  // For tiling patterns, offset is 0 (pattern tiles from top-left)
  const { x = 0.5, y = 0.5 } = transform || {}
  const offsetX = isTiling ? 0 : (x - 0.5) * dims.patternWidth
  const offsetY = isTiling ? 0 : (y - 0.5) * dims.patternHeight

  // Build transform attribute for rotation
  const centerX = dims.patternWidth / 2
  const centerY = dims.patternHeight / 2
  const transformAttr = rotation !== 0 ? `transform="rotate(${rotation} ${centerX} ${centerY})"` : ''

  // Optional filter reference
  const filterAttr = imageFilterId ? `filter="url(#${imageFilterId})"` : ''

  // Only apply opacity attribute when opacity < 1 to avoid SVG rendering quirks
  // Some browsers have issues when opacity="1" is explicitly set on pattern images
  const opacityAttr = opacity < 1 ? `opacity="${opacity}"` : ''

  // Pattern origin offset for curved text
  // This ensures the pattern covers negative coordinates when viewBox is adjusted
  const patternX = patternOrigin?.x ?? 0
  const patternY = patternOrigin?.y ?? 0

  return `
    <pattern id="${patternId}"
             patternUnits="userSpaceOnUse"
             x="${patternX}"
             y="${patternY}"
             width="${dims.patternWidth}"
             height="${dims.patternHeight}">
      <image
        href="${loadedImage.dataUrl}"
        x="${offsetX}"
        y="${offsetY}"
        width="${dims.width}"
        height="${dims.height}"
        preserveAspectRatio="${preserveAspectRatio}"
        ${opacityAttr}
        ${transformAttr}
        ${filterAttr}
      />
    </pattern>
  `
}

/**
 * Add image fill pattern to SVG defs
 *
 * @param svg - SVG element to add pattern to
 * @param imagePaint - The image paint configuration
 * @param patternId - Unique ID for the pattern
 * @param textWidth - Text bounds width
 * @param textHeight - Text bounds height
 * @param loadedImage - Pre-loaded image data
 * @param patternOrigin - Optional origin offset for curved text
 */
export function addImageFillPattern(
  svg: Svg,
  imagePaint: ImagePaint,
  patternId: string,
  textWidth: number,
  textHeight: number,
  loadedImage: LoadedImage,
  patternOrigin?: PatternOriginOptions
): ImageFillResult {
  const defs = svg.defs()

  // Build and add image filter if needed
  let imageFilterId: string | undefined
  if (imagePaint.filters) {
    imageFilterId = `${patternId}-img-filter`
    const filterXML = buildImageFilterXML(imagePaint.filters, imageFilterId)
    if (filterXML) {
      defs.svg(filterXML)
    } else {
      imageFilterId = undefined
    }
  }

  // Build and add pattern
  const patternXML = buildImagePatternXML(
    imagePaint,
    patternId,
    textWidth,
    textHeight,
    loadedImage,
    imageFilterId,
    patternOrigin
  )
  defs.svg(patternXML)

  return {
    patternId,
    filterId: imageFilterId,
    fillValue: `url(#${patternId})`,
  }
}

// ============================================
// Gradient Fill Functions
// ============================================

/**
 * Build color stops XML for gradient
 */
function buildColorStopsXML(stops: ColorStop[]): string {
  return stops.map(stop => `<stop offset="${stop.position * 100}%" stop-color="${stop.color}"/>`).join('\n')
}

/**
 * Build linear gradient XML
 */
export function buildLinearGradientXML(stops: ColorStop[], gradientId: string, transform?: GradientTransform): string {
  const { start = { x: 0, y: 0.5 }, end = { x: 1, y: 0.5 }, angle } = transform || {}

  // If angle is specified, calculate start/end from angle
  let x1 = start.x * 100
  let y1 = start.y * 100
  let x2 = end.x * 100
  let y2 = end.y * 100

  if (angle !== undefined) {
    // Convert angle to start/end points
    const radians = (angle * Math.PI) / 180
    x1 = 50 - Math.cos(radians) * 50
    y1 = 50 - Math.sin(radians) * 50
    x2 = 50 + Math.cos(radians) * 50
    y2 = 50 + Math.sin(radians) * 50
  }

  return `
    <linearGradient id="${gradientId}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
      ${buildColorStopsXML(stops)}
    </linearGradient>
  `
}

/**
 * Build radial gradient XML
 */
export function buildRadialGradientXML(stops: ColorStop[], gradientId: string, transform?: GradientTransform): string {
  const { start = { x: 0.5, y: 0.5 } } = transform || {}

  const cx = start.x * 100
  const cy = start.y * 100

  return `
    <radialGradient id="${gradientId}" cx="${cx}%" cy="${cy}%" r="50%" fx="${cx}%" fy="${cy}%">
      ${buildColorStopsXML(stops)}
    </radialGradient>
  `
}

/**
 * Add gradient fill to SVG defs
 */
export function addGradientFill(svg: Svg, gradientPaint: GradientPaint, gradientId: string): GradientFillResult {
  const defs = svg.defs()

  let gradientXML: string

  switch (gradientPaint.type) {
    case 'GRADIENT_LINEAR':
      gradientXML = buildLinearGradientXML(gradientPaint.stops, gradientId, gradientPaint.transform)
      break
    case 'GRADIENT_RADIAL':
      gradientXML = buildRadialGradientXML(gradientPaint.stops, gradientId, gradientPaint.transform)
      break
    case 'GRADIENT_ANGULAR':
    case 'GRADIENT_DIAMOND':
      // Angular and Diamond gradients are complex - fallback to linear for now
      // TODO: Implement conic-gradient polyfill for angular
      gradientXML = buildLinearGradientXML(gradientPaint.stops, gradientId, gradientPaint.transform)
      break
    default:
      gradientXML = buildLinearGradientXML(gradientPaint.stops, gradientId)
  }

  defs.svg(gradientXML)

  return {
    gradientId,
    fillValue: `url(#${gradientId})`,
  }
}

// ============================================
// Unified Paint Resolution
// ============================================

/**
 * Resolve a Paint to an SVG fill value
 *
 * For SolidPaint: returns the color string directly
 * For ImagePaint: creates a pattern and returns url(#patternId)
 * For GradientPaint: creates a gradient and returns url(#gradientId)
 *
 * @param svg - SVG element to add definitions to
 * @param paint - The paint configuration
 * @param fillId - Unique ID base for pattern/gradient
 * @param textWidth - Text bounds width
 * @param textHeight - Text bounds height
 * @param loadedImages - Pre-loaded image data map
 * @param patternOrigin - Optional origin offset for curved text patterns
 */
export function resolvePaintToFill(
  svg: Svg,
  paint: Paint,
  fillId: string,
  textWidth: number,
  textHeight: number,
  loadedImages?: Map<string, LoadedImage>,
  patternOrigin?: PatternOriginOptions
): FillResult {
  if (isSolidPaint(paint)) {
    return { type: 'solid', fillValue: paint.color }
  }

  if (isImagePaint(paint)) {
    const loadedImage = loadedImages?.get(paint.imageRef)
    if (!loadedImage) {
      // Image not loaded - return fallback color
      console.warn(`Image not loaded for paint: ${paint.imageRef}`)
      return { type: 'solid', fillValue: '#808080' }
    }

    const result = addImageFillPattern(svg, paint, `${fillId}-img`, textWidth, textHeight, loadedImage, patternOrigin)
    return { type: 'image', result }
  }

  if (isGradientPaint(paint)) {
    const result = addGradientFill(svg, paint, `${fillId}-grad`)
    return { type: 'gradient', result }
  }

  // Fallback
  return { type: 'solid', fillValue: '#000000' }
}

/**
 * Get the SVG fill attribute value from a FillResult
 */
export function getFillValue(result: FillResult): string {
  switch (result.type) {
    case 'solid':
      return result.fillValue
    case 'image':
      return result.result.fillValue
    case 'gradient':
      return result.result.fillValue
  }
}
