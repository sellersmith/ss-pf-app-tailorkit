/**
 * Text Effects Konva Filter
 *
 * Combined Konva filter for drop shadows and inner shadows using pixel manipulation.
 * Works on CACHED pixels after rendering - no compositing issues with alpha.
 *
 * Benefits:
 * - Fill opacity independence: Filter runs AFTER text renders
 * - No offset drift: Direct array indexing - no compositing artifacts
 * - No scale issues: Works on cached pixels at whatever resolution Konva rendered
 * - Safari compatible: Pure pixel manipulation, no ctx.filter dependency
 *
 * @module shared/libraries/konva/effects
 */

import type Konva from 'konva'
import type { DropShadowConfig, InnerShadowConfig } from './types'
import { stackBlurAlphaChannel } from './stackblur'

/**
 * RGB color type
 */
interface RGB {
  r: number
  g: number
  b: number
}

/**
 * Parse color string to RGB values
 * Handles hex, rgb(), rgba() formats
 */
function parseColor(color: string): RGB {
  // Handle rgba/rgb
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/)
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
    }
  }

  // Handle hex
  if (color.startsWith('#')) {
    const hex = color.replace('#', '')
    if (hex.length >= 6) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
      }
    }
    // Short hex (#RGB)
    if (hex.length >= 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      }
    }
  }

  // Default to black
  return { r: 0, g: 0, b: 0 }
}

/**
 * Resolve color - handles 'currentColor' keyword
 */
function resolveColor(color: string, textColor: string): RGB {
  if (color === 'currentColor') {
    return parseColor(textColor)
  }
  return parseColor(color)
}

/**
 * Extract alpha channel from pixels
 */
function extractAlpha(pixels: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const alpha = new Uint8Array(width * height)
  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = pixels[i * 4 + 3]
  }
  return alpha
}

/**
 * Apply offset to alpha array
 */
function offsetAlpha(
  alphaData: Uint8Array,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number
): Uint8Array {
  const result = new Uint8Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = x - offsetX
      const srcY = y - offsetY
      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        result[y * width + x] = alphaData[srcY * width + srcX]
      }
    }
  }

  return result
}

/**
 * Apply a single drop shadow to pixels
 *
 * SVG Filter equivalent:
 * <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur"/>
 * <feOffset in="blur" dx="4" dy="4" result="offset"/>
 * <feFlood flood-color="#000000" flood-opacity="0.5" result="color"/>
 * <feComposite in="color" in2="offset" operator="in" result="shadow"/>
 * <feComposite in="shadow" in2="SourceAlpha" operator="out" result="knockout"/>
 * <feMerge><feMergeNode in="knockout"/><feMergeNode in="SourceGraphic"/></feMerge>
 */
function applyDropShadow(
  pixels: Uint8ClampedArray,
  sourceAlpha: Uint8Array,
  width: number,
  height: number,
  shadow: DropShadowConfig,
  textColor: string
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(pixels)

  const shadowColor = resolveColor(shadow.color, textColor)
  const shadowOpacity = shadow.opacity ?? 1
  const blurRadius = shadow.radius || 0
  const offsetX = Math.round(shadow.offsetX || 0)
  const offsetY = Math.round(shadow.offsetY || 0)

  // Step 1: Blur the source alpha (feGaussianBlur)
  let blurredAlpha = sourceAlpha
  if (blurRadius > 0) {
    blurredAlpha = stackBlurAlphaChannel(sourceAlpha, width, height, blurRadius)
  }

  // Step 2: Offset the blurred alpha (feOffset)
  const offsetedAlpha = offsetAlpha(blurredAlpha, width, height, offsetX, offsetY)

  // Step 3: Knockout - shadow only visible OUTSIDE original shape (feComposite operator="out")
  const knockoutAlpha = new Uint8Array(width * height)
  for (let i = 0; i < sourceAlpha.length; i++) {
    // Shadow visible only where original is transparent
    knockoutAlpha[i] = Math.max(0, offsetedAlpha[i] - sourceAlpha[i])
  }

  // Step 4: Composite shadow BEHIND original (feMerge)
  for (let i = 0; i < sourceAlpha.length; i++) {
    const shadowA = (knockoutAlpha[i] / 255) * shadowOpacity
    const srcA = result[i * 4 + 3] / 255
    const pixelIdx = i * 4

    if (shadowA > 0) {
      // Porter-Duff: shadow behind, original on top
      // Final = original + shadow * (1 - originalAlpha)
      const outA = srcA + shadowA * (1 - srcA)

      if (outA > 0) {
        const srcR = result[pixelIdx]
        const srcG = result[pixelIdx + 1]
        const srcB = result[pixelIdx + 2]

        result[pixelIdx] = Math.round((srcR * srcA + shadowColor.r * shadowA * (1 - srcA)) / outA)
        result[pixelIdx + 1] = Math.round((srcG * srcA + shadowColor.g * shadowA * (1 - srcA)) / outA)
        result[pixelIdx + 2] = Math.round((srcB * srcA + shadowColor.b * shadowA * (1 - srcA)) / outA)
        result[pixelIdx + 3] = Math.round(outA * 255)
      }
    }
  }

  return result
}

/**
 * Apply a single inner shadow to pixels
 *
 * SVG Filter equivalent:
 * <feFlood flood-color="#000000" flood-opacity="1" result="flood"/>
 * <feComposite in="flood" in2="SourceAlpha" operator="out" result="composite1"/>
 * <feOffset dx="4" dy="4" in="composite1" result="offset"/>
 * <feGaussianBlur stdDeviation="4" in="offset" result="blur"/>
 * <feComposite in="blur" in2="SourceAlpha" operator="in" result="composite2"/>
 * <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="composite2"/></feMerge>
 */
function applyInnerShadow(
  pixels: Uint8ClampedArray,
  sourceAlpha: Uint8Array,
  width: number,
  height: number,
  shadow: InnerShadowConfig,
  textColor: string
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(pixels)

  const shadowColor = resolveColor(shadow.color, textColor)
  const shadowOpacity = shadow.opacity ?? 1
  const blurRadius = shadow.radius || 0
  const offsetX = Math.round(shadow.offsetX || 0)
  const offsetY = Math.round(shadow.offsetY || 0)

  // Step 1: Create inverted alpha (feComposite operator="out")
  // This creates "everything EXCEPT the text shape"
  const invertedAlpha = new Uint8Array(width * height)
  for (let i = 0; i < sourceAlpha.length; i++) {
    invertedAlpha[i] = 255 - sourceAlpha[i]
  }

  // Step 2: Offset the inverted alpha (feOffset)
  const offsetedAlpha = offsetAlpha(invertedAlpha, width, height, offsetX, offsetY)

  // Step 3: Blur the offset mask (feGaussianBlur)
  let blurredAlpha = offsetedAlpha
  if (blurRadius > 0) {
    blurredAlpha = stackBlurAlphaChannel(offsetedAlpha, width, height, blurRadius)
  }

  // Step 4: Clip to original shape (feComposite operator="in")
  // Inner shadow only visible INSIDE the original shape
  const innerShadowAlpha = new Uint8Array(width * height)
  for (let i = 0; i < sourceAlpha.length; i++) {
    // min() = intersection of both shapes
    innerShadowAlpha[i] = Math.min(blurredAlpha[i], sourceAlpha[i])
  }

  // Step 5: Composite inner shadow ON TOP of original (feMerge)
  for (let i = 0; i < sourceAlpha.length; i++) {
    const shadowA = (innerShadowAlpha[i] / 255) * shadowOpacity
    const pixelIdx = i * 4

    if (shadowA > 0) {
      // "source-over" compositing: shadow on top of original
      result[pixelIdx] = Math.round(result[pixelIdx] * (1 - shadowA) + shadowColor.r * shadowA)
      result[pixelIdx + 1] = Math.round(result[pixelIdx + 1] * (1 - shadowA) + shadowColor.g * shadowA)
      result[pixelIdx + 2] = Math.round(result[pixelIdx + 2] * (1 - shadowA) + shadowColor.b * shadowA)
      // Alpha stays the same (shadow is inside the shape)
    }
  }

  return result
}

/**
 * Apply fill opacity to pixels
 * Multiplies alpha channel by fillOpacity
 */
function applyFillOpacity(pixels: Uint8ClampedArray, fillOpacity: number): Uint8ClampedArray {
  if (fillOpacity >= 1) return pixels

  const result = new Uint8ClampedArray(pixels)

  for (let i = 0; i < result.length; i += 4) {
    result[i + 3] = Math.round(result[i + 3] * fillOpacity)
  }

  return result
}

/**
 * Calculate maximum shadow extent for cache bounds expansion
 */
export function calculateMaxShadowExtent(
  dropShadows: DropShadowConfig[],
  innerShadows: InnerShadowConfig[] = []
): number {
  let maxExtent = 0

  for (const shadow of dropShadows) {
    if (shadow.visible === false) continue
    const extent = (shadow.radius || 0) * 2 + Math.max(Math.abs(shadow.offsetX || 0), Math.abs(shadow.offsetY || 0))
    maxExtent = Math.max(maxExtent, extent)
  }

  for (const shadow of innerShadows) {
    if (shadow.visible === false) continue
    const extent = (shadow.radius || 0) * 2 + Math.max(Math.abs(shadow.offsetX || 0), Math.abs(shadow.offsetY || 0))
    maxExtent = Math.max(maxExtent, extent)
  }

  // Add padding for safety
  return Math.ceil(maxExtent) + 10
}

/**
 * Text Effects Konva Filter
 *
 * This filter handles BOTH drop shadows and inner shadows by processing
 * the cached pixel data directly.
 *
 * Usage:
 * 1. Set custom properties on the node:
 *    node.setAttr('textEffectsDropShadows', dropShadows)
 *    node.setAttr('textEffectsInnerShadows', innerShadows)
 *    node.setAttr('textEffectsFillOpacity', fillOpacity)
 *    node.setAttr('textEffectsTextColor', textColor)
 *
 * 2. Apply filter and cache with expanded bounds:
 *    node.filters([textEffectsFilter])
 *    node.cache({ x: -extent, y: -extent, width: w + extent*2, height: h + extent*2 })
 */
export function textEffectsFilter(this: Konva.Node, imageData: ImageData): void {
  const pixels = imageData.data
  const width = imageData.width
  const height = imageData.height

  // Get effects config from node attributes
  const dropShadows = (this.getAttr('textEffectsDropShadows') as DropShadowConfig[]) || []
  const innerShadows = (this.getAttr('textEffectsInnerShadows') as InnerShadowConfig[]) || []
  const fillOpacity = (this.getAttr('textEffectsFillOpacity') as number) ?? 1
  const textColor = (this.getAttr('textEffectsTextColor') as string) || '#000000'

  // Filter visible effects
  const visibleDropShadows = dropShadows.filter(s => s.visible !== false)
  const visibleInnerShadows = innerShadows.filter(s => s.visible !== false)

  // Early exit if no effects
  if (visibleDropShadows.length === 0 && visibleInnerShadows.length === 0 && fillOpacity >= 1) {
    return
  }

  // Extract source alpha once (used by all shadows)
  const sourceAlpha = extractAlpha(pixels, width, height)

  // Start with original pixels
  let result = new Uint8ClampedArray(pixels)

  // 1. Apply fill opacity first (before shadows)
  if (fillOpacity < 1) {
    result = applyFillOpacity(result, fillOpacity)
  }

  // 2. Apply all drop shadows (rendered BEHIND - reverse order for correct stacking)
  for (let i = visibleDropShadows.length - 1; i >= 0; i--) {
    result = applyDropShadow(result, sourceAlpha, width, height, visibleDropShadows[i], textColor)
  }

  // 3. Apply all inner shadows (rendered ON TOP)
  for (const shadow of visibleInnerShadows) {
    result = applyInnerShadow(result, sourceAlpha, width, height, shadow, textColor)
  }

  // Copy result back to imageData
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = result[i]
  }
}

/**
 * Register custom Konva attributes for text effects
 * Call this once at app initialization
 */
export function registerTextEffectsAttributes(): void {
  // These are custom attributes that don't need factory registration
  // They can be set/get via node.setAttr() / node.getAttr()
  // No special registration needed in Konva
}
