import { FULFILLMENT_ERRORS } from '~/constants/errors'
import { SHOPIFY_ORDER_PREFIX } from '~/constants/shopify'
import { submitPrintWayOrder } from '~/services/printway/submit-printway-order.server'
import { executeWithRetry } from '~/services/printway/retry-queue.server'
import { createPrintWaySdkWithRefresh } from '~/services/printway/token-manager.server'
import { rejectAssignedFulfillmentOrder } from '~/routes/webhooks/fns/fulfillFulfillmentServiceLineItems.server'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { formatShopifyObjectIdToNumberId } from '~/utils/shopify'

interface FulfillmentOrderRef {
  orderId: string
  id: string
}

interface FulfillmentProviderRef {
  apiToken?: string
  _id?: string
  id?: string
}

export interface IFulfillPrintWayOrderArgs {
  fulfillmentOrder: FulfillmentOrderRef
  shopDomain: string
  fulfillmentProvider: FulfillmentProviderRef
}

/**
 * Fulfills a PrintWay order - called during auto-fulfill or manual send to production.
 * Creates a PrintWay SDK instance with auto-refresh token persistence and submits
 * the order with artwork URLs. Wraps submission in exponential backoff retry.
 */
export async function fulfillPrintWayOrder(args: IFulfillPrintWayOrderArgs): Promise<void> {
  const { fulfillmentOrder, shopDomain, fulfillmentProvider } = args
  const { orderId: rawOrderId, id: fulfillmentOrderId } = fulfillmentOrder

  try {
    const { apiToken } = fulfillmentProvider

    if (!apiToken) {
      await rejectAssignedFulfillmentOrder(shopDomain, fulfillmentOrderId, FULFILLMENT_ERRORS.INVALID_SHOP)
      throw new Error('PrintWay API token not found')
    }

    // Convert Shopify GID (gid://shopify/Order/12345) to numeric ID
    const orderId = +formatShopifyObjectIdToNumberId(rawOrderId, SHOPIFY_ORDER_PREFIX)
    const providerId = String(fulfillmentProvider._id || fulfillmentProvider.id || '')

    const sdk = createPrintWaySdkWithRefresh(apiToken, shopDomain, providerId)

    await executeWithRetry({
      orderId,
      shopDomain,
      submitFn: () =>
        submitPrintWayOrder({
          orderId,
          shopDomain,
          callback: data => sdk.orders.create(data),
        }),
    })
  } catch (e) {
    console.error('[PrintWay] Error while fulfilling order:', e)
    await rejectAssignedFulfillmentOrder(shopDomain, fulfillmentOrderId, FULFILLMENT_ERRORS.FULFILLMENT_HAS_ISSUES)
    throw new Error(formatErrorMessage(e))
  }
}
