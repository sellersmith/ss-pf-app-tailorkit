/**
 * SVG Parsing Utilities - Barrel Export
 */

// Gradient parsing
export {
  parseGradientStops,
  parseLinearGradient,
  parseRadialGradient,
  extractGradients,
  isGradientReference,
  extractGradientId,
} from './gradientParsing'

// Filter parsing
export { parseFilterPrimitive, extractFilters, isFilterReference, extractFilterId } from './filterParsing'

// Mask and ClipPath parsing
export {
  extractMasks,
  extractClipPaths,
  isMaskReference,
  extractMaskId,
  isClipPathReference,
  extractClipPathId,
} from './maskClipParsing'
