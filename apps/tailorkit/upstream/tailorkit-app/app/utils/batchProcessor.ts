/**
 * Configuration for batch processing
 */
interface BatchConfig {
  batchSize: number
  delayBetweenBatches: number
  useIdleCallback: boolean
}

const DEFAULT_CONFIG: BatchConfig = {
  batchSize: 5,
  delayBetweenBatches: 0,
  useIdleCallback: true,
}

/**
 * Processes items in batches to avoid blocking the main thread
 * @param items Array of items to process
 * @param processor Function to process each item
 * @param config Configuration for batch processing
 * @returns Promise that resolves with all processed results
 */
export function processBatch<T, R>(
  items: T[],
  processor: (item: T) => R,
  config: Partial<BatchConfig> = {}
): Promise<R[]> {
  const { batchSize, delayBetweenBatches, useIdleCallback } = { ...DEFAULT_CONFIG, ...config }

  return new Promise((resolve, reject) => {
    const results: R[] = []
    const itemsCopy = [...items] // Don't mutate original array

    const processBatch = () => {
      try {
        // Process a batch of items
        const batch = itemsCopy.splice(0, batchSize)
        const batchResults = batch.map(processor)
        results.push(...batchResults)

        // If there are more items to process, schedule next batch
        if (itemsCopy.length > 0) {
          if (useIdleCallback && typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(processBatch, { timeout: 1000 })
          } else {
            setTimeout(processBatch, delayBetweenBatches)
          }
        } else {
          // All items processed
          resolve(results)
        }
      } catch (error) {
        reject(error)
      }
    }

    // Start processing
    processBatch()
  })
}

/**
 * Processes items in batches asynchronously
 * @param items Array of items to process
 * @param processor Async function to process each item
 * @param config Configuration for batch processing
 * @returns Promise that resolves with all processed results
 */
export async function processBatchAsync<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  config: Partial<BatchConfig> = {}
): Promise<R[]> {
  const { batchSize, delayBetweenBatches } = { ...DEFAULT_CONFIG, ...config }

  const results: R[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchPromises = batch.map(processor)
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)

    // Add delay between batches if specified and not the last batch
    if (delayBetweenBatches > 0 && i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
    }
  }

  return results
}
