/**
 * @description Marks a scheduled fulfillment order as open.
 * @example
 * {
    id": "gid://shopify/FulfillmentOrder/1046000781"
   }
 */
export const FULFILLMENT_ORDER_OPEN = `#graphql
   mutation fulfillmentOrderOpen($id: ID!) {
       fulfillmentOrderOpen(id: $id) {
           fulfillmentOrder {
               id
               status
           }
           userErrors {
               field
               message
           }
       }
   }
`

/**
 * @description Sends a fulfillment request to the fulfillment service of a fulfillment order.
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/mutations/fulfillmentOrderSubmitFulfillmentRequest?example=Sends+a+fulfillment+request
 */
export const FULFILLMENT_ORDER_SUBMIT_FULFILLMENT_REQUEST = `#graphql
   mutation fulfillmentOrderSubmitFulfillmentRequest($id: ID!) {
       fulfillmentOrderSubmitFulfillmentRequest(id: $id) {
           originalFulfillmentOrder {
               id
               status
               requestStatus
           }
           submittedFulfillmentOrder {
               id
               status
               requestStatus
           }
           unsubmittedFulfillmentOrder {
               id
               status
               requestStatus
           }
           userErrors {
               field
               message
           }
       }
   }
`

/**
 * @description Cancel a fulfillment order.
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/mutations/fulfillmentOrderCancel
 */
export const FULFILLMENT_ORDER_CANCEL = `#graphql
    mutation fulfillmentOrderCancel($id: ID!) {
        fulfillmentOrderCancel(id: $id) {
            fulfillmentOrder {
                id
                status
                requestStatus
            }
            replacementFulfillmentOrder {
                id
                status
                requestStatus
            }
            userErrors {
                field
                message
            }
        }
    }    
`

/**
 * @description Hold a fulfillment order.
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/mutations/fulfillmentOrderHold
 */

export enum FulfillmentHoldReason {
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  AWAITING_RETURN_ITEMS = 'AWAITING_RETURN_ITEMS',
  HIGH_RISK_OF_FRAUD = 'HIGH_RISK_OF_FRAUD',
  INCORRECT_ADDRESS = 'INCORRECT_ADDRESS',
  INVENTORY_OUT_OF_STOCK = 'INVENTORY_OUT_OF_STOCK',
  ONLINE_STORE_POST_PURCHASE_CROSS_SELL = 'ONLINE_STORE_POST_PURCHASE_CROSS_SELL',
  OTHER = 'OTHER',
  UNKNOWN_DELIVERY_DATE = 'UNKNOWN_DELIVERY_DATE',
}

export interface FulfillmentOrderHoldRequest {
  fulfillmentHold: {
    externalId?: string
    fulfillmentOrderLineItems?: Array<{ id: string; quantity: number }>
    notifyMerchant?: boolean
    reason: FulfillmentHoldReason
    reasonNotes?: string
  }
  id: string
}

export interface FulfillmentOrderHoldResponse {
  fulfillmentOrderHold: {
    fulfillmentOrder: {
      id: string
      displayReason: string
      reason: FulfillmentHoldReason
      reasonNotes?: string
    }
    userErrors: any[]
  }
}

export const FULFILLMENT_ORDER_HOLD = `#graphql
    mutation FulfillmentOrderHold($fulfillmentHold: FulfillmentOrderHoldInput!, $id: ID!) {
        fulfillmentOrderHold(fulfillmentHold: $fulfillmentHold, id: $id) {
            fulfillmentOrder {
                id
                displayReason
                reason
                reasonNotes
            }
            userErrors {
                field
                message
            }
        }
    }
`

/**
 * @description Submits a cancellation request for a fulfillment order.
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/mutations/fulfillmentOrderSubmitCancellationRequest
 */
export const FULFILLMENT_ORDER_SUBMIT_CANCELLATION_REQUEST = `#graphql
    mutation fulfillmentOrderSubmitCancellationRequest($id: ID!, $message: String) {
        fulfillmentOrderSubmitCancellationRequest(id: $id, message: $message) {
            fulfillmentOrder {
                id
                status
                requestStatus
            }
            userErrors {
                field
                message
            }
        }
    }
`
