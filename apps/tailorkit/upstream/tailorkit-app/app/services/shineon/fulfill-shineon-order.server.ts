import { FULFILLMENT_ERRORS } from '~/constants/errors'
import { SHOPIFY_ORDER_PREFIX } from '~/constants/shopify'
import { ShineOn } from '@sellersmith/shineon-sdk'
import { submitShineOnOrder } from '~/services/shineon/submit-shineon-order.server'
import { executeWithRetry } from '~/services/shineon/retry-queue.server'
import { rejectAssignedFulfillmentOrder } from '~/routes/webhooks/fns/fulfillFulfillmentServiceLineItems.server'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { formatShopifyObjectIdToNumberId } from '~/utils/shopify'

interface FulfillmentOrderRef {
  orderId: string
  id: string
}

interface FulfillmentProviderRef {
  apiToken?: string
}

interface IFulfillShineOnOrderArgs {
  fulfillmentOrder: FulfillmentOrderRef
  shopDomain: string
  fulfillmentProvider: FulfillmentProviderRef
}

/**
 * Fulfills a ShineOn order - called during auto-fulfill or manual send to production.
 * Creates ShineOn SDK instance and submits the order with personalization data.
 * Wraps submission in exponential backoff retry for transient errors.
 */
export async function fulfillShineOnOrder(args: IFulfillShineOnOrderArgs) {
  const { fulfillmentOrder, shopDomain, fulfillmentProvider } = args
  const { orderId: rawOrderId, id: fulfillmentOrderId } = fulfillmentOrder

  try {
    const { apiToken } = fulfillmentProvider

    if (!apiToken) {
      await rejectAssignedFulfillmentOrder(shopDomain, fulfillmentOrderId, FULFILLMENT_ERRORS.INVALID_SHOP)
      throw new Error('ShineOn API token not found')
    }

    // Convert Shopify GID (gid://shopify/Order/12345) to numeric ID
    const orderId = +formatShopifyObjectIdToNumberId(rawOrderId, SHOPIFY_ORDER_PREFIX)

    const shineOn = new ShineOn({ token: apiToken })

    await executeWithRetry({
      orderId,
      shopDomain,
      submitFn: () =>
        submitShineOnOrder({
          orderId,
          shopDomain,
          callback: data => shineOn.orders.create(data),
        }),
    })
  } catch (e) {
    console.error('Error while fulfilling ShineOn order:', e)
    await rejectAssignedFulfillmentOrder(shopDomain, fulfillmentOrderId, FULFILLMENT_ERRORS.FULFILLMENT_HAS_ISSUES)
    throw new Error(formatErrorMessage(e))
  }
}
