/**
 * Pixel-level color operations
 *
 * Functions for working with pixel data from ImageData or raw buffers.
 */

import type { RGB, RGBA } from '~/types/color'

/**
 * Default alpha threshold for considering a pixel opaque
 */
export const DEFAULT_OPAQUE_ALPHA_THRESHOLD = 10

/**
 * Get RGB color at a pixel index from image data
 *
 * @param data - Pixel data array (Uint8ClampedArray or Uint8Array)
 * @param idx - Pixel index (byte offset, must be multiple of 4)
 * @returns RGB color object
 *
 * @example
 * const color = getPixelColor(imageData.data, 0) // First pixel
 * const color = getPixelColor(imageData.data, 400) // 100th pixel (100 * 4)
 */
export function getPixelColor(data: Uint8ClampedArray | Uint8Array, idx: number): RGB {
  return {
    r: data[idx],
    g: data[idx + 1],
    b: data[idx + 2],
  }
}

/**
 * Get RGBA color at a pixel index from image data
 *
 * @param data - Pixel data array
 * @param idx - Pixel index (byte offset)
 * @returns RGBA color object
 */
export function getPixelColorWithAlpha(data: Uint8ClampedArray | Uint8Array, idx: number): RGBA {
  return {
    r: data[idx],
    g: data[idx + 1],
    b: data[idx + 2],
    a: data[idx + 3],
  }
}

/**
 * Check if a pixel is opaque (alpha above threshold)
 *
 * @param data - Pixel data array
 * @param idx - Pixel index (byte offset)
 * @param threshold - Alpha threshold (default: 10)
 * @returns True if pixel alpha is above threshold
 *
 * @example
 * if (isPixelOpaque(imageData.data, idx)) {
 *   // Process opaque pixel
 * }
 */
export function isPixelOpaque(
  data: Uint8ClampedArray | Uint8Array,
  idx: number,
  threshold: number = DEFAULT_OPAQUE_ALPHA_THRESHOLD
): boolean {
  return data[idx + 3] > threshold
}

/**
 * Calculate byte index from x, y coordinates
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param width - Image width
 * @returns Byte index (multiply of 4)
 *
 * @example
 * const idx = getPixelIndex(10, 20, 100) // (20 * 100 + 10) * 4 = 8040
 */
export function getPixelIndex(x: number, y: number, width: number): number {
  return (y * width + x) * 4
}

/**
 * Set RGB color at a pixel index in image data
 *
 * @param data - Pixel data array
 * @param idx - Pixel index (byte offset)
 * @param color - RGB color to set
 */
export function setPixelColor(data: Uint8ClampedArray | Uint8Array, idx: number, color: RGB): void {
  data[idx] = color.r
  data[idx + 1] = color.g
  data[idx + 2] = color.b
}

/**
 * Set RGBA color at a pixel index in image data
 *
 * @param data - Pixel data array
 * @param idx - Pixel index (byte offset)
 * @param color - RGBA color to set
 */
export function setPixelColorWithAlpha(data: Uint8ClampedArray | Uint8Array, idx: number, color: RGBA): void {
  data[idx] = color.r
  data[idx + 1] = color.g
  data[idx + 2] = color.b
  data[idx + 3] = color.a
}
