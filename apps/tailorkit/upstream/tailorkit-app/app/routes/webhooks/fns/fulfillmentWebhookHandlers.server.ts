import { SHOPIFY_ORDER_PREFIX } from '~/constants/shopify'
import Order from '~/models/Order.server'
import type { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { formatNumberIdToShopifyObjectId, formatShopifyObjectIdToNumberId } from '~/utils/shopify'
import { formatFulfillmentOrders } from './fulfillFulfillmentServiceLineItems.server'
import { getShopData } from '~/models/Shop.server'
import { postEventToCustomerIo } from '~/modules/customer.io/api.server'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'

/**
 * Sync fulfillment order to root order
 * By default, when fulfillment order is updated or created, the webhook orders/updated will not triggered.
 * So we need to sync the fulfillment order to root order via another webhook called fulfillment_orders.
 *
 * @param api ShopifyApiClient
 * @param payload any
 * @param shopDomain string
 */
export async function syncFulfillmentOrderToRootOrder(api: ShopifyApiClient, payload: any, shopDomain: string) {
  try {
    const fulfillmentOrderId = payload.original_fulfillment_order?.id || payload.fulfillment_order?.id

    // Get fulfillment order id
    const fulfillmentOrder = await api.getFulfillmentOrderById(fulfillmentOrderId)

    // Get root order
    const order = fulfillmentOrder.order
    const order_id = order.id

    // Get prettier order id
    const admin_graphql_api_id = formatNumberIdToShopifyObjectId(order_id, SHOPIFY_ORDER_PREFIX)
    const orderId = formatShopifyObjectIdToNumberId(order_id, SHOPIFY_ORDER_PREFIX)

    // Get more detail of the order
    const orderDetail = await api.getOrderById(admin_graphql_api_id)
    const { fulfillmentOrders: _fulfillmentOrders, displayFulfillmentStatus } = orderDetail

    // Get fulfillment orders
    const fulfillmentOrders = formatFulfillmentOrders(_fulfillmentOrders)

    // Update the order without overwriting print_images
    await Order.updateOne({ shopDomain, id: orderId }, { fulfillmentOrders, displayFulfillmentStatus })

    // Check if the required fulfillment services are connected to TailorKit
    const shopData = await getShopData(shopDomain)

    if (shopData) {
      fulfillmentOrders.forEach((fulfillmentOrder: any) => {
        fulfillmentOrder.lineItems.forEach((lineItem: any) => {
          const { title, vendor } = lineItem.lineItem

          // Check if the vendor is required to be connected to TailorKit
          if (shopData?.appConfig?.requiredFulfillmentServices?.[vendor] > 0) {
            postEventToCustomerIo({
              shopDomain,
              eventName: CUSTOMERIO_EVENTS.MISSING_PROVIDER_CONNECTION,
              eventData: { productTitle: title, vendorName: vendor },
            }).catch(console.error)
          }
        })
      })
    }
  } catch (e) {
    console.error('Failed to update fulfillment order', e)

    throw new Error(formatErrorMessage(e))
  }
}
