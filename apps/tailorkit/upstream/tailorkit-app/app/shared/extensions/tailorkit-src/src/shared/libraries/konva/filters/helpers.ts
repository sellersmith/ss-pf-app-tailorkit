/**
 * Filter Helper Functions
 * Utility functions for working with filters
 */

import Konva from 'konva';
import type { ImageFilters, FilterApplicationOptions } from './types';
import { ImageFilterPipeline } from './image-filter-pipeline';
import { FilterCache } from './filter-cache';

/**
 * Apply filters to a Konva image with caching support
 */
export function applyFiltersToKonvaImage(
  image: Konva.Image,
  filters: ImageFilters,
  options: FilterApplicationOptions = {}
): void {
  const { useCache = true, debounce = 0 } = options;

  // Generate image ID for caching
  const imageId = image.id() || `image-${Date.now()}`;

  // Check cache first
  if (useCache) {
    const cachedData = FilterCache.get(imageId, filters);
    if (cachedData) {
      // Apply cached image data
      // Note: This would require custom Konva implementation
      console.log('Using cached filter data');
      return;
    }
  }

  // Apply filters with optional debouncing
  if (debounce > 0) {
    const timeoutKey = `filter-debounce-${imageId}`;
    const existingTimeout = (image as any)[timeoutKey];

    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    (image as any)[timeoutKey] = setTimeout(() => {
      ImageFilterPipeline.applyFilters(image, filters, options);
      delete (image as any)[timeoutKey];
    }, debounce);
  } else {
    ImageFilterPipeline.applyFilters(image, filters, options);
  }
}

/**
 * Create a filtered image from a source image
 */
export async function createFilteredImage(
  sourceImage: HTMLImageElement,
  filters: ImageFilters,
  outputFormat: 'png' | 'jpeg' | 'webp' = 'png',
  quality = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Create temporary stage and layer
    const stage = new Konva.Stage({
      container: document.createElement('div'),
      width: sourceImage.width,
      height: sourceImage.height,
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    // Create Konva image
    const konvaImage = new Konva.Image({
      image: sourceImage,
      width: sourceImage.width,
      height: sourceImage.height,
    });

    layer.add(konvaImage);

    // Apply filters
    ImageFilterPipeline.applyFilters(konvaImage, filters);

    // Draw and export
    layer.draw();

    // Convert to blob
    stage.toBlob({
      callback: (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }

        // Cleanup
        stage.destroy();
      },
      mimeType: `image/${outputFormat}`,
      quality,
    });
  });
}

/**
 * Get a human-readable description of active filters
 */
export function getActiveFiltersDescription(filters: ImageFilters): string {
  const activeFilters: string[] = [];

  if (filters.exposure && filters.exposure !== 0) {
    activeFilters.push(`Exposure ${filters.exposure > 0 ? '+' : ''}${Math.round(filters.exposure * 100)}%`);
  }

  if (filters.contrast && filters.contrast !== 0) {
    activeFilters.push(`Contrast ${filters.contrast > 0 ? '+' : ''}${Math.round(filters.contrast * 100)}%`);
  }

  if (filters.saturation && filters.saturation !== 0) {
    activeFilters.push(`Saturation ${filters.saturation > 0 ? '+' : ''}${Math.round(filters.saturation * 100)}%`);
  }

  if (filters.hue && filters.hue !== 0) {
    activeFilters.push(`Hue ${Math.round(filters.hue * 180)}°`);
  }

  if (filters.blur && filters.blur > 0) {
    activeFilters.push(`Blur ${Math.round(filters.blur * 20)}px`);
  }

  if (filters.noise && filters.noise > 0) {
    activeFilters.push(`Noise ${Math.round(filters.noise * 100)}%`);
  }

  if (filters.pixelate && filters.pixelate > 0) {
    activeFilters.push(`Pixelate ${Math.round(filters.pixelate * 20)}px`);
  }

  if (filters.preset) {
    activeFilters.unshift(`Preset: ${filters.preset}`);
  }

  return activeFilters.length > 0 ? activeFilters.join(', ') : 'No filters applied';
}

/**
 * Check if two filter sets are equal
 */
export function areFiltersEqual(filters1: ImageFilters, filters2: ImageFilters): boolean {
  const keys = new Set([
    ...Object.keys(filters1),
    ...Object.keys(filters2),
  ]) as Set<keyof ImageFilters>;

  for (const key of keys) {
    if (key === 'preset') continue; // Ignore preset field for comparison

    const value1 = filters1[key] ?? 0;
    const value2 = filters2[key] ?? 0;

    if (Math.abs((value1 as number) - (value2 as number)) > 0.001) {
      return false;
    }
  }

  return true;
}

/**
 * Interpolate between two filter sets
 */
export function interpolateFilters(
  from: ImageFilters,
  to: ImageFilters,
  progress: number
): ImageFilters {
  const result: ImageFilters = {};
  const t = Math.max(0, Math.min(1, progress));

  const keys = new Set([
    ...Object.keys(from),
    ...Object.keys(to),
  ]) as Set<keyof ImageFilters>;

  for (const key of keys) {
    if (key === 'preset') continue;

    const fromValue = (from[key] ?? 0) as number;
    const toValue = (to[key] ?? 0) as number;

    result[key] = fromValue + (toValue - fromValue) * t;
  }

  return ImageFilterPipeline.normalizeFilters(result);
}

/**
 * Create a filter animation
 */
export function animateFilters(
  image: Konva.Image,
  fromFilters: ImageFilters,
  toFilters: ImageFilters,
  duration: number,
  easing: (t: number) => number = (t) => t
): Promise<void> {
  return new Promise((resolve) => {
    const startTime = performance.now();

    const animate = () => {
      const currentTime = performance.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easedProgress = easing(progress);

      const currentFilters = interpolateFilters(fromFilters, toFilters, easedProgress);
      ImageFilterPipeline.applyFilters(image, currentFilters);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(animate);
  });
}

/**
 * Extract dominant colors from an image for auto-filter suggestions
 */
export function extractDominantColors(imageData: ImageData, sampleSize = 5000): Array<{ r: number; g: number; b: number }> {
  const pixels = imageData.data;
  const pixelCount = pixels.length / 4;
  const step = Math.max(1, Math.floor(pixelCount / sampleSize));

  const colorMap = new Map<string, number>();

  for (let i = 0; i < pixels.length; i += step * 4) {
    const r = Math.floor(pixels[i] / 32) * 32;
    const g = Math.floor(pixels[i + 1] / 32) * 32;
    const b = Math.floor(pixels[i + 2] / 32) * 32;
    const key = `${r},${g},${b}`;

    colorMap.set(key, (colorMap.get(key) || 0) + 1);
  }

  // Sort by frequency and return top colors
  return Array.from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => {
      const [r, g, b] = key.split(',').map(Number);
      return { r, g, b };
    });
}

/**
 * Suggest filters based on image characteristics
 */
export function suggestFilters(imageData: ImageData): ImageFilters {
  // Calculate image brightness
  const pixels = imageData.data;
  let totalBrightness = 0;
  const sampleSize = 1000;
  const step = Math.max(1, Math.floor(pixels.length / 4 / sampleSize));

  for (let i = 0; i < pixels.length; i += step * 4) {
    const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
    totalBrightness += brightness;
  }

  const avgBrightness = totalBrightness / sampleSize;
  const suggestions: ImageFilters = {};

  // Suggest exposure adjustment based on brightness
  if (avgBrightness < 85) {
    suggestions.exposure = 0.2; // Brighten dark images
  } else if (avgBrightness > 170) {
    suggestions.exposure = -0.1; // Darken bright images
  }

  // Calculate color saturation
  let totalSaturation = 0;
  for (let i = 0; i < pixels.length; i += step * 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    totalSaturation += saturation;
  }

  const avgSaturation = totalSaturation / sampleSize;

  // Suggest saturation adjustment
  if (avgSaturation < 0.3) {
    suggestions.saturation = 0.15; // Boost low saturation
  } else if (avgSaturation > 0.7) {
    suggestions.saturation = -0.1; // Reduce high saturation
  }

  return suggestions;
}

/**
 * Batch apply filters to multiple images
 */
export async function batchApplyFilters(
  images: Konva.Image[],
  filters: ImageFilters,
  options: FilterApplicationOptions = {}
): Promise<void> {
  const promises = images.map((image) =>
    new Promise<void>((resolve) => {
      applyFiltersToKonvaImage(image, filters, options);
      resolve();
    })
  );

  await Promise.all(promises);
}

/**
 * Save filter configuration to localStorage
 */
export function saveFilterConfiguration(key: string, filters: ImageFilters): void {
  try {
    localStorage.setItem(`tailorkit-filters-${key}`, JSON.stringify(filters));
  } catch (error) {
    console.error('Failed to save filter configuration:', error);
  }
}

/**
 * Load filter configuration from localStorage
 */
export function loadFilterConfiguration(key: string): ImageFilters | null {
  try {
    const stored = localStorage.getItem(`tailorkit-filters-${key}`);
    if (!stored) return null;

    const filters = JSON.parse(stored);
    return ImageFilterPipeline.normalizeFilters(filters);
  } catch (error) {
    console.error('Failed to load filter configuration:', error);
    return null;
  }
}

/**
 * Clear all saved filter configurations
 */
export function clearSavedFilterConfigurations(): void {
  const keys = Object.keys(localStorage).filter(key => key.startsWith('tailorkit-filters-'));
  keys.forEach(key => localStorage.removeItem(key));
}