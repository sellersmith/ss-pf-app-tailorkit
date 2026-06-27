import { type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node'
import crypto from 'crypto'
import { EPROVIDER, FULFILLING, SENT_TO_PRODUCTION, FULFILLED, CANCELED } from '~/constants/fulfillment-providers'
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
import {
  canTransition,
  mapShineOnStatusToFulfillmentStatus,
  parseExternalId,
} from '~/services/shineon/status-transitions.server'
import { pollShineOnOrderStatuses } from '~/services/shineon/poll-order-statuses.server'
import { SHINEON_WEBHOOK_TOPIC } from './constants'
import type { ShineOnWebhookPayload } from './types'
import type { OrderStatus } from '@sellersmith/shineon-sdk'

const SUCCESS_STATUS = 200
const UNAUTHORIZED_STATUS = 401

// Timing-safe secret comparison to prevent timing attacks
function isValidSecret(provided: string | null): boolean {
  const expected = process.env.SHINEON_WEBHOOK_SECRET
  if (!expected || !provided) return false
  if (expected.length !== provided.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
}

/**
 * Maps TailorKit fulfillment status back to ShineOn status (reverse mapping)
 */
function mapFulfillmentStatusToShineOnStatus(status: string): OrderStatus {
  switch (status) {
    case FULFILLING:
      return 'awaiting_payment'
    case SENT_TO_PRODUCTION:
      return 'in_production'
    case FULFILLED:
      return 'shipped'
    case CANCELED:
      return 'cancelled'
    default:
      return 'on_hold'
  }
}

/**
 * POST handler - Receives shipment notification from ShineOn
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // 1. Validate secret from query param (timing-safe)
    const { searchParams } = new URL(request.url)
    if (!isValidSecret(searchParams.get('secret'))) {
      return json({ error: 'Unauthorized' }, { status: UNAUTHORIZED_STATUS })
    }

    // 2. Parse JSON body
    const body = await request.text()
    const payload = JSON.parse(body) as ShineOnWebhookPayload

    if (!payload?.order?.id || !payload?.order?.external_id) {
      return json({ error: 'Invalid payload' }, { status: SUCCESS_STATUS })
    }

    // 3. Extract order info
    const { order } = payload
    const parsedExternalId = parseExternalId(order.external_id)

    if (!parsedExternalId) {
      console.error('[ShineOn Webhook] Invalid external_id format:', order.external_id)
      return json({ error: 'Invalid external_id format' }, { status: SUCCESS_STATUS })
    }

    const { orderId } = parsedExternalId

    // 4. Find TailorKit Order first (needed for shopDomain in WebhookLog)
    const tkOrder = await Order.findOne({ id: orderId })

    if (!tkOrder) {
      console.error('[ShineOn Webhook] Order not found:', orderId)
      return json({ error: 'Order not found' }, { status: SUCCESS_STATUS })
    }

    const shopDomain = tkOrder.shopDomain
    const webhookId = `shineon-${order.id}-${order.status}`

    // 5. Log to WebhookLog with real shopDomain (idempotency via unique index)
    let webhookLog
    try {
      webhookLog = await WebhookLog.create({
        topic: SHINEON_WEBHOOK_TOPIC,
        webhookId,
        shopDomain,
        payload,
        status: 'processing',
      })
    } catch (error: unknown) {
      // Check for MongoDB duplicate key error
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        return json({ message: 'Webhook already processed' }, { status: SUCCESS_STATUS })
      }
      throw error
    }

    // 6. Get current ShineOn status from line item
    const lineItemsArray = tkOrder.line_items as Array<{
      vendor?: string
      fulfillment_order_submitted?: { orderId?: string; status?: string }
    }>

    const shineOnLineItem = lineItemsArray.find(
      item => item.vendor === EPROVIDER.SHINEON && item.fulfillment_order_submitted?.orderId === order.id
    )

    if (!shineOnLineItem) {
      console.error('[ShineOn Webhook] ShineOn line item not found for order:', order.id)
      await WebhookLog.updateOne({ _id: webhookLog._id }, { status: 'failed' })
      return json({ error: 'ShineOn line item not found' }, { status: SUCCESS_STATUS })
    }

    const currentFulfillmentStatus = shineOnLineItem.fulfillment_order_submitted?.status || FULFILLING
    const mappedCurrentStatus = mapFulfillmentStatusToShineOnStatus(currentFulfillmentStatus)

    // 7. Check transition (idempotent guard)
    if (!canTransition(mappedCurrentStatus, order.status)) {
      console.log(`[ShineOn Webhook] Skipping: ${mappedCurrentStatus} -> ${order.status} (downgrade or no-op)`)
      await WebhookLog.updateOne({ _id: webhookLog._id }, { status: 'completed', processedAt: new Date() })
      return json({ message: 'Transition skipped' }, { status: SUCCESS_STATUS })
    }

    // 8. Get Shopify fulfillment order ID
    const fulfillmentOrdersArray = tkOrder.fulfillmentOrders as Array<{
      id: string
      lineItems: Array<{ lineItem: { vendor?: string } }>
    }>

    const matchingFulfillmentOrder = fulfillmentOrdersArray?.find(fo =>
      fo.lineItems?.some(li => li.lineItem?.vendor === EPROVIDER.SHINEON)
    )

    if (!matchingFulfillmentOrder) {
      console.error('[ShineOn Webhook] Fulfillment order not found for ShineOn')
      await WebhookLog.updateOne({ _id: webhookLog._id }, { status: 'failed' })
      return json({ error: 'Fulfillment order not found' }, { status: SUCCESS_STATUS })
    }

    const shopifyFulfillmentOrderId = formatNumberIdToShopifyObjectId(
      matchingFulfillmentOrder.id,
      SHOPIFY_FULFILLMENT_ORDER_PREFIX
    )

    // 9. Apply status transition
    const newFulfillmentStatus = mapShineOnStatusToFulfillmentStatus(order.status)

    if (order.status === 'in_production') {
      await acceptAssignedFulfillmentOrder(shopDomain, shopifyFulfillmentOrderId)
    }

    if (order.status === 'shipped') {
      const trackingInfo
        = order.shipments?.length > 0
          ? {
              urls: order.shipments.map(s => s.tracking_url),
              numbers: order.shipments.map(s => s.tracking_number),
            }
          : undefined
      await markFulfillmentOrderAsFulfilled(shopDomain, shopifyFulfillmentOrderId, trackingInfo)
    }

    if (order.status === 'cancelled') {
      await rejectAssignedFulfillmentOrder(shopDomain, shopifyFulfillmentOrderId, 'Order canceled by ShineOn')
    }

    // 10. Update line item status
    await updateLineItemFulfillmentOrderStatus({
      order: tkOrder.toObject(),
      fulfillmentOrderId: order.id,
      shopDomain,
      shopId: 'shineon',
      status: newFulfillmentStatus,
      vendor: EPROVIDER.SHINEON,
    })

    // 11. Mark webhook as completed
    await WebhookLog.updateOne({ _id: webhookLog._id }, { status: 'completed', processedAt: new Date() })

    return json({ message: 'Webhook received successfully' }, { status: SUCCESS_STATUS })
  } catch (error) {
    console.error('[ShineOn Webhook] Error processing webhook:', error)
    return json({ message: 'Webhook received successfully' }, { status: SUCCESS_STATUS })
  }
}

/**
 * GET handler - Trigger polling job for intermediate statuses (cron endpoint)
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { searchParams } = new URL(request.url)
    if (!isValidSecret(searchParams.get('secret'))) {
      return json({ error: 'Unauthorized' }, { status: UNAUTHORIZED_STATUS })
    }

    if (searchParams.get('action') === 'poll') {
      const result = await pollShineOnOrderStatuses()
      return json({ message: 'Polling completed', ...result }, { status: SUCCESS_STATUS })
    }

    return json({ message: 'OK' }, { status: SUCCESS_STATUS })
  } catch (error) {
    console.error('[ShineOn Webhook] Polling error:', error)
    return json({ message: 'OK' }, { status: SUCCESS_STATUS })
  }
}
