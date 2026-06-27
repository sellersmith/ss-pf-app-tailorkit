/**
 * Color conversion utilities
 *
 * Functions for converting between color formats (RGB, Hex, etc.)
 */

import type { RGB, HexColor } from '~/types/color'

/**
 * Convert RGB object or tuple to hex color string
 *
 * @param rgb - RGB color as object or tuple
 * @returns Hex color string (e.g., "#ff0000")
 *
 * @example
 * rgbToHex({ r: 255, g: 0, b: 0 }) // "#ff0000"
 * rgbToHex([255, 128, 0]) // "#ff8000"
 */
export function rgbToHex(rgb: RGB | [number, number, number]): HexColor {
  const r = Array.isArray(rgb) ? rgb[0] : rgb.r
  const g = Array.isArray(rgb) ? rgb[1] : rgb.g
  const b = Array.isArray(rgb) ? rgb[2] : rgb.b

  return `#${[r, g, b]
    .map(c =>
      Math.min(255, Math.max(0, Math.round(c)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

/**
 * Convert hex color string to RGB object
 *
 * @param hex - Hex color string (with or without #)
 * @returns RGB object
 *
 * @example
 * hexToRgb("#ff0000") // { r: 255, g: 0, b: 0 }
 * hexToRgb("00ff00") // { r: 0, g: 255, b: 0 }
 */
export function hexToRgb(hex: HexColor): RGB {
  const cleanHex = hex.replace(/^#/, '')

  if (cleanHex.length === 3) {
    // Short form: #RGB -> #RRGGBB
    const r = parseInt(cleanHex[0] + cleanHex[0], 16)
    const g = parseInt(cleanHex[1] + cleanHex[1], 16)
    const b = parseInt(cleanHex[2] + cleanHex[2], 16)
    return { r, g, b }
  }

  const r = parseInt(cleanHex.slice(0, 2), 16)
  const g = parseInt(cleanHex.slice(2, 4), 16)
  const b = parseInt(cleanHex.slice(4, 6), 16)

  return { r, g, b }
}

/**
 * Convert RGB object to tuple array
 *
 * @param rgb - RGB object
 * @returns Tuple array [r, g, b]
 *
 * @example
 * rgbToArray({ r: 255, g: 128, b: 0 }) // [255, 128, 0]
 */
export function rgbToArray(rgb: RGB): [number, number, number] {
  return [rgb.r, rgb.g, rgb.b]
}

/**
 * Convert tuple array to RGB object
 *
 * @param arr - Tuple array [r, g, b]
 * @returns RGB object
 *
 * @example
 * arrayToRgb([255, 128, 0]) // { r: 255, g: 128, b: 0 }
 */
export function arrayToRgb(arr: [number, number, number]): RGB {
  return { r: arr[0], g: arr[1], b: arr[2] }
}
