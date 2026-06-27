/**
 * SVG Image Converter
 *
 * Converts SVG.js instances to HTMLImageElement for use with Konva.
 *
 * @module shared/libraries/svg
 */

import type { Svg } from '@svgdotjs/svg.js'

import { isIOS } from '../../../assets/utils/devices'

/**
 * Maximum pixel area for Safari compatibility.
 * Safari has strict limits (~4-6 million pixels) for SVG/canvas rendering.
 * iOS is more constrained due to memory pressure, so we use a smaller limit.
 */
const MAX_PIXEL_AREA = isIOS() ? 1_000_000 : 4_000_000

/**
 * Maximum render scale for iOS to prevent memory exhaustion.
 * iOS Safari has ~100-150MB limit for web content.
 * At 3x Retina, a 500x500 text = 2.25 million pixels = 9MB per render.
 * Limiting to 1.5x keeps each render under 2MB.
 */
const IOS_MAX_RENDER_SCALE = 1.5

/**
 * Render SVG to HTMLImageElement
 *
 * SAFARI FIX: Scales SVG dimensions before rasterization for higher resolution rendering.
 * Safari has issues with SVG filter rendering that cause pixelation.
 * By scaling the SVG element larger, we force Safari to render filters at higher resolution.
 *
 * SAFARI LIMIT: Caps final dimensions to stay under Safari's pixel limit (~4-6 million pixels).
 * Without this cap, large images (e.g., 900x900 with padding) would exceed the limit and fail to render.
 *
 * @param svg - SVG.js instance
 * @param scale - Optional scale factor (default: 1)
 * @returns Promise resolving to HTMLImageElement
 */
export async function svgToImage(svg: Svg, scale = 1): Promise<HTMLImageElement> {
  // Get original dimensions
  const width = svg.width() as number
  const height = svg.height() as number

  // Get device pixel ratio for crisp rendering on Retina displays
  // Safari needs SVG to be sized larger to render filters at higher resolution
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

  // iOS: Cap render scale to prevent memory exhaustion during rapid interactions
  // Desktop: Allow higher scale for better quality
  const maxScale = isIOS() ? IOS_MAX_RENDER_SCALE : Math.max(scale * dpr, 2)
  let renderScale = isIOS() ? Math.min(scale * dpr, maxScale) : Math.max(scale * dpr, 2)

  // Calculate scaled dimensions
  let scaledWidth = Math.ceil(width * renderScale)
  let scaledHeight = Math.ceil(height * renderScale)

  // SAFARI LIMIT: Cap dimensions to stay under Safari's pixel limit
  // If scaled dimensions exceed the limit, reduce scale to fit
  const scaledArea = scaledWidth * scaledHeight
  if (scaledArea > MAX_PIXEL_AREA) {
    // Calculate maximum scale that stays under the limit
    const areaMaxScale = Math.sqrt(MAX_PIXEL_AREA / (width * height))
    renderScale = Math.max(areaMaxScale, 1) // At least 1x
    scaledWidth = Math.ceil(width * renderScale)
    scaledHeight = Math.ceil(height * renderScale)
  }

  // Scale SVG size to force higher resolution rendering
  // Keep viewBox the same so content scales proportionally
  svg.size(scaledWidth, scaledHeight)

  // Get SVG string at scaled size
  const svgString = svg.svg()

  // Create blob URL for loading into image
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  // Load SVG as image at the scaled size
  const svgImage = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    // Set explicit dimensions to ensure browser renders at this size
    img.width = scaledWidth
    img.height = scaledHeight
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = error => {
      URL.revokeObjectURL(url)
      reject(error)
    }
    img.src = url
  })

  // Decode for non-blocking rendering
  try {
    await svgImage.decode()
  } catch {
    // Decode failed but image is still usable
  }

  return svgImage
}

/**
 * Get text element from SVG for applying filters
 *
 * @param svg - SVG.js instance
 * @returns First text element found
 */
export function getTextElement(svg: Svg) {
  return svg.find('text')[0]
}

/**
 * Get all text elements from SVG
 *
 * @param svg - SVG.js instance
 * @returns Array of text elements
 */
export function getAllTextElements(svg: Svg) {
  return svg.find('text')
}

/**
 * Get text fill elements (used when stroke is separated)
 *
 * @param svg - SVG.js instance
 * @returns Array of text-fill elements
 */
export function getTextFillElements(svg: Svg) {
  return svg.find('text.text-fill')
}

/**
 * Get text stroke elements
 *
 * @param svg - SVG.js instance
 * @returns Array of text-stroke elements
 */
export function getTextStrokeElements(svg: Svg) {
  return svg.find('text.text-stroke')
}

/**
 * Get text shadow elements
 *
 * @param svg - SVG.js instance
 * @returns Array of text-shadow elements
 */
export function getTextShadowElements(svg: Svg) {
  return svg.find('text.text-shadow')
}
