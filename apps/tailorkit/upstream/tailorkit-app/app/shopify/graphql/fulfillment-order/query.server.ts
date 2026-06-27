/**
 * @description Get fulfillmentOrderIdByOrderId
 */
export const getFulfillmentOrderIdByOrderId = `#graphql
    query GetFulfillmentOrderIdByOrderId($orderId: ID!) {
        order(id: $orderId) {
            id
            name
            fulfillmentOrders(first: 250) {
                edges {
                    node {
                        id
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
                        lineItems(first: 250) {
                            edges {
                                node {
                                    id
                                    vendor
                                }
                            }
                        }
                    }
                }
            }
        }
    }
`

/**
 * @description Get fulfillmentOrder by id
 */
export const GET_FULFILLMENT_ORDER = `#graphql
    query GetFulfillmentOrder($fulfillmentOrderId: ID!) {
        fulfillmentOrder(id: $fulfillmentOrderId) {
            id
            requestStatus
            status
            order {
                id
                name
                email
                totalPrice
            }
        }
    }
`
