/**
 * @description Deletes a webhook subscription.
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/mutations/webhookSubscriptionDelete
 */

export const deleteWebhookMutation = `
  mutation webhookSubscriptionDelete($id: ID!) {
    webhookSubscriptionDelete(id: $id) {
      deletedWebhookSubscriptionId
      userErrors {
        field
        message
      }
    }
  }
`

/**
 * @description Creates a new webhook subscription.
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/mutations/webhookSubscriptionCreate
 */
export const WEBHOOK_SUBSCRIPTION_CREATE = `
  mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription {
        id
        topic
        filter
        format
        endpoint {
          __typename
          ... on WebhookHttpEndpoint {
            callbackUrl
          }
        }
      }
      userErrors {
        field
        message
      }      
    }
  }
`

/** @see https://shopify.dev/docs/api/admin-graphql/2025-10/input-objects/WebhookSubscriptionInput */
export interface WebhookSubscriptionInput {
  callbackUrl?: string
  filter?: string
  format?: 'JSON' | 'XML'
  includeFields?: string[]
  metafieldNamespaces?: string[]
}

/**
 * @description Updates a webhook subscription.
 * @see https://shopify.dev/docs/api/admin-graphql/2025-10/mutations/webhookSubscriptionUpdate
 */
export const WEBHOOK_SUBSCRIPTION_UPDATE = `
  mutation webhookSubscriptionUpdate($id: ID!, $webhookSubscription: WebhookSubscriptionInput!) {
    webhookSubscriptionUpdate(id: $id, webhookSubscription: $webhookSubscription) {
      webhookSubscription {
        id
        callbackUrl
        filter
        apiVersion {
          handle
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`
