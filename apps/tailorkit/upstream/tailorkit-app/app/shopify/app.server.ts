import { restResources } from '@shopify/shopify-api/rest/admin/2025-07'
import '@shopify/shopify-app-remix/adapters/node'
import type { AdminApiContext } from '@shopify/shopify-app-remix/server'
import { ApiVersion, AppDistribution, shopifyApp } from '@shopify/shopify-app-remix/server'
import { MongooseSessionStorage } from '~/bootstrap/db/session-storage.server'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { runClusterTask } from '~/utils/cluster.server'
import ProviderIntegration from '~/models/ProviderIntegration.Server'
import { getShopifyApiClient, ShopifyApiClient } from './graphql/api.server'
import { FulfillmentOrderAssignmentStatus, FulfillmentRequestKind } from '~/constants/fulfillment-providers'
import { formatShopifyObjectIdToNumberId } from '~/utils/shopify'
import { SHOPIFY_ORDER_PREFIX, WEBHOOK_TOPICS } from '~/constants/shopify'
import { requestFulfillOrder } from '~/routes/api.orders/fns.server'
import type { WebhookSubscriptionInput } from './graphql/webhooks/mutation.server'
import { PROPERTY_PREFIX } from '~/routes/webhooks/fns.server'
import { serverInitiator } from '~/bootstrap/fns/initiator'
import { runSyncAnnouncementsFromGoogleSheet } from '~/modules/Announcement/models/Announcement.server'
import { runCreateFirstFeedbackForm } from '~/modules/Feedback/models/FeedbackForm.server'
import { serverCacheStorage } from '~/bootstrap/fns/serverCacheStorage'
import { isWIPAndRCEnv } from '~/app-configs.server'
import { afterAuthHandler } from './shopify.server'
import { getTailorKitSocketIOMCPServer } from '~/services/mcp/storefront/tailorkit-mcp.server'
import { getGlobalInstance } from '~/services/websocket/globalInstance'
import { cleanupOldWebVitalsData } from '~/models/WebVitals.server'
import { runCreateDefaultAiCreditPackages } from '~/models/AiCreditPackage.server'

/** IMPORTANT NOTE: THERE IS A BUG ON SERVER ENVIRONMENT THAT API VERSION DOES NOT EXIST */
export const apiVersion = ApiVersion.October25 || '2025-10'
export const appUrl = process.env.HOST || process.env.SHOPIFY_APP_URL || ''
export const appName = process.env.APP_NAME || ''
export const appHandle = process.env.APP_HANDLE || 'tailorkit'

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || '',
  apiVersion,
  scopes: process.env.SCOPES?.split(','),
  appUrl,
  authPathPrefix: '/auth',
  sessionStorage: new MongooseSessionStorage(),
  distribution: AppDistribution.AppStore,
  restResources,
  hooks: {
    afterAuth: afterAuthHandler,
  },
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] } : {}),
})

export default shopify
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders

export const authenticate = shopify.authenticate

export const unauthenticated = shopify.unauthenticated
export const login = shopify.login
export const sessionStorage = shopify.sessionStorage

// const webhookHandler: WebhookHandler = {
//   callbackUrl: `/webhooks`,
//   deliveryMethod: DeliveryMethod.HTTP,
// }

const webhookHandler: WebhookSubscriptionInput = {
  callbackUrl: `${appUrl}/webhooks`,
  format: 'JSON',
}

export const orderWebhookFilter = `line_items.properties.name:_${PROPERTY_PREFIX}`
const orderWebhookInput: WebhookSubscriptionInput = { ...webhookHandler, filter: orderWebhookFilter }

/** Metafield namespace & key used to flag personalized products for webhook filtering (pattern: tailorkit.personalized) */
export const PERSONALIZATION_METAFIELD_NAMESPACE = appHandle
export const PERSONALIZATION_METAFIELD_KEY = 'personalized'

// @see https://shopify.dev/docs/apps/build/webhooks/customize/filters
// Filter on metafield instead of tags — tags filter only matches exact full-string equality,
// which breaks when products have multiple tags.
const productUpdateWebhookInput: WebhookSubscriptionInput = {
  ...webhookHandler,
  metafieldNamespaces: [PERSONALIZATION_METAFIELD_NAMESPACE],
  filter: `metafields.namespace:${PERSONALIZATION_METAFIELD_NAMESPACE} AND metafields.key:${PERSONALIZATION_METAFIELD_KEY} AND metafields.value:true`,
}

const WEBHOOKS: { [key in WEBHOOK_TOPICS]: WebhookSubscriptionInput } = {
  [WEBHOOK_TOPICS.APP_UNINSTALLED]: webhookHandler,
  [WEBHOOK_TOPICS.SHOP_UPDATE]: webhookHandler,
  [WEBHOOK_TOPICS.ORDERS_CREATE]: orderWebhookInput,
  [WEBHOOK_TOPICS.ORDERS_DELETE]: orderWebhookInput,
  [WEBHOOK_TOPICS.ORDERS_UPDATED]: orderWebhookInput,
  [WEBHOOK_TOPICS.ORDERS_CANCELLED]: orderWebhookInput,
  [WEBHOOK_TOPICS.FULFILLMENT_ORDERS_FULFILLMENT_REQUEST_SUBMITTED]: webhookHandler,
  [WEBHOOK_TOPICS.FULFILLMENT_ORDERS_FULFILLMENT_REQUEST_REJECTED]: webhookHandler,
  [WEBHOOK_TOPICS.FULFILLMENT_ORDERS_FULFILLMENT_REQUEST_ACCEPTED]: webhookHandler,
  [WEBHOOK_TOPICS.FULFILLMENT_ORDERS_CANCELLATION_REQUEST_SUBMITTED]: webhookHandler,
  [WEBHOOK_TOPICS.FULFILLMENT_ORDERS_CANCELLATION_REQUEST_ACCEPTED]: webhookHandler,
  [WEBHOOK_TOPICS.FULFILLMENT_ORDERS_CANCELLATION_REQUEST_REJECTED]: webhookHandler,
  [WEBHOOK_TOPICS.APP_SUBSCRIPTIONS_APPROACHING_CAPPED_AMOUNT]: webhookHandler,
  [WEBHOOK_TOPICS.APP_SUBSCRIPTIONS_UPDATE]: webhookHandler,
  [WEBHOOK_TOPICS.PRODUCTS_UPDATE]: productUpdateWebhookInput,
}

/**
 * Register webhooks for a given shop
 * @note Currently, @shopify/shopify-app-remix and @shopify/shopify-api does not implement webhook subscription with filter field
 * => We need to manually subscribe webhooks with filter field.
 * Once the filter field is implemented, we can remove this function and turn back to use the default webhook subscription
 *
 * export const registerWebhooks = shopify.registerWebhooks
 * const webhookHandler: WebhookHandler = {
 *   callbackUrl: `/webhooks`,
 *   deliveryMethod: DeliveryMethod.HTTP,
 * }
 *
 * @param {AdminApiContext} admin - The admin API context for Shopify.
 * @param {string} shopDomain - The domain of the shop to register webhooks for.
 * @returns {Promise<void>} A promise that resolves when the webhooks are registered.
 */
export const registerWebhooks = async (admin: AdminApiContext, shopDomain: string): Promise<void> => {
  try {
    const api = new ShopifyApiClient(admin)

    const webhooks = await api.getWebhooks()

    const webhookEntries = Object.entries(WEBHOOKS)

    await Promise.allSettled(
      webhookEntries.map(async ([topic, webhookSubscriptionInput]) => {
        try {
          const isSubscribed = webhooks.webhookSubscriptions.edges.find((edge: any) => edge.node.topic === topic)

          if (isSubscribed) {
            return
          }

          await api.webhookSubscriptionCreate(topic as WEBHOOK_TOPICS, webhookSubscriptionInput)
        } catch (e) {
          console.error(`Error while registering webhook for ${shopDomain} with topic ${topic}`, e)
          return
        }
      })
    )
  } catch (e) {
    console.error('Error while registering webhooks', e)
  }
}

/**
 * Set test charge to true for testing
 * Remember removing when merging to production
 */
if (process.env.TEST_CHARGE !== 'true' && isWIPAndRCEnv()) {
  process.env.TEST_CHARGE = 'true'
}

/**
 * Sync fulfillment order of all shops that subscribe to fulfillment service
 * Shopify does not send us specific fulfillment order, they only send "hey, your merchants has requested fulfillment for some orders"
 * => We need to poll for it
 *
 *
 * @see https://shopify.dev/docs/apps/build/orders-fulfillment/fulfillment-service-apps/build-for-fulfillment-services
 */
export async function syncFulfillmentOrder() {
  // Query shops using fulfillment service
  const providerIntegrations = await ProviderIntegration.find({ apiToken: { $exists: true } })

  for (const providerIntegration of providerIntegrations) {
    try {
      const { shopDomain, apiToken, shopId } = providerIntegration

      // Check if provider integration is valid
      if (!shopDomain || !apiToken || !shopId) {
        continue
      }

      const api = await getShopifyApiClient(shopDomain)

      // Retrieve assigned fulfillment orders
      const fulfillmentOrders = await api.retrieveAssignedFulfillmentOrderRequests(
        FulfillmentOrderAssignmentStatus.FULFILLMENT_REQUESTED,
        FulfillmentRequestKind.FULFILLMENT_REQUEST
      )

      // Loop through fulfillment orders to prepare for submitting
      for (const fulfillmentOrder of fulfillmentOrders) {
        if (fulfillmentOrder) {
          const {
            node: { lineItems, orderId, requestStatus, status },
          } = fulfillmentOrder

          const isSubmittedRequest = requestStatus === 'SUBMITTED' && status === 'OPEN'

          if (!isSubmittedRequest) {
            continue
          }

          const vendor = lineItems.edges[0].node.vendor

          const numberOrderId = formatShopifyObjectIdToNumberId(orderId, SHOPIFY_ORDER_PREFIX)

          // Request fulfill order
          await requestFulfillOrder({
            shopDomain,
            api,
            selectedResources: [numberOrderId],
            vendor,
            shouldFulfill: true,
          })
        }
      }
    } catch (e) {
      console.error('Fail to sync fulfillment order', e)
      continue
    }
  }
}

// Set test charge to true for testing
// process.env.TEST_SYNC_FULFILLMENT_ORDER = 'true'

// Add runSyncAnnouncementsFromGoogleSheet to serverInitiator
serverInitiator.addInitiator(async function _runSyncAnnouncementsFromGoogleSheet() {
  runClusterTask({
    taskFn: runSyncAnnouncementsFromGoogleSheet,
    onError: error =>
      console.error('Error while executing workers: runSyncAnnouncementsFromGoogleSheet', formatErrorMessage(error)),
  })
})

// Add runCreateFirstFeedbackForm to serverInitiator
serverInitiator.addInitiator(runCreateFirstFeedbackForm)

// Add runCreateDefaultAiCreditPackages to serverInitiator
serverInitiator.addInitiator(runCreateDefaultAiCreditPackages)

// Clear all server cache
serverInitiator.addInitiator(async function _clearAllServerCache() {
  await serverCacheStorage.clearAllCache()
})

serverInitiator.addInitiator(function _initWebSocketServer() {
  const io = getGlobalInstance('GlobalWebSocketInstance')
  if (io) {
    getTailorKitSocketIOMCPServer(io)
  }
})

// Add Web Vitals cleanup to serverInitiator
serverInitiator.addInitiator(async function _cleanupWebVitalsData() {
  // Check if auto cleanup is enabled (default: true)
  const autoCleanupEnabled = process.env.WEB_VITALS_AUTO_CLEANUP !== 'false'

  if (!autoCleanupEnabled) {
    console.log('[WebVitals] Auto cleanup disabled via WEB_VITALS_AUTO_CLEANUP=false')
    return
  }

  // Get retention days from environment (default: 90 days)
  const retentionDays = parseInt(process.env.WEB_VITALS_RETENTION_DAYS || '90')

  // Validate retention days
  if (retentionDays < 1 || retentionDays > 730) {
    console.warn('[WebVitals] Invalid WEB_VITALS_RETENTION_DAYS. Using default 90 days')
  }

  const maxAgeDays = retentionDays >= 1 && retentionDays <= 730 ? retentionDays : 90

  runClusterTask({
    taskFn: async () => {
      try {
        console.log(`[WebVitals] Starting automatic cleanup of data older than ${maxAgeDays} days...`)

        const result = await cleanupOldWebVitalsData(maxAgeDays)

        if (result.success) {
          if (result.deletedCount > 0) {
            console.log(
              `[WebVitals] ✅ Cleanup completed: ${result.deletedCount} records deleted (cutoff: ${result.cutoffDate.toLocaleDateString()})`
            )
          } else {
            console.log('[WebVitals] ✅ Cleanup completed: No old records found to delete')
          }
        } else {
          console.error(`[WebVitals] ❌ Cleanup failed: ${result.error}`)
        }
      } catch (error) {
        console.error('[WebVitals] ❌ Cleanup error:', formatErrorMessage(error))
        throw error
      }
    },
    onError: error => console.error('[WebVitals] Error while executing Web Vitals cleanup:', formatErrorMessage(error)),
  })
})

// Execute all initiators
serverInitiator.init()
