import { type LoaderFunctionArgs } from '@remix-run/node'
import crypto from 'crypto'
import type { FulfillmentOrderStatus } from '~/constants/fulfillment-providers'
import { CANCELED, EPROVIDER, FULFILLED } from '~/constants/fulfillment-providers'
import Order from '~/models/Order.server'
import { getProviderIntegrationByShopId } from '~/models/ProviderIntegration.Server'
import { Printify } from '~/modules/Fulfillments'
import {
  acceptAssignedFulfillmentOrder,
  getFulfillmentOrderById,
  holdFulfillmentOrder,
  markFulfillmentOrderAsFulfilled,
  rejectAssignedFulfillmentOrder,
  requestCancelFulfillmentOrder,
} from '../webhooks/fns/fulfillFulfillmentServiceLineItems.server'
import { formatNumberIdToShopifyObjectId } from '~/utils/shopify'
import { SHOPIFY_FULFILLMENT_ORDER_PREFIX } from '~/constants/shopify'
import { sendOrderToProduction, updateLineItemFulfillmentOrderStatus } from '../api.providers/orders'
import { postEventToCustomerIo } from '~/modules/customer.io/api.server'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'
import { formatOrderStatus } from '../orders._index/fns'
import { FulfillmentHoldReason } from '~/shopify/graphql/fulfillment-order/mutation.server'
import { FIVE_SECONDS } from '~/constants/time'
import { json } from '~/bootstrap/fns/fetch.server'
import { getShopifyApiClient } from '~/shopify/graphql/api.server'

const vendor = EPROVIDER.PRINTIFY

// Auto send status is 200 to prevent Printify block us
const SUCCESS_STATUS = 200

// Securely compare the signatures
const secureCompare = (a: string, b: string) => {
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

// Generate HMAC SHA256 hash
const generateHash = (body: string, secret: string) => {
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(body, 'utf-8')
  return `sha256=${hmac.digest('hex')}`
}

// Resource not found
const responseResourceNotFound = (resource?: string) => {
  throw new Error(`Resource not found: ${resource}`)
}

export const action = async ({ request }: LoaderFunctionArgs) => {
  try {
    const secret = process.env.PRINTIFY_WEBHOOK_SECRET!
    const signature = request.headers.get('x-pfy-signature')

    const { searchParams } = new URL(request.url)
    const secretToken = searchParams.get('secret')

    // This bypass is served for testing
    const byPassValidation = secretToken === secret

    // Read the body only once
    const body = await request.text()

    if (!byPassValidation) {
      if (request.method !== 'POST') {
        return json({ error: 'Invalid request method' }, { status: SUCCESS_STATUS })
      }

      if (!signature) {
        return json({ error: 'Missing signature' }, { status: SUCCESS_STATUS })
      }

      const calculatedSignature = generateHash(body, secret)

      if (!secureCompare(signature, calculatedSignature)) {
        return json({ error: 'Invalid signature' }, { status: SUCCESS_STATUS })
      }
    }

    // Parse the body only once
    const event = JSON.parse(body)

    const { type, resource } = event

    switch (type) {
      case 'order:updated': {
        const {
          id: fulfillmentOrderId,
          data: { shop_id },
        } = resource

        // Update line item status
        const providerIntegration = await getProviderIntegrationByShopId(shop_id)

        if (!providerIntegration) {
          // Throw error not found resource
          responseResourceNotFound('providerIntegration')
        }

        const { apiToken, shopDomain } = providerIntegration

        const printify = new Printify({
          accessToken: apiToken,
          shopId: shop_id,
        })

        const order = await printify.orders.getOne(fulfillmentOrderId)

        if (!order) {
          responseResourceNotFound('order')
        }

        const {
          status,
          sent_to_production_at,
          metadata: { shop_order_label },
          shipments = [],
        } = order

        const [, shopifyOrderNumberId] = shop_order_label.split('_')

        const _shopifyOrder = await Order.findOne({ id: shopifyOrderNumberId })

        if (!_shopifyOrder) {
          throw new Error('Shopify order not found')
        }

        // Cast shopify order to object
        const shopifyOrder = _shopifyOrder.toObject()

        // Update line item status function
        async function updateLineItemSubmittedOrderStatus(fulfillmentOrderId: string, status: FulfillmentOrderStatus) {
          // Run line item status
          await updateLineItemFulfillmentOrderStatus({
            order: shopifyOrder,
            fulfillmentOrderId,
            shopDomain,
            shopId: shop_id,
            status,
            vendor,
          }).catch(console.error)
        }

        // Send notification for merchant
        async function sendNotificationForMerchant(
          eventName: string,
          trackingInfo?: { urls: string[]; numbers: string[] }
        ) {
          // Wait 10 seconds for re-new order
          setTimeout(async () => {
            // Re-call shopify order
            const _shopifyOrder = await Order.findOne({ id: shopifyOrderNumberId }).populate('customer')

            if (!_shopifyOrder) return

            // Cast shopify order to object
            const shopifyOrder = _shopifyOrder.toObject()

            postEventToCustomerIo({
              shopDomain,
              eventName,
              eventData: shopifyOrder,
            }).catch(console.error)

            // Send a trigger to the Shopify Flow app
            if (shopifyOrder.customer?.id) {
              try {
                const api = await getShopifyApiClient(shopDomain)

                const handle
                  = eventName === CUSTOMERIO_EVENTS.ORDER_FAILED
                    ? 'tlk-fulfillment-failed'
                    : eventName === CUSTOMERIO_EVENTS.ORDER_SENT_TO_PRODUCTION
                      ? 'tlk-fulfillment-in-production'
                      : eventName === CUSTOMERIO_EVENTS.ORDER_FULFILLED
                        ? 'tlk-fulfillment-shipped'
                        : null

                if (handle) {
                  await api.triggerShopifyFlow(handle, {
                    order_id: shopifyOrder.id,
                    customer_id: shopifyOrder.customer.id,
                    ...(eventName === CUSTOMERIO_EVENTS.ORDER_FULFILLED
                      ? { 'Tracking URL': trackingInfo?.urls?.join(' ') || '' }
                      : {}),
                  })
                }
              } catch (e: any) {
                console.error('Failed to send a trigger to the Shopify Flow app', e)
              }
            }
          }, FIVE_SECONDS * 2)
        }

        const { fulfillmentOrders = [] } = shopifyOrder

        // Get the last fulfillment order number id
        const fulfillmentOrderNumberId = [
          ...fulfillmentOrders.filter(
            (fulfillmentOrder: any) => fulfillmentOrder.lineItems[0].lineItem.vendor === vendor
          ),
        ].pop().id

        // Get shopify fulfillment order id
        const shopifyFulfillmentOrderId = formatNumberIdToShopifyObjectId(
          fulfillmentOrderNumberId,
          SHOPIFY_FULFILLMENT_ORDER_PREFIX
        )

        // Check and send order to production
        if (status === 'on-hold' && !sent_to_production_at) {
          // Send order to production
          await sendOrderToProduction({
            payloadData: { orderId: shopifyOrderNumberId },
            shopDomain,
            vendor: vendor,
            shop_id: shop_id,
            callback: printify.orders.sendToProduction,
          })
        } else if (status === 'on-hold') {
          const reasonNotes = `Order is on hold, please check your order on ${vendor}`

          // Hold fulfillment order
          await holdFulfillmentOrder(shopDomain, shopifyFulfillmentOrderId, FulfillmentHoldReason.OTHER, reasonNotes)
        }

        if (status === 'payment-not-received' || status === 'has-issues') {
          // Cancel current order of fulfillment
          // Printify does not provide API to delete order, we only can cancel the order.
          await printify.orders.cancelUnpaid(order.id)

          // Reject fulfill
          await rejectAssignedFulfillmentOrder(shopDomain, shopifyFulfillmentOrderId, formatOrderStatus(status)).catch(
            console.error
          )

          // Remove submitted order id from line item
          await updateLineItemSubmittedOrderStatus('', CANCELED)

          // Send email to notify merchant that their order will not be fulfilled
          await sendNotificationForMerchant(CUSTOMERIO_EVENTS.ORDER_FAILED)
        }

        //|| status === 'sending-to-production'
        if (status === 'in-production') {
          // Accept shopify fulfillment order
          await acceptAssignedFulfillmentOrder(shopDomain, shopifyFulfillmentOrderId)

          // Send email to notify merchant that their order has been accepted
          await sendNotificationForMerchant(CUSTOMERIO_EVENTS.ORDER_SENT_TO_PRODUCTION)
        }

        if (status === 'fulfilled') {
          const hasShipments = shipments.length > 0
          // Get tracking info
          const trackingInfo = hasShipments
            ? {
                urls: shipments.map(shipment => shipment.url),
                numbers: shipments.map(shipment => shipment.number),
              }
            : undefined

          // Mark fulfillment order as fulfilled
          await markFulfillmentOrderAsFulfilled(shopDomain, shopifyFulfillmentOrderId, trackingInfo)

          // Update status to 'fulfilled' for each vendor in order
          await updateLineItemSubmittedOrderStatus(fulfillmentOrderId, FULFILLED)

          // Send email to notify merchant that their order has been fulfilled
          await sendNotificationForMerchant(CUSTOMERIO_EVENTS.ORDER_FULFILLED, trackingInfo)
        }

        if (status === 'canceled') {
          // Get current fulfillment order
          const currentFulfillmentOrder = await getFulfillmentOrderById(shopDomain, shopifyFulfillmentOrderId)

          const { status } = currentFulfillmentOrder

          // Fulfillment order is not in cancelable request state and can't be canceled.
          // Before cancelling the order, we need manual send a cancelable request to make sure the order can cancelable
          // We only can cancel the fulfillment order if status is in progress (Shopify requires)
          if (status === 'IN_PROGRESS') {
            await requestCancelFulfillmentOrder(shopDomain, shopifyFulfillmentOrderId)
          }

          // The continue progress will be processed in the next webhook
          // READ MORE at app/routes/api.fulfillment-services.$id.fulfillment_order_notifications/route.tsx
        }

        break
      }
    }

    return json({ message: 'Webhook received successfully' }, { status: SUCCESS_STATUS })
  } catch (e) {
    console.error(e)
    // Still respond with success
    return json({ message: 'Webhook received successfully' }, { status: SUCCESS_STATUS })
  }
}
