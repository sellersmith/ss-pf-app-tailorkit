import { cleanupOldCache, getCacheStats } from '~/modules/MockupWizard/utils/imageCache.server'

/**
 * Interval reference for cleanup scheduler
 */
let cleanupInterval: NodeJS.Timeout | null = null

/**
 * Default cleanup interval in milliseconds (1 hour)
 */
const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Default max cache age in hours
 */
const DEFAULT_MAX_CACHE_AGE_HOURS = 1

/**
 * Start the image cache cleanup scheduler
 * This will run cleanup every hour by default
 *
 * @param intervalMs - Cleanup interval in milliseconds (default: 1 hour)
 * @param maxAgeHours - Maximum age for cache files in hours (default: 1)
 *
 * @example
 * ```typescript
 * // Start cleanup every hour
 * startCacheCleanup()
 *
 * // Start cleanup every 30 minutes with 2-hour max age
 * startCacheCleanup(30 * 60 * 1000, 2)
 * ```
 */
export function startCacheCleanup(
  intervalMs: number = DEFAULT_CLEANUP_INTERVAL_MS,
  maxAgeHours: number = DEFAULT_MAX_CACHE_AGE_HOURS
): void {
  // Stop existing scheduler if running
  if (cleanupInterval) {
    console.log('Image cache cleanup scheduler already running, stopping it first')
    stopCacheCleanup()
  }

  console.log(`Starting image cache cleanup scheduler (interval: ${intervalMs / 1000}s, max age: ${maxAgeHours}h)`)

  // Run cleanup immediately on start
  performCleanup(maxAgeHours).catch(error => {
    console.error('Error during initial cache cleanup:', error)
  })

  // Schedule periodic cleanup
  cleanupInterval = setInterval(() => {
    performCleanup(maxAgeHours).catch(error => {
      console.error('Error during scheduled cache cleanup:', error)
    })
  }, intervalMs)

  // Prevent the interval from keeping the process alive
  if (cleanupInterval.unref) {
    cleanupInterval.unref()
  }
}

/**
 * Stop the image cache cleanup scheduler
 *
 * @example
 * ```typescript
 * stopCacheCleanup()
 * ```
 */
export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
    console.log('Image cache cleanup scheduler stopped')
  }
}

/**
 * Perform cache cleanup and log statistics
 *
 * @param maxAgeHours - Maximum age for cache files in hours
 */
async function performCleanup(maxAgeHours: number): Promise<void> {
  try {
    console.log('Starting image cache cleanup...')

    // Get stats before cleanup
    const statsBefore = await getCacheStats()
    console.log('Cache stats before cleanup:', {
      files: statsBefore.totalFiles,
      sizeMB: (statsBefore.totalSizeBytes / (1024 * 1024)).toFixed(2),
      oldestAgeHours: statsBefore.oldestFileAgeHours?.toFixed(2),
      newestAgeHours: statsBefore.newestFileAgeHours?.toFixed(2),
    })

    // Perform cleanup
    const deletedCount = await cleanupOldCache(maxAgeHours)

    // Get stats after cleanup
    const statsAfter = await getCacheStats()
    const freedMB = (statsBefore.totalSizeBytes - statsAfter.totalSizeBytes) / (1024 * 1024)

    console.log('Cache cleanup completed:', {
      deletedFiles: deletedCount,
      freedMB: freedMB.toFixed(2),
      remainingFiles: statsAfter.totalFiles,
      remainingSizeMB: (statsAfter.totalSizeBytes / (1024 * 1024)).toFixed(2),
    })
  } catch (error) {
    console.error('Error during cache cleanup:', error)
  }
}

/**
 * Manually trigger cache cleanup
 * Useful for testing or manual maintenance
 *
 * @param maxAgeHours - Maximum age for cache files in hours (default: 1)
 * @returns Number of files deleted
 *
 * @example
 * ```typescript
 * const deleted = await triggerManualCleanup()
 * console.log(`Manually deleted ${deleted} files`)
 * ```
 */
export async function triggerManualCleanup(maxAgeHours: number = DEFAULT_MAX_CACHE_AGE_HOURS): Promise<number> {
  console.log(`Triggering manual cache cleanup (max age: ${maxAgeHours}h)`)
  await performCleanup(maxAgeHours)
  return cleanupOldCache(maxAgeHours)
}

/**
 * Check if cleanup scheduler is running
 *
 * @returns True if scheduler is active
 */
export function isCleanupRunning(): boolean {
  return cleanupInterval !== null
}
