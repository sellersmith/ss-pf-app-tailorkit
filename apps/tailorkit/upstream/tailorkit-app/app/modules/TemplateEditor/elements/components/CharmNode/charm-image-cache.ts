/**
 * Charm Image Cache - Shared image loading for charm thumbnails
 *
 * This module provides a global cache for charm product images to avoid
 * duplicate network requests and memory allocation when multiple charms
 * use the same product thumbnail.
 *
 * Benefits:
 * - O(1) lookup for previously loaded images
 * - Single network request per unique URL
 * - Shared HTMLImageElement across all charms with same thumbnail
 */

type ImageLoadState = {
  image: HTMLImageElement | null
  status: 'loading' | 'loaded' | 'error'
  listeners: Set<() => void>
}

/** Global cache: URL → ImageLoadState */
const imageCache = new Map<string, ImageLoadState>()

/**
 * Get a cached image or start loading it
 * @param url - The image URL to load
 * @param onUpdate - Callback when image load status changes
 * @returns The cached image (null if still loading or error)
 */
export function getCachedImage(url: string, onUpdate?: () => void): HTMLImageElement | null {
  if (!url) return null

  const existing = imageCache.get(url)

  if (existing) {
    // Image already in cache
    if (onUpdate && existing.status === 'loading') {
      existing.listeners.add(onUpdate)
    }
    return existing.image
  }

  // Start loading new image
  const state: ImageLoadState = {
    image: null,
    status: 'loading',
    listeners: new Set(onUpdate ? [onUpdate] : []),
  }
  imageCache.set(url, state)

  const img = new window.Image()
  img.crossOrigin = 'anonymous'
  img.src = url

  img.onload = () => {
    state.image = img
    state.status = 'loaded'
    // Notify all listeners
    state.listeners.forEach(listener => listener())
    state.listeners.clear()
  }

  img.onerror = () => {
    state.status = 'error'
    // Notify all listeners
    state.listeners.forEach(listener => listener())
    state.listeners.clear()
  }

  return null
}

/**
 * Remove a listener from a pending image load
 * @param url - The image URL
 * @param listener - The listener to remove
 */
export function removeCacheListener(url: string, listener: () => void): void {
  const state = imageCache.get(url)
  if (state) {
    state.listeners.delete(listener)
  }
}

/**
 * Check if an image is loaded in cache
 * @param url - The image URL to check
 * @returns true if the image is loaded and ready
 */
export function isImageCached(url: string): boolean {
  const state = imageCache.get(url)
  return state?.status === 'loaded' && state.image !== null
}

/**
 * Clear a specific image from cache
 * @param url - The image URL to clear
 */
export function clearCachedImage(url: string): void {
  imageCache.delete(url)
}

/**
 * Clear all cached images
 * Call this when resetting editor state or loading a new template
 */
export function clearImageCache(): void {
  imageCache.clear()
}

/**
 * Get cache statistics (for debugging)
 */
export function getImageCacheStats(): { total: number; loaded: number; loading: number; error: number } {
  let loaded = 0
  let loading = 0
  let error = 0

  imageCache.forEach(state => {
    if (state.status === 'loaded') loaded++
    else if (state.status === 'loading') loading++
    else error++
  })

  return { total: imageCache.size, loaded, loading, error }
}
