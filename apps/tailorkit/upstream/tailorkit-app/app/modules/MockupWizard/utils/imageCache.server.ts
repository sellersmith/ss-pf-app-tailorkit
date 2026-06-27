import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import { downloadImageFromUrl } from '~/utils/image-tools'

/**
 * Cache directory for mockup wizard images
 */
const CACHE_DIR = join(process.cwd(), 'cache', 'mockup-wizard')

/**
 * Ensure cache directory exists
 */
function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true })
  }
}

/**
 * Generate cache key from URL using MD5 hash
 *
 * @param url - Image URL
 * @returns MD5 hash of the URL
 */
function getCacheKey(url: string): string {
  return createHash('md5').update(url).digest('hex')
}

/**
 * Get cache file path for a given URL
 *
 * @param url - Image URL
 * @returns Full path to cache file
 */
function getCacheFilePath(url: string): string {
  const key = getCacheKey(url)
  return join(CACHE_DIR, `${key}.cache`)
}

/**
 * Get cached image buffer if it exists and is not expired
 *
 * @param url - Image URL
 * @param maxAgeHours - Maximum age in hours (default: 1)
 * @returns Buffer if cached and valid, null otherwise
 *
 * @example
 * ```typescript
 * const cached = await getCachedImage('https://cdn.shopify.com/image.jpg')
 * ```
 */
export async function getCachedImage(url: string, maxAgeHours: number = 1): Promise<Buffer | null> {
  try {
    ensureCacheDir()

    const filePath = getCacheFilePath(url)

    if (!existsSync(filePath)) {
      return null
    }

    // Check file age
    const stats = statSync(filePath)
    const ageMs = Date.now() - stats.mtimeMs
    const ageHours = ageMs / (1000 * 60 * 60)

    if (ageHours > maxAgeHours) {
      // Cache expired, delete it
      try {
        unlinkSync(filePath)
      } catch (deleteError) {
        console.warn(`Failed to delete expired cache file: ${filePath}`, deleteError)
      }
      return null
    }

    // Read and return cached buffer
    const buffer = readFileSync(filePath)
    return buffer
  } catch (error) {
    console.error(`Error reading cached image for URL: ${url}`, error)
    return null
  }
}

/**
 * Cache an image buffer
 *
 * @param url - Image URL
 * @param buffer - Image buffer to cache
 *
 * @example
 * ```typescript
 * await cacheImage('https://cdn.shopify.com/image.jpg', imageBuffer)
 * ```
 */
export async function cacheImage(url: string, buffer: Buffer): Promise<void> {
  try {
    ensureCacheDir()

    const filePath = getCacheFilePath(url)
    writeFileSync(filePath, buffer)
  } catch (error) {
    console.error(`Error caching image for URL: ${url}`, error)
    // Don't throw - caching is optional
  }
}

/**
 * Clean up old cached files
 *
 * @param maxAgeHours - Maximum age in hours for cache files
 * @returns Number of files deleted
 *
 * @example
 * ```typescript
 * const deleted = await cleanupOldCache(1)
 * ```
 */
export async function cleanupOldCache(maxAgeHours: number = 1): Promise<number> {
  let deletedCount = 0

  try {
    ensureCacheDir()

    const files = readdirSync(CACHE_DIR)
    const now = Date.now()

    for (const file of files) {
      if (!file.endsWith('.cache')) {
        continue
      }

      const filePath = join(CACHE_DIR, file)

      try {
        const stats = statSync(filePath)
        const ageMs = now - stats.mtimeMs
        const ageHours = ageMs / (1000 * 60 * 60)

        if (ageHours > maxAgeHours) {
          unlinkSync(filePath)
          deletedCount++
        }
      } catch (fileError) {
        console.warn(`Error processing cache file: ${file}`, fileError)
      }
    }
  } catch (error) {
    console.error('Error during cache cleanup:', error)
  }

  return deletedCount
}

/**
 * Get cached image or download it from URL
 * This is the main function to use for fetching images with caching
 *
 * @param url - Image URL
 * @param timeout - Download timeout in milliseconds (default: 15000)
 * @returns Image buffer
 * @throws Error if download fails
 *
 * @example
 * ```typescript
 * try {
 *   const buffer = await getCachedImageOrDownload('https://cdn.shopify.com/image.jpg')
 *   // Process buffer...
 * } catch (error) {
 *   console.error('Failed to get image:', error)
 * }
 * ```
 */
export async function getCachedImageOrDownload(url: string, timeout: number = 15000): Promise<Buffer> {
  // Try cache first
  const cached = await getCachedImage(url)
  if (cached) {
    return cached
  }

  try {
    const buffer = await downloadImageFromUrl(url, timeout)

    // Cache for next time (non-blocking)
    cacheImage(url, buffer).catch(error => {
      console.warn(`Failed to cache image after download: ${url}`, error)
    })

    return buffer
  } catch (error) {
    throw new Error(`Failed to download image from URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get cache statistics
 *
 * @returns Cache statistics
 */
export async function getCacheStats(): Promise<{
  totalFiles: number
  totalSizeBytes: number
  oldestFileAgeHours: number | null
  newestFileAgeHours: number | null
}> {
  try {
    ensureCacheDir()

    const files = readdirSync(CACHE_DIR).filter(f => f.endsWith('.cache'))
    const now = Date.now()

    let totalSize = 0
    let oldestAge: number | null = null
    let newestAge: number | null = null

    for (const file of files) {
      try {
        const filePath = join(CACHE_DIR, file)
        const stats = statSync(filePath)
        totalSize += stats.size

        const ageHours = (now - stats.mtimeMs) / (1000 * 60 * 60)
        if (oldestAge === null || ageHours > oldestAge) {
          oldestAge = ageHours
        }
        if (newestAge === null || ageHours < newestAge) {
          newestAge = ageHours
        }
      } catch (fileError) {
        console.warn(`Error reading stats for file: ${file}`, fileError)
      }
    }

    return {
      totalFiles: files.length,
      totalSizeBytes: totalSize,
      oldestFileAgeHours: oldestAge,
      newestFileAgeHours: newestAge,
    }
  } catch (error) {
    console.error('Error getting cache stats:', error)
    return {
      totalFiles: 0,
      totalSizeBytes: 0,
      oldestFileAgeHours: null,
      newestFileAgeHours: null,
    }
  }
}
