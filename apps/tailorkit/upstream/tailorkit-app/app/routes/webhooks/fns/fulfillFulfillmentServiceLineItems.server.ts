import {
  FULFILLMENT_SERVICE_SUBMIT_FULFILLMENT_ORDER_CANCELLATION_REQUEST,
  PARTIAL,
  UNFULFILLED,
} from '~/constants/fulfillment-providers'
import Order from '~/models/Order.server'
import { canUseFreeResources } from '~/models/PricingPlan.fns'
import Provider from '~/models/Provider.server'
import ProviderIntegration from '~/models/ProviderIntegration.Server'
import { getShopData } from '~/models/Shop.server'
import type { SubscriptionDocument } from '~/models/Subscription'
import { postEventToCustomerIo } from '~/modules/customer.io/api.server'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'
import { getProviderOrNull } from '~/services/fulfillment/registry.server'
import type { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { getShopifyApiClient } from '~/shopify/graphql/api.server'
import type { FulfillmentOrderHoldRequest } from '~/shopify/graphql/fulfillment-order/mutation.server'
import { FulfillmentHoldReason } from '~/shopify/graphql/fulfillment-order/mutation.server'
import { formatErrorMessage } from '~/utils/formatErrorMessage'

/**
 * Processes and fulfills line items associated with a fulfillment service.
 *
 * This asynchronous function handles the fulfillment of order line items that are processed by a designated fulfillment service.
 * It validates if auto-fulfillment is applicable based on order status, shop subscription details, and other relevant parameters.
 * Depending on the provided arguments, it will utilize an existing Shopify API client or obtain one using the shop domain.
 *
 * @param {Object} args - The parameters for fulfilling service line items.
 * @param {any} args.order - The order object to process. If it has a 'toObject' method, the order will be converted accordingly.
 * @param {any} [args.specificOrder] - Optional subset of the order data for selective line item fulfillment.
 * @param {string} args.shopDomain - The domain of the shop associated with this order.
 * @param {any} [args.shopData] - Optional shop data; if absent, it will be retrieved based on the shop domain.
 * @param {ShopifyApiClient} [args.api] - Optional Shopify API client; if not provided, one will be obtained using the shop domain.
 * @param {boolean} [args.shouldFulfill] - Flag indicating whether the order should be auto-fulfilled.
 * @param {boolean} [args.requestedFromOrderCreate=false] - Flag indicating if the fulfillment request originated from order creation.
 *
 * @returns {Promise<any>} A promise that resolves once the fulfillment service line items have been processed.
 */
export async function fulfillFulfillmentServiceLineItems(args: {
  order: any
  // If this order only need part of line items base on vendor
  specificOrder?: any
  shopDomain: string
  shopData?: any
  api?: ShopifyApiClient
  shouldFulfill?: boolean
  /** State for checking the request comes from order create */
  requestedFromOrderCreate?: boolean
}) {
  const { order: _order, shopDomain, shouldFulfill, requestedFromOrderCreate = false } = args

  // Cast to object order if needed
  const order = typeof _order.toObject === 'function' ? _order.toObject() : _order

  let api = args.api

  if (!api) {
    api = await getShopifyApiClient(shopDomain)

    if (!api) {
      throw new Error('Failed to get Shopify API client')
    }
  }

  let { shopData } = args

  try {
    // Automatically fulfill the order if all the following conditions match:
    // - The `financial_status` of the order is `paid`.
    // - The `fulfillment_status` of the order is `pending`.
    // - Ordered products are imported from a fulfillment provider.
    // - Merchants enable the auto-fulfill orders for the matched provider.
    // - Merchants still have monthly free orders remaining.
    // - Merchants haven't reached their manual-set capped amount.
    shopData = shopData || (await getShopData(shopDomain))
    const subscription = shopData?.subscription as SubscriptionDocument

    const isNonExistedStatus = order.fulfillment_status === null || order.fulfillment_status === undefined
    const isOrderPending = order.fulfillment_status === 'pending'
    const isUnfulfilled = order.fulfillment_status === UNFULFILLED
    const isPartiallyFulfilling = order.fulfillment_status === PARTIAL
    const canFulfillBaseOnFulfillmentStatus
      = isOrderPending || isNonExistedStatus || isUnfulfilled || isPartiallyFulfilling

    if (
      !(
        shopData
        // Check `financial_status`
        && order.financial_status === 'paid'
        // Check `fulfillment_status`
        && canFulfillBaseOnFulfillmentStatus
        // Check monthly free orders
        && canUseFreeResources({ shopData })
        // Check user capped amount
        && !subscription.reachedUserCappedAmount
      )
    ) {
      return
    }

    // Find provider integration by shopDomain to fulfill
    const fulfillmentProviders = await ProviderIntegration.find({ shopDomain }).populate({
      path: 'providerId',
      model: Provider,
    })

    if (!fulfillmentProviders.length) {
      return
    }

    for (const fulfillmentProvider of fulfillmentProviders) {
      const { autoFulfill } = fulfillmentProvider

      // 1. Only handle auto fulfill if order has just created
      // 2. Auto fulfill mode is enable
      if (requestedFromOrderCreate && !autoFulfill) {
        continue
      }

      // Recall order to make sure it update to date
      const orderDetail = await api.getOrderById(order.admin_graphql_api_id)
      const fulfillmentOrders = formatFulfillmentOrders(orderDetail.fulfillmentOrders)

      // Update fulfillmentOrders to make sure it up to date
      Order.updateOne({ id: order.id }, { fulfillmentOrders }).catch(console.error)

      // Loop through vendor
      for (const fulfillmentOrder of fulfillmentOrders) {
        try {
          const { lineItems } = fulfillmentOrder

          // Get last item
          const last_item = lineItems[lineItems.length - 1]

          // Get vendor
          const vendor = last_item.lineItem.vendor

          const adapter = getProviderOrNull(vendor)
          if (!adapter) continue // unknown vendor, skip to next fulfillment order

          if (shouldFulfill) {
            await adapter.fulfillOrder({
              fulfillmentOrder,
              shopDomain,
              fulfillmentProvider,
            })
          }

          if (api) {
            const fulfillmentOrderId = fulfillmentOrder.id
            const queriedFulfillmentOrder = await api.getFulfillmentOrderById(fulfillmentOrderId)

            if (queriedFulfillmentOrder) {
              const { status, requestStatus } = queriedFulfillmentOrder

              if (status === 'OPEN' && requestStatus !== 'SUBMITTED') {
                await api.fulfillmentOrderSubmitFulfillmentRequest(fulfillmentOrder.id)

                postEventToCustomerIo({
                  shopDomain,
                  eventName: CUSTOMERIO_EVENTS.REQUEST_FULFILLMENT_ORDER,
                  eventData: order,
                }).catch(console.error)
              }
            }
          }
        } catch (e) {
          // Send email to notify merchant that their order will not be fulfilled
          postEventToCustomerIo({
            shopDomain,
            eventName: CUSTOMERIO_EVENTS.ORDER_FAILED,
            eventData: order,
          }).catch(console.error)

          console.error(`Can't fulfill fulfillment order ${fulfillmentOrder.id} because: ${formatErrorMessage(e)}`)
          continue
        }
      }
    }
  } catch (e) {
    const errMessage = formatErrorMessage(e)
    console.error(`Can't auto fulfill because: ${errMessage}`)

    throw new Error(errMessage)
  }
}

/**
 * Hold a fulfillment order
 *
 * @param shopDomain string
 * @param fulfillmentOrderId string
 * @param reason FulfillmentHoldReason
 * @param reasonNotes string
 */
export async function holdFulfillmentOrder(
  shopDomain: string,
  fulfillmentOrderId: string,
  reason: FulfillmentHoldReason = FulfillmentHoldReason.OTHER,
  reasonNotes?: string
) {
  try {
    const shopifyApiClient = await getShopifyApiClient(shopDomain)

    // Prepare fulfillment hold request
    const fulfillmentHold: FulfillmentOrderHoldRequest['fulfillmentHold'] = {
      reason,
      reasonNotes,
    }

    // Hold fulfillment order
    await shopifyApiClient.holdFulfillmentOrder(fulfillmentHold, fulfillmentOrderId)
  } catch (e) {
    console.error('Failed to hold fulfillment order', e)
    throw new Error(formatErrorMessage(e))
  }
}

/**
 * Retrieve assigned fulfillment order requests
 *
 * @param shopDomain string
 * @param fulfillmentOrderId string
 * @returns
 */
export async function getFulfillmentOrderById(shopDomain: string, fulfillmentOrderId: string) {
  try {
    const shopifyApiClient = await getShopifyApiClient(shopDomain)

    return shopifyApiClient.getFulfillmentOrderById(fulfillmentOrderId)
  } catch (e) {
    console.error('Failed to get fulfillment order by id', e)
    throw new Error(formatErrorMessage(e))
  }
}

/**
 * Accept assigned fulfillment order
 *
 * @param shopDomain
 * @param fulfillmentOrderId
 */
export async function acceptAssignedFulfillmentOrder(shopDomain: string, fulfillmentOrderId: string) {
  try {
    const shopifyApiClient = await getShopifyApiClient(shopDomain)
    const ACCEPTED_FULFILLMENT_REQUEST = `Accept fulfillment request`

    // Reject assigned fulfillment order
    await shopifyApiClient.acceptFulfillmentRequest(fulfillmentOrderId, ACCEPTED_FULFILLMENT_REQUEST)
  } catch (e) {
    console.error('Failed to accept assigned fulfillment order', e)
    throw new Error(formatErrorMessage(e))
  }
}

/**
 * Reject assigned fulfillment order
 *
 * @param shopDomain
 * @param fulfillmentOrderId
 * @param rejectedMessage
 */
export async function rejectAssignedFulfillmentOrder(
  shopDomain: string,
  fulfillmentOrderId: string,
  rejectedMessage?: string
) {
  try {
    const shopifyApiClient = await getShopifyApiClient(shopDomain)
    const REJECT_FULFILLMENT_REQUEST = `Reject fulfillment request`

    // Reject assigned fulfillment order
    await shopifyApiClient.rejectFulfillmentRequest(fulfillmentOrderId, rejectedMessage || REJECT_FULFILLMENT_REQUEST)
  } catch (e) {
    console.error('Failed to reject assigned fulfillment order', e)
    throw new Error(formatErrorMessage(e))
  }
}

/**
 * Mark fulfillment order as fulfilled
 *
 * @param shopDomain
 * @param fulfillmentOrderId
 * @param trackingInfo
 */
export async function markFulfillmentOrderAsFulfilled(
  shopDomain: string,
  fulfillmentOrderId: string,
  trackingInfo?: { urls: string[]; numbers: string[] }
) {
  try {
    const shopifyApiClient = await getShopifyApiClient(shopDomain)

    // Create fulfillment for fulfilling order
    await shopifyApiClient.createFulfillment(fulfillmentOrderId, trackingInfo)
  } catch (e) {
    console.error('Failed to mark fulfillment order as fulfilled', e)
    throw new Error(formatErrorMessage(e))
  }
}

/**
 * Request cancel fulfillment order.
 * This function should only be used when the cancellation request comes from the fulfillment services.
 * Otherwise, DO NOT use this function.
 *
 * @param shopDomain string
 * @param fulfillmentOrderId string
 */
export async function requestCancelFulfillmentOrder(shopDomain: string, fulfillmentOrderId: string) {
  try {
    const shopifyApiClient = await getShopifyApiClient(shopDomain)

    // Create fulfillment for fulfilling order
    await shopifyApiClient.fulfillmentOrderSubmitCancellationRequest(
      fulfillmentOrderId,
      FULFILLMENT_SERVICE_SUBMIT_FULFILLMENT_ORDER_CANCELLATION_REQUEST
    )
  } catch (e) {
    console.error('Failed to request cancel fulfillment order', e)
    throw new Error(formatErrorMessage(e))
  }
}

/**
 * Cancel fulfillment order
 *
 * @param shopDomain string
 * @param fulfillmentOrderId string
 */
export async function cancelFulfillmentOrder(shopDomain: string, fulfillmentOrderId: string) {
  try {
    const shopifyApiClient = await getShopifyApiClient(shopDomain)

    // Create fulfillment for fulfilling order
    await shopifyApiClient.cancelFulfillmentOrder(fulfillmentOrderId)
  } catch (e) {
    console.error('Failed to cancel fulfillment order', e)
    throw new Error(formatErrorMessage(e))
  }
}

/**
 * Format the fulfillment orders data more readable
 *
 * @param fulfillmentOrdersData
 * @returns
 */
export function formatFulfillmentOrders(fulfillmentOrdersData: any) {
  // Extract and format fulfillment orders
  const formattedFulfillmentOrders = (fulfillmentOrdersData.edges || []).map((edge: any) => {
    // Get FulfillmentOrderNode
    const node = edge.node

    return {
      ...node,
      merchantRequests: node.merchantRequests.edges.map((merchantRequest: any) => merchantRequest.node),
      lineItems: node.lineItems.edges.map((lineItem: any) => lineItem.node),
    }
  })

  // Remove empty line items
  const filteredFulfillmentOrders = formattedFulfillmentOrders.filter(
    (fulfillmentOrder: any) => fulfillmentOrder.lineItems.length > 0
  )

  return filteredFulfillmentOrders
}
