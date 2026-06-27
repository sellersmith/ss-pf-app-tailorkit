// Re-export shared utilities from Konva core effects
export { parseColorWithOpacity } from 'extensions/tailorkit-src/src/shared/libraries/konva/effects/utils'

/**
 * Get optimal cache pixel ratio for Konva node caching
 * Returns 2x devicePixelRatio for non-Safari/iOS browsers for higher quality
 * Safari/iOS uses 1x to avoid performance issues with large cached canvases
 */
export function getCachePixelRatio(): number {
  const baseRatio = window.devicePixelRatio || 1
  return baseRatio
}
