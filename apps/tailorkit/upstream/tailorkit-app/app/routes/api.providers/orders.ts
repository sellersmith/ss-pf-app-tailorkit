import type { FulfillmentOrderStatus, EPROVIDER } from '~/constants/fulfillment-providers'
import { FULFILLING, PREFIX_FULFILLMENT_ORDER_ID } from '~/constants/fulfillment-providers'
import { SHOPIFY_FULFILLMENT_ORDER_PREFIX, SHOPIFY_ORDER_PREFIX } from '~/constants/shopify'
import type { LineItem } from '~/models/Order.server'
import Order from '~/models/Order.server'
import type { SubmitOrderData } from '~/modules/Fulfillments/Printify/orders/submit'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { formatShopifyObjectIdToNumberId } from '~/utils/shopify'
import { uuid } from '~/utils/uuid'
import { preparePrintAreasFulfillmentProvider } from './print-areas'

/**
 * Updates the fulfillment order status for line items in an order.
 * This function finds line items matching the specified vendor and updates their status.
 *
 * @param args - The arguments object
 * @param args.order - The order containing the line items to update
 * @param args.shopId - The shop's unique identifier
 * @param args.fulfillmentOrderId - The fulfillment order's unique identifier
 * @param args.vendor - The fulfillment provider's identifier
 * @param args.shopDomain - The shop's domain
 * @param args.status - The new fulfillment order status
 *
 * @example
 * ```ts
 * await updateLineItemFulfillmentOrderStatus({
 *   order,
 *   shopId: '123',
 *   fulfillmentOrderId: 'fo_123',
 *   vendor: EPROVIDER.PRINTIFY,
 *   shopDomain: 'myshop.myshopify.com',
 *   status: 'fulfilling'
 * })
 * ```
 */
export async function updateLineItemFulfillmentOrderStatus(args: {
  order: any
  shopId: string
  fulfillmentOrderId: string
  vendor: string
  shopDomain: string
  status: FulfillmentOrderStatus
}): Promise<void> {
  const { order, shopId, fulfillmentOrderId, vendor, shopDomain, status } = args

  const orderId = order.id
  const line_items = order.line_items as LineItem[]

  // Update status for each vendor in order
  await Order.updateOne(
    { shopDomain, id: orderId },
    {
      line_items: line_items.map((line_item: LineItem) => {
        if (line_item.vendor === vendor) {
          const fulfillment_order_submitted = {
            shop_id: shopId,
            status,
            orderId: fulfillmentOrderId,
          }

          return {
            ...(typeof line_item.toObject === 'function' ? line_item.toObject() : line_item),
            fulfillment_order_submitted,
          }
        }

        return line_item
      }),
    }
  )
}

/**
 * Submits an order to the fulfillment service.
 * This function prepares the order data according to the provider's requirements and submits it.
 *
 * @param args - The arguments object
 * @param args.payloadData - Object containing order and fulfillment order IDs
 * @param args.shopDomain - The shop's domain
 * @param args.vendor - The fulfillment provider
 * @param args.shop_id - The shop's unique identifier
 * @param args.callback - Function to call with the prepared order data
 * @returns The response from the fulfillment service
 * @throws Error if order is not found or submission fails
 *
 * @example
 * ```ts
 * const response = await submitOrder({
 *   payloadData: { orderId: '123', fulfillmentOrderId: 'fo_123' },
 *   shopDomain: 'myshop.myshopify.com',
 *   vendor: EPROVIDER.PRINTIFY,
 *   shop_id: '123',
 *   callback: (data) => printifyApi.submitOrder(data)
 * })
 * ```
 */
export async function submitOrder(args: {
  payloadData: { orderId: string; fulfillmentOrderId: string }
  shopDomain: string
  vendor: EPROVIDER
  shop_id: string
  callback: (data: SubmitOrderData) => Promise<any>
}) {
  try {
    const { payloadData, shopDomain, shop_id: shopId, vendor, callback } = args
    const { orderId, fulfillmentOrderId } = payloadData

    // Format order IDs for display
    const prettyOrderId = formatShopifyObjectIdToNumberId(orderId, SHOPIFY_ORDER_PREFIX)
    const prettyFulfillmentOrderId = formatShopifyObjectIdToNumberId(
      fulfillmentOrderId,
      SHOPIFY_FULFILLMENT_ORDER_PREFIX
    )

    // Find the order
    const order = await Order.findOne({ shopDomain, id: prettyOrderId })
    if (!order) {
      throw new Error('Order not found')
    }

    const line_items = [...order.line_items] as LineItem[]
    let isValidLineItems = true
    const preparedLineItems = []

    // Process each line item
    for (const line_item of line_items) {
      if (line_item.vendor !== vendor) continue

      const { fulfillment_order_data = {}, fulfillment_order_submitted = {} } = line_item
      const { orderId: existingFulfillmentOrderId } = fulfillment_order_submitted

      // Check if line item can be submitted
      const fulfillmentOrderDataKeys = Object.keys(JSON.parse(JSON.stringify(fulfillment_order_data)))
      const isEmptyFulfillmentOrderData = fulfillmentOrderDataKeys.length === 0

      if ((isEmptyFulfillmentOrderData || existingFulfillmentOrderId) && isValidLineItems) {
        isValidLineItems = false
      }

      // Prepare line item data
      const { product_id, variant_id, provider_id, print_areas } = fulfillment_order_data
      const preparedPrintAreas = preparePrintAreasFulfillmentProvider(print_areas, vendor)

      const line_item_data = {
        blueprint_id: product_id,
        variant_id,
        print_provider_id: provider_id,
        print_areas: preparedPrintAreas,
        quantity: line_item.quantity,
      } as unknown as LineItem

      preparedLineItems.push(line_item_data)
    }

    // If no valid line items, return early
    if (!isValidLineItems) {
      console.log('Not all line items have fulfillment order data')
      return null
    }

    // Prepare the order data
    const submitOrderData: SubmitOrderData = {
      external_id: uuid(),
      label: `${PREFIX_FULFILLMENT_ORDER_ID}_${prettyOrderId}_${prettyFulfillmentOrderId}`,
      line_items: preparedLineItems,
      shipping_method: 1, // Standard shipping
      is_economy_shipping: false,
      is_printify_express: false,
      send_shipping_notification: true,
      address_to: { ...order.shipping_address, country: order.shipping_address.country_code },
    }

    // Submit the order
    const response = await callback(submitOrderData)

    // Update the order status
    await updateLineItemFulfillmentOrderStatus({
      order,
      fulfillmentOrderId: response.id,
      shopDomain,
      shopId,
      status: FULFILLING,
      vendor,
    })

    return response
  } catch (e) {
    console.error(`Failed to submit order ${args.payloadData.orderId}`, e)
    throw new Error(formatErrorMessage(e))
  }
}

/**
 * Sends an existing order to production.
 * This function finds an order and sends it to the fulfillment service's production system.
 *
 * @param args - The arguments object
 * @param args.payloadData - Object containing the order ID
 * @param args.shopDomain - The shop's domain
 * @param args.vendor - The fulfillment provider
 * @param args.shop_id - The shop's unique identifier
 * @param args.callback - Function to call with the fulfillment order ID
 * @returns The response from the fulfillment service
 * @throws Error if order is not found or sending to production fails
 */
export async function sendOrderToProduction(args: {
  payloadData: { orderId: string }
  shopDomain: string
  vendor: EPROVIDER
  shop_id: string
  callback: (fulfillmentOrderId: string) => Promise<any>
}) {
  const { payloadData, shopDomain, shop_id: shopId, vendor, callback } = args
  const orderId = +payloadData.orderId

  // Find the order
  const order = await Order.findOne({ shopDomain, id: orderId })
  if (!order) {
    throw new Error('Order not found')
  }

  // Find the fulfillment order ID
  const line_items = order.line_items as LineItem[]
  const fulfillmentOrderId = line_items.find(line_item => line_item.vendor === vendor)?.fulfillment_order_submitted
    ?.orderId

  if (!fulfillmentOrderId) {
    throw new Error(`${vendor} order not found`)
  }

  try {
    // Send to production
    const response = await callback(fulfillmentOrderId)

    if (!response.id) {
      throw new Error('Invalid order id')
    }

    // Update the order status
    await updateLineItemFulfillmentOrderStatus({
      order,
      fulfillmentOrderId: response.id,
      shopDomain,
      shopId,
      status: 'sent-to-production',
      vendor,
    })

    return response
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : (e as string)
    console.log('errorMessage: ', errorMessage)
    throw new Error(errorMessage)
  }
}
