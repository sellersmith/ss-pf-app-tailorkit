/**
 * Image Filter Pipeline
 * Core filter engine that applies filters to Konva images using the filter system
 */

import Konva from 'konva';
import type {
  ImageFilters,
  FilterMapping,
  FilterApplicationOptions,
  FilterPerformanceMetrics,
  FilterConfig,
  FilterRange,
} from './types';

/**
 * Filter mappings from normalized values to Konva filter values
 */
export const FILTER_MAPPINGS: Record<keyof Omit<ImageFilters, 'preset'>, FilterMapping> = {
  exposure: {
    konvaFilter: 'Brightness',
    transform: (v: number) => v, // -1 to +1 directly
  },
  contrast: {
    konvaFilter: 'Contrast',
    transform: (v: number) => v * 100, // -100 to +100
  },
  saturation: {
    konvaFilter: 'HSL',
    transform: (v: number) => v * 2, // -2 to +2
    property: 'saturation',
  },
  hue: {
    konvaFilter: 'HSL',
    transform: (v: number) => v * 180, // -180° to +180°
    property: 'hue',
  },
  blur: {
    konvaFilter: 'Blur',
    transform: (v: number) => Math.max(0, v * 20), // 0 to 20px
  },
  noise: {
    konvaFilter: 'Noise',
    transform: (v: number) => Math.max(0, v * 0.5), // 0 to 0.5 amount
  },
  pixelate: {
    konvaFilter: 'Pixelate',
    transform: (v: number) => Math.max(1, Math.round(v * 20)), // 1 to 20 pixelSize
  },
};

/**
 * Filter configuration with UI ranges
 */
export const FILTER_CONFIG: FilterConfig = {
  exposure: {
    min: -1,
    max: 1,
    default: 0,
    step: 0.01,
    unit: '%',
    formatter: (v: number) => `${Math.round(v * 100)}%`,
  },
  contrast: {
    min: -1,
    max: 1,
    default: 0,
    step: 0.01,
    unit: '%',
    formatter: (v: number) => `${Math.round(v * 100)}%`,
  },
  saturation: {
    min: -1,
    max: 1,
    default: 0,
    step: 0.01,
    unit: '%',
    formatter: (v: number) => `${Math.round(v * 100)}%`,
  },
  hue: {
    min: -1,
    max: 1,
    default: 0,
    step: 0.01,
    unit: '°',
    formatter: (v: number) => `${Math.round(v * 180)}°`,
  },
  blur: {
    min: 0,
    max: 1,
    default: 0,
    step: 0.01,
    unit: 'px',
    formatter: (v: number) => `${Math.round(v * 20)}px`,
  },
  noise: {
    min: 0,
    max: 1,
    default: 0,
    step: 0.01,
    unit: '%',
    formatter: (v: number) => `${Math.round(v * 100)}%`,
  },
  pixelate: {
    min: 0,
    max: 1,
    default: 0,
    step: 0.05,
    unit: 'px',
    formatter: (v: number) => `${Math.max(1, Math.round(v * 20))}px`,
  },
};

/**
 * Main filter pipeline class
 */
export class ImageFilterPipeline {
  private static performanceMetrics: FilterPerformanceMetrics[] = [];
  private static readonly MAX_METRICS_HISTORY = 100;

  /**
   * Apply filters to a Konva image node
   */
  static applyFilters(
    imageNode: Konva.Image,
    filters: ImageFilters,
    options: FilterApplicationOptions = {}
  ): void {
    const startTime = performance.now();

    try {
      // Clear existing filters first
      this.clearFilters(imageNode);

      // Normalize filter values
      const normalizedFilters = this.normalizeFilters(filters);

      // Check if any filters are active
      if (!this.hasActiveFilters(normalizedFilters)) {
        imageNode.filters([]);
        imageNode.clearCache();
        return;
      }

      // Build filter array in optimal order
      const konvaFilters = this.buildKonvaFilters(normalizedFilters);

      // Apply filters to the image
      if (konvaFilters.length > 0) {
        // Cache the image first (required for multiple filters)
        imageNode.cache();

        // Apply filters
        imageNode.filters(konvaFilters);

        // Set filter properties
        this.setFilterProperties(imageNode, normalizedFilters);

        // Track performance if requested
        if (options.trackPerformance) {
          const endTime = performance.now();
          this.recordPerformanceMetrics({
            applyTime: endTime - startTime,
            filterCount: konvaFilters.length,
            cacheHit: false, // Will be implemented with cache system
            imageSize: {
              width: imageNode.width(),
              height: imageNode.height(),
            },
          });
        }
      }
    } catch (error) {
      console.error('Error applying filters:', error);
      // Restore image to unfiltered state on error
      this.clearFilters(imageNode);
      throw error;
    }
  }

  /**
   * Clear all filters from an image node
   */
  static clearFilters(imageNode: Konva.Image): void {
    imageNode.filters([]);
    imageNode.clearCache();
  }

  /**
   * Normalize filter values to ensure they're within valid ranges
   */
  static normalizeFilters(filters: ImageFilters): ImageFilters {
    const normalized: ImageFilters = {};

    for (const [key, value] of Object.entries(filters)) {
      if (key === 'preset' || value === undefined || value === null) {
        continue;
      }

      const filterKey = key as keyof Omit<ImageFilters, 'preset'>;
      const config = FILTER_CONFIG[filterKey];

      if (config) {
        // Clamp value to valid range
        normalized[filterKey] = Math.max(
          config.min,
          Math.min(config.max, value as number)
        );
      }
    }

    return normalized;
  }

  /**
   * Check if any filters are active
   */
  static hasActiveFilters(filters: ImageFilters): boolean {
    return Object.entries(filters).some(([key, value]) => {
      if (key === 'preset') return false;
      const filterKey = key as keyof Omit<ImageFilters, 'preset'>;
      const config = FILTER_CONFIG[filterKey];
      return value !== undefined && value !== config?.default;
    });
  }

  /**
   * Build array of Konva filters to apply
   */
  private static buildKonvaFilters(filters: ImageFilters): Array<typeof Konva.Filters[keyof typeof Konva.Filters]> {
    const konvaFilters: Array<typeof Konva.Filters[keyof typeof Konva.Filters]> = [];
    const addedFilters = new Set<string>();

    // Optimal order for filter application (blur should be last for performance)
    const filterOrder: Array<keyof Omit<ImageFilters, 'preset'>> = [
      'exposure',
      'contrast',
      'saturation',
      'hue',
      'noise',
      'pixelate',
      'blur',
    ];

    for (const filterKey of filterOrder) {
      const value = filters[filterKey];
      if (value === undefined || value === null) continue;

      const mapping = FILTER_MAPPINGS[filterKey];
      const config = FILTER_CONFIG[filterKey];

      // Skip if at default value
      if (value === config.default) continue;

      // Get the Konva filter
      const konvaFilterName = mapping.konvaFilter;
      const konvaFilter = Konva.Filters[konvaFilterName as keyof typeof Konva.Filters];

      if (konvaFilter && !addedFilters.has(konvaFilterName)) {
        konvaFilters.push(konvaFilter);
        addedFilters.add(konvaFilterName);
      }
    }

    return konvaFilters;
  }

  /**
   * Set filter properties on the image node
   */
  private static setFilterProperties(imageNode: Konva.Image, filters: ImageFilters): void {
    // Apply brightness (exposure)
    if (filters.exposure !== undefined) {
      const mapping = FILTER_MAPPINGS.exposure;
      imageNode.brightness(mapping.transform(filters.exposure));
    }

    // Apply contrast
    if (filters.contrast !== undefined) {
      const mapping = FILTER_MAPPINGS.contrast;
      imageNode.contrast(mapping.transform(filters.contrast));
    }

    // Apply HSL (saturation and hue)
    if (filters.saturation !== undefined || filters.hue !== undefined) {
      // Get current HSL values or defaults
      const currentHue = filters.hue !== undefined
        ? FILTER_MAPPINGS.hue.transform(filters.hue)
        : 0;
      const currentSaturation = filters.saturation !== undefined
        ? FILTER_MAPPINGS.saturation.transform(filters.saturation)
        : 0;

      imageNode.hue(currentHue);
      imageNode.saturation(currentSaturation);
    }

    // Apply blur
    if (filters.blur !== undefined) {
      const mapping = FILTER_MAPPINGS.blur;
      imageNode.blurRadius(mapping.transform(filters.blur));
    }

    // Apply noise
    if (filters.noise !== undefined) {
      const mapping = FILTER_MAPPINGS.noise;
      imageNode.noise(mapping.transform(filters.noise));
    }

    // Apply pixelate
    if (filters.pixelate !== undefined) {
      const mapping = FILTER_MAPPINGS.pixelate;
      imageNode.pixelSize(mapping.transform(filters.pixelate));
    }
  }

  /**
   * Create a hash from filter configuration for caching
   */
  static createFilterHash(filters: ImageFilters): string {
    const normalized = this.normalizeFilters(filters);
    const filterString = Object.entries(normalized)
      .filter(([key]) => key !== 'preset')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');

    // Simple hash function for the filter string
    let hash = 0;
    for (let i = 0; i < filterString.length; i++) {
      const char = filterString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(36);
  }

  /**
   * Reset filters to default values
   */
  static resetFilters(): ImageFilters {
    const reset: ImageFilters = {};

    for (const [key, config] of Object.entries(FILTER_CONFIG)) {
      reset[key as keyof Omit<ImageFilters, 'preset'>] = config.default;
    }

    return reset;
  }

  /**
   * Get filter difference between two states
   */
  static getFilterDifference(
    oldFilters: ImageFilters,
    newFilters: ImageFilters
  ): Array<{ filter: string; oldValue: number; newValue: number }> {
    const differences: Array<{ filter: string; oldValue: number; newValue: number }> = [];

    const allKeys = new Set([
      ...Object.keys(oldFilters),
      ...Object.keys(newFilters),
    ]);

    for (const key of allKeys) {
      if (key === 'preset') continue;

      const filterKey = key as keyof Omit<ImageFilters, 'preset'>;
      const oldValue = oldFilters[filterKey] ?? FILTER_CONFIG[filterKey]?.default;
      const newValue = newFilters[filterKey] ?? FILTER_CONFIG[filterKey]?.default;

      if (oldValue !== newValue) {
        differences.push({
          filter: key,
          oldValue: oldValue as number,
          newValue: newValue as number,
        });
      }
    }

    return differences;
  }

  /**
   * Merge multiple filter configurations
   */
  static mergeFilters(...filterSets: ImageFilters[]): ImageFilters {
    const merged: ImageFilters = {};

    for (const filters of filterSets) {
      Object.assign(merged, filters);
    }

    return this.normalizeFilters(merged);
  }

  /**
   * Record performance metrics
   */
  private static recordPerformanceMetrics(metrics: FilterPerformanceMetrics): void {
    this.performanceMetrics.push(metrics);

    // Keep only recent metrics
    if (this.performanceMetrics.length > this.MAX_METRICS_HISTORY) {
      this.performanceMetrics.shift();
    }
  }

  /**
   * Get performance statistics
   */
  static getPerformanceStats(): {
    averageApplyTime: number;
    totalFiltersApplied: number;
    cacheHitRate: number;
  } {
    if (this.performanceMetrics.length === 0) {
      return {
        averageApplyTime: 0,
        totalFiltersApplied: 0,
        cacheHitRate: 0,
      };
    }

    const totalTime = this.performanceMetrics.reduce((sum, m) => sum + m.applyTime, 0);
    const totalFilters = this.performanceMetrics.reduce((sum, m) => sum + m.filterCount, 0);
    const cacheHits = this.performanceMetrics.filter(m => m.cacheHit).length;

    return {
      averageApplyTime: totalTime / this.performanceMetrics.length,
      totalFiltersApplied: totalFilters,
      cacheHitRate: cacheHits / this.performanceMetrics.length,
    };
  }

  /**
   * Validate filter configuration
   */
  static validateFilters(filters: ImageFilters): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (key === 'preset') continue;

      const filterKey = key as keyof Omit<ImageFilters, 'preset'>;
      const config = FILTER_CONFIG[filterKey];

      if (!config) {
        errors.push(`Unknown filter: ${key}`);
        continue;
      }

      if (typeof value !== 'number') {
        errors.push(`Filter ${key} must be a number`);
        continue;
      }

      if (value < config.min || value > config.max) {
        errors.push(
          `Filter ${key} value ${value} is out of range [${config.min}, ${config.max}]`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}