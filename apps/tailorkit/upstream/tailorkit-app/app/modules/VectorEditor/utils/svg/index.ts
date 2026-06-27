/**
 * SVG Utilities - Barrel Export
 * Re-exports all SVG parsing, geometry, and effect utilities
 */

// Path parsing utilities
export {
  parseSvgPath,
  serializePathCommands,
  extractPathsFromSvg,
  parseSvgString,
  decodeSvgDataUri,
  encodeSvgToDataUri,
  rebuildSvgString,
  calculatePathBounds,
  calculatePathCenter,
} from './pathParsing'

// Path parsing types
export type { PathCommandType, Point, PathCommand, ParsedPath, ParsedSvg } from './pathParsing'

// Path geometry utilities
export {
  distance,
  getPointOnLine,
  closestPointOnLineSegment,
  isPointNearLineSegment,
  getPointOnQuadraticBezier,
  getPointOnCubicBezier,
  isPointNearSegment,
  findSegmentAtPoint,
  insertNodeIntoPath,
  closePath,
  // Connected segment detection (for subpath highlighting)
  findClosestNodeInPath,
  findConnectedSegment,
  parseAllSegments,
  buildSegmentPathD,
} from './pathGeometry'

// SVG Effect types
export type {
  // Gradients
  GradientStop,
  GradientUnits,
  SpreadMethod,
  LinearGradientDef,
  RadialGradientDef,
  GradientDef,
  // Filters
  BlendMode,
  ColorMatrixType,
  TurbulenceType,
  CompositeOperator,
  FeGaussianBlur,
  FeColorMatrix,
  FeDropShadow,
  FeBlend,
  FeOffset,
  FeFlood,
  FeComposite,
  FeMergeNode,
  FeMerge,
  FeTurbulence,
  FeDisplacementMap,
  PointLight,
  DistantLight,
  SpotLight,
  LightSource,
  FeDiffuseLighting,
  FeSpecularLighting,
  FilterPrimitive,
  FilterDef,
  // Masks and Clip Paths
  MaskType,
  MaskDef,
  ClipPathDef,
  // Paint
  SolidPaint,
  GradientPaint,
  NonePaint,
  Paint,
  // Color Adjustments
  ColorAdjustments,
  // Path Style
  PathStyle,
  // Subpath Style Types
  SubpathStyleOverride,
  SubpathKey,
  SubpathStylesMap,
  PathStyleWithSubpaths,
  // Extended parsed types
  SvgDefs,
  ParsedPathExtended,
  ParsedSvgExtended,
  // Orphaned defs cleanup
  UsedDefIds,
} from './types'

// Effect and parsed helper functions
export {
  // Paint helpers
  createSolidPaint,
  createGradientPaint,
  createNonePaint,
  createDefaultPathStyle,
  // Gradient helpers
  createLinearGradient,
  createRadialGradient,
  // Filter helpers
  createBlurFilter,
  createDropShadowFilter,
  createSaturationFilter,
  createHueRotateFilter,
  // Defs helpers
  createEmptyDefs,
  hasAnyDefs,
  cloneDefs,
  // Parsed helpers
  createParsedPathExtended,
  createEmptyParsedSvg,
  // Conversion helpers
  convertToExtendedPath,
  convertToExtendedSvg,
  convertToLegacyPath,
  convertToLegacySvg,
  // Defs manipulation helpers
  addGradientToDefs,
  removeGradientFromDefs,
  addFilterToDefs,
  removeFilterFromDefs,
  addMaskToDefs,
  removeMaskFromDefs,
  addClipPathToDefs,
  removeClipPathFromDefs,
  generateDefId,
  stringToPaint,
  // Orphaned defs cleanup
  collectUsedDefIds,
  cleanupOrphanedDefs,
  getCleanedDefs,
} from './types'

// Parsing utilities
export {
  // Gradient parsing
  parseGradientStops,
  parseLinearGradient,
  parseRadialGradient,
  extractGradients,
  isGradientReference,
  extractGradientId,
  // Filter parsing
  parseFilterPrimitive,
  extractFilters,
  isFilterReference,
  extractFilterId,
  // Mask and ClipPath parsing
  extractMasks,
  extractClipPaths,
  isMaskReference,
  extractMaskId,
  isClipPathReference,
  extractClipPathId,
} from './parsing'

// Serialization utilities
export type { RebuildSvgOptions } from './serialization'
export {
  serializeGradientStops,
  serializeLinearGradient,
  serializeRadialGradient,
  serializeGradient,
  serializeFilterPrimitive,
  serializeFilter,
  serializeMask,
  serializeClipPath,
  serializeDefs,
  serializePaint,
  serializePathExtended,
  rebuildSvgStringExtended,
  // Overlay serialization
  buildOverlaySvgOutput,
  serializeClipPathOverlay,
  serializeFilterOverlay,
  serializeCombinedOverlay,
} from './serialization'

// Color matrix utilities
export {
  identityMatrix,
  brightnessMatrix,
  contrastMatrix,
  saturationMatrix,
  hueRotateMatrix,
  invertMatrix,
  sepiaMatrix,
  grayscaleMatrix,
  opacityMatrix,
  multiplyColorMatrices,
  chainColorMatrices,
  colorAdjustmentsToMatrix,
  colorAdjustmentsToFeColorMatrix,
  colorAdjustmentsToFilter,
  formatMatrix,
} from './effects'

// Effect groups (for SVG-only clip/hole)
export type { SvgEffectGroup } from './effectGroups'
export { calculateEffectGroups, findAffectingGroup } from './effectGroups'
