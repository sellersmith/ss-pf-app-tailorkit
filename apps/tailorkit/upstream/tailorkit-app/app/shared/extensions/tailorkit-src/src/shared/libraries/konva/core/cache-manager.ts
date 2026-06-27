import type { CacheMetrics } from './types'

/**
 * Manages caching for images and processed masks with metrics tracking.
 * Helps reduce redundant image loading and mask processing operations.
 */
export class CacheManager {
  private imageCache: Map<string, HTMLImageElement>
  private maskCanvasCache: Map<string, HTMLCanvasElement>
  private metrics: CacheMetrics

  constructor() {
    this.imageCache = new Map()
    this.maskCanvasCache = new Map()
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
    }
  }

  /**
   * Get a cached image by URL (does not affect metrics - use recordHit/recordMiss explicitly)
   */
  getImage(url: string): HTMLImageElement | undefined {
    return this.imageCache.get(url)
  }

  /**
   * Check if an image is cached without affecting metrics
   */
  hasImage(url: string): boolean {
    return this.imageCache.has(url)
  }

  /**
   * Store an image in the cache
   */
  setImage(url: string, image: HTMLImageElement): void {
    this.imageCache.set(url, image)
  }

  /**
   * Get a cached mask canvas by key
   */
  getMaskCanvas(key: string): HTMLCanvasElement | undefined {
    return this.maskCanvasCache.get(key)
  }

  /**
   * Check if a mask canvas is cached
   */
  hasMaskCanvas(key: string): boolean {
    return this.maskCanvasCache.has(key)
  }

  /**
   * Store a mask canvas in the cache
   */
  setMaskCanvas(key: string, canvas: HTMLCanvasElement): void {
    this.maskCanvasCache.set(key, canvas)
  }

  /**
   * Record a cache miss (for external loading operations)
   */
  recordMiss(): void {
    this.metrics.cacheMisses++
  }

  /**
   * Record a cache hit (for external lookup operations)
   */
  recordHit(): void {
    this.metrics.cacheHits++
  }

  /**
   * Get current cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics }
  }

  /**
   * Clear all caches and reset metrics
   */
  clearAll(): void {
    this.imageCache.clear()
    this.maskCanvasCache.clear()
    this.metrics.cacheHits = 0
    this.metrics.cacheMisses = 0
  }

  /**
   * Get the number of cached images
   */
  get imageCount(): number {
    return this.imageCache.size
  }

  /**
   * Get the number of cached mask canvases
   */
  get maskCount(): number {
    return this.maskCanvasCache.size
  }
}
