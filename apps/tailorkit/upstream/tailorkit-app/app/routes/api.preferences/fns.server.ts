import type { AdminApiContext, AdminContext } from '@shopify/shopify-app-remix/server'
import { INVALID_SHOP_ERROR } from '~/constants/errors'
import type { ShopDocument } from '~/models/Shop'
import Shop, { getShopData } from '~/models/Shop.server'
import Template from '~/models/Template.server'
import { getMyShopifySubdomainName } from '~/shopify/fns'
import { checkAppBlockOnProductTemplates, getMainThemeId, getThemeBlocksStatus } from '~/shopify/fns.server'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { TAILORKIT_APP_SETTINGS, TAILORKIT_GLOBAL_STYLING, TAILORKIT_NAMESPACE } from '~/constants/metafield-keys'
import Integration from '~/models/Integration.server'
import type { GlobalStyling } from '~/types/global-styling'
import VariantIntegration from '~/models/VariantIntegration.server'

/**
 * Return essential shop data
 *
 * @param request Request
 * @returns
 */
export async function getEssentialShopData(adminContext: AdminContext): Promise<ShopDocument> {
  try {
    const {
      session: { shop: shopDomain },
    } = adminContext

    // Get shop data
    const shop = await getShopData(shopDomain)

    if (!shop) {
      throw new Error(INVALID_SHOP_ERROR)
    }

    // Get the time the first template was created
    if (!shop.appConfig?.userFirstActions?.firstTemplateCreatedAt) {
      const firstTemplate = await Template.findOne({ shopDomain }, 'createdAt', { sort: { createdAt: 1 } })
      const firstTemplateCreatedAt = firstTemplate?.createdAt

      if (firstTemplateCreatedAt) {
        // Fix: Use $set to update nested field atomically without overwriting appConfig
        await Shop.updateOne(
          { shopDomain },
          { $set: { 'appConfig.userFirstActions.firstTemplateCreatedAt': firstTemplateCreatedAt } }
        )
      }
    }

    // Get the time the first integration was published
    if (!shop.appConfig?.userFirstActions?.firstIntegrationPublishedAt) {
      const firstIntegrationPublishedAt = (
        await Integration.findOne({ shopDomain, publishedAt: { $ne: null } }, 'publishedAt', {
          sort: { publishedAt: 1 },
        })
      )?.publishedAt

      if (firstIntegrationPublishedAt) {
        // Fix: Use $set to update nested field atomically without overwriting appConfig
        await Shop.updateOne(
          { shopDomain },
          { $set: { 'appConfig.userFirstActions.firstIntegrationPublishedAt': firstIntegrationPublishedAt } }
        )
      }
    }

    return shop
  } catch (e) {
    throw new Error(formatErrorMessage(e))
  }
}

/**
 * Get the last updated template and its unpublished integration with mockup and printArea
 * Returns null if template doesn't exist or has no integrations
 *
 * @param shopDomain - Shop domain
 * @returns Object with templateId, integrationId, mockupId, printAreaId or null
 */
export async function getFirstTemplateWithIntegration(
  shopDomain: string
): Promise<{ templateId: string; integrationId: string; mockupId: string; printAreaId: string } | null> {
  try {
    // Query for UNPUBLISHED integration (publishedAt is null), sort by last updated
    const firstIntegration = (await Integration.findOne(
      {
        shopDomain,
        publishedAt: null,
      },
      '_id createdAt publishedAt updatedAt variants'
    )
      .sort({ updatedAt: -1 })
      .lean()) as any

    if (!firstIntegration || !firstIntegration.variants?.length) {
      return null
    }

    // Get first variant from the integration
    const firstVariantId = firstIntegration.variants[0]
    const firstVariant = (await VariantIntegration.findOne(
      { id: firstVariantId },
      '_id mockup printAreas'
    ).lean()) as any

    if (!firstVariant || !firstVariant.mockup || !firstVariant.printAreas?.length) {
      return null
    }

    // Get last updated template
    const firstTemplate = (await Template.findOne({ shopDomain }, '_id createdAt updatedAt', {
      sort: { updatedAt: -1 },
    }).lean()) as any

    if (!firstTemplate) {
      return null
    }

    // Extract mockupId and printAreaId
    const mockupId = typeof firstVariant.mockup === 'string' ? firstVariant.mockup : firstVariant.mockup._id
    const printAreaId = firstVariant.printAreas[0]

    const result = {
      templateId: firstTemplate._id as string,
      integrationId: firstIntegration._id as string,
      mockupId: mockupId as string,
      printAreaId: printAreaId as string,
    }

    return result
  } catch (error) {
    console.error('[getFirstTemplateWithIntegration] Error:', error)
    return null
  }
}

/**
 * Get theme shop config
 *
 * @param context AdminContext
 * @param shopDomain string
 * @returns
 */
export async function getThemeShopConfig(context: AdminContext) {
  const {
    session: { shop: shopDomain },
  } = context

  const subdomain = getMyShopifySubdomainName(shopDomain)

  // Get main theme ID first (required for subsequent calls)
  const themeId = await getMainThemeId(context)

  // Run all theme checks in parallel for maximum performance
  // - checkAppBlockOnProductTemplates: scans ALL product*.json templates, resolves string section refs
  // - getThemeBlocksStatus: combined check for app embed + OneTick helper (1 API call instead of 2)
  const [appBlockCheck, themeBlocksStatus] = await Promise.all([
    checkAppBlockOnProductTemplates(context, themeId),
    getThemeBlocksStatus(context, themeId),
  ])

  const { hasProductTemplates, enabledAppBlock, diagnostics: appBlockDiagnostics } = appBlockCheck

  if (!hasProductTemplates) {
    return {
      isOS2Theme: false,
      productThemeLink: '',
      enabledAppBlock: false,
      enabledAppEmbed: false,
      enabledOneTickHelper: false,
      customizerLink: '',
      themeEditCodeLink: '',
      appEmbedLink: '',
      oneTickHelperLink: '',
    }
  }

  const { enabledAppEmbed, enabledOneTickHelper } = themeBlocksStatus
  const { SHOPIFY_TAILORKIT_ID } = process.env

  const productThemeLink = `https://admin.shopify.com/store/${subdomain}/themes/${themeId}/editor?template=product`

  const linkToEditCode = `https://admin.shopify.com/store/${subdomain}/themes/${themeId}`

  // Generate a link to toggle app block
  // eslint-disable-next-line max-len
  const linkToCustomizeMainTheme = `${productThemeLink}&addAppBlockId=${SHOPIFY_TAILORKIT_ID}/customizer&target=mainSection`

  // Generate a link to activate app embed
  // eslint-disable-next-line max-len
  const linkToActivateAppEmbed = `${productThemeLink}&context=apps&activateAppId=${SHOPIFY_TAILORKIT_ID}/app-embed`

  // Generate a link to activate OneTick/Checkbox theme helper (theme block targets body)
  // eslint-disable-next-line max-len
  const linkToActivateOneTickHelper = `${productThemeLink}&context=apps&activateAppId=${SHOPIFY_TAILORKIT_ID}/theme`

  // Generate links to add TailorKit Checkboxes block (for product and cart pages)
  const cartThemeLink = `https://admin.shopify.com/store/${subdomain}/themes/${themeId}/editor?template=cart`
  // eslint-disable-next-line max-len
  const linkToAddCheckboxBlockProduct = `${productThemeLink}&addAppBlockId=${SHOPIFY_TAILORKIT_ID}/checkbox&target=mainSection`
  // eslint-disable-next-line max-len
  const linkToAddCheckboxBlockCart = `${cartThemeLink}&addAppBlockId=${SHOPIFY_TAILORKIT_ID}/checkbox&target=mainSection`

  return {
    isOS2Theme: true,
    productThemeLink,
    enabledAppBlock,
    enabledAppEmbed,
    enabledOneTickHelper,
    themeEditCodeLink: linkToEditCode,
    customizerLink: linkToCustomizeMainTheme,
    appEmbedLink: linkToActivateAppEmbed,
    oneTickHelperLink: linkToActivateOneTickHelper,
    checkboxBlockLinkProduct: linkToAddCheckboxBlockProduct,
    checkboxBlockLinkCart: linkToAddCheckboxBlockCart,
    // Diagnostics for tracking when app block is not detected (undefined when block is found)
    ...(appBlockDiagnostics && { appBlockDiagnostics }),
  }
}

/**
 * Validates the aiPersonalizerProduct input
 */
export function validatePersonalizerProductData(aiPersonalizerProduct: unknown): boolean {
  return typeof aiPersonalizerProduct === 'boolean'
}

/**
 * Updates personalizer product setting with proper error handling and transaction safety
 */
export async function updateAppMetafields(
  admin: any,
  shopDomain: string,
  appMetafields: { [key: string]: any }
): Promise<{ success: boolean; message?: string }> {
  try {
    const $set: Record<string, any> = {}

    for (const [key, value] of Object.entries(appMetafields)) {
      $set[`appConfig.appMetafields.${key}`] = value
    }

    // Use findOneAndUpdate for better performance - combines find and update operations
    const updatedShop = await Shop.findOneAndUpdate(
      { shopDomain },
      {
        $set,
      },
      {
        new: true, // Return updated document
        projection: { 'appConfig.appMetafields': 1 }, // Only return what we need
      }
    )

    if (!updatedShop) {
      throw new Error(INVALID_SHOP_ERROR)
    }

    // Prepare app metafields for Shopify API
    const updatedAppMetafields = updatedShop.appConfig?.appMetafields || {}

    // Update Shopify app metafield - if this fails, we should handle it gracefully
    try {
      const api = new ShopifyApiClient(admin)
      await api.upsertAppMetafields([
        {
          type: 'json',
          namespace: TAILORKIT_NAMESPACE,
          key: TAILORKIT_APP_SETTINGS,
          value: JSON.stringify(updatedAppMetafields),
        },
      ])
    } catch (shopifyError) {
      // Log the error but don't fail the entire operation
      console.error('Failed to update Shopify app metafield:', shopifyError)

      // Revert the database change if Shopify update fails
      await Shop.findOneAndUpdate(
        { shopDomain },
        {
          $unset: {
            [`appConfig.appMetafields.aiPersonalizerProduct`]: 1,
          },
        }
      )

      throw new Error('Failed to sync with Shopify. Please try again.')
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating personalizer product:', error)
    throw error
  }
}

/**
 * Updates personalizer product setting with proper error handling and transaction safety
 */
export async function updateGlobalStylingToAppMetafields(
  admin: AdminApiContext,
  globalStyling: GlobalStyling
): Promise<{ success: boolean; message?: string }> {
  try {
    // Update Shopify app metafield - if this fails, we should handle it gracefully
    try {
      const api = new ShopifyApiClient(admin)
      await api.upsertAppMetafields([
        {
          type: 'json',
          namespace: TAILORKIT_NAMESPACE,
          key: TAILORKIT_GLOBAL_STYLING,
          value: JSON.stringify(globalStyling),
        },
      ])
    } catch (shopifyError) {
      // Log the error but don't fail the entire operation
      console.error('Failed to update Shopify app metafield global styling:', shopifyError)

      throw new Error('Failed to sync with Shopify. Please try again.')
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating global styling to app metafields:', error)
    throw error
  }
}

/**
 * Updates the appConfig.occurredEvents for a shop in a reusable and flexible way.
 *
 * @param shopDomain - The shop domain to update
 * @param eventName - The event name to update in occurredEvents
 * @param value - The value to update the event to
 * @returns Promise<void>
 */
export async function updateOccurredEvent(shop: string | ShopDocument, eventName: string, value: any): Promise<void> {
  const shopData = typeof shop === 'string' ? await getShopData(shop) : shop
  if (!shopData) {
    throw new Error(INVALID_SHOP_ERROR)
  }

  const occurredEvents = { ...(shopData.appConfig?.occurredEvents || {}) }

  occurredEvents[eventName] = value

  await Shop.updateOne({ shopDomain: shopData.shopDomain }, { $set: { 'appConfig.occurredEvents': occurredEvents } })
}
