/* eslint-disable max-lines */
/**
 * SVG Print Document Builder
 *
 * Builds SVG documents for print output, converting template layers to vector SVG.
 * Used alongside PNG generation in the print image workflow.
 *
 * Features:
 * - Text layers rendered as native SVG text elements (vector, scalable)
 * - Image layers embedded as base64 data URIs for portability
 * - Proper layer ordering and transforms
 * - Font embedding via base64 CSS
 *
 * @module shared/libraries/svg
 */

import { SVG, type Svg, type Element as SvgElement } from '@svgdotjs/svg.js'
import { createSVGText, type SVGTextConfig } from './svg-text-creator'
import { createSVGTextPath, type SVGTextPathConfig } from './svg-text-path-creator'
import { createEnvelopeText, type EnvelopeTextOptions } from './svg-envelope-text-creator'
import { fetchCustomFontAsBase64, fetchGoogleFontCss } from './svg-font-manager'
import { generateTextPath } from '../konva/text/text-path-geometry'
import { scaleCustomPathToFit } from '../konva/text/scale-custom-path'
import { compositeImageWithOverlay } from '../../utils/overlay-compositor'
import type { DropShadowConfig, InnerShadowConfig } from '../konva/effects/types'
import type { StrokeConfig } from '../paint/stroke-types'
import type { Paint } from '../paint/paint-types'

/**
 * Configuration for creating a print SVG document
 */
export interface SvgPrintDocumentConfig {
  width: number
  height: number
  resolution?: number
  backgroundColor?: string
}

/**
 * Text layer data for SVG rendering
 */
export interface TextLayerData {
  content: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  fontSize: number
  fontFamily: string
  fontWeight?: string | number
  fontStyle?: string
  fontSrc?: string
  color: string
  letterSpacing?: number
  lineHeight?: number
  align?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  wrap?: 'none' | 'word' | 'char'
  textDecoration?: string
  fillOpacity?: number
  stroke?: string
  strokeWidth?: number
  strokes?: StrokeConfig[]
  fill?: Paint
  dropShadows?: DropShadowConfig[]
  innerShadows?: InnerShadowConfig[]
  // Text shape properties
  textShape?: 'none' | 'circle' | 'curve' | 'custom' | 'fill-shape'
  circleStartAngle?: number
  circleEndAngle?: number
  circleInverted?: boolean
  curvePeaks?: number
  curveBend?: number
  customPathData?: string
  customPathMetadata?: { viewBoxWidth: number; viewBoxHeight: number }
  customPathInverted?: boolean
  fillShapePathData?: string
  fillShapeMetadata?: { viewBoxWidth: number; viewBoxHeight: number }
  fillShapeVerticalOffset?: number
  fillShapeVerticalScale?: number
  fillShapeHorizontalOffset?: number
  fillShapeHorizontalScale?: number
  fillShapeCharacterSpacing?: number
}

/**
 * Overlay data for image layers
 */
export interface ImageOverlayData {
  overlaySvg: string
  overlayMetadata?: {
    imageWidth: number
    imageHeight: number
    hasClipPaths?: boolean
    hasFilters?: boolean
    hasDrawnPaths?: boolean
  }
}

/**
 * Image layer data for SVG rendering
 */
export interface ImageLayerData {
  src: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  opacity?: number
  /** Pre-converted base64 data URI (if already converted) */
  base64DataUri?: string
  /** SVG overlay data for vector overlays on image */
  overlay?: ImageOverlayData
  /**
   * Whether to skip filter presets (debossing, embossing, etc.) in the output.
   * When true (default), filter presets are stripped for physical engraving.
   * When false, filter presets are preserved for regular printing.
   */
  skipFilterPresets?: boolean
  /**
   * Rotation pivot for the image, expressed in bbox-local coordinates
   * (where (0, 0) is the visible bbox top-left and (width, height) is the bottom-right).
   *
   * Accepted values:
   * - 'top-left' (default): equivalent to `{ offsetX: 0, offsetY: 0 }`. Backward-compatible.
   * - 'center': equivalent to `{ offsetX: width/2, offsetY: height/2 }`.
   * - `{ offsetX, offsetY }`: explicit pivot — the visible bbox top-left stays at (x, y),
   *   only the rotation pivot moves.
   *
   * Used by charm rendering to align the print rotation pivot with the slot anchor point.
   * @default 'top-left'
   */
  rotationOrigin?: 'top-left' | 'center' | { offsetX: number; offsetY: number }
}

/**
 * SVG Print Document wrapper class
 */
export class SvgPrintDocument {
  private svg: Svg
  private config: SvgPrintDocumentConfig
  private fontStyles: string[] = []
  private defsElement: SvgElement | null = null

  constructor(config: SvgPrintDocumentConfig) {
    this.config = config
    this.svg = SVG().size(config.width, config.height)
    this.svg.viewbox(0, 0, config.width, config.height)
    this.svg.attr('xmlns', 'http://www.w3.org/2000/svg')

    // Add background if specified
    if (config.backgroundColor) {
      this.svg.rect(config.width, config.height).fill(config.backgroundColor)
    }
  }

  /**
   * Add font CSS to the document defs
   */
  addFontStyle(fontCss: string): void {
    if (fontCss && !this.fontStyles.includes(fontCss)) {
      this.fontStyles.push(fontCss)
    }
  }

  /**
   * Add a text layer to the SVG document
   */
  async addTextLayer(layer: TextLayerData, fontBase64Css?: string | null): Promise<void> {
    const {
      content,
      x,
      y,
      width,
      height,
      rotation = 0,
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      color,
      letterSpacing,
      lineHeight,
      align,
      verticalAlign,
      wrap,
      textDecoration,
      fillOpacity,
      stroke,
      strokeWidth,
      dropShadows,
      innerShadows,
      textShape = 'none',
      fillShapePathData,
      fillShapeMetadata,
      fillShapeVerticalOffset,
      fillShapeVerticalScale,
      fillShapeHorizontalOffset,
      fillShapeHorizontalScale,
      fillShapeCharacterSpacing,
      circleStartAngle,
      circleEndAngle,
      circleInverted,
      curvePeaks,
      curveBend,
      customPathData,
      customPathMetadata,
      customPathInverted,
    } = layer

    // Add font CSS if provided
    if (fontBase64Css) {
      this.addFontStyle(fontBase64Css)
    }

    let textSvgString: string | null = null

    // Handle fill-shape (envelope distortion) text
    if (textShape === 'fill-shape' && fillShapePathData) {
      // Scale the fill shape path to fit text layer dimensions (matching PNG renderer behavior)
      const scaledFillShapePath = scaleCustomPathToFit(fillShapePathData, width, height, fillShapeMetadata)

      const envelopeOptions: EnvelopeTextOptions = {
        text: content,
        fontSize,
        fontFamily,
        fontWeight,
        letterSpacing,
        lineHeight,
        fillColor: color,
        strokeColor: stroke,
        strokeWidth,
        fontBase64Css,
        verticalOffset: fillShapeVerticalOffset,
        verticalScale: fillShapeVerticalScale,
        horizontalOffset: fillShapeHorizontalOffset,
        horizontalScale: fillShapeHorizontalScale,
        characterSpacing: fillShapeCharacterSpacing,
      }

      const envelopeResult = createEnvelopeText(scaledFillShapePath, envelopeOptions, width, height)
      if (envelopeResult) {
        textSvgString = envelopeResult.svg
      }
    }
    // Handle text on path (circle, curve, custom)
    else if (textShape !== 'none' && (textShape === 'circle' || textShape === 'curve' || textShape === 'custom')) {
      // Generate path data from shape parameters
      const { textPath: generatedPathData } = generateTextPath({
        width,
        height,
        fontSize,
        textShape,
        circleStartAngle: circleStartAngle ?? 0,
        circleEndAngle: circleEndAngle ?? Math.PI,
        circleInverted,
        curvePeaks,
        curveBend,
        customPathData,
        customPathMetadata,
        customPathInverted,
        fontFamily,
        color,
        align: align || 'center',
        verticalAlign: verticalAlign || 'top',
      })

      // Skip if no valid path was generated
      if (!generatedPathData) {
        console.warn('Failed to generate text path for shape:', textShape)
        return
      }

      const textPathConfig: SVGTextPathConfig = {
        content,
        width,
        height,
        fontSize,
        fontFamily,
        fontWeight,
        fontStyle,
        fontBase64Css,
        color,
        letterSpacing,
        align: align as SVGTextPathConfig['align'],
        stroke,
        strokeWidth,
        dropShadows,
        innerShadows,
        pathData: generatedPathData,
        curveBend,
      }

      const textPathResult = createSVGTextPath(textPathConfig)
      textSvgString = textPathResult.svg.svg()
    }
    // Handle regular text
    else {
      const textConfig: SVGTextConfig = {
        content,
        width,
        height,
        fontSize,
        fontFamily,
        fontWeight,
        fontStyle,
        fontBase64Css,
        color,
        letterSpacing,
        lineHeight,
        align: align as SVGTextConfig['align'],
        verticalAlign: verticalAlign as SVGTextConfig['verticalAlign'],
        wrap: wrap as SVGTextConfig['wrap'],
        textDecoration,
        fillOpacity,
        stroke,
        strokeWidth,
        dropShadows,
        innerShadows,
      }

      const textResult = createSVGText(textConfig)
      textSvgString = textResult.svg.svg()
    }

    if (!textSvgString) {
      return
    }

    // Create a group for the layer with position and rotation
    const group = this.svg.group()

    // Apply transform: translate to position, then rotate around top-left corner
    // This matches Konva's default rotation behavior (around position point when no offset is set)
    let transform = `translate(${x}, ${y})`
    if (rotation !== 0) {
      transform += ` rotate(${rotation})`
    }
    group.attr('transform', transform)

    // Parse the text SVG and add its content to the group
    // Extract the inner content from the SVG wrapper
    const innerContent = extractSvgInnerContent(textSvgString)
    if (innerContent) {
      group.svg(innerContent)
    }
  }

  /**
   * Add an image layer to the SVG document
   */
  async addImageLayer(layer: ImageLayerData): Promise<void> {
    const {
      src,
      x,
      y,
      width,
      height,
      rotation = 0,
      opacity = 1,
      base64DataUri,
      overlay,
      skipFilterPresets = true,
      rotationOrigin = 'top-left',
    } = layer

    // Create a group for the layer with position and rotation
    const group = this.svg.group()

    // Apply transform. Two modes:
    // - 'top-left' (default): rotate around the position point — matches Konva's default
    //   behavior for layers rendered without an offsetX/offsetY pivot.
    // - 'center' or explicit `{ offsetX, offsetY }`: rotate around an arbitrary pivot
    //   inside the bbox, while keeping the visible top-left at (x, y).
    //   Implemented as: translate(pivot) → rotate → translate(-pivot-in-bbox-local).
    let pivotOffsetX = 0
    let pivotOffsetY = 0
    if (rotationOrigin === 'center') {
      pivotOffsetX = width / 2
      pivotOffsetY = height / 2
    } else if (typeof rotationOrigin === 'object' && rotationOrigin !== null) {
      pivotOffsetX = rotationOrigin.offsetX
      pivotOffsetY = rotationOrigin.offsetY
    }

    let transform: string
    if (rotation !== 0 && (pivotOffsetX !== 0 || pivotOffsetY !== 0)) {
      const cx = x + pivotOffsetX
      const cy = y + pivotOffsetY
      transform = `translate(${cx}, ${cy}) rotate(${rotation}) translate(${-pivotOffsetX}, ${-pivotOffsetY})`
    } else {
      transform = `translate(${x}, ${y})`
      if (rotation !== 0) {
        transform += ` rotate(${rotation})`
      }
    }
    group.attr('transform', transform)

    // Determine the source to use
    const sourceToCheck = base64DataUri || src
    const isSvg = isSvgSource(sourceToCheck)

    // Check if source is SVG - embed as inline SVG to preserve vector quality
    if (isSvg) {
      try {
        let svgContent = await fetchSvgContent(sourceToCheck)

        // Strip filter presets from SVG content when skipFilterPresets is true
        // This matches PNG export behavior where filter effects are removed for physical engraving
        if (skipFilterPresets) {
          svgContent = stripFilterPresetsFromSvg(svgContent)
        }

        // Extract viewBox from original SVG for proper scaling
        const viewBoxMatch = svgContent.match(/viewBox=["']([^"']+)["']/)
        const viewBox = viewBoxMatch ? viewBoxMatch[1] : `0 0 ${width} ${height}`

        // Extract inner content from the SVG
        const innerContent = extractSvgInnerContent(svgContent)

        // Create a nested SVG element that scales to fit the layer dimensions
        const nestedSvg = SVG(
          `<svg viewBox="${viewBox}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet">${innerContent}</svg>`
        )

        if (opacity !== 1) {
          nestedSvg.attr('opacity', opacity)
        }

        group.add(nestedSvg)
      } catch (error) {
        console.warn('Failed to embed SVG as inline, falling back to image element:', error)
        // Fallback to image element if SVG embedding fails
        const image = group.image(sourceToCheck).size(width, height)
        if (opacity !== 1) {
          image.attr('opacity', opacity)
        }
      }

      // For SVG images with overlay, add overlay paths on top (preserves vector quality)
      if (overlay?.overlaySvg) {
        try {
          const overlayPaths = parseOverlayPaths(overlay.overlaySvg, skipFilterPresets)
          if (overlayPaths.pathsContent && overlayPaths.pathsContent.trim()) {
            const overlayViewBox = overlayPaths.viewBox || `0 0 ${width} ${height}`
            const overlayGroup = group.group()
            overlayGroup.attr('class', 'image-overlay')

            // Include defs content when preserving filter presets
            const defsSection = overlayPaths.defsContent ? `<defs>${overlayPaths.defsContent}</defs>` : ''

            const nestedSvg = SVG(
              `<svg viewBox="${overlayViewBox}" width="${width}" height="${height}" `
                + `preserveAspectRatio="none">${defsSection}${overlayPaths.pathsContent}</svg>`
            )
            overlayGroup.add(nestedSvg)
          }
        } catch (error) {
          console.warn('Failed to add SVG overlay to SVG image layer:', error)
        }
      }
    } else {
      // For raster images (PNG, JPG, etc.)
      // If overlay is provided, composite the image with overlay first (same as PNG export)
      // This ensures consistent rendering between PNG and SVG exports
      if (overlay?.overlaySvg) {
        try {
          // Use the same compositing approach as PNG export
          const composited = await compositeImageWithOverlay({
            imageUrl: base64DataUri || src,
            overlay: {
              combinedSvg: overlay.overlaySvg,
              metadata: overlay.overlayMetadata || {
                imageWidth: width,
                imageHeight: height,
                hasClipPaths: true,
                hasFilters: true,
                hasDrawnPaths: true,
              },
            },
            targetWidth: width,
            targetHeight: height,
            devicePixelRatio: 2, // Use 2x for good quality in print
          })

          // Embed the composited result
          const image = group.image(composited.dataUrl).size(width, height)
          if (opacity !== 1) {
            image.attr('opacity', opacity)
          }
        } catch (error) {
          console.warn('Failed to composite overlay with raster image, embedding without overlay:', error)
          // Fallback: embed raster image without overlay
          let imageSrc = base64DataUri || src
          if (!imageSrc.startsWith('data:')) {
            try {
              imageSrc = await imageUrlToBase64(src)
            } catch {
              imageSrc = src
            }
          }
          const image = group.image(imageSrc).size(width, height)
          if (opacity !== 1) {
            image.attr('opacity', opacity)
          }
        }
      } else {
        // No overlay - just embed the raster image as base64
        let imageSrc = base64DataUri || src
        if (!imageSrc.startsWith('data:')) {
          try {
            imageSrc = await imageUrlToBase64(src)
          } catch (error) {
            console.warn('Failed to convert image to base64, using original URL:', error)
            imageSrc = src
          }
        }
        const image = group.image(imageSrc).size(width, height)
        if (opacity !== 1) {
          image.attr('opacity', opacity)
        }
      }
    }
  }

  /**
   * Export the SVG document as a string
   */
  export(): string {
    // Add font styles to defs if any
    if (this.fontStyles.length > 0) {
      const styleContent = this.fontStyles.join('\n')
      // Find or create defs element
      let defs = this.svg.findOne('defs')
      if (!defs) {
        defs = this.svg.defs()
      }
      // Add style element
      const styleElement = SVG('<style type="text/css"></style>')
      styleElement.node.textContent = styleContent
      defs.add(styleElement)
    }

    return this.svg.svg()
  }

  /**
   * Export the SVG as a base64 data URI
   * Uses base64 encoding to be compatible with dataURLtoFile function
   */
  exportAsDataUri(): string {
    const svgString = this.export()
    const base64 = btoa(unescape(encodeURIComponent(svgString)))
    return `data:image/svg+xml;base64,${base64}`
  }

  /**
   * Get the underlying SVG.js instance
   */
  getSvg(): Svg {
    return this.svg
  }
}

/**
 * Create a new SVG print document
 */
export function createSvgPrintDocument(config: SvgPrintDocumentConfig): SvgPrintDocument {
  return new SvgPrintDocument(config)
}

/**
 * Fetch and prepare font CSS for embedding
 */
export async function prepareFontCss(
  fontFamily: string,
  fontWeight?: string | number,
  fontSrc?: string
): Promise<string | null> {
  try {
    if (fontSrc) {
      return await fetchCustomFontAsBase64(fontSrc, fontFamily)
    }
    if (fontFamily !== 'Arial') {
      return await fetchGoogleFontCss(fontFamily, String(fontWeight || 400))
    }
  } catch (error) {
    console.warn('Failed to fetch font for SVG embedding:', error)
  }
  return null
}

/**
 * Check if a URL or data URI is an SVG
 */
export function isSvgSource(src: string): boolean {
  if (!src) return false

  // Check data URI mime type
  if (src.startsWith('data:image/svg+xml')) {
    return true
  }

  // Check URL extension (case-insensitive)
  const urlWithoutQuery = src.split('?')[0]
  return urlWithoutQuery.toLowerCase().endsWith('.svg')
}

/**
 * Fetch SVG content from URL and return as string
 */
export async function fetchSvgContent(url: string): Promise<string> {
  // Handle data URI
  if (url.startsWith('data:image/svg+xml')) {
    // Extract SVG content from data URI
    if (url.includes('base64,')) {
      const base64Content = url.split('base64,')[1]
      return atob(base64Content)
    }
    if (url.includes(',')) {
      // URL-encoded SVG
      const encodedContent = url.split(',')[1]
      return decodeURIComponent(encodedContent)
    }
    throw new Error('Invalid SVG data URI format')
  }

  // Fetch from URL
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch SVG: ${response.status}`)
  }
  return response.text()
}

/**
 * Convert an image URL to a base64 data URI
 */
export async function imageUrlToBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0)

      try {
        const dataUri = canvas.toDataURL('image/png')
        resolve(dataUri)
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error(`Failed to load image: ${url}`))
    }

    img.src = url
  })
}

/**
 * Parse overlay SVG and extract the overlay paths group content
 *
 * The overlay SVG has a specific structure from VectorEditor:
 * - <defs> containing clipPath, mask, filter definitions
 * - <g id="overlay-paths"> containing the actual drawn paths
 *
 * For print SVG output, we extract paths from g#overlay-paths.
 * Filter effects can be optionally stripped based on skipFilterPresets parameter.
 *
 * @param svgString - The overlay SVG string
 * @param skipFilterPresets - Whether to strip filter attributes (default: true for engraving)
 * @returns Object with viewBox, paths content, and defs content (if filters preserved)
 */
function parseOverlayPaths(
  svgString: string,
  skipFilterPresets: boolean = true
): { viewBox: string | null; pathsContent: string; defsContent?: string } {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgString, 'image/svg+xml')

    // Check for parsing errors
    const parserError = doc.querySelector('parsererror')
    if (parserError) {
      console.warn('[parseOverlayPaths] SVG parsing error')
      return { viewBox: null, pathsContent: '' }
    }

    const svgElement = doc.querySelector('svg')
    if (!svgElement) {
      return { viewBox: null, pathsContent: '' }
    }

    // Extract viewBox from SVG element
    let viewBox = svgElement.getAttribute('viewBox')
    if (!viewBox) {
      // Fallback to width/height attributes
      const w = svgElement.getAttribute('width')
      const h = svgElement.getAttribute('height')
      if (w && h) {
        viewBox = `0 0 ${w} ${h}`
      }
    }

    // Extract defs content if preserving filters
    let defsContent: string | undefined
    if (!skipFilterPresets) {
      const defsElement = svgElement.querySelector('defs')
      if (defsElement) {
        defsContent = defsElement.innerHTML
      }
    }

    // Find the overlay paths group (g#overlay-paths)
    const overlayPathsGroup = svgElement.querySelector('g#overlay-paths')
    if (!overlayPathsGroup) {
      // Fallback: try to extract all path elements if no overlay-paths group
      const allPaths = svgElement.querySelectorAll('path')
      if (allPaths.length === 0) {
        return { viewBox, pathsContent: '', defsContent }
      }

      // Clone paths and optionally strip filter references for print output
      const pathsContent = Array.from(allPaths)
        .map(path => {
          const clonedPath = path.cloneNode(true) as Element
          // Remove filter attribute if skipFilterPresets is true (for engraving)
          if (skipFilterPresets) {
            clonedPath.removeAttribute('filter')
          }
          return clonedPath.outerHTML
        })
        .join('\n')

      return { viewBox, pathsContent, defsContent }
    }

    // Clone the overlay paths group and optionally strip filter references from all paths
    const clonedGroup = overlayPathsGroup.cloneNode(true) as Element
    if (skipFilterPresets) {
      const paths = clonedGroup.querySelectorAll('path')
      for (const path of paths) {
        // Remove filter attribute (filter effects are for visualization only in engraving)
        path.removeAttribute('filter')
      }
    }

    // Return the inner content of the cloned group (the paths themselves)
    return { viewBox, pathsContent: clonedGroup.innerHTML, defsContent }
  } catch (error) {
    console.warn('[parseOverlayPaths] Error parsing overlay SVG:', error)
    return { viewBox: null, pathsContent: '' }
  }
}

/**
 * Strip ALL filter effects from SVG content for print image generation.
 * Filter effects are for visualization only and should not be included
 * in physical engraving/printing output.
 *
 * This removes:
 * - All <filter> elements from <defs>
 * - All filter="url(#...)" attributes from elements
 * - All filter: url(#...) in inline styles
 *
 * @param svgContent - The SVG content string
 * @returns Modified SVG content with all filters stripped
 */
function stripFilterPresetsFromSvg(svgContent: string): string {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')

    // Check for parsing errors
    const parserError = doc.querySelector('parsererror')
    if (parserError) {
      console.warn('[stripFilterPresetsFromSvg] SVG parsing error, returning original')
      return svgContent
    }

    const svg = doc.documentElement
    let modified = false

    // Remove ALL filter elements - print images don't need any filter effects
    const filters = svg.querySelectorAll('filter')
    if (filters.length > 0) {
      for (const filter of filters) {
        filter.remove()
      }
      modified = true
    }

    // Remove ALL filter attributes from elements
    const elementsWithFilter = svg.querySelectorAll('[filter]')
    if (elementsWithFilter.length > 0) {
      for (const el of elementsWithFilter) {
        el.removeAttribute('filter')
      }
      modified = true
    }

    // Remove filter properties from inline styles
    const elementsWithStyle = svg.querySelectorAll('[style]')
    for (const el of elementsWithStyle) {
      const style = el.getAttribute('style') || ''
      if (style.includes('filter')) {
        // Remove filter property from style
        const newStyle = style.replace(/filter\s*:\s*[^;]+;?/gi, '')
        if (newStyle.trim()) {
          el.setAttribute('style', newStyle)
        } else {
          el.removeAttribute('style')
        }
        modified = true
      }
    }

    // If no modifications were made, return original content
    if (!modified) {
      return svgContent
    }

    // Serialize back to string
    const serializer = new XMLSerializer()
    return serializer.serializeToString(svg)
  } catch (error) {
    console.warn('[stripFilterPresetsFromSvg] Error processing SVG:', error)
    return svgContent
  }
}

/**
 * Extract inner content from an SVG string (removes the outer <svg> wrapper)
 */
function extractSvgInnerContent(svgString: string): string {
  // Match the content between <svg...> and </svg>
  const match = svgString.match(/<svg[^>]*>([\s\S]*)<\/svg>/i)
  return match ? match[1] : svgString
}

/**
 * Build a complete print SVG from layer data
 * This is a convenience function for common use cases
 */
export async function buildPrintSvg(config: {
  width: number
  height: number
  layers: Array<{ type: 'text' | 'image'; data: TextLayerData | ImageLayerData }>
  backgroundColor?: string
}): Promise<string> {
  const doc = createSvgPrintDocument({
    width: config.width,
    height: config.height,
    backgroundColor: config.backgroundColor,
  })

  for (const layer of config.layers) {
    if (layer.type === 'text') {
      const textData = layer.data as TextLayerData
      const fontCss = await prepareFontCss(textData.fontFamily, textData.fontWeight, textData.fontSrc)
      await doc.addTextLayer(textData, fontCss)
    } else if (layer.type === 'image') {
      await doc.addImageLayer(layer.data as ImageLayerData)
    }
  }

  return doc.export()
}
