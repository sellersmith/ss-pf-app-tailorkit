import type { DropShadowConfig, InnerShadowConfig } from './types'
import { isIOS } from '../../../../assets/utils/devices'

/**
 * Resolve color value, replacing 'currentColor' with actual text color
 */
export function resolveColor(color: string, textColor?: string): string {
  return color === 'currentColor' ? textColor || 'rgba(0, 0, 0, 1)' : color
}

/**
 * Parse color and modify its opacity/alpha value
 * Handles rgb(), rgba(), hex, and named colors
 */
export function parseColorWithOpacity(color: string, opacity: number): string {
  // If already rgba, replace alpha
  if (color.startsWith('rgba(')) {
    return color.replace(/,\s*[\d.]+\)$/, `, ${opacity})`)
  }

  // If rgb, convert to rgba
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`)
  }

  // If hex, convert to rgba
  if (color.startsWith('#')) {
    const hex = color.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }

  // For named colors, wrap in rgba (browser will parse)
  // This is a fallback that may not work perfectly
  return `rgba(0, 0, 0, ${opacity})`
}

/**
 * Calculate off-screen rendering distance for shadows (inner and drop)
 *
 * CRITICAL: This must calculate ONE distance for ALL shadows using the MAXIMUM radius.
 * This matches the original algorithm exactly (line 248-249 in extensions utils.ts):
 * ```
 * const maxRadius = Math.max(...visibleShadows.map(s => s.radius))
 * const hideDistance = Math.ceil((maxDimension + maxRadius + 100) * scale)
 * ```
 *
 * @param text - Text content
 * @param fontSize - Font size in pixels
 * @param letterSpacing - Letter spacing in pixels
 * @param width - Optional text container width
 * @param shadows - Array of shadow configs (inner or drop shadows)
 * @param scale - Canvas scale factor (default 1 for Konva)
 * @returns Hide distance in pixels
 */
export function calculateHideDistance(
  text: string,
  fontSize: number,
  letterSpacing: number,
  width: number | undefined,
  shadows: Array<InnerShadowConfig | DropShadowConfig>,
  scale: number = 1
): number {
  if (shadows.length === 0) return 0

  // Estimate text width if not provided
  // Use rough approximation: fontSize * 0.6 per character + letter spacing
  const estimatedTextWidth = width || text.length * fontSize * 0.6 + letterSpacing * (text.length - 1)
  const maxDimension = Math.max(estimatedTextWidth, fontSize)

  // Get maximum radius from ALL shadows (this is critical!)
  const maxRadius = Math.max(...shadows.map(s => s.radius), 0)

  // Calculate hide distance with buffer
  return Math.min(Math.ceil((maxDimension + maxRadius + 100) * scale))
}

/**
 * Calculate rotated shadow offset for inner shadows under element rotation
 *
 * When a text element is rotated, shadow offsets must be rotated too to maintain
 * the correct visual appearance. This function applies a 2D rotation matrix.
 *
 * @param hideDistance - Off-screen distance for shadow text
 * @param shadowOffsetX - Shadow X offset from effect config
 * @param shadowOffsetY - Shadow Y offset from effect config
 * @param rotationDeg - Element rotation in degrees
 * @param scale - Uniform scale factor (max of scaleX/scaleY)
 * @returns Rotated shadow offset coordinates and scaled blur
 */
export function calculateRotatedShadowOffset(
  hideDistance: number,
  shadowOffsetX: number,
  shadowOffsetY: number,
  rotationDeg: number,
  scale: number = 1
): { offsetX: number; offsetY: number; scale: number } {
  // Calculate base offset in local coordinates (scale-aware)
  const baseOffsetX = -hideDistance + shadowOffsetX * scale
  const baseOffsetY = -hideDistance + shadowOffsetY * scale

  // Apply 2D rotation matrix
  const rad = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  return {
    offsetX: baseOffsetX * cos - baseOffsetY * sin,
    offsetY: baseOffsetX * sin + baseOffsetY * cos,
    scale,
  }
}

/**
 * Render inner shadows directly to target canvas using forward chaining
 *
 * Strategy (Figma's algorithm):
 * 1. Base fill = first inner-shadow's color
 * 2. For each shadow:
 *    - Draw text off-screen (x + hideDistance, y + hideDistance)
 *    - Shadow offset brings it back: (-hideDistance - offsetX, -hideDistance - offsetY)
 *    - Use source-atop to clip shadow to text shape
 *    - Next shadow's color becomes current shadow's fill color (forward chaining)
 */
/**
 * Convert hex color to RGB object
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) {
    return { r: 0, g: 0, b: 0 }
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

/**
 * Parse color string to RGB values
 * Handles hex, rgb(), rgba() formats
 */
function parseColorToRgb(color: string): { r: number; g: number; b: number; a: number } {
  // Handle rgba
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
    }
  }

  // Handle hex with alpha (#RRGGBBAA)
  if (color.startsWith('#')) {
    const hex = color.replace('#', '')
    const rgb = hexToRgb(color)
    // Check for 8-character hex with alpha
    if (hex.length === 8) {
      const alpha = parseInt(hex.substring(6, 8), 16) / 255
      return { ...rgb, a: alpha }
    }
    return { ...rgb, a: 1 }
  }

  // Default to black
  return { r: 0, g: 0, b: 0, a: 1 }
}

/**
 * Extract RGB color (without alpha) from any color format
 * Returns hex color string
 */
export function extractRgbColor(color: string): string {
  const { r, g, b } = parseColorToRgb(color)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Extract alpha value from any color format
 * Returns alpha as number 0-1
 * Handles hex, rgb(), rgba() formats
 */
export function extractAlpha(color: string): number {
  const { a } = parseColorToRgb(color)
  return a
}

export const SAFE_CANVAS_PIXELS_IOS = 16_000_000
export const SAFE_CANVAS_PIXELS_DEFAULT = 26_843_545_600

/**
 * Options for computing safe cache pixel ratio
 */
export interface CachePixelRatioOptions {
  /** Whether the cache is for a text path (needs higher quality) */
  forTextPath?: boolean
  /** Whether the cache is for an SVG image (needs crisp rendering) */
  forSvg?: boolean
}

/**
 * Compute safe cache pixel ratio for Konva
 *
 * Ensures the cached canvas doesn't exceed memory limits on mobile devices.
 * iOS Safari has stricter limits than other browsers.
 *
 * For SVG images, we use higher minimum ratios to preserve vector crispness.
 * For text paths, we also use higher quality to prevent transparency issues.
 *
 * @param width - Width of the cache
 * @param height - Height of the cache
 * @param options - Options for computing the ratio (can also be boolean for backward compat)
 * @returns Safe cache pixel ratio
 */
export function computeSafeCachePixelRatio(
  width: number,
  height: number,
  options: CachePixelRatioOptions | boolean = false
): number {
  // Handle backward compatibility (boolean = forTextPath)
  const opts: CachePixelRatioOptions = typeof options === 'boolean' ? { forTextPath: options } : options
  const { forTextPath = false, forSvg = false } = opts

  const area = Math.max(0, Math.floor(width) * Math.floor(height))
  if (area === 0) return 1

  // For TextPath (especially curves), we need higher quality to prevent transparency issues
  // Increase max pixels for text paths to maintain quality
  const MAX_CACHE_PIXELS = isIOS() ? SAFE_CANVAS_PIXELS_IOS : SAFE_CANVAS_PIXELS_DEFAULT

  // pixelRatio scales both dimensions, so area scales by r^2
  const r = Math.min(1, Math.sqrt(MAX_CACHE_PIXELS / area))

  // Keep a higher minimum for different content types
  // SVG images need higher quality to preserve vector crispness (match device DPR)
  // TextPath needs higher quality to prevent transparency issues
  let MIN_R: number
  if (forSvg) {
    // SVG images: aim for device DPR to maintain crispness
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    MIN_R = isIOS() ? Math.min(dpr, 2) : Math.min(dpr, 3)
  } else if (forTextPath) {
    MIN_R = isIOS() ? 0.5 : 0.7
  } else {
    MIN_R = isIOS() ? 0.33 : 0.5
  }

  return Math.max(MIN_R, r)
}
