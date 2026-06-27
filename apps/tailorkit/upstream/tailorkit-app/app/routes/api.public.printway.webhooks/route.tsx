import { type ActionFunctionArgs } from '@remix-run/node'
import crypto from 'crypto'
import { z } from 'zod'
import { EPROVIDER, FULFILLING } from '~/constants/fulfillment-providers'
import { SHOPIFY_FULFILLMENT_ORDER_PREFIX } from '~/constants/shopify'
import Order from '~/models/Order.server'
import WebhookLog from '~/models/WebhookLog.server'
import {
  acceptAssignedFulfillmentOrder,
  markFulfillmentOrderAsFulfilled,
  rejectAssignedFulfillmentOrder,
} from '~/routes/webhooks/fns/fulfillFulfillmentServiceLineItems.server'
import { updateLineItemFulfillmentOrderStatus } from '~/routes/api.providers/orders'
import { formatNumberIdToShopifyObjectId } from '~/utils/shopify'
import { json } from '~/bootstrap/fns/fetch.server'
import { canTransition, mapPrintWayStatusToFulfillmentStatus } from '~/services/printway/status-transitions.server'
import { PRINTWAY_WEBHOOK_TOPIC } from './constants'
import type { PrintWayTrackingPayload, PrintWayOrderStatusPayload, PrintWayWebhookType } from './types'

const SUCCESS_STATUS = 200
const UNAUTHORIZED_STATUS = 401

if (!process.env.PRINTWAY_WEBHOOK_SECRET) {
  console.warn('[PrintWay Webhook] PRINTWAY_WEBHOOK_SECRET is not set — all webhooks will be rejected')
}

const trackingPayloadSchema = z.object({
  order_id: z.string(),
  tracking_number: z.string(),
  tracking_url: z.string(),
})

const orderStatusPayloadSchema = z.object({
  order_id: z.string(),
  order_items: z
    .array(
      z.object({
        item_sku: z.string(),
        order_status: z.string(),
        message_error: z.string().optional(),
      })
    )
    .min(1),
})

/**
 * Timing-safe comparison of the provided access_key against the configured secret.
 */
function isValidAccessKey(provided: string | null): boolean {
  const expected = process.env.PRINTWAY_WEBHOOK_SECRET
  if (!expected || !provided) return false
  if (expected.length !== provided.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
}

/**
 * Resolves the "worst" (most severe) status from an array of per-item statuses.
 * Priority: failed > cancelled > shipped > delivered > in_production > producing > processing > pending
 */
function resolveAggregateStatus(statuses: string[]): string {
  const priority: Record<string, number> = {
    failed: 100,
    cancelled: 90,
    shipped: 70,
    delivered: 70,
    in_production: 40,
    producing: 40,
    processing: 20,
    pending: 10,
  }

  return statuses.reduce((worst, current) => {
    const currentPriority = priority[current?.toLowerCase()] ?? 0
    const worstPriority = priority[worst?.toLowerCase()] ?? 0
    return currentPriority > worstPriority ? current : worst
  }, statuses[0] ?? 'pending')
}

/**
 * Handles PrintWay tracking webhook — updates Shopify fulfillment with tracking info.
 */
async function handleTrackingWebhook(payload: PrintWayTrackingPayload): Promise<Response> {
  if (!payload?.order_id) {
    return json({ error: 'Invalid payload: missing order_id' }, { status: SUCCESS_STATUS })
  }

  // Find TailorKit Order by PrintWay order_id stored in fulfillment_order_submitted.orderId
  const tkOrder = await Order.findOne({
    'line_items.vendor': EPROVIDER.PRINTWAY,
    'line_items.fulfillment_order_submitted.orderId': payload.order_id,
  })

  if (!tkOrder) {
    console.error('[PrintWay Webhook] Order not found for pw_order_id:', payload.order_id)
    return json({ error: 'Order not found' }, { status: SUCCESS_STATUS })
  }

  const shopDomain = tkOrder.shopDomain
  const webhookId = `printway-tracking-${payload.order_id}`

  // Idempotency via WebhookLog unique index
  let webhookLog
  try {
    webhookLog = await WebhookLog.create({
      topic: PRINTWAY_WEBHOOK_TOPIC,
      webhookId,
      shopDomain,
      payload,
      status: 'processing',
    })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return json({ message: 'Webhook already processed' }, { status: SUCCESS_STATUS })
    }
    throw error
  }

  // Find the matching fulfillment order for PrintWay
  const fulfillmentOrdersArray = tkOrder.fulfillmentOrders as Array<{
    id: string
    lineItems: Array<{ lineItem: { vendor?: string } }>
  }>

  const matchingFulfillmentOrder = fulfillmentOrdersArray?.find(fo =>
    fo.lineItems?.some(li => li.lineItem?.vendor === EPROVIDER.PRINTWAY)
  )

  if (!matchingFulfillmentOrder) {
    console.error('[PrintWay Webhook] Fulfillment order not found for PrintWay, order_id:', payload.order_id)
    await WebhookLog.updateOne({ _id: webhookLog._id }, { status: 'failed' })
    return json({ error: 'Fulfillment order not found' }, { status: SUCCESS_STATUS })
  }

  const shopifyFulfillmentOrderId = formatNumberIdToShopifyObjectId(
    matchingFulfillmentOrder.id,
    SHOPIFY_FULFILLMENT_ORDER_PREFIX
  )

  // Mark as fulfilled with tracking info on Shopify
  await markFulfillmentOrderAsFulfilled(shopDomain, shopifyFulfillmentOrderId, {
    urls: [payload.tracking_url],
    numbers: [payload.tracking_number],
  })

  // Update line item status in TailorKit
  await updateLineItemFulfillmentOrderStatus({
    order: tkOrder.toObject(),
    fulfillmentOrderId: payload.order_id,
    shopDomain,
    shopId: EPROVIDER.PRINTWAY,
    status: 'fulfilled',
    vendor: EPROVIDER.PRINTWAY,
  })

  await WebhookLog.updateOne({ _id: webhookLog._id }, { status: 'completed', processedAt: new Date() })
  return json({ message: 'Tracking webhook processed successfully' }, { status: SUCCESS_STATUS })
}

/**
 * Handles PrintWay order status webhook — transitions fulfillment order status.
 * Uses the "worst" per-item status to determine the aggregate fulfillment order status.
 */
async function handleOrderStatusWebhook(payload: PrintWayOrderStatusPayload): Promise<Response> {
  if (!payload?.order_id || !Array.isArray(payload.order_items) || payload.order_items.length === 0) {
    return json({ error: 'Invalid payload: missing order_id or order_items' }, { status: SUCCESS_STATUS })
  }

  // Find TailorKit Order by PrintWay order_id
  const tkOrder = await Order.findOne({
    'line_items.vendor': EPROVIDER.PRINTWAY,
    'line_items.fulfillment_order_submitted.orderId': payload.order_id,
  })

  if (!tkOrder) {
    console.error('[PrintWay Webhook] Order not found for pw_order_id:', payload.order_id)
    return json({ error: 'Order not found' }, { status: SUCCESS_STATUS })
  }

  const shopDomain = tkOrder.shopDomain

  // Aggregate per-item statuses to a single representative status
  const itemStatuses = payload.order_items.map(item => item.order_status)
  const aggregateStatus = resolveAggregateStatus(itemStatuses)
  const webhookId = `printway-order-${payload.order_id}-${aggregateStatus}`

  // Idempotency via WebhookLog unique index
  let webhookLog
  try {
    webhookLog = await WebhookLog.create({
      topic: PRINTWAY_WEBHOOK_TOPIC,
      webhookId,
      shopDomain,
      payload,
      status: 'processing',
    })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return json({ message: 'Webhook already processed' }, { status: SUCCESS_STATUS })
    }
    throw error
  }

  // Get current status for this order's PrintWay line item
  const lineItemsArray = tkOrder.line_items as Array<{
    vendor?: string
    fulfillment_order_submitted?: { orderId?: string; status?: string }
  }>

  const printWayLineItem = lineItemsArray.find(
    item => item.vendor === EPROVIDER.PRINTWAY && item.fulfillment_order_submitted?.orderId === payload.order_id
  )

  if (!printWayLineItem) {
    console.error('[PrintWay Webhook] PrintWay line item not found for order_id:', payload.order_id)
    await WebhookLog.updateOne({ _id: webhookLog._id }, { status: 'failed' })
    return json({ error: 'PrintWay line item not found' }, { status: SUCCESS_STATUS })
  }

  const currentStatus = printWayLineItem.fulfillment_order_submitted?.status || FULFILLING

  // Guard: check if transition is allowed
  if (!canTransition(currentStatus, aggregateStatus)) {
    console.log(`[PrintWay Webhook] Skipping: ${currentStatus} -> ${aggregateStatus} (downgrade or no-op)`)
    await WebhookLog.updateOne({ _id: webhookLog._id }, { status: 'completed', processedAt: new Date() })
    return json({ message: 'Transition skipped' }, { status: SUCCESS_STATUS })
  }

  // Find the matching Shopify fulfillment order
  const fulfillmentOrdersArray = tkOrder.fulfillmentOrders as Array<{
    id: string
    lineItems: Array<{ lineItem: { vendor?: string } }>
  }>

  const matchingFulfillmentOrder = fulfillmentOrdersArray?.find(fo =>
    fo.lineItems?.some(li => li.lineItem?.vendor === EPROVIDER.PRINTWAY)
  )

  if (!matchingFulfillmentOrder) {
    console.error('[PrintWay Webhook] Fulfillment order not found for PrintWay, order_id:', payload.order_id)
    await WebhookLog.updateOne({ _id: webhookLog._id }, { status: 'failed' })
    return json({ error: 'Fulfillment order not found' }, { status: SUCCESS_STATUS })
  }

  const shopifyFulfillmentOrderId = formatNumberIdToShopifyObjectId(
    matchingFulfillmentOrder.id,
    SHOPIFY_FULFILLMENT_ORDER_PREFIX
  )

  const normalized = aggregateStatus.toLowerCase()

  // Apply the appropriate Shopify fulfillment action
  if (normalized === 'in_production' || normalized === 'producing') {
    await acceptAssignedFulfillmentOrder(shopDomain, shopifyFulfillmentOrderId)
  }

  if (normalized === 'shipped' || normalized === 'delivered') {
    await markFulfillmentOrderAsFulfilled(shopDomain, shopifyFulfillmentOrderId)
  }

  if (normalized === 'cancelled' || normalized === 'failed') {
    const errorMessage = payload.order_items.find(i => i.message_error)?.message_error
    await rejectAssignedFulfillmentOrder(
      shopDomain,
      shopifyFulfillmentOrderId,
      errorMessage || `Order ${normalized} by PrintWay`
    )
  }

  // Update TailorKit line item status
  const newFulfillmentStatus = mapPrintWayStatusToFulfillmentStatus(aggregateStatus)
  await updateLineItemFulfillmentOrderStatus({
    order: tkOrder.toObject(),
    fulfillmentOrderId: payload.order_id,
    shopDomain,
    shopId: EPROVIDER.PRINTWAY,
    status: newFulfillmentStatus,
    vendor: EPROVIDER.PRINTWAY,
  })

  await WebhookLog.updateOne({ _id: webhookLog._id }, { status: 'completed', processedAt: new Date() })
  return json({ message: 'Order status webhook processed successfully' }, { status: SUCCESS_STATUS })
}

/**
 * POST handler — Receives tracking and order status webhooks from PrintWay.
 * Discriminated by ?type=tracking|order query param.
 * Always returns 200 to prevent PrintWay from retrying on application errors.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { searchParams } = new URL(request.url)

    // Validate access_key (timing-safe)
    if (!isValidAccessKey(searchParams.get('access_key'))) {
      return json({ error: 'Unauthorized' }, { status: UNAUTHORIZED_STATUS })
    }

    const webhookType = searchParams.get('type') as PrintWayWebhookType | null

    if (!webhookType || (webhookType !== 'tracking' && webhookType !== 'order')) {
      return json({ error: 'Missing or invalid ?type param (expected: tracking|order)' }, { status: SUCCESS_STATUS })
    }

    const body = await request.text()
    const payload = JSON.parse(body)

    if (webhookType === 'tracking') {
      const parsed = trackingPayloadSchema.safeParse(payload)
      if (!parsed.success) {
        return json({ error: 'Invalid tracking payload' }, { status: SUCCESS_STATUS })
      }
      return await handleTrackingWebhook(parsed.data)
    }

    const parsed = orderStatusPayloadSchema.safeParse(payload)
    if (!parsed.success) {
      return json({ error: 'Invalid order status payload' }, { status: SUCCESS_STATUS })
    }
    return await handleOrderStatusWebhook(parsed.data)
  } catch (error) {
    if (error instanceof Response) throw error
    console.error('[PrintWay Webhook] Unhandled error:', error)
    // Always return 200 to prevent PrintWay from retrying indefinitely
    return json({ message: 'Webhook received' }, { status: SUCCESS_STATUS })
  }
}
