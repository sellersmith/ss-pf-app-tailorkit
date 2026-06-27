/* eslint-disable max-lines */
import { EMPTY_OBJECT, ONE_SECOND_IN_MILLISECONDS, THIRTY_MINUTES_IN_MILLISECONDS } from '~/constants'
import { TAILORKIT_NAMESPACE } from '~/constants/metafield-keys'
import { PREFIX_PRODUCT_ID, PREFIX_VARIANT_ID } from '~/constants/shopify'
import { evaluateRequestForMutatingAssets } from '~/models/Asset.server'
import Integration, {
  deletedVariantsNotUsed,
  deleteLayersNotUsed,
  deleteMockupsNotUsed,
  deletePrintAreasNotUsed,
  getDetailIntegration,
  upsertIntegration,
} from '~/models/Integration.server'
import { upsertLayerIntegration } from '~/models/LayerIntegration.server'
import { upsertMockup, recomputeTemplatesActiveVariants } from '~/models/Mockup.server'
import { upsertPrintArea } from '~/models/PrintArea.server'
import { bulkUpsertMockupViews, updateMockupViewsOrdering } from '~/models/MockupView.server'
import { getShopData } from '~/models/Shop.server'
import VariantIntegration, {
  deleteProductActivatedByVariantId,
  upsertVariantIntegration,
} from '~/models/VariantIntegration.server'
import { bulkUpdateMockupDenormalizedData } from '~/routes/api.integrations/utils/mockup-fns.server'
import { getShopifyApiClient, ShopifyApiClient } from '~/shopify/graphql/api.server'
import type {
  IntegrationDataSaver,
  Integration as IntegrationType,
  VariantIntegration as VariantIntegrationType,
} from '~/types/integration'
import { chunkArray } from '~/utils/chunkArray'
import { getSizeInUnit } from '~/utils/file-types'
import { formatShopifyObjectIdToNumberId } from '~/utils/shopify'
import { sleep } from '~/utils/sleep'
import { prepareMetafieldDataBeforePublishingIntegrationV2, preparePreMadePrompt } from './preparation-fns.server'
import { FEATURE_FLAGS } from 'extensions/tailorkit-src/src/assets/constants/feature-flags'
import { hasEnoughAiCredits } from '~/models/helpers/ai-credit-utils'
import type { AdminApiContext } from '@shopify/shopify-app-remix/server'
import { mongoDBCacheStorage } from '~/models/Cache.server'
import Promotion from '~/models/Promotion.server'
import { decrementCampaignCounts, incrementCampaignCounts } from '~/models/ShopCampaignStats.server'
import { PERSONALIZATION_METAFIELD_NAMESPACE, PERSONALIZATION_METAFIELD_KEY } from '~/shopify/app.server'

/** Narrow unknown to plain object */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Safely extract a template id from various shapes used across the app:
 * - data.templateId: string | { _id: string }
 * - data.template: string | { _id: string }
 */
function extractTemplateIdFromLayerData(data?: { templateId?: unknown; template?: unknown }): string | undefined {
  const { templateId, template } = data || {}

  if (typeof templateId === 'string') return templateId
  if (isObject(templateId) && typeof templateId._id === 'string') return templateId._id

  if (typeof template === 'string') return template
  if (isObject(template) && typeof template._id === 'string') return template._id

  return undefined
}

type ServerLayer = { _id?: string; data?: { templateId?: unknown; template?: unknown } }
type ServerMockup = { _id?: string; layers?: ServerLayer[] }
type ServerVariant = { id: string; printAreas?: { _id: string }[]; mockup?: ServerMockup }

/**
 * Generic utility to find unused IDs
 * @param currentItems - Current items (may be strings or objects)
 * @param newItems - New items to compare against
 * @param idExtractor - Function to extract ID from objects
 * @returns Array of unused IDs
 */
// removed: findUnusedIds – inlined strongly-typed set diffs below

/**
 * Processes and saves an integration with all its related entities
 *
 * This function handles:
 * 1. Cleanup of unused variants
 * 2. Upserting print areas, layers, variants, mockups, and the integration itself
 * 3. Updating denormalizedData for mockups in the background for improved performance
 * @param integrationData Data for the integration and related entities
 * @returns Promise that resolves when the integration is saved
 */
export async function saveIntegrationProcess(integrationData: IntegrationDataSaver & { shopDomain: string }) {
  const {
    printAreas,
    layers,
    mockups,
    mockupViews = [],
    variants,
    shopDomain,
    integration,
    integration: { _id },
  } = integrationData

  try {
    // Evaluate request number
    await evaluateRequestForMutatingAssets(shopDomain)

    // Get shop data
    const shopData = await getShopData(shopDomain)

    if (!shopData) return

    const currIntegration = (await getDetailIntegration({ shopDomain, _id })) as { variants?: ServerVariant[] } | null

    // Handle variant cleanup if needed
    if (currIntegration) {
      const currentVariants = (currIntegration.variants || []) as ServerVariant[]

      const currentPrintAreas = (currentVariants.map(v => v.printAreas || []) || []).flat()
      const currentMockups = currentVariants.map(v => v.mockup || {})
      const currentLayers = (currentMockups.map(m => m.layers || []) || []).flat()

      // Use optimized utility function for each entity type
      const currentVariantIds = currentVariants.map(v => v.id).filter(Boolean)
      const newVariantIds = (variants || []).map(v => v.id).filter(Boolean)
      const unusedVariantIds = currentVariantIds.filter(id => !new Set(newVariantIds).has(id))

      const currentPrintAreaIds = currentPrintAreas
        .map(p => p?._id)
        .filter((id): id is string => typeof id === 'string')
      const newPrintAreaIds = (printAreas || []).map(p => p._id).filter((id): id is string => typeof id === 'string')
      const unusedPrintAreaIds = currentPrintAreaIds.filter(id => !new Set(newPrintAreaIds).has(id))

      const currentMockupIds = currentMockups.map(m => m?._id).filter((id): id is string => typeof id === 'string')
      const newMockupIds = (mockups || []).map(m => m._id).filter((id): id is string => typeof id === 'string')
      const unusedMockupIds = currentMockupIds.filter(id => !new Set(newMockupIds).has(id))

      const extractId = (value: unknown): string | undefined => {
        if (typeof value === 'string') return value
        if (isObject(value) && typeof value._id === 'string') return value._id
        return undefined
      }
      const currentLayerIds = currentLayers.map(extractId).filter((id): id is string => typeof id === 'string')
      const newLayerIds = (layers || []).map(l => l._id).filter((id): id is string => typeof id === 'string')
      const unusedLayerIds = currentLayerIds.filter(id => !new Set(newLayerIds).has(id))

      // Delete variants are not used
      if (unusedVariantIds.length > 0) {
        await deletedVariantsNotUsed(unusedVariantIds, shopDomain)
      }

      // Delete print areas are not used
      if (unusedPrintAreaIds.length > 0) {
        await deletePrintAreasNotUsed(unusedPrintAreaIds, shopDomain)
      }

      // Delete mockups are not used
      if (unusedMockupIds.length > 0) {
        await deleteMockupsNotUsed(unusedMockupIds, shopDomain)
      }

      // Delete layers are not used
      if (unusedLayerIds.length > 0) {
        await deleteLayersNotUsed(unusedLayerIds, shopDomain)
      }
    }

    /** Upsert print areas */
    try {
      await Promise.all(printAreas.map(printArea => upsertPrintArea(printArea, shopDomain)))
    } catch (error) {
      console.error('❌ Error upserting print areas:', error)
      throw error
    }

    /** Upsert layers integration  */
    try {
      await Promise.all(layers.map(layer => upsertLayerIntegration(layer, shopDomain)))
    } catch (error) {
      console.error('❌ Error upserting layer integrations:', error)
      throw error
    }

    /** Upsert variant integration */
    try {
      await Promise.all(variants.map(variant => upsertVariantIntegration(variant, shopDomain, shopData)))
    } catch (error) {
      console.error('❌ Error upserting variant integrations:', error)
      throw error
    }

    /** Upsert mockup */
    try {
      await Promise.all(mockups.map(mockup => upsertMockup(mockup, shopDomain)))
    } catch (error) {
      console.error('❌ Error upserting mockups:', error)
      throw error
    }

    /** Upsert mockup views & update Mockup.views ordering (no business logic here) */
    try {
      if (Array.isArray(mockupViews) && mockupViews.length > 0) {
        await bulkUpsertMockupViews(mockupViews as any, shopDomain)
        await updateMockupViewsOrdering(mockupViews as any)
      }
    } catch (error) {
      console.error('❌ Error upserting mockup views:', error)
      throw error
    }

    /** Upsert integration */
    try {
      await upsertIntegration(integration, shopDomain)
    } catch (error) {
      console.error('❌ Error upserting integration:', error)
      throw error
    }

    /** Recompute templates' activeVariantIntegration after saves and deletions */
    try {
      // Previous template ids from existing integration (covers removals)
      const prevTemplateIds: string[] = (currIntegration?.variants || [])
        .flatMap(vi => vi?.mockup?.layers || [])
        .map(layer => extractTemplateIdFromLayerData((layer as ServerLayer).data))
        .filter((id): id is string => typeof id === 'string')

      // New template ids from incoming payload (covers additions)
      const newTemplateIds: string[] = (layers || [])
        .map(l => extractTemplateIdFromLayerData(l.data as { templateId?: unknown; template?: unknown }))
        .filter((id): id is string => typeof id === 'string')

      const templateIdsToRecompute = [...new Set([...prevTemplateIds, ...newTemplateIds])]

      if (templateIdsToRecompute.length > 0) {
        await recomputeTemplatesActiveVariants(templateIdsToRecompute)
      }
    } catch (error) {
      // Non-blocking; log and continue
      console.error('⚠️ Failed to recompute templates activeVariantIntegration:', error)
    }

    /** Update denormalizedData for mockups efficiently */
    // This is done after all other operations are complete to avoid blocking the response
    // The update runs in the background, so we don't await the result
    const mockupIds = mockups.map(mockup => mockup._id)

    // Add integration info to the denormalizedData options
    const integrationInfo = {
      integration: {
        _id: integration._id,
        name: integration.title,
      },
    }

    // Use setTimeout with 0ms delay to push this operation to the next event loop cycle
    // This ensures we don't block the response while still performing the update
    setTimeout(() => {
      bulkUpdateMockupDenormalizedData(mockupIds, shopDomain, {
        additionalData: integrationInfo,
      }).catch(error => console.error('Failed to bulk update denormalizedData for mockups:', error))
    }, 0)
  } catch (error) {
    console.error('Failed to save integration:', error)
    throw new Error('Failed to save integration')
  }
}

/**
 * Processes variants and extracts IDs for publishing
 * @param integration Integration data containing variants
 * @returns Object containing variant IDs to publish and delete
 */
function processVariantChanges(integration: IntegrationType): {
  variantIdsNeedToBePublished: string[]
  variantIdsToDelete: string[]
} {
  // Ensure unique variant IDs to avoid duplicates in published state
  const variantIdsNeedToBePublished = [
    ...new Set(integration.variants.map((variant: VariantIntegrationType) => variant.id)),
  ]

  // The variantIdsPublished is the variantIds that are published on the integration,
  // so we need to delete the variants that are not in the variantIdsNeedToBePublished
  const variantIdsToDelete = (integration.variantIdsPublished || []).filter(
    id => !variantIdsNeedToBePublished.includes(id)
  )

  return { variantIdsNeedToBePublished, variantIdsToDelete }
}

/**
 * Processes and publishes an integration by updating product status, managing variants, and syncing metafields.
 * This approach maintains sequential processing for better error tracking but splits concerns into smaller functions.
 *
 * @param admin - Shopify admin API client
 * @param integrationId - ID of the integration to publish
 * @param shopDomain - Shop domain for the integration
 * @returns Object containing prepared data and metafield data, or null if integration not found
 */
export async function publishIntegrationProcess(
  admin: AdminApiContext,
  integrationId: string,
  shopDomain: string,
  options?: { skipProductActivation?: boolean }
): Promise<{ metafieldSize: Record<string, string> } | null> {
  try {
    // Get integration details
    const integration = await getDetailIntegration({
      _id: integrationId,
      shopDomain,
      populateTemplate: true,
    })

    if (!integration) {
      return null
    }

    // Process variants and get IDs to manage (deduped)
    const { variantIdsNeedToBePublished, variantIdsToDelete } = processVariantChanges(integration)

    // Set product to active if needed (skip for onboarding — products stay UNLISTED until merchant subscribes)
    if (!options?.skipProductActivation) {
      await updateProductStatus({ integration, admin })
    }

    // Deduplicate variants by id before writing metafields to avoid redundant writes
    const uniqVariantsMap = new Map<string, VariantIntegrationType>()
    for (const v of integration.variants as VariantIntegrationType[]) {
      if (v?.id && !uniqVariantsMap.has(v.id)) uniqVariantsMap.set(v.id, v)
    }
    const uniqueVariants = Array.from(uniqVariantsMap.values())

    const { metafieldSize } = await updateMetafields({
      admin,
      variants: uniqueVariants,
      shopDomain,
    })

    // Ensure publishedAt is strictly later than any related template's updatedAt
    const templateUpdatedAtTimes: number[] = []
    try {
      const variantsForTimestamps = (uniqueVariants || []) as any[]
      variantsForTimestamps.forEach((variant: any) => {
        // Layers templates
        variant?.mockup?.layers?.forEach((layer: any) => {
          const data = layer?.data
          const t = data?.templateId || data?.template
          if (isObject(t) && 'updatedAt' in t && (t as any).updatedAt) {
            templateUpdatedAtTimes.push(new Date(String((t as any).updatedAt)).getTime())
          }
        })
        // Print area templates
        const pas = (variant?.printAreas as any[]) || []
        pas.forEach((pa: any) => {
          const t = pa?.template
          if (isObject(t) && 'updatedAt' in t && (t as any).updatedAt) {
            templateUpdatedAtTimes.push(new Date(String((t as any).updatedAt)).getTime())
          }
        })
      })
    } catch (e) {
      // Ignore errors in collecting timestamps; fall back to current time
    }

    const nowMs = Date.now()
    const maxTemplateUpdatedAtMs = templateUpdatedAtTimes.length ? Math.max(...templateUpdatedAtTimes) : 0
    // Add a small buffer to guarantee publishedAt > max(template.updatedAt)
    const publishedAtMs = Math.max(nowMs, maxTemplateUpdatedAtMs + ONE_SECOND_IN_MILLISECONDS)
    const publishedAt = new Date(publishedAtMs)
    const updatedAt = new Date(publishedAtMs - ONE_SECOND_IN_MILLISECONDS)

    // Get active PTE campaigns to tag this integration
    const now = publishedAt

    // Read current campaigns to avoid double-counting on re-publish
    const currentCampaigns = integration.pteCampaigns || []

    const activePTECampaigns = await Promotion.find({
      name: { $regex: /^Publish to Earn -/i },
      status: 'active',
      campaignId: { $exists: true, $ne: null },
      $and: [
        { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
        { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
      ],
    }).distinct('campaignId')

    // Update Integration document
    await Integration.updateOne(
      {
        _id: integrationId,
        shopDomain,
      },
      {
        // Subtracts 1 second to make sure published time is always larger than updated time
        updatedAt: updatedAt.toISOString(),
        publishedAt: publishedAt.toISOString(),
        unpublishedAt: null, // Clear unpublish timestamp when publishing
        variantIdsPublished: variantIdsNeedToBePublished,
        $addToSet: { pteCampaigns: { $each: activePTECampaigns } },
      },
      { timestamps: false }
    )

    // Update campaign stats in ShopCampaignStats collection
    // Only increment for NEW campaigns (not already in currentCampaigns)
    // This prevents double-counting when re-publishing integrations
    if (activePTECampaigns.length > 0) {
      const newCampaigns = activePTECampaigns.filter(c => !currentCampaigns.includes(c))

      for (let i = 0; i < newCampaigns.length; i++) {
        const campaignId = newCampaigns[i]
        await incrementCampaignCounts(shopDomain, campaignId, publishedAt)
      }
    }

    // Mark products as personalized via metafield for webhook filtering (fire-and-forget)
    markProductsPersonalized(admin, uniqueVariants).catch(err => {
      console.error('[DimensionValidation] Failed to mark products personalized on publish:', err)
    })

    // Handle variant cleanup asynchronously
    if (variantIdsToDelete.length > 0) {
      await removeUnusedVariantsInAppMetafield({
        admin,
        variantsIds: variantIdsToDelete,
        shopDomain,
      }).catch(error => {
        throw new Error(`Variant cleanup failed: ${error}`)
      })
    }

    return { metafieldSize }
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : `${e}`)
  }
}

/**
 * Unpublish integration process
 * This version function is served for the old integration. We save all variant ids in product in app metafield
 *
 * @param args
 * @returns
 */
export async function unpublishIntegrationProcess(args: {
  admin: any
  shopDomain: string
  integrationId?: string
  variantsIds?: string[]
}) {
  const { admin, integrationId, shopDomain, variantsIds = [] } = args

  const api = new ShopifyApiClient(admin)
  let variants: any[] = []

  try {
    if (variantsIds.length > 0) {
      variants = await api.getProductVariantsByVariantIds(variantsIds)
    } else if (integrationId) {
      const integration = await getDetailIntegration({ _id: integrationId, shopDomain })

      if (!integration) {
        return null
      }

      variants = integration.variants as VariantIntegrationType[]
    }

    const variantIds = [
      ...new Set(variants.map(variant => formatShopifyObjectIdToNumberId(variant.id, PREFIX_VARIANT_ID))),
    ].filter(Boolean)
    const productIds = [
      ...new Set(
        variants.map(variant =>
          formatShopifyObjectIdToNumberId(variant.productId || variant.product?.id || '', PREFIX_PRODUCT_ID)
        )
      ),
    ].filter(Boolean)

    // Mutate the print area on app meta field
    const appMetafield = (await api.getAppMetafields()).appInstallation.metafields

    const chunkSize = 20
    const variantIdsChunk = chunkArray(variantIds, chunkSize)

    // For version save all variant ids in product in app metafield
    /**
     * This loop is used for the old integration. We save all variant ids in product in app metafield
     * @deprecated
     *  */
    for (const product_id of productIds) {
      // Remove variant from app metafield
      const metafieldByProduct = appMetafield.nodes.find((node: any) => node.key === product_id)

      if (!metafieldByProduct) {
        continue
      }

      const parsedMetafieldByProduct = JSON.parse(metafieldByProduct.value)

      variantIds.forEach(variantId => {
        const metafieldByProductVariant = parsedMetafieldByProduct[variantId]

        if (metafieldByProductVariant) {
          // Remove metafield by variant id
          delete parsedMetafieldByProduct[variantId]
        }
      })

      const _metaFieldValue = JSON.stringify({ ...(parsedMetafieldByProduct ?? {}) })

      // Update app metafield
      await api.upsertAppMetafields([
        {
          type: 'json',
          namespace: TAILORKIT_NAMESPACE,
          key: product_id,
          value: _metaFieldValue,
        },
      ])
    }

    for (const chunkVariantIds of variantIdsChunk) {
      await Promise.all(
        chunkVariantIds.map(async variantId => {
          await cleanupVariantInAppMetafield(api, variantId)
        })
      )

      // Sleep for 0.5 second to avoid rate limit
      await sleep(ONE_SECOND_IN_MILLISECONDS / 2)
    }

    // Read campaigns before clearing (needed for decrement)
    const integration = await Integration.findOne({ _id: integrationId })
    const campaignsToDecrement = integration?.pteCampaigns || []

    // Clear Integration campaigns and publishedAt
    await Integration.updateOne(
      {
        _id: integrationId,
      },
      {
        publishedAt: null,
        unpublishedAt: new Date(), // Track when unpublished for analytics
        pteCampaigns: [], // Clear campaigns when unpublishing
        dimensionAlert: null, // Clear stale dimension mismatch alert
      }
    )

    // Decrement campaign stats in ShopCampaignStats collection
    // Uses atomic aggregation pipeline internally to prevent race conditions
    // Note: peakPublishedCount is NOT decremented - badges are persistent
    if (campaignsToDecrement.length > 0) {
      for (let i = 0; i < campaignsToDecrement.length; i++) {
        const campaignId = campaignsToDecrement[i]
        await decrementCampaignCounts(shopDomain, campaignId)
      }
    }

    // Remove personalization metafield if no other published integrations for this product (fire-and-forget)
    unmarkProductsPersonalized(admin, variants, shopDomain).catch(err => {
      console.error('[DimensionValidation] Failed to unmark products on unpublish:', err)
    })

    return { metafieldData: {} }
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : `${e}`)
  }
}

/**
 * Remove unused variants in app metafield
 *
 * @param args
 * @returns
 */
export async function removeUnusedVariantsInAppMetafield(args: {
  admin: any
  shopDomain: string
  integrationId?: string
  variantsIds?: string[]
}) {
  const { admin, integrationId, shopDomain, variantsIds = [] } = args

  const api = new ShopifyApiClient(admin)
  let variants: any[] = []

  try {
    if (variantsIds.length > 0) {
      // Loop over variants ids and create a list of objects with id and productId
      variants = variantsIds.map(variantId => ({ id: variantId }))
    } else if (integrationId) {
      const integration = await getDetailIntegration({ _id: integrationId, shopDomain })

      if (!integration) {
        return null
      }

      variants = integration.variants as VariantIntegrationType[]
    }

    const variantIds = [
      ...new Set(variants.map(variant => formatShopifyObjectIdToNumberId(variant.id, PREFIX_VARIANT_ID))),
    ].filter(Boolean)

    const chunkSize = 20
    const variantIdsChunk = chunkArray(variantIds, chunkSize)

    for (const chunkVariantIds of variantIdsChunk) {
      await Promise.all(
        chunkVariantIds.map(async variantId => {
          await cleanupVariantInAppMetafield(api, variantId)
        })
      )
    }
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : `${e}`)
  }
}

/**
 * Cleanup variant in app metafield
 *
 * @param api
 * @param variantId
 * @returns
 */
async function cleanupVariantInAppMetafield(api: ShopifyApiClient, variantId: string) {
  return api.upsertAppMetafields([
    {
      type: 'json',
      namespace: TAILORKIT_NAMESPACE,
      key: variantId,
      value: JSON.stringify(EMPTY_OBJECT),
    },
  ])
}

/**
 * Invalidate cache for product variant integration
 * Call this function when integration data is updated/published
 *
 * @param shopDomain
 * @param variantId
 * @param productId - Optional product ID to also clear product page cache
 */
export async function invalidateProductVariantCache(
  shopDomain: string,
  variantId: string | number,
  productId?: string | number
) {
  // Clear app metafield cache from MongoDB
  const metafieldCacheKey = `app-metafield_${shopDomain}_${variantId}`
  await mongoDBCacheStorage.delete(metafieldCacheKey)

  // Clear product page cache if productId provided
  if (productId) {
    const productPageCacheKey = `product-page_${shopDomain}_${productId}_${variantId}`
    await mongoDBCacheStorage.delete(productPageCacheKey)
  }
}

/**
 * Get product app metafield
 * Results are cached for 30 minutes to avoid Shopify Admin API rate limits.
 * Cache is stored in MongoDB and shared across all servers.
 *
 * Lookup order matches `customizer.liquid` to keep storefront + fallback in sync:
 *   1. Variant-level metafield (current storage format)
 *   2. Product-level metafield (legacy format — contains all variants as sub-keys)
 *
 * @param shopDomain
 * @param variantId
 * @param productId Optional — when provided, enables product-level fallback for legacy integrations
 * @returns
 */
export async function getProductAppMetafield(
  shopDomain: string,
  variantId: string | number,
  productId?: string | number
) {
  // Separate cache key when productId is provided so the product-level fallback
  // result doesn't pollute callers that only pass variantId
  const cacheKey
    = productId !== undefined
      ? `app-metafield_${shopDomain}_${productId}_${variantId}`
      : `app-metafield_${shopDomain}_${variantId}`

  // Try to get cached data from MongoDB
  const cachedData = await mongoDBCacheStorage.get(cacheKey)
  if (cachedData !== null) {
    return cachedData
  }

  // If no cache, fetch from Shopify
  const api = await getShopifyApiClient(shopDomain)

  const appMetafield = (await api.getAppMetafields()).appInstallation.metafields

  // Variant-level lookup (current storage format)
  let _metaField = appMetafield.nodes.find((node: any) => node.key.toString() === variantId.toString())

  // Product-level fallback (legacy storage format — same { [variantId]: { mockup } } shape)
  if (!_metaField && productId !== undefined) {
    _metaField = appMetafield.nodes.find((node: any) => node.key.toString() === productId.toString())
  }

  const parsedMetafield = _metaField?.value && JSON.parse(_metaField.value)

  // Cache the result for 30 minutes in MongoDB
  await mongoDBCacheStorage.set(cacheKey, parsedMetafield, THIRTY_MINUTES_IN_MILLISECONDS)

  return parsedMetafield
}

export async function updateMetafields({
  admin,
  variants,
  shopDomain,
}: {
  admin: AdminApiContext
  variants: VariantIntegrationType[]
  shopDomain?: string
}) {
  const preMadePrompts = FEATURE_FLAGS.PRE_MADE_PROMPT ? await preparePreMadePrompt(variants) : {}

  // Load shop data once for both AI credit + Colour Guide global default lookups.
  const shopData = shopDomain ? await getShopData(shopDomain) : null

  // Check AI credits at publish time to hide AI features on storefront when exhausted.
  const hasAiCredits = shopData ? hasEnoughAiCredits(shopData.usages?.aiCredit) : undefined

  // Shop-wide Colour Guide defaults — used as fallback for color_option sets that have
  // no per-template `data.colourGuideImageUrl` / `colourGuideDescription` configured.
  const globalColourGuideUrl = shopData?.appConfig?.appMetafields?.colourGuide?.defaultImageUrl
  const globalColourGuideDescription = shopData?.appConfig?.appMetafields?.colourGuide?.defaultDescription

  const preparedVariantsData = prepareMetafieldDataBeforePublishingIntegrationV2(
    variants,
    preMadePrompts,
    hasAiCredits,
    globalColourGuideUrl,
    globalColourGuideDescription
  )

  // Mutate the print area on app meta field
  const api = new ShopifyApiClient(admin)

  const chunkSize = 20
  const variantIds = Object.keys(preparedVariantsData)
  const chunkVariantsIds = chunkArray(variantIds, chunkSize)

  const metafieldSize: Record<string, string> = {}

  for (const chunkVariantIds of chunkVariantsIds) {
    await Promise.all(
      chunkVariantIds.map(async variant_id => {
        const metafieldValue = preparedVariantsData[variant_id]

        if (!metafieldValue) return

        const _metaFieldValue = JSON.stringify(metafieldValue)

        metafieldSize[variant_id] = getSizeInUnit(_metaFieldValue.length, 'kb')

        await api.upsertAppMetafields([
          {
            type: 'json',
            namespace: TAILORKIT_NAMESPACE,
            key: `${variant_id}`,
            value: _metaFieldValue,
          },
        ])

        // Invalidate cache after updating metafield in MongoDB
        if (shopDomain) {
          const variant = variants.find(v => formatShopifyObjectIdToNumberId(v.id, PREFIX_VARIANT_ID) === variant_id)
          if (variant) {
            const productId = formatShopifyObjectIdToNumberId(variant.productId, PREFIX_PRODUCT_ID)
            await mongoDBCacheStorage.delete(`app-metafield_${shopDomain}_${variant_id}`)
            if (productId) {
              await mongoDBCacheStorage.delete(`product-page_${shopDomain}_${productId}_${variant_id}`)
            }
          }
        }
      })
    )

    // Sleep for 0.5 second to avoid rate limit
    await sleep(ONE_SECOND_IN_MILLISECONDS / 2)
  }

  return { preparedVariantsData, metafieldSize }
}

export async function updateProductStatus(args: { admin: AdminApiContext; integration: IntegrationType }) {
  const { admin, integration } = args

  const groupedProducts: { [key: string]: boolean } = {}

  const variants = integration.variants

  variants.forEach((variant: VariantIntegrationType) => {
    if (variant.productActivated) {
      groupedProducts[variant.productId] = variant.productActivated
    }
  })

  const api = new ShopifyApiClient(admin)

  // Set grouped products to active
  for (const productId of Object.keys(groupedProducts)) {
    await api.updateProductStatus(productId, 'ACTIVE')
  }

  // Create productActivated status for variant selected
  await Promise.all(
    variants.map(async (variant: VariantIntegrationType) => {
      await deleteProductActivatedByVariantId(variant.id)
    })
  )
}

/**
 * This function is used to count saved integrations and check if it is the first integration
 *
 * @param shopDomain
 */
export const countSavedIntegrations = async (shopDomain: string) => {
  const numSavedIntegrations = await Integration.countDocuments({ shopDomain })
  const numPublishedIntegrations = await Integration.countDocuments({ shopDomain, publishedAt: { $ne: null } })

  return {
    numSavedIntegrations,
    numPublishedIntegrations,
    isFirstIntegration: numSavedIntegrations === 1 && !numPublishedIntegrations,
  }
}

/** Extract unique product GIDs from variant integration data */
function getUniqueProductGids(variants: VariantIntegrationType[]): string[] {
  return [
    ...new Set(
      variants
        .map(v => v.productId || (v.product as any)?.id)
        .filter(Boolean)
        .map((id: string) => (id.startsWith('gid://') ? id : `${PREFIX_PRODUCT_ID}${id}`))
    ),
  ]
}

/** Set personalization metafield on products on publish (fire-and-forget) */
async function markProductsPersonalized(admin: AdminApiContext, variants: VariantIntegrationType[]) {
  const api = new ShopifyApiClient(admin)
  const productGids = getUniqueProductGids(variants)

  await Promise.allSettled(
    productGids.map(gid =>
      api.upsertAppMetafields([
        {
          ownerId: gid,
          namespace: PERSONALIZATION_METAFIELD_NAMESPACE,
          key: PERSONALIZATION_METAFIELD_KEY,
          type: 'single_line_text_field',
          value: 'true',
        },
      ])
    )
  )
}

/** Remove personalization metafield on unpublish (only if no other published integrations reference this product) */
async function unmarkProductsPersonalized(admin: any, variants: VariantIntegrationType[], shopDomain: string) {
  const api = new ShopifyApiClient(admin)
  const productGids = getUniqueProductGids(variants)
  const numericIds = productGids.map(gid => gid.replace(PREFIX_PRODUCT_ID, ''))

  // Batch query: find all VariantIntegrations for these products in one query
  const allVariants = await VariantIntegration.find({
    productId: { $in: numericIds },
    shopDomain,
  })

  // Group variant IDs by product
  const variantsByProduct = new Map<string, string[]>()
  for (const v of allVariants) {
    const pid = (v as any).productId
    if (!variantsByProduct.has(pid)) variantsByProduct.set(pid, [])
    if ((v as any).id) variantsByProduct.get(pid)!.push((v as any).id)
  }

  // Check each product: unmark only if no other published integration references it
  await Promise.allSettled(
    productGids.map(async gid => {
      const numericId = gid.replace(PREFIX_PRODUCT_ID, '')
      const variantIds = variantsByProduct.get(numericId) || []
      if (!variantIds.length) return

      const stillPublished = await Integration.findOne({
        variants: { $in: variantIds },
        publishedAt: { $ne: null },
        shopDomain,
      })

      if (!stillPublished) {
        await api.upsertAppMetafields([
          {
            ownerId: gid,
            namespace: PERSONALIZATION_METAFIELD_NAMESPACE,
            key: PERSONALIZATION_METAFIELD_KEY,
            type: 'single_line_text_field',
            value: 'false',
          },
        ])
      }
    })
  )
}
