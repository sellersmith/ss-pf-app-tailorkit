/**
 * @description Creates a fulfillment service.
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/mutations/fulfillmentServiceCreate
 * @example
 * variable: {
    "name": "example_fulfillment_service",
    "callbackUrl": "https://callback.org/",
    "inventoryManagement": true,
    "trackingSupport": true
    }

    response: 
    {
        "fulfillmentServiceCreate": {
            "fulfillmentService": {
              "id": "gid://shopify/FulfillmentService/1061774487?id=true",
              "serviceName": "example_fulfillment_service",
              "callbackUrl": "https://callback.org/",
              "inventoryManagement": true,
              "trackingSupport": true
            },
            "userErrors": []
        }
    }
 */

export const FULFILLMENT_SERVICE_CREATE = `#graphql
  mutation fulfillmentServiceCreate($name: String!, $callbackUrl: URL!, $inventoryManagement: Boolean!, $trackingSupport: Boolean!) {
    fulfillmentServiceCreate(name: $name, callbackUrl: $callbackUrl, inventoryManagement: $inventoryManagement, trackingSupport: $trackingSupport) {
      fulfillmentService {
        id
        serviceName
        callbackUrl
        inventoryManagement
        trackingSupport
      }
      userErrors {
        field
        message
      }
    }
  }`

/**
 * @description Updates a fulfillment service.
 *
 * @see https://shopify.dev/docs/apps/build/orders-fulfillment/fulfillment-service-apps/build-for-fulfillment-services#accept-a-fulfillment-request
 */
export const ACCEPT_FULFILLMENT_REQUEST = `#graphql
  mutation acceptFulfillmentRequest($id: ID!, $message: String!) {
    fulfillmentOrderAcceptFulfillmentRequest(id: $id, message: $message) {
      fulfillmentOrder {
        status
        requestStatus
      }
    }
  }
`

/**
 * @description Accepts a cancellation request.
 *
 * @see https://shopify.dev/docs/apps/build/orders-fulfillment/fulfillment-service-apps/build-for-fulfillment-services#accept-a-cancellation-request
 */

export interface FulfillmentOrderResponse {
  fulfillmentOrder: {
    status: string
    requestStatus: string
  }
}

export const ACCEPT_CANCELLATION_REQUEST = `#graphql
  mutation acceptCancellationRequest($id: ID!, $message: String!) {
    fulfillmentOrderAcceptCancellationRequest(id: $id, message: $message) {
      fulfillmentOrder {
        status
        requestStatus
      }
    }
  }
`

/**
 * @description Rejects a cancellation request.
 *
 * @see https://shopify.dev/docs/apps/build/orders-fulfillment/fulfillment-service-apps/build-for-fulfillment-services#reject-a-cancellation-request
 */

export const REJECT_CANCELLATION_REQUEST = `#graphql
  mutation rejectCancellationRequest($id: ID!, $message: String!) {
    fulfillmentOrderRejectCancellationRequest(id: $id, message: $message) {
      fulfillmentOrder {
        status
        requestStatus
      }
    }
  }
`

/**
 * @description Rejects a fulfillment request.
 *
 * @see https://shopify.dev/docs/apps/build/orders-fulfillment/fulfillment-service-apps/build-for-fulfillment-services#reject-a-fulfillment-request
 */

export interface RejectFulfillmentResponse {
  fulfillmentOrder: {
    status: string
    requestStatus: string
  }
}

export const REJECT_FULFILLMENT_REQUEST = `#graphql
  mutation rejectFulfillmentRequest($id: ID!, $message: String!) {
    fulfillmentOrderRejectFulfillmentRequest(
      id: $id,
      message: $message
    ) {
      fulfillmentOrder {
        status
        requestStatus
      }
    }
  }
`
