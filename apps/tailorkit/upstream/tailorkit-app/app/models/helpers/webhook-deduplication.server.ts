import WebhookLog from '~/models/WebhookLog.server'

/**
 * Check if webhook has already been processed (idempotency check)
 *
 * How Shopify webhook retry works:
 * - Shopify retries webhooks if no 200 OK response within 5 seconds
 * - Each webhook has unique X-Shopify-Webhook-Id header
 * - Same webhook ID = same event (retry), different ID = new event
 *
 * This function ensures each webhook is processed exactly once:
 * - First call: Creates log entry, returns false (process webhook)
 * - Retry calls: Finds existing log, returns true (skip processing)
 *
 * @param webhookId - X-Shopify-Webhook-Id from request headers
 * @param topic - Webhook topic (e.g., 'ORDERS_CREATE')
 * @param shopDomain - Shop domain for this webhook
 * @returns true if webhook already processed (skip), false if new (process)
 */
export async function isWebhookAlreadyProcessed(
  webhookId: string | null,
  topic: string,
  shopDomain: string
): Promise<boolean> {
  // If no webhook ID provided, can't deduplicate → process it
  // This shouldn't happen with Shopify webhooks, but handle gracefully
  if (!webhookId) {
    console.warn('[Webhook Deduplication] No webhook ID provided, processing anyway')
    return false
  }

  try {
    // Check if this webhook was already processed
    const existingLog = await WebhookLog.findOne({
      webhookId,
      topic,
      shopDomain,
      status: 'completed', // Only skip if previously completed successfully
    })

    if (existingLog) {
      // Webhook already processed successfully → skip
      console.log(`[Webhook Deduplication] Skipping duplicate webhook: ${topic} (ID: ${webhookId}) for ${shopDomain}`)
      return true
    }

    // New webhook → create log entry to claim processing
    // This prevents race condition if same webhook arrives concurrently
    await WebhookLog.create({
      webhookId,
      topic,
      shopDomain,
      status: 'processing',
      payload: null, // Payload stored later if needed
    })

    return false // Process this webhook
  } catch (error: any) {
    // If error is duplicate key (E11000), another process is handling it
    if (error.code === 11000) {
      console.log(`[Webhook Deduplication] Another process is handling webhook: ${topic} (ID: ${webhookId})`)
      return true // Skip, let other process handle it
    }

    // Other errors → log and allow processing
    // Better to process twice than skip a real webhook
    console.error('[Webhook Deduplication] Error checking webhook:', error)
    return false
  }
}

/**
 * Mark webhook as successfully processed
 *
 * Call this after webhook processing completes successfully
 * Updates log status to 'completed' and records completion time
 *
 * @param webhookId - X-Shopify-Webhook-Id from request headers
 * @param topic - Webhook topic
 * @param shopDomain - Shop domain
 */
export async function markWebhookProcessed(webhookId: string | null, topic: string, shopDomain: string): Promise<void> {
  if (!webhookId) return

  try {
    await WebhookLog.updateOne(
      { webhookId, topic, shopDomain },
      {
        $set: {
          status: 'completed',
          processedAt: new Date(),
        },
      }
    )
  } catch (error) {
    // Non-critical error, just log it
    console.error('[Webhook Deduplication] Error marking webhook as processed:', error)
  }
}

/**
 * Mark webhook as failed
 *
 * Call this if webhook processing fails with an error
 * Stores error details for debugging
 *
 * @param webhookId - X-Shopify-Webhook-Id from request headers
 * @param topic - Webhook topic
 * @param shopDomain - Shop domain
 * @param error - Error that occurred during processing
 */
export async function markWebhookFailed(
  webhookId: string | null,
  topic: string,
  shopDomain: string,
  error: any
): Promise<void> {
  if (!webhookId) return

  try {
    await WebhookLog.updateOne(
      { webhookId, topic, shopDomain },
      {
        $set: {
          status: 'failed',
          processedAt: new Date(),
          error: {
            message: error?.message || 'Unknown error',
            stack: error?.stack,
          },
        },
      }
    )
  } catch (err) {
    console.error('[Webhook Deduplication] Error marking webhook as failed:', err)
  }
}
