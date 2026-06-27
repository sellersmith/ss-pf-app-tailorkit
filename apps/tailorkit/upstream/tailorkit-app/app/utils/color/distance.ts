/**
 * Color distance utilities
 *
 * Functions for calculating color similarity and distance.
 * Uses Euclidean distance in RGB color space.
 */

import type { RGB } from '~/types/color'

/**
 * RGB color as tuple array [r, g, b]
 */
type RGBTuple = [number, number, number]

/**
 * Color input that can be either RGB object or tuple
 */
type ColorInput = RGB | RGBTuple | { r?: number; g?: number; b?: number; 0?: number; 1?: number; 2?: number }

/**
 * Normalize color input to RGB values
 */
function normalizeColor(color: ColorInput): { r: number; g: number; b: number } {
  if (Array.isArray(color)) {
    return { r: color[0], g: color[1], b: color[2] }
  }
  // Handle both RGB object and array-like object
  const r = (color as RGB).r ?? (color as any)[0] ?? 0
  const g = (color as RGB).g ?? (color as any)[1] ?? 0
  const b = (color as RGB).b ?? (color as any)[2] ?? 0
  return { r, g, b }
}

/**
 * Calculate Euclidean color distance between two RGB colors
 *
 * @param c1 - First color (RGB object or tuple)
 * @param c2 - Second color (RGB object or tuple)
 * @returns Distance value (0-441.67 for RGB space)
 *
 * @example
 * colorDistance({ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }) // ~360.62
 * colorDistance([255, 0, 0], [0, 0, 255]) // ~360.62
 */
export function colorDistance(c1: ColorInput, c2: ColorInput): number {
  const color1 = normalizeColor(c1)
  const color2 = normalizeColor(c2)

  return Math.sqrt(
    Math.pow(color1.r - color2.r, 2) + Math.pow(color1.g - color2.g, 2) + Math.pow(color1.b - color2.b, 2)
  )
}

/**
 * Check if two colors are similar within a tolerance
 *
 * @param c1 - First color
 * @param c2 - Second color
 * @param tolerance - Maximum distance to consider similar (default: 30)
 * @returns True if colors are within tolerance
 *
 * @example
 * colorsAreSimilar({ r: 255, g: 0, b: 0 }, { r: 250, g: 5, b: 5 }, 30) // true
 */
export function colorsAreSimilar(c1: ColorInput, c2: ColorInput, tolerance: number = 30): boolean {
  return colorDistance(c1, c2) <= tolerance
}
