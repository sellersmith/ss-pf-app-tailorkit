/**
 * SVG Types - Barrel Export
 * Re-exports all SVG effect and parsed types
 */

// Effect types
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
} from './effects'

// Effect helper functions
export {
  createSolidPaint,
  createGradientPaint,
  createNonePaint,
  createDefaultPathStyle,
  createLinearGradient,
  createRadialGradient,
  createBlurFilter,
  createDropShadowFilter,
  createSaturationFilter,
  createHueRotateFilter,
} from './effects'

// Extended parsed types
export type { SvgDefs, ParsedPathExtended, ParsedSvgExtended, UsedDefIds } from './parsed'

// Parsed helper functions
export {
  createEmptyDefs,
  hasAnyDefs,
  cloneDefs,
  createParsedPathExtended,
  createEmptyParsedSvg,
  convertToExtendedPath,
  convertToExtendedSvg,
  convertToLegacyPath,
  convertToLegacySvg,
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
} from './parsed'
