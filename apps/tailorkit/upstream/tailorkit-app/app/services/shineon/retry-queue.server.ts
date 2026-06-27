import { classifyShineOnError, RETRY_DELAYS, MAX_RETRY_ATTEMPTS } from './error-classifier.server'
import { notifyShineOnSubmissionFailed, notifyShineOnVariantUnavailable } from './notifications.server'
import Order from '~/models/Order.server'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import { sleep } from '~/utils/sleep'

/**
 * Wraps a ShineOn order submission with exponential backoff retry logic.
 * Uses an inline while-loop to avoid recursive calls.
 */
export async function executeWithRetry<T>(args: {
  orderId: number
  shopDomain: string
  submitFn: () => Promise<T>
}): Promise<T> {
  const { orderId, shopDomain, submitFn } = args
  let attempt = 0

  while (true) {
    try {
      return await submitFn()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const classified = classifyShineOnError(err)

      if (!classified.retryable || attempt >= MAX_RETRY_ATTEMPTS) {
        await handleTerminalError({ orderId, shopDomain, message, classified, attempt })
        throw err
      }

      const delayMs = RETRY_DELAYS[attempt] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1]
      console.warn(
        `[ShineOn] Retry ${attempt + 1}/${MAX_RETRY_ATTEMPTS} for order #${orderId} in ${delayMs}ms (${classified.category})`
      )
      await sleep(delayMs)
      attempt++
    }
  }
}

/** Stores error and sends notifications when the submission cannot proceed. */
async function handleTerminalError(args: {
  orderId: number
  shopDomain: string
  message: string
  classified: { category: string; httpStatus?: number; retryable: boolean }
  attempt: number
}) {
  const { orderId, shopDomain, message, classified, attempt } = args

  await storeErrorOnOrder({
    orderId,
    shopDomain,
    error: { message, code: classified.httpStatus, category: classified.category },
  })

  if (classified.category === 'not_found') {
    await notifyShineOnVariantUnavailable({ shopDomain, sku: 'unknown', orderId })
  }

  const suffix = classified.retryable ? ' (exhausted retries)' : ''
  await notifyShineOnSubmissionFailed({
    shopDomain,
    orderId,
    error: `[${classified.category}] ${message}${suffix}`,
    attempts: attempt + 1,
  })
}

/**
 * Persists the error on the ShineOn line item's fulfillment_order_submitted field.
 */
export async function storeErrorOnOrder(args: {
  orderId: number
  shopDomain: string
  error: { message: string; code?: number; category: string }
}): Promise<void> {
  const { orderId, shopDomain, error } = args
  try {
    await Order.updateOne(
      { shopDomain, id: orderId, 'line_items.vendor': EPROVIDER.SHINEON },
      {
        $set: {
          'line_items.$.fulfillment_order_submitted.error': {
            ...error,
            timestamp: new Date(),
          },
        },
      }
    )
  } catch (e) {
    console.error(`[ShineOn] Failed to store error on order #${orderId}`, e)
  }
}
