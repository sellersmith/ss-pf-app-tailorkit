/**
 * Konva Filters Module
 * Exports all filter-related functionality
 */

// Types
export type {
  ImageFilters,
  FilterPreset,
  FilterMapping,
  FilterCacheEntry,
  FilterPerformanceMetrics,
  TextFillConfig,
  FilterApplicationOptions,
  FilterRange,
  FilterConfig,
  FilterUIState,
  FilteredImageExportOptions,
  FilterHistoryEntry,
} from './types';

// Core pipeline
export {
  ImageFilterPipeline,
  FILTER_MAPPINGS,
  FILTER_CONFIG,
} from './image-filter-pipeline';

// Presets
export {
  FILTER_PRESETS,
  FilterPresetManager,
} from './filter-presets';

// Cache
export { FilterCache } from './filter-cache';

// Helper functions
export { applyFiltersToKonvaImage, createFilteredImage } from './helpers';

// Constants
export const FILTER_INSPECTOR_KEY = 'image-filters-inspector';
export const MAX_FILTER_VALUE = 1;
export const MIN_FILTER_VALUE = -1;
export const FILTER_DEBOUNCE_MS = 100;

/**
 * Initialize filter system
 */
export function initializeFilterSystem(): void {
  // Initialize cache
  FilterCache.initialize({
    maxSize: 50 * 1024 * 1024, // 50MB
    maxEntries: 100,
    ttl: 15 * 60 * 1000, // 15 minutes
    cleanupInterval: 60 * 1000, // 1 minute
  });
}

/**
 * Cleanup filter system
 */
export function cleanupFilterSystem(): void {
  FilterCache.destroy();
}