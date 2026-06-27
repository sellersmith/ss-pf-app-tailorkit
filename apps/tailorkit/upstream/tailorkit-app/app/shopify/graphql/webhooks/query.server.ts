/**
 * @description Returns a list of webhook subscriptions.
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/queries/webhookSubscriptions
 */

export const queryForWebhooks = `{
    webhookSubscriptions(first: 50) {
        edges {
        node {
                id
                topic
                filter
                updatedAt
                apiVersion {
                    displayName
                    handle
                    supported
                }
            }
        }
    }
}
`

/**
 * @description Query for a webhook subscription by its ID.
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/queries/webhookSubscription
 */
export const WEBHOOK_SUBSCRIPTION_BY_ID = `
    webhookSubscription(id: $id) {
        id
        topic
        endpoint {
            __typename
            ... on WebhookHttpEndpoint {
                callbackUrl
            }
        }
    }
`
