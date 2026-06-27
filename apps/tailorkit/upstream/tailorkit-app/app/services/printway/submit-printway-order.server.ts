import type { CreateOrderData } from '@sellersmith/printway-sdk'
import { EPROVIDER, FULFILLING } from '~/constants/fulfillment-providers'
import Order from '~/models/Order.server'
import type { LineItem } from '~/models/Order.server'
import type { PrintWayFulfillmentData } from '~/services/fulfillment/fulfillment-data-types'
import { isPrintWayData } from '~/services/fulfillment/fulfillment-data-types'
import { updateLineItemFulfillmentOrderStatus } from '~/routes/api.providers/orders'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { uuid } from '~/utils/uuid'

/**
 * Submits a PrintWay order. Builds the order payload from Order + PrintWay fulfillment data,
 * including artwork URLs per item. Uses flat SDK field names as required by CreateOrderData.
 */
export async function submitPrintWayOrder(args: {
  orderId: number
  shopDomain: string
  callback: (data: CreateOrderData) => Promise<any>
}) {
  const { orderId, shopDomain, callback } = args

  try {
    const order = await Order.findOne({ shopDomain, id: orderId })
    if (!order) throw new Error('Order not found')

    const line_items = [...order.line_items] as LineItem[]
    const orderItems: CreateOrderData['order_items'] = []

    for (const line_item of line_items) {
      if (line_item.vendor !== EPROVIDER.PRINTWAY) continue

      const { fulfillment_order_data, fulfillment_order_submitted } = line_item
      // Skip if already submitted or missing required data
      if (fulfillment_order_submitted?.orderId || !fulfillment_order_data) continue

      const fodRaw
        = typeof fulfillment_order_data.toObject === 'function'
          ? fulfillment_order_data.toObject()
          : fulfillment_order_data

      if (!isPrintWayData(fodRaw)) continue

      const fod = fodRaw as PrintWayFulfillmentData
      if (!fod.item_sku) continue

      const item: Record<string, unknown> = {
        item_sku: fod.item_sku,
        variant_id: fod.variant_id,
        quantity: line_item.quantity,
        product_location: fod.product_location,
        made_in_location: fod.made_in_location,
        product_name: '',
      }

      // Spread artwork URLs (artwork_front, artwork_back, etc.) as flat fields
      for (const [key, url] of Object.entries(fod.artworks || {})) {
        item[key] = url
      }

      orderItems.push(item as unknown as CreateOrderData['order_items'][number])
    }

    if (orderItems.length === 0) {
      console.log('[PrintWay] No PrintWay line items to submit for order', orderId)
      return null
    }

    const shipping = order.shipping_address
    const submitData: CreateOrderData = {
      order_id: `TLKT-${orderId}-${uuid().slice(0, 8)}`,
      firstName: shipping.first_name || '',
      lastName: shipping.last_name || '',
      shipping_email: order.contact_email || order.email || '',
      shipping_phone: shipping.phone || '',
      shipping_address1: shipping.address1 || '',
      shipping_city: shipping.city || '',
      shipping_province: shipping.province || '',
      shipping_province_code: shipping.province_code || '',
      shipping_zip: shipping.zip || '',
      shipping_country: shipping.country || '',
      shipping_country_code: shipping.country_code || shipping.country || '',
      shipping_service: 'standard',
      order_items: orderItems,
    }

    const response = await callback(submitData)

    // Store PrintWay order ID on line items
    await updateLineItemFulfillmentOrderStatus({
      order,
      fulfillmentOrderId: String(response.pw_order_id || response.order_id || response.id),
      shopDomain,
      shopId: 'printway',
      status: FULFILLING,
      vendor: EPROVIDER.PRINTWAY,
    })

    return response
  } catch (e) {
    console.error(`[PrintWay] Failed to submit order #${orderId}`, e)
    throw new Error(formatErrorMessage(e))
  }
}
