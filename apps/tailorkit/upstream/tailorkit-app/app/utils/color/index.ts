/**
 * Color utilities barrel file
 *
 * Re-exports all color-related utilities for easy importing.
 */

export { colorDistance, colorsAreSimilar } from './distance'
export { rgbToHex, hexToRgb, rgbToArray, arrayToRgb } from './conversion'
export {
  getPixelColor,
  getPixelColorWithAlpha,
  isPixelOpaque,
  getPixelIndex,
  setPixelColor,
  setPixelColorWithAlpha,
  DEFAULT_OPAQUE_ALPHA_THRESHOLD,
} from './pixel'

// Re-export types for convenience
export type { RGB, RGBA, HexColor } from '~/types/color'
