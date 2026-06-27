import { sleep } from '~/utils/sleep'
import { CHECK_BULK_OPERATION_STATUS } from './query.server'
import { verifyResponse } from '../api.server'

type GraphQLFunction = (query: string, opts?: any) => Promise<any> | { data: null }

/**
 * Process a batch of order data and update the order map
 * @param batch Array of order data objects to process
 * @param orderMap Map to store processed orders
 * @param cutoffDate Date to filter orders by
 */
export const processBatch = (batch: any[], orderMap: Map<string, any>, cutoffDate?: Date): void => {
  batch.forEach(obj => {
    if (!obj.__parentId) {
      // Only add orders that meet the date criteria
      const orderDate = cutoffDate ? new Date(obj.createdAt) : null
      if (!cutoffDate || (orderDate && orderDate >= cutoffDate)) {
        orderMap.set(obj.id, {
          ...obj,
          lineItems: [],
        })
      }
    } else if (orderMap.has(obj.__parentId)) {
      const order = orderMap.get(obj.__parentId)
      const { __parentId, product, ...lineItemBase } = obj
      order.lineItems.push({
        ...lineItemBase,
        product: product || null,
      })
    }
  })
}

/**
 * Process JSON lines data in batches with parallel processing
 * @param jsonLines Array of JSON line objects
 * @param daysAgo Number of days to filter orders by
 * @returns Processed array of orders
 */
export const processBatchedJsonLines = async (jsonLines: any[], daysAgo?: number): Promise<any[]> => {
  const batchSize = 1000
  const batches = []
  let cutoffDate: Date

  if (daysAgo) {
    // Calculate cutoff date once
    cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo)
  }

  for (let i = 0; i < jsonLines.length; i += batchSize) {
    batches.push(jsonLines.slice(i, i + batchSize))
  }

  const orderMap = new Map<string, any>()

  // Process batches in parallel with concurrency limit
  const concurrencyLimit = 3
  for (let i = 0; i < batches.length; i += concurrencyLimit) {
    const batchPromises = batches.slice(i, i + concurrencyLimit).map(batch => processBatch(batch, orderMap, cutoffDate))
    await Promise.all(batchPromises)
  }

  return Array.from(orderMap.values())
}

/**
 * Poll for bulk operation status with exponential backoff
 * @param graphql Function to execute GraphQL queries
 * @param retryCount Current retry attempt
 * @param maxRetries Maximum number of retry attempts
 * @returns URL of completed operation
 */
export const pollOperationStatus = async (
  graphql: GraphQLFunction,
  retryCount = 0,
  maxRetries = 100
): Promise<string> => {
  const baseDelay = 2000 // 2 seconds

  while (retryCount < maxRetries) {
    const statusResponse = await graphql(CHECK_BULK_OPERATION_STATUS)
    const status = await verifyResponse(statusResponse, 'currentBulkOperation')

    if (status.status === 'COMPLETED') {
      return status.url
    }

    if (status.status === 'FAILED') {
      throw new Error(`Bulk operation failed: ${status.errorCode}`)
    }

    // Exponential backoff with jitter
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), 10000) // Max 10 seconds
    const jitter = Math.random() * 200 // Add random delay 0-200ms
    await sleep(delay + jitter)

    retryCount++
  }

  throw new Error('Bulk operation timed out')
}
