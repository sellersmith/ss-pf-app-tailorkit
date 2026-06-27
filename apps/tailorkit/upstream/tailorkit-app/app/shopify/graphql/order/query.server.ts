import { PAGE_INFO_SELECTION } from '../constants'
import { getConnectionArguments } from '../fns.server'
import type { ConnectionArguments } from '../types'

/**
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/objects/Order
 */
export const GET_ORDER_BY_ID_QUERY = `#graphql
    query getOrder($id: ID!) {
        order(id: $id) {
            id
            name
            email
            createdAt
            displayFulfillmentStatus
            fulfillmentOrders(first: 50) {
                edges {
                    node {
                        id
                        orderId
                        status
                        fulfillAt
                        status
                        requestStatus
                        orderProcessedAt
                        merchantRequests(first: 250) {
                            edges {
                                node {
                                    id
                                    kind
                                    message
                                    requestOptions
                                    responseData
                                }
                            }
                        }
                        lineItems(first: 50) {
                            edges {
                                node {
                                    id
                                    totalQuantity
                                    lineItem {
                                        id
                                        title
                                        vendor
                                        quantity
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
`

const ORDER_LIST_FIELD_SELECTION = `
  id
  name
  createdAt
  lineItems(first: 250) {
    edges {
      node {
        id
        quantity
        title
        product {
          id
          title
          handle
          featuredImage {
            url
            width
            height
            altText
          }
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
        }
        variant {
          id
          title
        }
      }
    }
  }
`

/**
 * Query for orders using bulk operations API for better performance with large datasets
 * @param params Additional query parameters
 * @param daysAgo Optional number of days to look back
 * @see https://shopify.dev/api/usage/bulk-operations/queries
 */
export const getBulkQueryOrders = (params: ConnectionArguments & any = {}, daysAgo?: number): string => {
  const query = getQueryForOrders(params, daysAgo)

  return `#graphql
  mutation {
    bulkOperationRunQuery(
      query: """
      {
        orders(${query}) {
          edges {
            node {
              ${ORDER_LIST_FIELD_SELECTION}
            }
          }
        }
      }
      """
    ) {
      bulkOperation {
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
}

/**
 * Query to check bulk operation status
 */
export const CHECK_BULK_OPERATION_STATUS = `#graphql
  query {
    currentBulkOperation {
      id
      status
      errorCode
      createdAt
      completedAt
      objectCount
      fileSize
      url
      partialDataUrl
    }
  }
`

export const queryForOrders = (params: ConnectionArguments & any = {}, daysAgo?: number): string => {
  const query = getQueryForOrders(params, daysAgo)

  return `query {
    orders(${query}) {
      nodes {
        ${ORDER_LIST_FIELD_SELECTION}
      }
      ${PAGE_INFO_SELECTION}
    }
  }`
}

/**
 * Get the query for orders
 * @param params Additional query parameters
 * @param daysAgo Optional number of days to look back
 * @returns Query string
 */
function getQueryForOrders(params: ConnectionArguments & any = {}, daysAgo?: number): string {
  const args = getConnectionArguments(params)

  if (daysAgo) {
    // Calculate the date range for the last N days
    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999) // Set to end of today

    const startDate = new Date()
    startDate.setDate(endDate.getDate() - (daysAgo - 1)) // -1 because we want to include today
    startDate.setHours(0, 0, 0, 0) // Set to start of the day

    const formattedStartDate = startDate.toISOString()
    const formattedEndDate = endDate.toISOString()

    // Add date range to the query arguments
    args.push(`query: "created_at:>='${formattedStartDate}' AND created_at:<='${formattedEndDate}'"`)
  }

  return args.join(', ')
}
