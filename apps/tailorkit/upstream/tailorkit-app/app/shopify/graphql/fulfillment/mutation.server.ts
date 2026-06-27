/**
 * @description Fulfill line_items of fulfillment orders
 * @example
* fulfillment: {
    lineItemsByFulfillmentOrder: [
        {
        fulfillmentOrderId: 'gid://shopify/FulfillmentOrder/7320781652213',
        fulfillmentOrderLineItems: [
            {
            id: 'gid://shopify/FulfillmentOrderLineItem/15777243005173',
            quantity: 1,
            },
        ],
        },
    ],
    notifyCustomer: true,
},
    @see https://shopify.dev/docs/api/admin-graphql/2025-10/mutations/fulfillmentCreate
 */
export const fulfillmentCreate = `#graphql
    mutation fulfillmentCreate($fulfillment: FulfillmentInput!, $message: String, trackingInfo: FulfillmentTrackingInput) {
        fulfillmentCreate(fulfillment: $fulfillment, message: $message, trackingInfo: $trackingInfo) {
            fulfillment {
                # Fulfillment fields
                id
                trackingInfo {                    
                    numbers
                    urls
                }
            }
            userErrors {
                field
                message
            }
        }
    }
`
