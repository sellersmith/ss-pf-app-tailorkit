import { EPROVIDER, FULFILLING } from '~/constants/fulfillment-providers'
import Order from '~/models/Order.server'
import type { LineItem } from '~/models/Order.server'
import type { CreateOrderV1Params, OrderResponse } from '@sellersmith/shineon-sdk'
import { updateLineItemFulfillmentOrderStatus } from '~/routes/api.providers/orders'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { uuid } from '~/utils/uuid'

/**
 * Submits a ShineOn order. Unlike Printify, ShineOn uses a flat payload with
 * SKU + properties (personalization). No blueprint/provider/print_areas nesting.
 */
export async function submitShineOnOrder(args: {
  orderId: number
  shopDomain: string
  callback: (data: CreateOrderV1Params) => Promise<OrderResponse>
}) {
  const { orderId, shopDomain, callback } = args

  try {
    const order = await Order.findOne({ shopDomain, id: orderId })
    if (!order) throw new Error('Order not found')

    const line_items = [...order.line_items] as LineItem[]
    const shineOnLineItems: CreateOrderV1Params['order']['line_items'] = []

    for (const line_item of line_items) {
      if (line_item.vendor !== EPROVIDER.SHINEON) continue

      const { fulfillment_order_data, fulfillment_order_submitted } = line_item
      // Skip if already submitted or no data
      if (fulfillment_order_submitted?.orderId || !fulfillment_order_data?.sku) continue

      shineOnLineItems.push({
        store_line_item_id: fulfillment_order_data.sku,
        sku: fulfillment_order_data.sku,
        quantity: line_item.quantity,
        properties: fulfillment_order_data.properties || {},
      })
    }

    if (shineOnLineItems.length === 0) {
      console.log('No ShineOn line items to submit')
      return null
    }

    const shipping = order.shipping_address
    const submitData: CreateOrderV1Params = {
      order: {
        source_id: `TLKT-${orderId}-${uuid().slice(0, 8)}`,
        shipment_notification_url: '',
        shipping_address: {
          name: `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim(),
          country_code: shipping.country_code || shipping.country || '',
          province: shipping.province || '',
          province_code: shipping.province_code || '',
          address1: shipping.address1 || '',
          address2: shipping.address2 || '',
          city: shipping.city || '',
          zip: shipping.zip || '',
          phone: shipping.phone || '',
        },
        email: order.contact_email || order.email || '',
        line_items: shineOnLineItems,
      },
    }

    const response = await callback(submitData)

    // Store ShineOn order ID on line items
    await updateLineItemFulfillmentOrderStatus({
      order,
      fulfillmentOrderId: String(response.order.id),
      shopDomain,
      shopId: 'shineon',
      status: FULFILLING,
      vendor: EPROVIDER.SHINEON,
    })

    return response
  } catch (e) {
    console.error(`Failed to submit ShineOn order ${orderId}`, e)
    throw new Error(formatErrorMessage(e))
  }
}
