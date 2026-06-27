import { Printify } from '~/modules/Fulfillments'
import { getShopsListFromPrintify } from '../api.providers-connection.$id/Printify/fns.server'
import type { PollConfig } from '~/utils/polling'
import { poll } from '~/utils/polling'
import { submitOrder } from '../api.providers/orders'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import { ONE_MINUTE_IN_MILLISECONDS, ONE_SECOND_IN_MILLISECONDS } from '~/constants'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { FULFILLMENT_ERRORS } from '~/constants/errors'
import { rejectAssignedFulfillmentOrder } from '../webhooks/fns/fulfillFulfillmentServiceLineItems.server'

interface IFulfillPrintifyOrderArgs {
  fulfillmentOrder: any
  shopDomain: string
  fulfillmentProvider: any
}

/**
 * Fulfill Printify order
 *
 * @param args IFulfillPrintifyOrderArgs
 * @returns
 */
export async function fulfillPrintifyOrder(args: IFulfillPrintifyOrderArgs) {
  const { fulfillmentOrder, shopDomain, fulfillmentProvider } = args
  const { orderId, id: fulfillmentOrderId } = fulfillmentOrder
  try {
    const { apiToken, shopId } = fulfillmentProvider

    const shopList = await getShopsListFromPrintify(apiToken)

    if (!shopList) {
      // Reject the fulfill order if the shop is not found
      await rejectAssignedFulfillmentOrder(shopDomain, fulfillmentOrderId, FULFILLMENT_ERRORS.INVALID_SHOP)

      throw new Error(FULFILLMENT_ERRORS.INVALID_SHOP)
    }

    // Create Printify instance
    const printify = new Printify({
      accessToken: apiToken,
      shopId,
    })

    // Submit order. This process will not have a error. If having errors, we listen via webhook
    await submitOrder({
      payloadData: { orderId, fulfillmentOrderId },
      shopDomain,
      vendor: EPROVIDER.PRINTIFY,
      shop_id: shopId,
      callback: printify.orders.submit,
    }).catch(console.error)
  } catch (e) {
    console.error('Error while fulfilling Printify order:', e)

    // Reject the fulfill order if it has issues
    await rejectAssignedFulfillmentOrder(shopDomain, fulfillmentOrderId, FULFILLMENT_ERRORS.FULFILLMENT_HAS_ISSUES)

    throw new Error(formatErrorMessage(e))
  }
}

const DEFAULT_POLL_CONFIG: PollConfig = {
  maxTimeout: ONE_MINUTE_IN_MILLISECONDS * 5, // 5 minutes
  initialDelay: ONE_SECOND_IN_MILLISECONDS * 30, // 30 seconds
}

/**
 * Poll the order until it is not pending (call 30s each time, maximum 5 minutes)
 *
 * @returns
 */
export async function pollForEndPendingPrintifyOrder(printify: Printify, fulfillmentOrderId: string) {
  return poll(async () => {
    const order = await printify.orders.getOne(fulfillmentOrderId)

    if (!order) {
      throw new Error('Fulfillment order is not found')
    }

    return order.status !== 'pending' ? order : null
  }, DEFAULT_POLL_CONFIG)
}
