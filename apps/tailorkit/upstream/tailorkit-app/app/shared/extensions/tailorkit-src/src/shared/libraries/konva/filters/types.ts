/**
 * Image Filter Type Definitions
 * Provides type-safe interfaces for image filters in TailorKit
 */

/**
 * Image filter configuration with normalized values (-1 to +1 range)
 * All values are optional - undefined means no filter applied
 */
export interface ImageFilters {
  /** Brightness adjustment: -1 (darker) to +1 (brighter), 0 = default */
  exposure?: number;

  /** Contrast adjustment: -1 (less contrast) to +1 (more contrast), 0 = default */
  contrast?: number;

  /** Color saturation: -1 (grayscale) to +1 (vivid), 0 = default */
  saturation?: number;

  /** Hue rotation: -1 to +1 (maps to -180° to +180°) */
  hue?: number;

  /** Blur amount: 0 (none) to 1 (maximum, maps to 20px) */
  blur?: number;

  /** Noise amount: 0 (none) to 1 (maximum, maps to 0.5 intensity) */
  noise?: number;

  /** Pixelate amount: 0 (none) to 1 (maximum, maps to 20 pixel size) */
  pixelate?: number;

  /** Optional preset name that was applied */
  preset?: string;
}

/**
 * Filter preset configuration
 */
export interface FilterPreset {
  /** Unique preset identifier */
  name: string;

  /** User-friendly description */
  description?: string;

  /** Filter values to apply */
  filters: ImageFilters;

  /** Optional thumbnail image URL */
  thumbnail?: string;

  /** Category for grouping presets */
  category?: 'basic' | 'vintage' | 'modern' | 'artistic' | 'custom';
}

/**
 * Filter mapping configuration for Konva
 */
export interface FilterMapping {
  /** Konva filter name */
  konvaFilter: string;

  /** Transform function from normalized to Konva value */
  transform: (value: number) => number;

  /** Specific property for multi-value filters (e.g., HSL) */
  property?: string;
}

/**
 * Filter cache entry
 */
export interface FilterCacheEntry {
  /** Unique hash of filter configuration */
  hash: string;

  /** Cached image data */
  imageData: ImageData | null;

  /** Timestamp of cache creation */
  timestamp: number;

  /** Size in bytes */
  size: number;
}

/**
 * Filter performance metrics
 */
export interface FilterPerformanceMetrics {
  /** Time taken to apply filters in milliseconds */
  applyTime: number;

  /** Number of filters applied */
  filterCount: number;

  /** Cache hit/miss */
  cacheHit: boolean;

  /** Image dimensions */
  imageSize: {
    width: number;
    height: number;
  };
}

/**
 * [Reserved for Phase 2] Text fill configuration with image support
 * This interface is reserved for future implementation of text fills with images
 */
export interface TextFillConfig {
  /** Fill type */
  type: 'solid' | 'gradient' | 'image';

  /** Image URL for image fills */
  imageUrl?: string;

  /** Filters to apply to fill image */
  imageFilters?: ImageFilters;

  /** Fill opacity (0-1) */
  opacity?: number;

  /** Blend mode for the fill */
  blendMode?: GlobalCompositeOperation;

  /** Scale of the image fill */
  scale?: { x: number; y: number };

  /** Offset of the image fill */
  offset?: { x: number; y: number };
}

/**
 * Filter application options
 */
export interface FilterApplicationOptions {
  /** Use cached result if available */
  useCache?: boolean;

  /** Enable performance tracking */
  trackPerformance?: boolean;

  /** Quality level (affects blur and noise) */
  quality?: 'low' | 'medium' | 'high';

  /** Enable debouncing for real-time preview */
  debounce?: number;
}

/**
 * Filter value range configuration
 */
export interface FilterRange {
  /** Minimum value */
  min: number;

  /** Maximum value */
  max: number;

  /** Default value */
  default: number;

  /** Step size for UI controls */
  step: number;

  /** Display unit (%, °, px, etc.) */
  unit?: string;

  /** Display formatter function */
  formatter?: (value: number) => string;
}

/**
 * Complete filter configuration with ranges
 */
export type FilterConfig = {
  [K in keyof Required<Omit<ImageFilters, 'preset'>>]: FilterRange;
};

/**
 * Filter state for UI management
 */
export interface FilterUIState {
  /** Currently active filters */
  activeFilters: ImageFilters;

  /** Selected preset (if any) */
  selectedPreset?: string;

  /** Modified since preset selection */
  isModified: boolean;

  /** Currently adjusting filter */
  activeControl?: keyof ImageFilters;

  /** Preview enabled */
  previewEnabled: boolean;

  /** Comparison mode (before/after) */
  comparisonMode?: 'side-by-side' | 'split' | 'toggle';
}

/**
 * Export options for filtered images
 */
export interface FilteredImageExportOptions {
  /** Output format */
  format: 'png' | 'jpeg' | 'webp';

  /** Quality (0-1, for jpeg/webp) */
  quality?: number;

  /** Apply filters during export */
  applyFilters: boolean;

  /** Scale factor for export */
  scale?: number;

  /** Include alpha channel */
  includeAlpha?: boolean;
}

/**
 * Filter history entry for undo/redo
 */
export interface FilterHistoryEntry {
  /** Timestamp of the change */
  timestamp: number;

  /** Previous filter state */
  previousFilters: ImageFilters | null;

  /** New filter state */
  newFilters: ImageFilters;

  /** Description of the change */
  description: string;

  /** Layer ID affected */
  layerId: string;
}