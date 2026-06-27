/* eslint-disable max-len */
/**
 * @description Receive a list of all FulfillmentServices
 */

import type { FulfillmentOrderRequestStatus, FulfillmentOrderStatus } from '~/models/Order'

export const RECEIVE_A_LIST_OF_ALL_FULFILLMENT_SERVICES = `#graphql
    query {
        shop {
            fulfillmentServices {
                id
                serviceName
                callbackUrl
                location {
                    id
                    name
                }      
            }
        }
    }
`

/**
 * Retrieve assigned fulfillment order requests
 * @see https://shopify.dev/docs/apps/build/orders-fulfillment/fulfillment-service-apps/build-for-fulfillment-services#step-3-act-on-fulfillment-requests
 */

export interface FulfillmentOrderRequest {
  shop: {
    assignedFulfillmentOrders: {
      edges: Array<{
        node: {
          id: string
          requestStatus: FulfillmentOrderRequestStatus
          status: FulfillmentOrderStatus
          orderId: string
          order: {
            id: string
          }
          destination: {
            firstName: string
            lastName: string
            address1: string
            city: string
            province: string
            zip: string
            countryCode: string
            phone: string
          }
          lineItems: {
            edges: Array<{
              node: {
                id: string
                productTitle: string
                sku: string
                remainingQuantity: number
                vendor: string
              }
            }>
          }
          merchantRequests: {
            edges: Array<{
              node: {
                message: string
              }
            }>
          }
        }
      }>
    }
  }
}

export const RETRIEVE_ASSIGNED_FULFILLMENT_ORDER_REQUESTS = `#graphql
  query retrieveAssignedFulfillmentOrders(
    $assignmentStatus: FulfillmentOrderAssignmentStatus!
    $kind: FulfillmentOrderMerchantRequestKind!
    $sortKey: FulfillmentOrderSortKeys = UPDATED_AT
    $reverse: Boolean = true
  ) {
    shop {
      assignedFulfillmentOrders(first: 250, assignmentStatus: $assignmentStatus, sortKey: $sortKey, reverse: $reverse) {
        edges {
          node {
            id
            requestStatus
            status
            orderId
            order {
              id
            }
            destination {
              firstName
              lastName
              address1
              city
              province
              zip
              countryCode
              phone
            }
            lineItems(first: 250) {
              edges {
                node {
                  id
                  productTitle
                  sku
                  remainingQuantity
                  vendor
                }
              }
            }
            merchantRequests(first: 250, kind: $kind) {
              edges {
                node {
                  message
                }
              }
            }
          }
        }
      }
    }
  }
`
