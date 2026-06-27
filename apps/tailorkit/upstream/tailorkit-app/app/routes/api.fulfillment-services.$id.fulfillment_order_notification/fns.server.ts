/* eslint-disable max-len */
import { FulfillmentOrderAssignmentStatus, FulfillmentRequestKind } from '~/constants/fulfillment-providers'
import type { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { poll } from '~/utils/polling'

/**
 * Poll for cancellation orders
 *
 * @description Refer to Shopify documentation about act on cancellation requests.
 * It might take a few minutes for cancellation requests to show up as a part of your assigned fulfillment orders.
 * We recommend polling your assigned fulfillment orders until you receive the cancellation request.
 *
 * => Shopify will not instantly send us the cancellation items, we need to poll for it by setting a timeout until we receive the cancellation items.
 *
 * @see https://shopify.dev/docs/apps/build/orders-fulfillment/fulfillment-service-apps/build-for-fulfillment-services#step-5-act-on-cancellation-requests
 *
 * @param api ShopifyApiClient
 * @param config PollConfig
 * @returns Promise<FulfillmentOrderRequest>
 */
export async function pollForCancellationOrders(api: ShopifyApiClient) {
  return poll(async () => {
    const orders = await api.retrieveAssignedFulfillmentOrderRequests(
      FulfillmentOrderAssignmentStatus.CANCELLATION_REQUESTED,
      FulfillmentRequestKind.CANCELLATION_REQUEST
    )

    return orders.length > 0 ? orders : null
  })
}
