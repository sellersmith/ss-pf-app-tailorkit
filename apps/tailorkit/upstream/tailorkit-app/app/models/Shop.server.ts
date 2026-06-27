/* eslint-disable max-lines */
import type { ShopDocument } from './Shop'
import type { Session } from '@shopify/shopify-api'
import type { PricingPlanDocument } from './PricingPlan'
import type { SubscriptionDocument } from './Subscription'
import type { AdminApiContext } from '@shopify/shopify-app-remix/server'
import Mockup from './Mockup.server'
import Template from './Template.server'
import Integration from './Integration.server'
import UserJourney from './UserJourney.server'
import ShopifySession from './ShopifySession.server'
import mongoose from '~/bootstrap/db/connect-db.server'
import LayerIntegration from './LayerIntegration.server'
import ProviderIntegration from './ProviderIntegration.Server'
import PricingPlan, { getUsageFeeAfterDiscount } from './PricingPlan.server'
import { getBillingType } from './helpers/subscription-helpers.server'
import { getAppGeneratedRevenueInBillingCycle } from './Order.server'
import Coupon, { cleanUpExpiredCouponsByShopDomain } from './Coupon.server'
import Subscription, {
  cancelCurrentSubscription,
  createAppUsageRecord,
  getTotalChargedUsageFees,
  submitDailyUsageCharge,
} from './Subscription.server'
import BillingCycle from './BillingCycle.server'
import { trackEvent } from '~/bootstrap/fns/mixpanel.server'
import { applyPromotionIfQualified } from './Promotion.server'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { getBillingCycleDate } from '~/utils/getBillingCycleDate'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'
import { postEventToCustomerIo } from '~/modules/customer.io/api.server'
import { THIRTY_DAYS_BILLING_CYCLE_INTERVAL } from '~/constants/shopify'
import { postToSlackChannelWhenInstall } from '~/bootstrap/fns/slack.server'
import { getBillingSubscriptionTime, getTrialEndsOn } from '~/routes/api.pricing/utils/fns.server'
import { updateUserMilestoneIfShopHasAchieved200DollarInTrialPeriod } from '~/routes/api.user-journey/journeys/achieve-first-sale/fns.server'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { getShopifyApiClient } from '~/shopify/graphql/api.server'
import { DEFAULT_CATEGORIES } from '~/constants/products'
import { AssistantService } from '~/libs/openai/assistant.service'
import type { ShopInfo, TopSellingProduct } from '~/shopify/graphql/types'
import ShopLifecycleEvent, { LifecycleEventType } from '~/models/ShopLifecycleEvent.server'
import fetch from 'node-fetch'
import { requestGraphqlApi } from '~/shopify/graphql/fns.server'
import { handleCheckStorefrontAccessToken } from '~/services/storefront/storefront-access-token.server'
import { checkAndResetAiCreditsIfNeeded } from './helpers/ai-credit-helpers.server'
import {
  checkTrialExpiration,
  completeTrialTracking,
  handleTrialReinstall,
  getActiveTrialDays,
} from './helpers/trial-tracking.server'
import { chargeTrialDebt } from './helpers/trial-debt.server'
import { ONE_DAY_IN_MILLISECONDS } from '~/constants'
import BillingStateManager from './helpers/BillingStateManager.server'

/**
 * Check if current time is within billing window (23:00-00:59 UTC)
 * Used by cron job to process daily charges only during this window
 */
function shouldProcessCharge(): boolean {
  const now = new Date()
  const hour = now.getUTCHours()
  // Billing window: 23:00-00:59 UTC (1 hour before midnight + 1 hour after)
  return hour === 23 || hour === 0
}

export const DEFAULT_SHOP_DATA = {
  shopConfig: null,
  appConfig: {}, // Fix: Default to empty object instead of null to prevent MongoDB $inc errors
  uninstalledAt: null,
}

const ShopSchema = new mongoose.Schema<ShopDocument>(
  {
    shopDomain: {
      type: String,
      index: true,
      unique: true,
      required: true,
    },
    shopConfig: {
      type: Object,
      default: DEFAULT_SHOP_DATA.shopConfig,
    },
    appConfig: {
      type: Object,
      default: DEFAULT_SHOP_DATA.appConfig,
    },
    lastAccess: {
      type: Date,
      index: true,
    },
    uninstalledAt: {
      type: Date,
      index: true,
      default: DEFAULT_SHOP_DATA.uninstalledAt,
    },
    lastReinstalledAt: {
      type: Date,
      index: true,
      // Set in afterAuth when shop reinstalls (has uninstalledAt)
      // Used for reinstall detection in handleMigrations
    },
    /**
     * Active-days trial tracking (V2+)
     * Trial pauses when uninstalled, resumes on reinstall
     */
    trialStartedAt: {
      type: Date,
      index: true, // For querying active trials
    },
    trialPausedDuration: {
      type: Number,
      default: 0, // Milliseconds
    },
    trialCompletedAt: {
      type: Date,
      index: true,
    },
    trialDebt: {
      orderOverage: { type: Number, default: 0 },
      aiCreditOverage: { type: Number, default: 0 },
      lastCalculatedAt: Date,
      chargedOrders: { type: Number, default: 0 },
    },
    /**
     * `subscription` is the `_id` of a document in the `subscriptions` collection.
     */
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      default: null,
      index: true,
    },
    /**
     * `usages` is an object that contains the current usage of the app. Below is
     * an example of `usages` object definition:
     *
     * {
     *   templates: 50,
     *   assets: 100,
     *   orders: 500,
     * }
     *
     * The example above means that:
     *
     * - The shop has created 50 templates using the app.
     * - The shop has created 100 assets using the app.
     * - The shop has gained 500 orders using the app.
     */
    usages: mongoose.Schema.Types.Mixed,

    /**
     * `metadata` is an object that contains the metadata of the shop.
     *
     * The example above means that:
     *
     * - The shop has a description of "This is a test shop".
     */
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
)

// Compound indexes for feature analytics queries optimization
ShopSchema.index({ uninstalledAt: 1, createdAt: 1 }) // Active shops by creation date
ShopSchema.index({ 'usages.featureUsage.svgExportCount': 1, uninstalledAt: 1 }) // SVG export feature adoption
ShopSchema.index({ 'usages.featureUsage.autoFulfillmentCount': 1, uninstalledAt: 1 }) // Auto fulfillment adoption
ShopSchema.index({ 'usages.featureUsage.highResPngExportCount': 1, uninstalledAt: 1 }) // High-res PNG adoption
ShopSchema.index({ 'usages.featureUsage.priorityRequestsCount': 1, uninstalledAt: 1 }) // Priority requests adoption
ShopSchema.index({ 'usages.featureUsage.bulkAssignCount': 1, uninstalledAt: 1 }) // Bulk assign adoption
ShopSchema.index({ 'usages.usedAIAssistant': 1, uninstalledAt: 1 }) // AI assistant adoption
ShopSchema.index({ 'usages.usedGenerativeAI': 1, uninstalledAt: 1 }) // Generative AI adoption
ShopSchema.index({ 'usages.featureUsage.lastFeatureUsedAt': 1, uninstalledAt: 1 }) // Feature retention analysis

const Shop = mongoose.models.Shop || mongoose.model<ShopDocument>('Shop', ShopSchema)

export default Shop

/**
 * Create a new or update an existing shop document with data returned by Shopify API.
 *
 * @param {AdminApiContext} admin
 * @param {Session}         session
 *
 * @returns {Promise<void>}
 */
export async function createOrUpdateShop(admin: AdminApiContext, session: Session): Promise<null | ShopDocument> {
  try {
    // Request shop data
    const { shop: shopDomain } = session

    const shopifyApi = await getShopifyApiClient(shopDomain, admin)
    const [shopResources, shopInfo, topSellingProducts] = await Promise.all([
      // Get shop info
      admin.rest.resources.Shop.all({ session }),

      // Get shop info
      shopifyApi.getShopInfo(),

      // Get top selling products
      shopifyApi.getTopSellingProducts(),
    ])

    const shopConfig = shopResources?.data?.[0]

    if (!shopConfig) {
      return null
    }

    // Upsert shop data
    const shop = await Shop.findOne({ shopDomain })

    await Shop.updateOne(
      { shopDomain },
      {
        shopConfig,
      },
      { upsert: true }
    )

    // Check and create storefront access token if needed (for OneTick addon variant feature)
    handleCheckStorefrontAccessToken(shopDomain, admin, session).catch(error => {
      console.error('[Shop] Failed to check storefront access token:', error)
    })

    // Get shop data
    const shopData = await getShopData(shopDomain)

    // Do services when new shop installs or re-install
    // Check if this is a new install or reinstall (not just missing subscription on every auth)
    const isNewOrReinstall = !shop || (await isShopReInstalled(shop))
    // Also create subscription if it's missing (but only during new/reinstall to prevent infinite loops)
    const needsSubscription = isNewOrReinstall || !shopData?.subscription

    if (needsSubscription) {
      // Analyze shop description and categories (only on new/reinstall)
      if (isNewOrReinstall) {
        runAsyncAnalyzeShopDescriptionAndCategories(shopDomain, { shopInfo, topSellingProducts }).catch(console.error)

        // NEW: Handle trial reinstall
        const isReinstall = shop && (await isShopReInstalled(shop))

        // Log install/reinstall lifecycle event (fire-and-forget — must not block install flow)
        ShopLifecycleEvent.create({
          shopDomain,
          event: isReinstall ? LifecycleEventType.REINSTALL : LifecycleEventType.INSTALL,
          timestamp: new Date(),
          metadata: isReinstall ? { previousUninstalledAt: (shop as ShopDocument)?.uninstalledAt } : {},
        }).catch((err: unknown) => console.error('[ShopLifecycleEvent] Failed to log install event:', err))

        if (isReinstall) {
          // Check if shop has active-days trial (V2+ users)
          // V1 users (revenue-based, no trial) are treated as NEW users on reinstall
          const hasActiveDaysTrial = !!shop.trialStartedAt

          if (hasActiveDaysTrial) {
            // V2+ user: Resume trial tracking
            await handleTrialReinstall(shopDomain)

            // Send reinstall analytics event with trial data
            const shopDataAfterReinstall = await getShopData(shopDomain)
            if (shopDataAfterReinstall) {
              const activeDays = getActiveTrialDays(shopDataAfterReinstall)
              await trackEvent(shopDataAfterReinstall, EVENTS_TRACKING.REINSTALLED_APP, {
                activeDays,
                remainingTrialDays: 14 - activeDays,
                pausedDuration: shopDataAfterReinstall.trialPausedDuration,
              })
            }
          } else {
            // V1 user (no trialStartedAt): Treat as NEW user
            // Just clear uninstalledAt, let them select plan and get fresh trial
            await Shop.updateOne(
              { shopDomain },
              {
                $unset: {
                  uninstalledAt: 1,
                },
              }
            )

            // Send simple reinstall event without trial data
            const shopDataAfterReinstall = await getShopData(shopDomain)
            if (shopDataAfterReinstall) {
              await trackEvent(shopDataAfterReinstall, EVENTS_TRACKING.REINSTALLED_APP, {
                wasV1User: true, // Track that this was a V1→V2 migration
              })
            }
          }
        } else {
          // Brand new install (not reinstall): Start V2 trial tracking immediately
          // so the shop is recognized as a V2 user from day one
          await Shop.updateOne(
            { shopDomain },
            {
              $set: {
                trialStartedAt: new Date(),
                trialPausedDuration: 0,
                trialDebt: {
                  orderOverage: 0,
                  aiCreditOverage: 0,
                  lastCalculatedAt: new Date(),
                  chargedOrders: 0,
                },
              },
            }
          )
        }
      }

      // Apply promotion if has
      // await applyPromotionIfQualified(shopData)

      // No auto-subscription on install.
      // New users must select a plan (Starter/Growth) from the pricing page.
      // canUseFreeResources() returns false for shops without subscription,
      // which triggers redirect to the pricing page via withNavMenu.

      // Prepare event data
      const eventData = { installedAt: shopData?.createdAt }
      const eventName = shop?.uninstalledAt ? CUSTOMERIO_EVENTS.REINSTALLED_APP : CUSTOMERIO_EVENTS.INSTALLED_APP

      // Send event to MixPanel
      trackEvent(shopData!, eventName, eventData).catch(console.error)

      // Send email for customer
      postEventToCustomerIo({ admin, eventData, eventName, shopDomain }).catch(console.error)

      // Notify message that user install our app
      postToSlackChannelWhenInstall(shopDomain, shopConfig.email, shopConfig.id).catch(console.error)
    }

    return shopData
  } catch (e) {
    console.error(formatErrorMessage(e))

    return null
  }
}

/**
 * Clear all configs stored in a shop document.
 *
 * @param {string} shopDomain
 *
 * @returns {Promise<void>}
 */
export async function clearShopConfigs(
  shopDomain: string,
  additionalData?: {
    uninstalledAt: Date
  }
): Promise<void> {
  // Get shop data
  const shopData = await getShopData(shopDomain)
  const { email, shop_owner } = shopData?.shopConfig || {}

  if (additionalData?.uninstalledAt) {
    // Cancel shop subscription
    await cancelCurrentSubscription(shopDomain, false, true, 'app_uninstalled', 'Shop/clearShopConfigs')

    // TODO: Do not remove subscription data because the app will need to track usage fees
    //await Subscription.deleteMany({ shopDomain })

    // Clear all shop sessions
    await ShopifySession.deleteMany({ shop: shopDomain })

    // Clear all fulfillment services
    await ProviderIntegration.deleteMany({ shopDomain })

    // TODO: Unsubscribe all webhooks from fulfillment services (refine in fulfillment service improvement)
  }

  await Shop.updateOne(
    { shopDomain },
    {
      appConfig: DEFAULT_SHOP_DATA.appConfig,
      shopConfig: { email, shop_owner },
      ...additionalData,
    }
  )
}

/**
 * Get shop data.
 *
 * @param {string} shopDomain
 *
 * @returns {Promise<null|ShopDocument>}
 */
export async function getShopData(shopDomain: string): Promise<null | ShopDocument> {
  const shop = await Shop.findOne({ shopDomain }).populate({
    model: Subscription,
    path: 'subscription',
    populate: [
      {
        path: 'plan',
        model: PricingPlan,
      },
      {
        model: Coupon,
        path: 'coupon',
        foreignField: 'code',
        localField: 'couponCode',
      },
    ],
  })

  if (!shop) {
    return null
  }

  const shopObj = shop.toObject()

  return shopObj
}

/**
 * Check if the shop is re-installed
 *
 * @param {string | ShopDocument} shop
 *
 * @returns {Promise<boolean>}
 */
export async function isShopReInstalled(shop: string | ShopDocument): Promise<boolean> {
  const shopData = typeof shop === 'string' ? await Shop.findOne({ shopDomain: shop }) : shop

  return shopData?.uninstalledAt ? true : false
}

/**
 * Update shop uages
 *
 * @param {string} shopDomain
 *
 * @returns {Promise<void>}
 */
export async function updateShopUsages(shopDomain: string, syncImmediately = true): Promise<void> {
  await Shop.aggregate([
    { $match: { shopDomain } },
    {
      $lookup: {
        from: UserJourney.collection.collectionName,
        let: { shopDomain: '$shopDomain' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $in: ['$type', ['onboarding', 'template-editor-quick-tour', 'integration-editor-quick-tour']] },
                  { $eq: ['$shopDomain', '$$shopDomain'] },
                  { $eq: ['$isFinished', true] },
                ],
              },
            },
          },
        ],
        as: 'completed_onboarding',
      },
    },
    {
      $set: {
        'appConfig.occurredEvents.completed_onboarding': {
          $ifNull: [
            '$appConfig.occurredEvents.completed_onboarding',
            {
              $cond: [{ $eq: [{ $size: '$completed_onboarding' }, 3] }, true, false],
            },
          ],
        },
      },
    },
    { $unset: 'completed_onboarding' },
    {
      $lookup: {
        from: Template.collection.collectionName,
        let: { shopDomain: '$shopDomain' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ['$type', 'template'] }, { $eq: ['$shopDomain', '$$shopDomain'] }],
              },
            },
          },
          {
            $lookup: {
              from: LayerIntegration.collection.collectionName,
              localField: '_id',
              foreignField: 'data.templateId',
              as: 'layer',
            },
          },
          {
            $unwind: {
              path: '$layer',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: Mockup.collection.collectionName,
              let: { layerId: '$layer._id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [{ $in: ['$$layerId', '$layers'] }],
                    },
                  },
                },
              ],
              as: 'mockup',
            },
          },
          {
            $unwind: {
              path: '$mockup',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $group: {
              _id: '$_id',
              mockups: { $addToSet: '$mockup' },
              createdAt: { $first: '$createdAt' },
              lastTemplateCreatedAt: { $last: '$createdAt' },
            },
          },
          { $sort: { createdAt: 1 } },
          {
            $set: {
              status: {
                $cond: [{ $gt: [{ $size: '$mockups' }, 0] }, 'active', 'inactive'],
              },
            },
          },
        ],
        as: 'templates',
      },
    },
    {
      $set: {
        'usages.totalCreatedTemplates': { $size: '$templates' },
        'usages.totalIntegratedTemplates': {
          $size: {
            $filter: {
              input: '$templates.status',
              as: 'status',
              cond: { $eq: ['$$status', 'active'] },
            },
          },
        },
        'usages.firstTemplateCreatedAt': { $arrayElemAt: ['$templates.createdAt', 0] },
        'usages.firstTemplateCreatedAfterHowManyDays': {
          $dateDiff: {
            startDate: '$createdAt',
            endDate: { $arrayElemAt: ['$templates.createdAt', 0] },
            unit: 'day',
          },
        },
        'usages.lastTemplateCreatedAt': { $arrayElemAt: ['$templates.createdAt', -1] },
      },
    },
    { $unset: 'templates' },
    {
      $lookup: {
        from: Integration.collection.collectionName,
        let: { shopDomain: '$shopDomain' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ['$shopDomain', '$$shopDomain'] }],
              },
            },
          },
          { $sort: { publishedAt: 1 } },
        ],
        as: 'integrations',
      },
    },
    {
      $set: {
        'usages.totalCreatedIntegrations': { $size: '$integrations' },
        'usages.totalPublishedIntegrations': {
          $size: {
            $filter: {
              input: '$integrations.publishedAt',
              as: 'publishedAt',
              cond: { $ne: ['$$publishedAt', null] },
            },
          },
        },
        published_integrations: {
          $filter: {
            input: '$integrations',
            as: 'integration',
            cond: { $ne: ['$$integration.publishedAt', null] },
          },
        },
      },
    },
    {
      $set: {
        'usages.firstIntegrationPublishedAt': { $arrayElemAt: ['$published_integrations.publishedAt', 0] },
        'usages.firstIntegrationPublishedAfterHowManyDays': {
          $dateDiff: {
            startDate: '$createdAt',
            endDate: { $arrayElemAt: ['$published_integrations.publishedAt', 0] },
            unit: 'day',
          },
        },
        'usages.lastIntegrationPublishedAt': { $arrayElemAt: ['$published_integrations.publishedAt', -1] },
      },
    },
    { $unset: ['integrations', 'published_integrations'] },
    {
      $merge: {
        into: Shop.collection.collectionName,
        on: '_id',
      },
    },
  ])
    .exec()
    .catch(console.error)

  if (!syncImmediately) {
    return
  }

  setTimeout(async () => {
    /**
     * Sync shop data to the Google sheet `App Usage Stats`.
     *
     * @link https://docs.google.com/spreadsheets/d/1BnTmPZ8Q_zmagIN0fhpeBLDJ4Q_-jKJ931fhG_tjc7E
     */
    // eslint-disable-next-line operator-linebreak
    const syncDataEndpoint =
      'https://script.google.com/macros/s/AKfycbyFx0Ff2Q8Yhp0udVCOan7i1UNiNmiVWT06nYZryHxdvPhjgrBFQWLBw3xUXqiQ4hwI/exec'

    const stats = (
      await Shop.aggregate([
        { $match: { shopDomain } },
        {
          $project: {
            shop_domain: '$shopDomain',
            shop_name: '$shopConfig.name',
            email: '$shopConfig.email',
            installed_at: '$createdAt',
            status: { $cond: [{ $eq: ['$uninstalledAt', null] }, 'Active', 'Uninstalled'] },
            last_access: '$lastAccess',
            uninstalled_at: '$uninstalledAt',
            review_data: '$appConfig.reviewData',
            timezone: '$shopConfig.timezone',
            country: '$shopConfig.country_name',
            owner_name: '$shopConfig.shop_owner',
            shopify_plan: '$shopConfig.plan_display_name',
            used_ai_assistant: '$usages.usedAIAssistant',
            used_generative_ai: '$usages.usedGenerativeAI',
            updated_at: '$updatedAt',
            completed_onboarding: '$appConfig.occurredEvents.completed_onboarding',
            total_created_templates: '$usages.totalCreatedTemplates',
            total_integrated_templates: '$usages.totalIntegratedTemplates',
            first_template_created_at: '$usages.firstTemplateCreatedAt',
            first_template_created_after_how_many_days: '$usages.firstTemplateCreatedAfterHowManyDays',
            last_template_created_at: '$usages.lastTemplateCreatedAt',
            total_created_integrations: '$usages.totalCreatedIntegrations',
            total_published_integrations: '$usages.totalPublishedIntegrations',
            published_integrations: '$usages.publishedIntegrations',
            first_integration_published_at: '$usages.firstIntegrationPublishedAt',
            first_integration_published_after_how_many_days: '$usages.firstIntegrationPublishedAfterHowManyDays',
            last_integration_published_at: '$usages.lastIntegrationPublishedAt',
            shop_description: '$metadata.shopDescription',
            shop_categories: '$metadata.shopCategories',
            personalization_compatibility_score: '$metadata.personalizationCompatibilityScore',
          },
        },
      ]).exec()
    )?.[0]

    if (stats) {
      // Query for published products
      const products = await Integration.aggregate([
        { $match: { shopDomain, publishedAt: { $ne: null } } },
        { $sort: { publishedAt: -1 } },
        {
          $lookup: {
            from: Mockup.collection.collectionName,
            localField: '_id',
            foreignField: 'denormalizedData.integration._id',
            as: 'mockups',
          },
        },
        { $unwind: '$mockups' },
      ])

      // Get product IDs
      const productIds: any[] = []

      products.forEach(p =>
        p.mockups.denormalizedData?.variants?.forEach((v: any) => {
          const productId = v.productId.split('/').pop()

          if (!productIds.includes(productId)) {
            productIds.push(productId)
          }
        })
      )

      // Build product URLs
      const publishedProducts: any[] = []

      if (productIds.length) {
        const session = await ShopifySession.findOne({ shop: shopDomain })

        if (session) {
          const query = `(id:${productIds.join(') OR (id:')})`

          const res = await requestGraphqlApi({
            shopDomain,
            accessToken: session.accessToken,
            query: `query {
            products(first: 250, reverse: true, query:"(${query}) AND (status:ACTIVE)") {
              nodes {
                id
                title
                handle
                publishedAt
              }
            }
          }`,
          })

          res.data?.products?.nodes?.forEach((n: any) =>
            publishedProducts.push({
              shop_domain: shopDomain,
              product_title: n.title,
              published_at: n.publishedAt,
              product_link: `https://${shopDomain}/products/${n.handle}`,
            })
          )
        }
      }

      fetch(syncDataEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: process.env.SECRET_TOKEN,
          type: 'app_usage_stats',
          data: {
            ...stats,
            published_products: publishedProducts,
          },
        }),
      }).catch(console.error)
    }
  }, 10)
}

/**
 * Sync shop usage tracking and create Shopify charges.
 *
 * Called by cron job every hour (production) or 5 minutes (dev/RC/WIP).
 * Handles asset resets, AI credits, trial campaigns, and billing for all subscribed shops.
 *
 * @param shopDomain - Optional. If provided, sync only this shop. Otherwise sync all shops.
 */
/**
 * Sync shop usage and process billing charges
 * @param shopDomain - Optional shop domain to sync specific shop
 * @param forceCharge - Force charge submission regardless of time window (for manual testing)
 */
export async function syncShopUsage(shopDomain?: string, forceCharge = false): Promise<void> {
  const shops = await Shop.find({ subscription: { $ne: null }, ...(shopDomain ? { shopDomain } : {}) })

  for (const shop of shops) {
    try {
      const { shopDomain } = shop

      // 1. Reset daily asset mutation counter (23:00-00:59 UTC)
      const currentHour = new Date().getHours()
      if (currentHour >= 23 || currentHour <= 0) {
        await resetAssetsMutationPerDay(shopDomain)
      }

      const shopData = await getShopData(shopDomain)
      if (!shopData?.subscription) continue

      const shopSubscription = shopData.subscription as SubscriptionDocument
      const plan = shopSubscription.plan as PricingPlanDocument
      if (!plan) continue

      const billingType = getBillingType(plan)

      // 2. Reset AI credits if billing cycle has rolled over
      await checkAndResetAiCreditsIfNeeded(shopDomain, shopData, shopSubscription)

      /** PRESERVE FOR CAMPAIGN Q1 - 2025 */
      // 3. Handle trial period campaign - track $200 revenue milestone
      await handleTrialPeriodCampaign(shopDomain, shopData, shopSubscription)
      /** END PRESERVE FOR CAMPAIGN Q1 - 2025 */

      // 3.5. Check for active-days trial expiration
      const trialJustExpired = await checkTrialExpiration(shopDomain)
      if (trialJustExpired) {
        try {
          // Charge accumulated debt
          await chargeTrialDebt(shopDomain, shopSubscription, 'trial_end')

          // Mark trial as completed
          await completeTrialTracking(shopDomain)

          // CRITICAL: Set baseline = current order count to prevent double-charging
          // After charging trial debt, we need to mark these orders as "already charged"
          // So daily billing doesn't charge them again
          const shopDataRefresh = await getShopData(shopDomain)
          const currentOrderCount = shopDataRefresh?.usages?.orders || 0

          // Check if billing cycle already exists (created by order webhook)
          const existingCycle = await BillingStateManager.getCurrentState(shopDomain)

          if (existingCycle) {
            // CASE A: Cycle exists (user created orders during trial)
            // UPDATE baseline to mark orders as charged
            await BillingCycle.updateOne(
              { shopDomain, status: 'active' },
              {
                $set: {
                  'orderCount.initial': currentOrderCount,
                },
              }
            )
          } else {
            // CASE B: No cycle (user didn't create any orders during trial)
            // CREATE cycle for future billing
            await BillingStateManager.createCycle(shopSubscription, plan, {
              isFirstCycle: true,
              initialOrderCount: currentOrderCount, // Usually 0 if no orders during trial
            })
          }
        } catch (error) {
          console.error(`[syncShopUsage] Failed to handle trial expiration for ${shopDomain}:`, error)
          // Don't block other processing if trial handling fails
        }
      }

      // 4. Process billing charges
      if (billingType === 'order-based') {
        // V2: Order-based plans - charge during billing window (23:00-00:59)
        // NOTE: Webhooks call updateOrderCount() directly (see Order.server.ts:updateOrderUsage)
        // This cron job ONLY handles daily batch charging, not order counting
        // forceCharge allows manual testing via API call (bypasses time window)
        if (forceCharge || shouldProcessCharge()) {
          await submitDailyUsageCharge(shopDomain)
        }
      } else if (billingType === 'revenue-based') {
        // V1: Revenue-based plans - charge when revenue tier changes
        await processRevenueBasedBilling(shopDomain, shopData, shopSubscription, plan)
      }
    } catch (error) {
      console.error(`[syncShopUsage] Error processing ${shop.shopDomain}:`, formatErrorMessage(error))
      continue
    }
  }
}

/**
 * PRESERVE FOR CAMPAIGN Q1 - 2025
 *
 * Q1 2025 Trial Campaign - Track $200 Revenue Milestone
 *
 * Business Logic:
 * - During trial period, track merchant's app-generated revenue
 * - If merchant reaches $200 revenue milestone, unlock special promotion
 * - Update milestone achievement status in real-time for UI display
 *
 * TODO: Review this function after Q1 2025 campaign ends
 */
async function handleTrialPeriodCampaign(
  shopDomain: string,
  shopData: ShopDocument,
  shopSubscription: SubscriptionDocument
): Promise<void> {
  try {
    const shopifyCharge = shopSubscription.shopifyCharge
    if (!shopifyCharge) return

    const billingSubscriptionTime = getBillingSubscriptionTime(shopifyCharge)
    const shopSubscriptionCreatedAt = new Date(shopSubscription.createdAt).toISOString()
    const now = Date.now()
    const shopifyChargeBillingTime = billingSubscriptionTime || shopSubscriptionCreatedAt

    // Only process if currently in trial period (billing hasn't started yet)
    if (!shopifyChargeBillingTime || new Date(shopifyChargeBillingTime).getTime() > now) {
      const trialEndsOn = getTrialEndsOn(shopifyCharge)

      if (trialEndsOn && new Date(trialEndsOn).getTime() > now) {
        // Calculate trial cycle revenue
        const { from, to } = getBillingCycleDate(shopifyCharge.activated_on, shopifyCharge.trialDays)
        const appGeneratedRevenue = await getAppGeneratedRevenueInBillingCycle(shopDomain, from, to)
        const gained200DollarInTrialPeriod = appGeneratedRevenue >= 200

        // Track milestone achievement (async, don't block)
        updateUserMilestoneIfShopHasAchieved200DollarInTrialPeriod(shopDomain, {
          appGeneratedRevenue,
          finished: gained200DollarInTrialPeriod,
        }).catch(console.error)

        // Update revenue in shop usages for dashboard display
        await Shop.updateOne({ shopDomain }, { usages: { ...shopData.usages, appGeneratedRevenue } })

        // Apply promotion if qualified (e.g., discount on first paid plan)
        await applyPromotionIfQualified(shopDomain)
      }
    }
  } catch (error) {
    console.error(`[handleTrialPeriodCampaign] Error:`, error)
  }
}

/**
 * V1 Revenue-Based Billing - Tiered Pricing by App-Generated Revenue
 *
 * Billing Flow:
 * 1. Calculate current 30-day billing cycle
 * 2. Get merchant's app-generated revenue in cycle (from orders using our templates)
 * 3. Find matching tier in plan.usages.revenue[] (e.g., $0-$1000 → Tier 1, $1000-$5000 → Tier 2)
 * 4. Calculate tier fee + optional revenue share for amounts above tier cap
 * 5. Apply coupon discount if available
 * 6. Create incremental usage charge (only charge difference from already charged fees)
 *
 * Example: Merchant generated $1,200 revenue on Tier 2 ($49 base + 5% revenue share)
 * - Base fee: $49
 * - Revenue share: ($1,200 - $1,000) * 5% = $10
 * - Total: $59 (capped at plan.cappedAmount)
 */
async function processRevenueBasedBilling(
  shopDomain: string,
  shopData: ShopDocument,
  shopSubscription: SubscriptionDocument,
  plan: PricingPlanDocument
): Promise<void> {
  const shopifyCharge = shopSubscription.shopifyCharge
  if (!shopifyCharge || !plan.usages.revenue) return

  const billingSubscriptionTime = getBillingSubscriptionTime(shopifyCharge)
  const shopSubscriptionCreatedAt = new Date(shopSubscription.createdAt).toISOString()
  const now = Date.now()
  const shopifyChargeBillingTime = billingSubscriptionTime || shopSubscriptionCreatedAt

  // Skip if billing hasn't started yet (still in trial or future subscription)
  if (!shopifyChargeBillingTime || new Date(shopifyChargeBillingTime).getTime() > now) return

  // Find current 30-day billing cycle by advancing from initial billing date
  const billingOn = new Date(shopifyChargeBillingTime)
  while (billingOn.getTime() + THIRTY_DAYS_BILLING_CYCLE_INTERVAL * ONE_DAY_IN_MILLISECONDS < now) {
    billingOn.setUTCDate(billingOn.getUTCDate() + THIRTY_DAYS_BILLING_CYCLE_INTERVAL)
  }

  const { from, to } = getBillingCycleDate(billingOn.toISOString())

  // Get merchant's revenue and already charged fees in current cycle
  const appGeneratedRevenue = await getAppGeneratedRevenueInBillingCycle(shopDomain, from, to)
  const totalChargedUsageFees = await getTotalChargedUsageFees(shopDomain, from, to)

  // Find matching tier based on revenue amount
  let tier = 0
  let tierUsageFee = 0

  for (tier = 0; tier < plan.usages.revenue.length; tier++) {
    const usage = plan.usages.revenue[tier]
    if ((!usage.from || appGeneratedRevenue >= usage.from) && (!usage.to || appGeneratedRevenue <= usage.to)) {
      tierUsageFee = usage.totalFee
      break
    }
  }

  // Add revenue share for amounts exceeding tier cap (e.g., 5% of revenue above $1,000)
  if (plan.usages.revenue[tier]?.revenueShare) {
    const revenueTier = plan.usages.revenue[tier]
    const revenueCap = revenueTier.to !== Infinity ? revenueTier.to : revenueTier.from
    const revenueAboveCap = appGeneratedRevenue - revenueCap
    const revenueShare = parseFloat(revenueTier.revenueShare as string) / 100
    tierUsageFee += revenueAboveCap * revenueShare
  }

  // Apply coupon discount and enforce capped amount limit
  const couponCode = shopSubscription.couponCode || shopSubscription.coupon || plan.couponCode
  await cleanUpExpiredCouponsByShopDomain(shopDomain, shopData)
  let usageFeeAfterDiscount = await getUsageFeeAfterDiscount(plan, tierUsageFee, couponCode, shopDomain)
  usageFeeAfterDiscount = Math.min(usageFeeAfterDiscount, plan.cappedAmount)

  // Calculate incremental charge (only charge difference to avoid double-billing)
  const usageFee = Math.max(0, usageFeeAfterDiscount - totalChargedUsageFees)

  if (usageFee === 0) return // Already fully charged for current cycle

  // Update shop usages for UI display (dashboard, billing page)
  await Shop.updateOne(
    { shopDomain },
    {
      $set: {
        'usages.appGeneratedRevenue': appGeneratedRevenue,
        'usages.usageFee': tierUsageFee,
        'usages.discountedUsageFee': usageFeeAfterDiscount,
      },
    }
  )

  // Create Shopify usage charge
  const chargeDescription = totalChargedUsageFees
    ? `Additional usage fees for app-generated revenue at Tier ${tier + 1} generated by ${process.env.APP_NAME}`
    : `Usage fees for app-generated revenue at Tier ${tier + 1} generated by ${process.env.APP_NAME}`

  const res = await createAppUsageRecord(shopDomain, shopifyCharge, usageFee, chargeDescription)

  // Handle charge errors
  if (res.userErrors?.length) {
    console.error('[Revenue Billing] Shopify error:', res.userErrors)

    // User set custom capped amount lower than plan limit - mark as reached
    if (res.userErrors[0].message === 'Total price exceeds balance remaining') {
      const userCappedAmount = shopSubscription.userCappedAmount
      const planCappedAmount = plan.cappedAmount

      if (userCappedAmount && userCappedAmount < planCappedAmount) {
        await Subscription.updateOne({ _id: shopSubscription._id }, { reachedUserCappedAmount: true })
      }
    }
  } else {
    // Charge successful - reset capped amount flag if previously reached
    if (shopSubscription.userCappedAmount && shopSubscription.reachedUserCappedAmount) {
      await Subscription.updateOne({ _id: shopSubscription._id }, { reachedUserCappedAmount: false })
    }

    // Record successful charge in subscription history
    await Subscription.create({
      to,
      from,
      shopDomain,
      status: 'active',
      periodical: 'one-time',
      plan: plan._id,
      finalPrice: usageFee,
      shopifyCharge: res.appUsageRecord,
    })

    // Apply any qualifying promotions after successful charge
    await applyPromotionIfQualified(shopDomain)

    // Track charge event for analytics
    trackEvent(shopData, EVENTS_TRACKING.CHARGE_USAGE_FEES, {
      [EVENTS_PARAMETERS_NAME.REVENUE_TIER]: tier + 1,
      [EVENTS_PARAMETERS_NAME.TIER_USAGE_FEES]: tierUsageFee,
      [EVENTS_PARAMETERS_NAME.APP_GENERATED_REVENUE]: appGeneratedRevenue,
      [EVENTS_PARAMETERS_NAME.USAGE_FEES_AFTER_DISCOUNT]: usageFeeAfterDiscount,
      [EVENTS_PARAMETERS_NAME.CHARGED_ADDITIONAL_USAGE_FEES]: usageFee,
    }).catch(console.error)
  }
}

/**
 * Increase the assets mutation per day by 1
 *
 * @param {string} shopDomain
 *
 * @returns {Promise<void>}
 */
export const increaseAssetsMutationPerDay = async (shopDomain: string, incNumber = 1) => {
  console.log(`Attempting to increment request number for shop: ${shopDomain}`)

  await Shop.updateOne(
    { shopDomain }, // Find the document by shopDomain
    { $inc: { 'usages.assetsMutationPerDay': incNumber } } // Increment the count by incNumber or 1
  )
}

/**
 * Reset the assets mutation per day to 0
 *
 * @param {string} shopDomain
 *
 * @returns {Promise<void>}
 */
export const resetAssetsMutationPerDay = async (shopDomain: string) => {
  await Shop.updateOne(
    { shopDomain }, // Find the document by shopDomain
    { 'usages.assetsMutationPerDay': 0 } // Reset request number
  )
}

/**
 * Analyze shop description and categories
 *
 * @param {string} shopDomain
 * @param {AdminApiContext} admin
 *
 * @returns {Promise<{ shopCategories: string[], shopDescription: string, personalizationCompatibilityScore: number }>}
 */
async function analyzeShopDescriptionAndCategories(
  shopDomain: string,
  dataProcessed: { shopInfo: ShopInfo; topSellingProducts: TopSellingProduct[] }
): Promise<{ shopCategories: string[]; shopDescription: string; personalizationCompatibilityScore: number }> {
  try {
    const { shopInfo, topSellingProducts } = dataProcessed

    // Get shop description
    const description = shopInfo.description || ''
    const topSellingProductTitle = topSellingProducts[0]?.title
    const topSellingProductDescription = topSellingProducts[0]?.description

    const existingProductInformation = topSellingProductTitle || topSellingProductDescription
    const productLabel = existingProductInformation
      ? `Title: ${topSellingProductTitle}\nDescription: ${topSellingProductDescription}`
      : ''

    // Analyze shop description and extract categories using AI
    let shopCategories: string[] = []
    let shopDescription = ''
    let personalizationCompatibilityScore = 0.5 // Default medium score

    if ((description && description.trim().length > 0) || productLabel) {
      try {
        // Import the AssistantService to analyze the shop description
        const assistantService = new AssistantService({
          apiKey: process.env.OPENAI_API_KEY || '',
          shopDomain: shopDomain,
          model: 'gpt-4.1-mini',
          temperature: 1,
        })

        const analysisResult = await assistantService.analyzeShopDescription(description, productLabel)

        shopCategories = analysisResult.categories
        shopDescription = analysisResult.description
        personalizationCompatibilityScore = analysisResult.personalizationCompatibilityScore
      } catch (error) {
        console.error(`Failed to analyze shop description for ${shopDomain}:`, error)
        // Use default categories if analysis fails
        shopCategories = DEFAULT_CATEGORIES
        shopDescription = description?.trim() || ''
      }
    } else {
      // Use default categories if no description
      shopCategories = DEFAULT_CATEGORIES
    }

    return { shopCategories, shopDescription, personalizationCompatibilityScore }
  } catch (error) {
    console.warn('Failed to analyze shop description and categories for', shopDomain, formatErrorMessage(error))
    return { shopCategories: DEFAULT_CATEGORIES, shopDescription: '', personalizationCompatibilityScore: 0.5 }
  }
}

/**
 * Analyze shop description and categories
 * When shop is installed, we need to analyze shop description and categories but it takes a long time to analyze
 * so we need to run it asynchronously
 *
 * @param {string} shopDomain
 *
 * @returns {Promise<void>}
 */
async function runAsyncAnalyzeShopDescriptionAndCategories(
  shopDomain: string,
  dataProcessed: { shopInfo: ShopInfo; topSellingProducts: TopSellingProduct[] }
): Promise<void> {
  const data = await analyzeShopDescriptionAndCategories(shopDomain, dataProcessed)

  const { shopDescription, shopCategories, personalizationCompatibilityScore } = data

  await Shop.updateOne(
    { shopDomain },
    {
      metadata: {
        shopDescription,
        shopCategories,
        personalizationCompatibilityScore,
      },
    }
  )
}
