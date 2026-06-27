/**
 * Filter Utilities
 * Export filter presets and helpers
 */

// Image filter presets (for raster background images)
export type { ImageFilterPreset, FilterParameter, FilterPresetParams } from './imageFilterPresets'
export {
  IMAGE_FILTER_PRESETS,
  getFilterPresetById,
  getDefaultParams,
  getPresetDefaultParams,
  buildFilterPrimitives,
  buildCssPreview,
} from './imageFilterPresets'

// Path filter presets (for vector paths - printing techniques)
export type {
  PathFilterPreset,
  PathFilterParameter,
  PathFilterPresetParams,
  PathFilterCategory,
  PathFilterBuildOptions,
  FoilColorId,
  MetalSurfaceColorId,
} from './pathFilterPresets'
export {
  PATH_FILTER_PRESETS,
  PATH_FILTER_PRESETS_BY_CATEGORY,
  COLOR_OVERRIDING_FILTER_IDS,
  getPathFilterPresetById,
  getPathFilterDefaultParams,
  buildPathFilterPrimitives,
  buildPathFilterCssPreview,
  FOIL_COLORS,
  METAL_SURFACE_COLORS,
} from './pathFilterPresets'
