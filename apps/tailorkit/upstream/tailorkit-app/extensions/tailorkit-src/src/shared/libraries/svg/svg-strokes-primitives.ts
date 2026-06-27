/**
 * SVG Strokes Primitives
 *
 * Builds SVG filter primitives for multiple strokes with TextStudio-style "wrapping".
 * Each stroke wraps the text plus all previous strokes using cumulative radius.
 *
 * Key insight: Each stroke's dilate radius is CUMULATIVE:
 * - Stroke 1: radius = stroke1Width
 * - Stroke 2: radius = stroke1Width + stroke2Width
 * - Stroke 3: radius = stroke1Width + stroke2Width + stroke3Width
 *
 * This makes each outer stroke wrap all inner content.
 *
 * @module shared/libraries/svg
 */

import type { StrokeConfig } from '../paint/stroke-types'
import type { Paint, PatternSize } from '../paint/paint-types'
import { isSolidPaint, isImagePaint, isGradientPaint } from '../paint/paint-types'
import type { LoadedImage } from '../paint/paint-renderer'
import { buildLinearGradientXML, buildRadialGradientXML } from '../paint/paint-renderer'
import { buildImageFilterPrimitives } from '../paint/image-filter-primitives'
import { toFloodColor, getFloodOpacity } from './svg-color-utils'
import { strokePercentToPixels } from '../konva/effects/relative-shadow-utils'
import { getStrokeEffectiveOpacity } from '../paint/stroke-types'
import { isSafari } from '../../../assets/utils/devices'

/** Fallback color for missing images or unknown paint types */
const FALLBACK_STROKE_COLOR = '#808080'

/**
 * Result from building multiple stroke primitives
 */
export interface StrokesPrimitiveResult {
  /** SVG defs XML (patterns, gradients) to add before the filter */
  defsXML: string
  /** SVG filter primitives XML */
  primitives: string
  /** feMergeNode XML array for compositing order (outermost to innermost) */
  mergeNodes: string[]
}

/**
 * Build multiple stroke filter primitives with TextStudio-style wrapping
 *
 * Each stroke's dilate radius is cumulative, so outer strokes wrap inner strokes.
 * Strokes are rendered from outermost to innermost (last in array = outermost).
 *
 * @param strokes - Array of stroke configurations (order: inner to outer)
 * @param fontSize - Font size for weight percentage conversion
 * @param patternIdPrefix - Unique ID prefix for patterns/gradients
 * @param textWidth - Text bounds width
 * @param textHeight - Text bounds height (may be expanded for curved text)
 * @param loadedImages - Map of loaded images for ImagePaint
 * @param curveExtension - Optional vertical extension for curved text patterns
 */
export function buildStrokesPrimitives(
  strokes: StrokeConfig[],
  fontSize: number,
  patternIdPrefix: string,
  textWidth: number,
  textHeight: number,
  loadedImages?: Map<string, LoadedImage>,
  curveExtension?: number,
  curveBend?: number
): StrokesPrimitiveResult {
  // Filter visible strokes
  const visibleStrokes = strokes.filter(s => s.visible !== false)

  if (visibleStrokes.length === 0) {
    return { defsXML: '', primitives: '', mergeNodes: [] }
  }

  // Calculate cumulative radii (the TextStudio wrapping magic!)
  const cumulativeRadii: number[] = []
  let totalRadius = 0
  for (const stroke of visibleStrokes) {
    const pixelWidth = strokePercentToPixels(stroke.weight, fontSize)
    totalRadius += pixelWidth
    cumulativeRadii.push(totalRadius)
  }

  const allDefs: string[] = []
  const allPrimitives: string[] = []
  const allMergeNodes: string[] = []

  // Process strokes from outermost to innermost for correct rendering order
  // Outermost stroke renders first (behind), innermost stroke renders last (on top of previous strokes)
  for (let i = visibleStrokes.length - 1; i >= 0; i--) {
    const stroke = visibleStrokes[i]
    const outerRadius = cumulativeRadii[i]
    const innerRadius = i > 0 ? cumulativeRadii[i - 1] : 0
    const prefix = `stroke${i}`
    const patternId = `${patternIdPrefix}-stroke${i}`

    // Build primitive for this stroke with cumulative radius
    const result = buildSingleStrokePrimitive(
      stroke,
      outerRadius,
      innerRadius,
      prefix,
      patternId,
      textWidth,
      textHeight,
      fontSize,
      loadedImages,
      curveExtension,
      curveBend
    )

    if (result.defsXML) {
      allDefs.push(result.defsXML)
    }
    allPrimitives.push(result.primitives)
    allMergeNodes.push(result.mergeNode)
  }

  return {
    defsXML: allDefs.join('\n'),
    primitives: allPrimitives.join('\n'),
    mergeNodes: allMergeNodes,
  }
}

/**
 * Build a single stroke primitive with cumulative radius and optional inner knockout
 *
 * Creates a "ring" shape by dilating to outerRadius and knocking out innerRadius.
 */
function buildSingleStrokePrimitive(
  stroke: StrokeConfig,
  outerRadius: number,
  innerRadius: number,
  prefix: string,
  patternId: string,
  textWidth: number,
  textHeight: number,
  fontSize: number,
  loadedImages?: Map<string, LoadedImage>,
  curveExtension?: number,
  curveBend?: number
): { defsXML: string; primitives: string; mergeNode: string } {
  const effectiveOpacity = getStrokeEffectiveOpacity(stroke)
  const paint = stroke.paint

  // Build defs and primitives based on paint type
  let defsXML = ''
  let paintPrimitives = ''
  let coloredResult = `${prefix}_colored`

  if (isSolidPaint(paint)) {
    const floodColor = toFloodColor(paint.color)
    const floodOpacity = getFloodOpacity(paint.color, paint.opacity)

    paintPrimitives = `
      <feFlood flood-color="${floodColor}" flood-opacity="${floodOpacity}" result="${prefix}_color"/>
      <feComposite in="${prefix}_color" in2="${prefix}_dilated" operator="in" result="${coloredResult}"/>
    `
  } else if (isImagePaint(paint)) {
    const loadedImage = loadedImages?.get(paint.imageRef)
    if (!loadedImage) {
      // Fallback for missing image
      paintPrimitives = `
        <feFlood flood-color="${FALLBACK_STROKE_COLOR}" flood-opacity="1" result="${prefix}_color"/>
        <feComposite in="${prefix}_color" in2="${prefix}_dilated" operator="in" result="${coloredResult}"/>
      `
    } else {
      // Build image paint based on patternSize
      const patternSize: PatternSize = paint.patternSize ?? 100 // Default to 100% tiling
      const { rotation = 0 } = paint.transform || {}

      // Parse curveBend as number (may come as string from props)
      const curveBendNum = curveBend !== undefined ? Number(curveBend) : 0

      // Calculate feImage positioning and dimensions
      // =============================================
      //
      // For curved text with text-anchor="middle" and startOffset="50%":
      // - Text is centered on the path
      // - First glyph extends LEFT of path start (x=0)
      // - Last glyph extends RIGHT of path end
      // - Glyphs at steep parts of curve are rotated, affecting their bounding box
      //
      // Horizontal padding scales with curve intensity (curveBend):
      // - curveBend 100 = 90° rotation at ends, characters extend by full fontSize
      // - curveBend 50 = 45° rotation, characters extend by fontSize * sin(45°) ≈ 0.7
      // For Safari, cap the padding to prevent filter region from being too large
      //
      // Vertical positioning:
      // - curveBend > 0 (arc UP): curve extends above, y starts at -curveExtension - outerRadius
      // - curveBend < 0 (arc DOWN): curve extends below, y starts at -outerRadius
      // - curveBend = 0: symmetric stroke extension

      let horizontalPadding = 0
      if (curveExtension && curveExtension > 0) {
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

      // SVG dimensions include stroke extension + horizontal padding for curved text
      // textHeight already includes curveExtension*2 (from buildStrokeConfig)
      const svgWidth = textWidth + outerRadius * 2 + horizontalPadding * 2
      const svgHeight = textHeight + outerRadius * 2

      // feImage position
      const feImageX = -outerRadius - horizontalPadding
      let feImageY = -outerRadius

      if (curveExtension && curveExtension > 0 && curveBendNum !== 0) {
        if (curveBendNum > 0) {
          // Arc UP: curve extends above, pattern starts higher
          feImageY = -curveExtension - outerRadius
        } else {
          // Arc DOWN: curve extends below, pattern starts at normal position
          feImageY = -outerRadius
        }
      }

      const feImageWidth = svgWidth
      const feImageHeight = svgHeight

      // Image adjustments
      const imageAdjustments = buildImageAdjustmentPrimitives(paint, `${prefix}_pattern`, `${prefix}_adjusted`)
      const adjustedResult = imageAdjustments ? `${prefix}_adjusted` : `${prefix}_pattern`

      // Build image SVG based on patternSize mode
      // The embedded SVG uses absolute positioning (content at 0,0)
      // and is sized to svgWidth x svgHeight which includes all extensions
      const { embeddedSvg } = buildImagePatternSvg({
        patternSize,
        loadedImage,
        svgWidth,
        svgHeight,
        rotation,
        patternId,
      })

      // Encode SVG as data URL for feImage
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(embeddedSvg)}`

      paintPrimitives = `
        <feImage href="${svgDataUrl}" preserveAspectRatio="none"
          x="${feImageX}" y="${feImageY}"
          width="${feImageWidth}" height="${feImageHeight}"
          result="${prefix}_pattern"/>
        ${imageAdjustments}
        <feComposite in="${adjustedResult}" in2="${prefix}_dilated" operator="in" result="${coloredResult}"/>
      `
    }
  } else if (isGradientPaint(paint)) {
    const strokeGradientId = `${patternId}-gradient`
    const strokeRectPatternId = `${patternId}-grad-pattern`
    let gradientXML: string

    switch (paint.type) {
      case 'GRADIENT_LINEAR':
        gradientXML = buildLinearGradientXML(paint.stops, strokeGradientId, paint.transform)
        break
      case 'GRADIENT_RADIAL':
        gradientXML = buildRadialGradientXML(paint.stops, strokeGradientId, paint.transform)
        break
      default:
        gradientXML = buildLinearGradientXML(paint.stops, strokeGradientId, paint.transform)
    }

    const patternXML = `
      <pattern id="${strokeRectPatternId}" patternUnits="userSpaceOnUse" width="${textWidth}" height="${textHeight}">
        <rect width="100%" height="100%" fill="url(#${strokeGradientId})"/>
      </pattern>
    `

    defsXML = gradientXML + patternXML

    paintPrimitives = `
      <feImage href="#${strokeRectPatternId}" preserveAspectRatio="none" width="100%" height="100%" result="${prefix}_pattern"/>
      <feComposite in="${prefix}_pattern" in2="${prefix}_dilated" operator="in" result="${coloredResult}"/>
    `
  } else {
    // Unknown paint type - fallback
    paintPrimitives = `
      <feFlood flood-color="${FALLBACK_STROKE_COLOR}" flood-opacity="1" result="${prefix}_color"/>
      <feComposite in="${prefix}_color" in2="${prefix}_dilated" operator="in" result="${coloredResult}"/>
    `
  }

  // Build the complete primitive
  // 1. Dilate to outer radius
  // 2. Apply paint (color/image/gradient)
  // 3. Knockout inner radius (if any) to create "ring"
  // 4. Apply opacity
  // Note: vertices option (round/miter/bevel) reserved for future implementation

  let primitives = `<feMorphology in="SourceAlpha" operator="dilate" radius="${outerRadius}" result="${prefix}_dilated"/>`
  primitives += paintPrimitives

  // Create ring/outline shape:
  // - For outer strokes: knockout inner strokes to create "ring" between them
  // - For all strokes: knockout SourceAlpha (text interior) so strokes don't bleed
  //   into fill area when fillOpacity < 1 (e.g., deboss effect)
  if (innerRadius > 0) {
    // Outer stroke: create ring between inner and outer radius
    primitives += `
      <feMorphology in="SourceAlpha" operator="dilate" radius="${innerRadius}" result="${prefix}_inner"/>
      <feComposite in="${coloredResult}" in2="${prefix}_inner" operator="out" result="${prefix}_ring"/>
    `
    coloredResult = `${prefix}_ring`
  } else {
    // Innermost stroke: knockout SourceAlpha (text interior) directly
    primitives += `
      <feComposite in="${coloredResult}" in2="SourceAlpha" operator="out" result="${prefix}_outline"/>
    `
    coloredResult = `${prefix}_outline`
  }

  // Apply stroke opacity (if not 1)
  let finalResult = coloredResult
  if (effectiveOpacity < 1) {
    primitives += `
      <feComponentTransfer in="${coloredResult}" result="${prefix}_final">
        <feFuncA type="linear" slope="${effectiveOpacity}"/>
      </feComponentTransfer>
    `
    finalResult = `${prefix}_final`
  }

  return {
    defsXML,
    primitives,
    mergeNode: `<feMergeNode in="${finalResult}"/>`,
  }
}

/**
 * Build image adjustment filter primitives for ImagePaint
 */
function buildImageAdjustmentPrimitives(paint: Paint, inputResult: string, outputResult: string): string {
  if (!isImagePaint(paint)) return ''

  const opacity = paint.opacity ?? 1
  const filters = paint.filters || {}

  const result = buildImageFilterPrimitives(filters, {
    inputResult,
    outputPrefix: `${outputResult}_step`,
    useResultChaining: true,
  })

  if (!result.hasAdjustments && opacity === 1) {
    return ''
  }

  const primitives = [...result.primitives]
  const currentInput = result.finalResult || inputResult

  primitives.push(`
    <feComponentTransfer in="${currentInput}" result="${outputResult}">
      <feFuncA type="linear" slope="${opacity}"/>
    </feComponentTransfer>
  `)

  return primitives.join('\n')
}

/**
 * Calculate total stroke extent (for filter bounds calculation)
 */
export function calculateStrokesExtent(strokes: StrokeConfig[], fontSize: number): number {
  let totalRadius = 0
  for (const stroke of strokes) {
    if (stroke.visible !== false) {
      totalRadius += strokePercentToPixels(stroke.weight, fontSize)
    }
  }
  return totalRadius
}

/** Options for building image pattern SVG */
interface ImagePatternSvgOptions {
  patternSize: PatternSize
  loadedImage: LoadedImage
  /** Full SVG width (includes stroke extension on both sides) */
  svgWidth: number
  /** Full SVG height (includes stroke + curve extension) */
  svgHeight: number
  rotation: number
  patternId: string
}

/**
 * Build rotation transform attribute
 */
function buildRotationAttr(rotation: number, centerX: number, centerY: number): string {
  return rotation !== 0 ? `transform="rotate(${rotation} ${centerX} ${centerY})"` : ''
}

/**
 * Wrap content in SVG container
 *
 * For curved text with stroke, we DON'T use viewBox offset anymore.
 * Instead, we size the SVG to the full expanded dimensions and position content absolutely.
 * This avoids coordinate system mismatches with feImage percentage-based positioning.
 *
 * @param content - SVG content to wrap
 * @param width - Full SVG width (includes stroke extension)
 * @param height - Full SVG height (includes stroke + curve extension)
 */
function wrapInSvg(content: string, width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${content}</svg>`
}

/** Options for building tiled pattern content */
interface TiledPatternOptions {
  patternId: string
  dataUrl: string
  tileWidth: number
  tileHeight: number
  svgWidth: number
  svgHeight: number
  rotationAttr: string
  preserveAspectRatio: string
}

/**
 * Build tiled pattern SVG content
 *
 * Uses absolute positioning - the SVG is sized to the full expanded dimensions,
 * and the pattern/rect fill the entire SVG area starting from (0,0).
 */
function buildTiledPatternContent(options: TiledPatternOptions): string {
  const { patternId, dataUrl, tileWidth, tileHeight, svgWidth, svgHeight, rotationAttr, preserveAspectRatio } = options

  const imageAttrs = [
    `href="${dataUrl}"`,
    `x="0" y="0"`,
    `width="${tileWidth}" height="${tileHeight}"`,
    `preserveAspectRatio="${preserveAspectRatio}"`,
    rotationAttr,
  ]
    .filter(Boolean)
    .join(' ')

  // Pattern starts at origin and tiles across the entire SVG
  // Rect fills the entire SVG area
  return `
    <defs>
      <pattern id="${patternId}" patternUnits="userSpaceOnUse"
        x="0" y="0" width="${tileWidth}" height="${tileHeight}">
        <image ${imageAttrs}/>
      </pattern>
    </defs>
    <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}"
      fill="url(#${patternId})"/>
  `
}

/**
 * Build image pattern SVG based on patternSize mode
 *
 * For tiling modes, we create an SVG with embedded pattern and encode it as data URL.
 * This approach works because feImage can't reference pattern elements directly.
 *
 * IMPORTANT: We use absolute positioning (content starts at 0,0) instead of viewBox offsets.
 * The SVG is sized to the full expanded dimensions (includes stroke + curve extension).
 * This avoids coordinate system mismatches with feImage percentage-based positioning.
 *
 * Pattern modes:
 * - 'stretch': Scale image to fill entire bounds
 * - 'stretch-x': Stretch horizontally, tile vertically
 * - 'stretch-y': Stretch vertically, tile horizontally
 * - number (10-100): Tile at percentage of original image size
 */
function buildImagePatternSvg(options: ImagePatternSvgOptions): { embeddedSvg: string } {
  const { patternSize, loadedImage, svgWidth, svgHeight, rotation, patternId } = options
  const { width: imgWidth, height: imgHeight, dataUrl } = loadedImage

  // STRETCH mode: scale image to fill entire bounds
  if (patternSize === 'stretch') {
    const rotationAttr = buildRotationAttr(rotation, svgWidth / 2, svgHeight / 2)
    const imageAttrs = [
      `href="${dataUrl}"`,
      `x="0" y="0"`,
      `width="${svgWidth}" height="${svgHeight}"`,
      'preserveAspectRatio="none"',
      rotationAttr,
    ]
      .filter(Boolean)
      .join(' ')
    const content = `<image ${imageAttrs}/>`
    return { embeddedSvg: wrapInSvg(content, svgWidth, svgHeight) }
  }

  // STRETCH-X mode: stretch horizontally, tile vertically
  if (patternSize === 'stretch-x') {
    const tileHeight = imgHeight
    const rotationAttr = buildRotationAttr(rotation, svgWidth / 2, tileHeight / 2)
    const content = buildTiledPatternContent({
      patternId,
      dataUrl,
      tileWidth: svgWidth,
      tileHeight,
      svgWidth,
      svgHeight,
      rotationAttr,
      preserveAspectRatio: 'none',
    })
    return { embeddedSvg: wrapInSvg(content, svgWidth, svgHeight) }
  }

  // STRETCH-Y mode: stretch vertically, tile horizontally
  if (patternSize === 'stretch-y') {
    const tileWidth = imgWidth
    const rotationAttr = buildRotationAttr(rotation, tileWidth / 2, svgHeight / 2)
    const content = buildTiledPatternContent({
      patternId,
      dataUrl,
      tileWidth,
      tileHeight: svgHeight,
      svgWidth,
      svgHeight,
      rotationAttr,
      preserveAspectRatio: 'none',
    })
    return { embeddedSvg: wrapInSvg(content, svgWidth, svgHeight) }
  }

  // PERCENTAGE mode (10-100): tile at percentage of original image size
  if (typeof patternSize === 'number') {
    const scale = patternSize / 100
    const tileWidth = imgWidth * scale
    const tileHeight = imgHeight * scale
    const rotationAttr = buildRotationAttr(rotation, tileWidth / 2, tileHeight / 2)
    const content = buildTiledPatternContent({
      patternId,
      dataUrl,
      tileWidth,
      tileHeight,
      svgWidth,
      svgHeight,
      rotationAttr,
      preserveAspectRatio: 'xMidYMid meet',
    })
    return { embeddedSvg: wrapInSvg(content, svgWidth, svgHeight) }
  }

  // Fallback: stretch (handles unknown patternSize values)
  const fallbackAttrs = [
    `href="${dataUrl}"`,
    `x="0" y="0"`,
    `width="${svgWidth}" height="${svgHeight}"`,
    'preserveAspectRatio="none"',
  ].join(' ')
  const content = `<image ${fallbackAttrs}/>`
  return { embeddedSvg: wrapInSvg(content, svgWidth, svgHeight) }
}
