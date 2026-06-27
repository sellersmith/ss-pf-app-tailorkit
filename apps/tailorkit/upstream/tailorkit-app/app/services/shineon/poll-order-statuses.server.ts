import { EPROVIDER, FULFILLING, SENT_TO_PRODUCTION } from '~/constants/fulfillment-providers'
import { SHOPIFY_FULFILLMENT_ORDER_PREFIX } from '~/constants/shopify'
import Order from '~/models/Order.server'
import ProviderIntegration from '~/models/ProviderIntegration.Server'
import Provider from '~/models/Provider.server'
import { ShineOn } from '@sellersmith/shineon-sdk'
import type { Order as ShineOnOrder, OrderStatus } from '@sellersmith/shineon-sdk'
import {
  acceptAssignedFulfillmentOrder,
  markFulfillmentOrderAsFulfilled,
  rejectAssignedFulfillmentOrder,
} from '~/routes/webhooks/fns/fulfillFulfillmentServiceLineItems.server'
import { updateLineItemFulfillmentOrderStatus } from '~/routes/api.providers/orders'
import { formatNumberIdToShopifyObjectId } from '~/utils/shopify'
import { canTransition, mapShineOnStatusToFulfillmentStatus } from './status-transitions.server'

const ONE_HOUR_MS = 60 * 60 * 1000

/**
 * Polls ShineOn API for order status updates on orders that haven't
 * reached a terminal state (shipped/cancelled).
 * Called via cron endpoint: GET /api/public/shineon/webhooks?action=poll
 */
export async function pollShineOnOrderStatuses(): Promise<{ polled: number; updated: number }> {
  const cutoffDate = new Date(Date.now() - ONE_HOUR_MS)

  // Find orders with ShineOn line items in non-terminal status
  const orders = await Order.find({
    line_items: {
      $elemMatch: {
        vendor: EPROVIDER.SHINEON,
        'fulfillment_order_submitted.status': { $in: [FULFILLING, SENT_TO_PRODUCTION] },
        'fulfillment_order_submitted.orderId': { $exists: true, $ne: null },
      },
    },
    updatedAt: { $lt: cutoffDate },
  }).limit(50) // Process max 50 orders per poll run

  if (orders.length === 0) return { polled: 0, updated: 0 }

  // Group by shopDomain
  const ordersByShop = new Map<string, typeof orders>()
  for (const order of orders) {
    const shopDomain = order.shopDomain
    if (!ordersByShop.has(shopDomain)) ordersByShop.set(shopDomain, [])
    ordersByShop.get(shopDomain)!.push(order)
  }

  let updated = 0

  for (const [shopDomain, shopOrders] of ordersByShop) {
    try {
      // Find ShineOn provider integration for this shop
      const providerIntegrations = await ProviderIntegration.find({ shopDomain }).populate({
        path: 'providerId',
        model: Provider,
      })

      const shineOnIntegration = providerIntegrations.find(
        (pi: { providerId?: { name?: string; vendor?: string } }) =>
          pi.providerId?.name === EPROVIDER.SHINEON || pi.providerId?.vendor === EPROVIDER.SHINEON
      )

      if (!shineOnIntegration) continue

      const shineOn = new ShineOn({ token: shineOnIntegration.apiToken })

      for (const order of shopOrders) {
        try {
          const orderObj = order.toObject()
          // Find ShineOn line item
          const shineOnLineItem = orderObj.line_items?.find(
            (li: { vendor?: string; fulfillment_order_submitted?: { orderId?: string; status?: string } }) =>
              li.vendor === EPROVIDER.SHINEON && li.fulfillment_order_submitted?.orderId
          )
          if (!shineOnLineItem) continue

          const shineOnOrderId = shineOnLineItem.fulfillment_order_submitted.orderId
          const currentStatus = shineOnLineItem.fulfillment_order_submitted.status

          // Fetch current status from ShineOn API
          const response = await shineOn.orders.get(shineOnOrderId)
          const shineOnOrder = response.order
          if (!shineOnOrder) continue

          // Map current fulfillment status back to ShineOn status for comparison
          const currentShineOnStatus = mapFulfillmentStatusToShineOn(currentStatus)
          if (!currentShineOnStatus) continue

          // Check if transition is valid
          if (!canTransition(currentShineOnStatus, shineOnOrder.status)) continue

          // Find Shopify fulfillment order ID
          const fulfillmentOrder = orderObj.fulfillmentOrders?.find(
            (fo: { id: string; lineItems?: Array<{ lineItem?: { vendor?: string } }> }) =>
              fo.lineItems?.some(li => li.lineItem?.vendor === EPROVIDER.SHINEON)
          )
          if (!fulfillmentOrder) continue

          const shopifyFulfillmentOrderId = formatNumberIdToShopifyObjectId(
            fulfillmentOrder.id,
            SHOPIFY_FULFILLMENT_ORDER_PREFIX
          )

          // Apply transition
          await applyStatusTransition(shopDomain, shopifyFulfillmentOrderId, shineOnOrder, orderObj, shineOnOrderId)
          updated++
        } catch (e) {
          console.error(`Failed to poll ShineOn order for order ${order.id}:`, e)
        }
      }
    } catch (e) {
      console.error(`Failed to poll ShineOn orders for shop ${shopDomain}:`, e)
    }
  }

  console.log(`ShineOn polling completed: ${orders.length} polled, ${updated} updated`)
  return { polled: orders.length, updated }
}

/**
 * Map TailorKit fulfillment status back to ShineOn status for transition comparison
 */
function mapFulfillmentStatusToShineOn(status: string): OrderStatus | null {
  switch (status) {
    case FULFILLING:
      return 'on_hold' // Could be on_hold or awaiting_payment
    case SENT_TO_PRODUCTION:
      return 'in_production'
    default:
      return null // Already in terminal state
  }
}

/**
 * Apply status transition - shared logic with webhook handler
 */
async function applyStatusTransition(
  shopDomain: string,
  shopifyFulfillmentOrderId: string,
  shineOnOrder: ShineOnOrder,
  tkOrder: Record<string, unknown>,
  shineOnOrderId: string
) {
  const newFulfillmentStatus = mapShineOnStatusToFulfillmentStatus(shineOnOrder.status)

  if (shineOnOrder.status === 'in_production') {
    await acceptAssignedFulfillmentOrder(shopDomain, shopifyFulfillmentOrderId)
  }

  if (shineOnOrder.status === 'shipped') {
    // Tracking info is on line items in SDK
    const trackedItems = shineOnOrder.line_items.filter(li => li.tracking_number)
    const trackingInfo
      = trackedItems.length > 0
        ? {
            urls: [] as string[],
            numbers: trackedItems.map(li => li.tracking_number!),
          }
        : undefined
    await markFulfillmentOrderAsFulfilled(shopDomain, shopifyFulfillmentOrderId, trackingInfo)
  }

  if (shineOnOrder.status === 'cancelled') {
    await rejectAssignedFulfillmentOrder(shopDomain, shopifyFulfillmentOrderId, 'Order canceled by ShineOn')
  }

  // Update line item status
  await updateLineItemFulfillmentOrderStatus({
    order: tkOrder,
    fulfillmentOrderId: shineOnOrderId,
    shopDomain,
    shopId: 'shineon',
    status: newFulfillmentStatus,
    vendor: EPROVIDER.SHINEON,
  })
}
