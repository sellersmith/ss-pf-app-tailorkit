import type { ORDER_WEBHOOK_TOPICS } from '~/constants/shopify'
import type { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { orderWebhookFilter } from '~/shopify/app.server'

/**
 * Migrates order webhooks by updating their filter fields based on the provided topics.
 * @preserve This is function is used to migrate order webhooks to the new filter format.
 * Can be re-use if we need to migrate other webhooks in the future.
 * @param {AdminApiContextWithRest<ShopifyRestResources>} admin - The admin API context for Shopify.
 * @param {string[]} topics - An array of topics to filter the webhooks.
 * @returns {Promise<void>} A promise that resolves when the migration is complete.
 */
export async function migrateOrderWebhooks(api: ShopifyApiClient, topics: ORDER_WEBHOOK_TOPICS[]): Promise<void> {
  try {
    // Apply filter for order webhooks
    // Get webhook by ID
    const webhooks = await api.getWebhooks()

    for (const topic of topics) {
      const webhookByTopic = webhooks.webhookSubscriptions.edges.find((edge: any) => edge.node.topic === topic)

      if (webhookByTopic) {
        const { id: webhookId, filter } = webhookByTopic.node

        /**
         * @important
         * New filter for order webhooks to exclude those not created by TailorKit.
         * This filter triggers the webhook if at least one item in the line_items array has a property
         * with the name prefixed by _custom_property.
         * Note: When using ATC, ensure the default name property for line_items is set to match the PROPERTY_PREFIX,
         * rather than using CONTAIN.
         */
        const newFilter = orderWebhookFilter

        // Exclude if the filter is already updated
        if (filter === newFilter) {
          continue
        }

        // Update filter field for order webhooks
        await api.webhookSubscriptionUpdate(webhookId, {
          filter: newFilter,
        })

        console.log(`Migrate order webhook ${webhookId} for topic ${topic} successfully`)
      }
    }
  } catch (e) {
    throw e
  }
}
