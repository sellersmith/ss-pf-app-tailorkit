import type { CacheManager } from '../core/cache-manager'

/**
 * Load an image from URL with caching support.
 * Uses the CacheManager to avoid redundant network requests.
 *
 * @param url - The image URL to load
 * @param cache - The cache manager instance
 * @returns Promise resolving to the loaded HTMLImageElement
 */
export async function loadImage(url: string, cache: CacheManager): Promise<HTMLImageElement> {
  // Check cache first
  if (cache.hasImage(url)) {
    cache.recordHit()
    return cache.getImage(url)!
  }

  cache.recordMiss()

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'Anonymous'
    image.src = url

    image.onload = () => {
      cache.setImage(url, image)
      resolve(image)
    }

    image.onerror = reject
  })
}

/**
 * Load multiple images in parallel with caching support.
 *
 * @param urls - Array of image URLs to load
 * @param cache - The cache manager instance
 * @returns Promise resolving to array of loaded HTMLImageElements
 */
export async function loadImages(urls: string[], cache: CacheManager): Promise<HTMLImageElement[]> {
  return Promise.all(urls.map(url => loadImage(url, cache)))
}
