/**
 * Filter Cache System
 * Caches filtered image data to improve performance for repeated filter applications
 */

import type { FilterCacheEntry, ImageFilters } from './types';
import { ImageFilterPipeline } from './image-filter-pipeline';

/**
 * Filter cache configuration
 */
interface CacheConfig {
  maxSize: number; // Maximum cache size in bytes
  maxEntries: number; // Maximum number of cached entries
  ttl: number; // Time to live in milliseconds
  cleanupInterval: number; // Cleanup interval in milliseconds
}

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 50 * 1024 * 1024, // 50MB
  maxEntries: 100,
  ttl: 15 * 60 * 1000, // 15 minutes
  cleanupInterval: 60 * 1000, // 1 minute
};

/**
 * Filter cache manager
 */
export class FilterCache {
  private static cache = new Map<string, FilterCacheEntry>();
  private static config: CacheConfig = DEFAULT_CONFIG;
  private static currentSize = 0;
  private static cleanupTimer: NodeJS.Timeout | null = null;
  private static hitCount = 0;
  private static missCount = 0;

  /**
   * Initialize the cache with custom configuration
   */
  static initialize(config: Partial<CacheConfig> = {}): void {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupTimer();
  }

  /**
   * Get cached filtered image data
   */
  static get(imageId: string, filters: ImageFilters): ImageData | null {
    const cacheKey = this.createCacheKey(imageId, filters);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.remove(cacheKey);
      this.missCount++;
      return null;
    }

    this.hitCount++;

    // Update timestamp for LRU
    entry.timestamp = Date.now();

    return entry.imageData;
  }

  /**
   * Set cached filtered image data
   */
  static set(imageId: string, filters: ImageFilters, imageData: ImageData): void {
    const cacheKey = this.createCacheKey(imageId, filters);
    const size = this.calculateImageDataSize(imageData);

    // Check if we need to make room
    if (this.shouldEvict(size)) {
      this.evictOldest();
    }

    // Remove existing entry if present
    if (this.cache.has(cacheKey)) {
      this.remove(cacheKey);
    }

    // Add new entry
    const entry: FilterCacheEntry = {
      hash: cacheKey,
      imageData,
      timestamp: Date.now(),
      size,
    };

    this.cache.set(cacheKey, entry);
    this.currentSize += size;
  }

  /**
   * Remove a cache entry
   */
  static remove(cacheKey: string): boolean {
    const entry = this.cache.get(cacheKey);
    if (!entry) return false;

    this.cache.delete(cacheKey);
    this.currentSize -= entry.size;
    return true;
  }

  /**
   * Clear entire cache
   */
  static clear(): void {
    this.cache.clear();
    this.currentSize = 0;
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Clear cache for a specific image
   */
  static clearForImage(imageId: string): void {
    const keysToRemove: string[] = [];

    // Find all entries for this image
    for (const [key, entry] of this.cache.entries()) {
      if (key.startsWith(`${imageId}:`)) {
        keysToRemove.push(key);
        this.currentSize -= entry.size;
      }
    }

    // Remove entries
    keysToRemove.forEach(key => this.cache.delete(key));
  }

  /**
   * Create cache key from image ID and filters
   */
  private static createCacheKey(imageId: string, filters: ImageFilters): string {
    const filterHash = ImageFilterPipeline.createFilterHash(filters);
    return `${imageId}:${filterHash}`;
  }

  /**
   * Calculate size of ImageData in bytes
   */
  private static calculateImageDataSize(imageData: ImageData): number {
    // ImageData contains Uint8ClampedArray with 4 bytes per pixel (RGBA)
    return imageData.width * imageData.height * 4;
  }

  /**
   * Check if entry has expired
   */
  private static isExpired(entry: FilterCacheEntry): boolean {
    return Date.now() - entry.timestamp > this.config.ttl;
  }

  /**
   * Check if we should evict entries to make room
   */
  private static shouldEvict(newSize: number): boolean {
    return (
      this.currentSize + newSize > this.config.maxSize ||
      this.cache.size >= this.config.maxEntries
    );
  }

  /**
   * Evict oldest entries (LRU)
   */
  private static evictOldest(): void {
    // Sort entries by timestamp
    const entries = Array.from(this.cache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );

    // Remove oldest 20% or until we have enough space
    const targetRemoval = Math.max(1, Math.floor(entries.length * 0.2));

    for (let i = 0; i < targetRemoval; i++) {
      const [key] = entries[i];
      this.remove(key);
    }
  }

  /**
   * Start cleanup timer
   */
  private static startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  static destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }

  /**
   * Clean up expired entries
   */
  private static cleanup(): void {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttl) {
        keysToRemove.push(key);
        this.currentSize -= entry.size;
      }
    }

    keysToRemove.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  static getStats(): {
    entries: number;
    size: number;
    sizeInMB: number;
    hitRate: number;
    missRate: number;
    hits: number;
    misses: number;
  } {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;
    const missRate = totalRequests > 0 ? this.missCount / totalRequests : 0;

    return {
      entries: this.cache.size,
      size: this.currentSize,
      sizeInMB: this.currentSize / (1024 * 1024),
      hitRate,
      missRate,
      hits: this.hitCount,
      misses: this.missCount,
    };
  }

  /**
   * Warm up cache with presets
   */
  static async warmUp(
    imageId: string,
    imageElement: HTMLImageElement,
    presets: string[]
  ): Promise<void> {
    // Import preset manager
    const { FilterPresetManager } = await import('./filter-presets');

    for (const presetName of presets) {
      const filters = FilterPresetManager.applyPreset(presetName);
      if (!filters) continue;

      // Check if already cached
      const cacheKey = this.createCacheKey(imageId, filters);
      if (this.cache.has(cacheKey)) continue;

      // Apply filters to get ImageData (this would be done with Konva in actual implementation)
      // For now, this is a placeholder
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      canvas.width = imageElement.width;
      canvas.height = imageElement.height;
      ctx.drawImage(imageElement, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Cache the result
      this.set(imageId, filters, imageData);
    }
  }

  /**
   * Get memory usage estimate
   */
  static getMemoryUsage(): {
    used: number;
    available: number;
    percentage: number;
  } {
    const used = this.currentSize;
    const available = this.config.maxSize - used;
    const percentage = (used / this.config.maxSize) * 100;

    return {
      used,
      available,
      percentage,
    };
  }

  /**
   * Optimize cache by removing least used entries
   */
  static optimize(): void {
    // If cache is more than 80% full, remove least recently used entries
    const usage = this.getMemoryUsage();
    if (usage.percentage > 80) {
      this.evictOldest();
    }
  }

  /**
   * Export cache metadata for debugging
   */
  static exportMetadata(): Array<{
    key: string;
    size: number;
    age: number;
    dimensions: { width: number; height: number };
  }> {
    const now = Date.now();

    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      size: entry.size,
      age: now - entry.timestamp,
      dimensions: {
        width: entry.imageData?.width || 0,
        height: entry.imageData?.height || 0,
      },
    }));
  }

  /**
   * Prefetch and cache filtered versions of an image
   */
  static async prefetch(
    imageId: string,
    baseImageData: ImageData,
    filterSets: ImageFilters[]
  ): Promise<void> {
    for (const filters of filterSets) {
      const cacheKey = this.createCacheKey(imageId, filters);

      // Skip if already cached
      if (this.cache.has(cacheKey)) continue;

      // In a real implementation, this would apply filters using Konva
      // For now, we'll just cache the base image data
      this.set(imageId, filters, baseImageData);

      // Add small delay to avoid blocking UI
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Set cache configuration
   */
  static configure(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart cleanup timer with new interval
    if (config.cleanupInterval) {
      this.startCleanupTimer();
    }

    // If max size reduced, evict entries
    if (config.maxSize && config.maxSize < this.config.maxSize) {
      while (this.currentSize > config.maxSize) {
        this.evictOldest();
      }
    }
  }
}