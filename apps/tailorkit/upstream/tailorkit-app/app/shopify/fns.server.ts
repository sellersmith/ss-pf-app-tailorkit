import type { SessionData } from '@remix-run/node'
import { mergeDeep } from '~/utils/mergeDeep'
import { getShopifyApiClient, ShopifyApiClient } from './graphql/api.server'
import { appName, appUrl } from './app.server'
import { FULFILLMENT_PROVIDERS, type EPROVIDER } from '~/constants/fulfillment-providers'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import type { AdminApiContext } from '@shopify/shopify-app-remix/server'
import type { DeliveryProfile } from './graphql/types'
import { chunkArray } from '~/utils/chunkArray'
import { isShopReInstalled } from '~/models/Shop.server'

/** Shopify theme asset with key identifier and optional JSON/text value */
interface ShopifyAsset {
  key: string
  value?: string | null
}

/** Response shape from Shopify REST Asset.all() */
interface AssetListResponse {
  data?: Array<{ key: string }>
}

type Asset = ShopifyAsset | null

/**
 * Represents a Shopify theme block structure
 */
interface ThemeBlock {
  type?: string
  disabled?: boolean
  blocks?: { [key: string]: ThemeBlock } | ThemeBlock[]
  settings?: Record<string, any>
}

/**
 * Represents the blocks collection in a theme section
 */
type BlocksCollection = { [key: string]: ThemeBlock } | ThemeBlock[]

/**
 * Recursively checks if a TailorKit block is enabled in the given blocks structure.
 * This handles both regular theme blocks and nested blocks in the Horizontal theme.
 *
 * @param blocks - The blocks object to search through (can be an object or array of blocks)
 * @param tailorKitId - The TailorKit app ID to search for
 * @returns true if an enabled TailorKit block is found, false otherwise
 */
export function hasEnabledTailorKitBlockRecursive(
  blocks: BlocksCollection | null | undefined,
  tailorKitId: string
): boolean {
  if (!blocks || typeof blocks !== 'object') {
    return false
  }

  // Convert blocks to array of values if it's an object
  const blockValues: ThemeBlock[] = Array.isArray(blocks) ? blocks : Object.values(blocks)

  for (const block of blockValues) {
    if (!block || typeof block !== 'object') {
      continue
    }

    // Check if current block is a TailorKit block (match by extension UUID or app handle)
    const appHandle = process.env.APP_HANDLE || process.env.APP_NAME
    const isTailorKitBlock
      = typeof block.type === 'string'
      && (block.type.includes(tailorKitId) || (appHandle && block.type.includes(`apps/${appHandle}/`)))
      && !block.disabled

    if (isTailorKitBlock) {
      return true
    }

    // Recursively check nested blocks (for Horizontal theme and similar structures)
    if (block.blocks && typeof block.blocks === 'object') {
      const hasNestedTailorKitBlock = hasEnabledTailorKitBlockRecursive(block.blocks, tailorKitId)
      if (hasNestedTailorKitBlock) {
        return true
      }
    }
  }

  return false
}

/**
 * Diagnostic info about theme structure — sent to analytics when app block is not detected.
 */
export interface AppBlockDiagnostics {
  /** Product template files found (e.g. ["templates/product.json", "templates/product.prestige.json"]) */
  productTemplateKeys: string[]
  /** Per-template section layout: maps template key → array of {key, type} for each section entry */
  sectionLayouts: Record<string, Array<{ key: string; valueType: 'object' | 'string' | 'other' }>>
}

/**
 * Result of checking app block status across product templates.
 */
export interface AppBlockCheckResult {
  /** True when the theme has at least one `templates/product*.json` file (OS2 theme). */
  hasProductTemplates: boolean
  /** True when an enabled TailorKit block was found in any product template. */
  enabledAppBlock: boolean
  /** Theme structure diagnostics — populated when enabledAppBlock is false for debugging. */
  diagnostics?: AppBlockDiagnostics
}

/**
 * Checks ALL product-template JSON files in the active theme for an enabled
 * TailorKit block.  Also resolves string section references (e.g. themes that
 * use `"main": "main-product"` pointing to `sections/main-product.json`).
 */
export async function checkAppBlockOnProductTemplates(
  context: { admin: AdminApiContext; session: SessionData },
  themeId?: string
): Promise<AppBlockCheckResult> {
  const result: AppBlockCheckResult = { hasProductTemplates: false, enabledAppBlock: false }

  try {
    const { admin, session } = context

    const { SHOPIFY_TAILORKIT_ID } = process.env
    if (!SHOPIFY_TAILORKIT_ID) return result

    // Resolve the main theme once so we can list its assets.
    themeId = themeId || (await getMainThemeId(context))

    // 1) Retrieve a list of *all* assets for the theme (keys only to minimise payload)
    const assetsListResp = await admin.rest.resources.Asset.all({
      session,
      theme_id: themeId,
      fields: 'key',
    })

    const assetKeys: string[] = ((assetsListResp as AssetListResponse)?.data || []).map(a => a.key)

    // 2) Keep only product-template JSON files (e.g. templates/product.json, templates/product.custom.json)
    //    Must match "templates/product.json" or "templates/product.<name>.json" — exclude "templates/products.json" etc.
    const productTemplateKeys = assetKeys.filter(
      key => (key === 'templates/product.json' || key.startsWith('templates/product.')) && key.endsWith('.json')
    )

    result.hasProductTemplates = productTemplateKeys.length > 0
    if (!result.hasProductTemplates) return result

    // Build a set of section file keys for quick lookup when resolving string references
    const sectionKeySet = new Set(assetKeys.filter(key => key.startsWith('sections/') && key.endsWith('.json')))

    // Collect diagnostics for debugging when block is not found
    const sectionLayouts: AppBlockDiagnostics['sectionLayouts'] = {}

    // 3) Iterate through each template, checking whether the TailorKit block is enabled.
    //    Bail out early as soon as we find one that is enabled.
    for (const key of productTemplateKeys) {
      const templateAsset = await getThemeAsset(context, key, themeId)
      if (!templateAsset?.value) continue

      let settings: any
      try {
        settings = JSON.parse(templateAsset.value)
      } catch (parseErr) {
        console.warn(`Failed to parse JSON for asset ${key}:`, parseErr)
        continue
      }

      // Check all sections for TailorKit blocks
      const sections = settings?.sections || {}
      const layoutEntries: Array<{ key: string; valueType: 'object' | 'string' | 'other' }> = []

      for (const [sectionKey, section] of Object.entries(sections) as [string, any][]) {
        // Handle string section references (e.g. "main-product" → sections/main-product.json)
        if (typeof section === 'string') {
          layoutEntries.push({ key: sectionKey, valueType: 'string' })
          const sectionFileKey = `sections/${section}.json`
          if (sectionKeySet.has(sectionFileKey)) {
            const resolved = await resolveAndCheckSectionFile(context, sectionFileKey, SHOPIFY_TAILORKIT_ID, themeId)
            if (resolved) {
              result.enabledAppBlock = true
              return result
            }
          }
          continue
        }

        if (!section || typeof section !== 'object') {
          layoutEntries.push({ key: sectionKey, valueType: 'other' })
          continue
        }

        layoutEntries.push({ key: sectionKey, valueType: 'object' })
        const blocks = section.blocks || {}
        if (hasEnabledTailorKitBlockRecursive(blocks, SHOPIFY_TAILORKIT_ID)) {
          result.enabledAppBlock = true
          return result
        }
      }

      sectionLayouts[key] = layoutEntries
    }

    // Block not found — attach diagnostics for tracking
    result.diagnostics = { productTemplateKeys, sectionLayouts }
    return result
  } catch (e) {
    console.error('Error while checking TailorKit block status on product templates:', e)
    return result
  }
}

/**
 * Loads a section JSON file and checks whether it contains an enabled TailorKit block.
 * Used to resolve string section references in product templates.
 */
async function resolveAndCheckSectionFile(
  context: { admin: AdminApiContext; session: SessionData },
  sectionKey: string,
  tailorKitId: string,
  themeId?: string
): Promise<boolean> {
  try {
    const sectionAsset = await getThemeAsset(context, sectionKey, themeId)
    if (!sectionAsset?.value) return false

    const sectionData = JSON.parse(sectionAsset.value)
    const blocks = sectionData?.blocks || {}
    return hasEnabledTailorKitBlockRecursive(blocks, tailorKitId)
  } catch (error) {
    console.error(`[TK] Failed to resolve section ${sectionKey}:`, error)
    return false
  }
}

/** @deprecated Use `checkAppBlockOnProductTemplates` instead. */
export async function isAppBlockEnabledOnDefaultProductTemplate(
  context: { admin: AdminApiContext; session: SessionData },
  asset?: Asset
): Promise<boolean> {
  const { enabledAppBlock } = await checkAppBlockOnProductTemplates(context)
  return enabledAppBlock
}

export async function isAppEmbedEnabledOnTheme(
  context: { admin: AdminApiContext; session: SessionData },
  themeId?: string
): Promise<boolean> {
  try {
    // Get the settings_data.json asset which contains app embed status
    const asset = await getThemeAsset(context, 'config/settings_data.json', themeId)

    if (!asset?.value) {
      return false
    }

    const { SHOPIFY_TAILORKIT_ID } = process.env

    if (!SHOPIFY_TAILORKIT_ID) {
      return false
    }

    // Safely parse JSON with proper error handling
    let settings: any
    try {
      settings = JSON.parse(asset.value)
    } catch (jsonError) {
      console.error('Failed to parse settings_data.json:', jsonError)
      return false
    }

    // Safely access nested properties with proper checks
    const current = settings?.current
    if (!current || typeof current !== 'object') {
      return false
    }

    const blocks = current.blocks
    if (!blocks || typeof blocks !== 'object') {
      return false
    }

    if (Object.keys(blocks).length === 0) {
      return false
    }

    // Find TailorKit app embed blocks with more flexible criteria
    const tailorKitEmbedBlocks = Object.entries(blocks).filter(([key, block]: [string, any]) => {
      // Ensure block is valid object with type property
      if (!block || typeof block !== 'object' || typeof block.type !== 'string') {
        return false
      }

      // Check if the block type contains our app ID (or app handle) and is an app embed
      const appHandle = process.env.APP_HANDLE || process.env.APP_NAME
      const containsAppId
        = block.type.includes(SHOPIFY_TAILORKIT_ID!) || (appHandle && block.type.includes(`apps/${appHandle}/`))
      const isAppEmbed = block.type.includes('/app-embed') || block.type.includes('/blocks/app-embed')

      return containsAppId && isAppEmbed
    })

    if (tailorKitEmbedBlocks.length === 0) {
      return false
    }

    // Check if any app embed block is enabled (not disabled)
    const enabledEmbedBlock = tailorKitEmbedBlocks.find(([key, block]) => {
      return !(block as any).disabled
    })

    return !!enabledEmbedBlock
  } catch (e) {
    console.error('Error checking app embed status:', e)
    return false
  }
}

/**
 * Check if the OneTick/Checkbox theme helper (theme.liquid block) is enabled on the current theme.
 * This is different from the app embed - this checks the "TailorKit Up-sale Helper" block
 * which is required for checkboxes to function properly.
 */
export async function isOneTickHelperEnabledOnTheme(
  context: { admin: AdminApiContext; session: SessionData },
  themeId?: string
): Promise<boolean> {
  try {
    // Get the settings_data.json asset which contains block status
    const asset = await getThemeAsset(context, 'config/settings_data.json', themeId)

    if (!asset?.value) {
      return false
    }

    const { SHOPIFY_TAILORKIT_ID } = process.env

    if (!SHOPIFY_TAILORKIT_ID) {
      return false
    }

    // Safely parse JSON with proper error handling
    let settings: any
    try {
      settings = JSON.parse(asset.value)
    } catch (jsonError) {
      console.error('Failed to parse settings_data.json:', jsonError)
      return false
    }

    // Safely access nested properties with proper checks
    const current = settings?.current
    if (!current || typeof current !== 'object') {
      return false
    }

    const blocks = current.blocks
    if (!blocks || typeof blocks !== 'object') {
      return false
    }

    if (Object.keys(blocks).length === 0) {
      return false
    }

    // Find TailorKit Up-sale Helper blocks (theme.liquid) - targets body, not app-embed
    const themeHelperBlocks = Object.entries(blocks).filter(([key, block]: [string, any]) => {
      // Ensure block is valid object with type property
      if (!block || typeof block !== 'object' || typeof block.type !== 'string') {
        return false
      }

      // Check if the block type contains our app ID and is the theme block (not app-embed)
      const containsAppId = block.type.includes(SHOPIFY_TAILORKIT_ID)
      const isThemeBlock = block.type.includes('/blocks/theme')

      return containsAppId && isThemeBlock
    })

    if (themeHelperBlocks.length === 0) {
      return false
    }

    // Check if any theme helper block is enabled (not disabled)
    const enabledThemeBlock = themeHelperBlocks.find(([key, block]) => {
      return !(block as any).disabled
    })

    return !!enabledThemeBlock
  } catch (e) {
    console.error('Error checking OneTick helper status:', e)
    return false
  }
}

/**
 * Combined function to check both app embed and OneTick helper status in a single API call.
 * This is more efficient than calling isAppEmbedEnabledOnTheme and isOneTickHelperEnabledOnTheme separately
 * since they both fetch the same settings_data.json file.
 */
export async function getThemeBlocksStatus(
  context: { admin: AdminApiContext; session: SessionData },
  themeId?: string
): Promise<{ enabledAppEmbed: boolean; enabledOneTickHelper: boolean }> {
  const result = { enabledAppEmbed: false, enabledOneTickHelper: false }

  try {
    // Get the settings_data.json asset which contains both app embed and theme block status
    const asset = await getThemeAsset(context, 'config/settings_data.json', themeId)

    if (!asset?.value) {
      return result
    }

    const { SHOPIFY_TAILORKIT_ID } = process.env

    if (!SHOPIFY_TAILORKIT_ID) {
      return result
    }

    // Safely parse JSON with proper error handling
    let settings: any
    try {
      settings = JSON.parse(asset.value)
    } catch (jsonError) {
      console.error('Failed to parse settings_data.json:', jsonError)
      return result
    }

    // Safely access nested properties with proper checks
    const current = settings?.current
    if (!current || typeof current !== 'object') {
      return result
    }

    const blocks = current.blocks
    if (!blocks || typeof blocks !== 'object' || Object.keys(blocks).length === 0) {
      return result
    }

    // Check both app embed and OneTick helper in a single pass through blocks
    for (const [, block] of Object.entries(blocks)) {
      if (!block || typeof block !== 'object' || typeof (block as any).type !== 'string') {
        continue
      }

      const blockType = (block as any).type
      const isDisabled = (block as any).disabled
      const containsAppId = blockType.includes(SHOPIFY_TAILORKIT_ID)

      if (!containsAppId) continue

      // Check for app embed
      if (!result.enabledAppEmbed) {
        const isAppEmbed = blockType.includes('/app-embed') || blockType.includes('/blocks/app-embed')
        if (isAppEmbed && !isDisabled) {
          result.enabledAppEmbed = true
        }
      }

      // Check for OneTick helper (theme block)
      if (!result.enabledOneTickHelper) {
        const isThemeBlock = blockType.includes('/blocks/theme')
        if (isThemeBlock && !isDisabled) {
          result.enabledOneTickHelper = true
        }
      }

      // Early exit if both are found
      if (result.enabledAppEmbed && result.enabledOneTickHelper) {
        break
      }
    }

    return result
  } catch (e) {
    console.error('Error checking theme blocks status:', e)
    return result
  }
}

/**
 * Common section keys used by Shopify themes for the main product section.
 * Ordered by popularity — the first match wins.
 */
const PRODUCT_SECTION_KEY_CANDIDATES = [
  'main',
  'main-product',
  'product',
  'product-main',
  'main_product',
  'product-template',
  'product-section',
  'featured-product',
] as const

/**
 * Finds the main product section key in a parsed product template.
 * Checks common section key patterns used by various Shopify themes.
 */
export function findProductSectionKey(sections: Record<string, any>): string | null {
  if (!sections || typeof sections !== 'object') return null

  // 1) Check common known section keys first
  for (const candidate of PRODUCT_SECTION_KEY_CANDIDATES) {
    if (sections[candidate] && typeof sections[candidate] === 'object') {
      return candidate
    }
  }

  // 2) Fuzzy match: any key containing "product" or "main" (object sections only)
  for (const key of Object.keys(sections)) {
    if (typeof sections[key] !== 'object' || !sections[key]) continue
    if (key.includes('product') || key === 'main') {
      return key
    }
  }

  // 3) Fallback: first object-type section
  for (const key of Object.keys(sections)) {
    if (typeof sections[key] === 'object' && sections[key]) {
      return key
    }
  }

  return null
}

export async function toggleAppBlockOnDefaultProductTemplate(
  context: { admin: AdminApiContext; session: SessionData },
  enable: boolean,
  asset?: Asset
): Promise<void> {
  // Try to find any product template (not just the default one)
  if (!asset) {
    asset = await getThemeAsset(context, 'templates/product.json')

    // If default product.json doesn't exist, find a custom-named one
    if (!asset) {
      const themeId = await getMainThemeId(context)
      const assetsListResp = await context.admin.rest.resources.Asset.all({
        session: context.session,
        theme_id: themeId,
        fields: 'key',
      })
      const assetKeys: string[] = ((assetsListResp as AssetListResponse)?.data || []).map(a => a.key)
      const productTemplateKey = assetKeys.find(
        key => (key === 'templates/product.json' || key.startsWith('templates/product.')) && key.endsWith('.json')
      )
      if (productTemplateKey) {
        asset = await getThemeAsset(context, productTemplateKey, themeId)
      }
    }
  }

  if (!asset) {
    console.warn('No product template found to toggle app block')
    return
  }

  /**
   * The TailorKit app needs to be granted permission to use Shopify's Asset API, which is
   * required to enable/disable the TailorKit extension programmatically. If the permission
   * is lacking, merchants need to add the TailorKit extension manually.
   *
   * @see https://shopify.dev/docs/api/admin-rest/2025-10/resources/asset
   * @see https://shopify.dev/docs/apps/build/online-store/asset-legacy
   */
  const slug = await getAppSlug(context.admin)

  // Detect the correct section key from the existing template structure
  const existingSettings = JSON.parse(asset?.value || '{}')
  const sectionKey = findProductSectionKey(existingSettings?.sections || {}) || 'main'

  asset.value = JSON.stringify(
    mergeDeep(existingSettings, {
      sections: {
        [sectionKey]: {
          blocks: {
            [slug]: {
              type: `shopify://apps/${slug}/blocks/customizer/${process.env.SHOPIFY_TAILORKIT_ID}`,
              disabled: !enable,
              settings: {},
            },
          },
        },
      },
    })
  )

  await asset.save()
}

/**
 * Create TailorKit Delivery Profile in Shopify Admin
 * @param admin
 */
export async function createTailorKitDeliveryProfile(admin: AdminApiContext, shopDomain: string) {
  try {
    const api = new ShopifyApiClient(admin)

    // Cleanup delivery profiles before creating a new one if exists
    await cleanupDeliveryProfiles(admin, shopDomain)

    // Create an empty delivery profile by default
    const result = await api.createDeliveryProfile({ name: appName })

    return result
  } catch (e) {
    if (e instanceof Error && e.message.includes('Name has already been taken')) {
      console.log('Delivery profile already exists for shop', shopDomain)
      return
    }
    console.log(e)
  }
}

/**
 * @description
 * Subscribe TailorKit app as a fulfillment service app
 * A fulfillment service fulfills orders that a merchant or another app requests.
 * Each fulfillment service has a dedicated location.
 * When we create a fulfillment service, Shopify automatically creates a new location for it.
 * At this time, each line_item in order will be grouped and come from TailorKit location/fulfillment
 * @see https://prnt.sc/X0QR6PJvrf2q
 * @param admin
 * @returns
 */
export async function subscribeTailorKitFulfillmentService(admin: AdminApiContext, fulfillmentProviderName: EPROVIDER) {
  try {
    const api = new ShopifyApiClient(admin)

    /**
     * @example TailorKit - Printify
     */
    const fulfillmentServiceName = getFulfillmentServiceName(appName, fulfillmentProviderName)
    const fulfillmentServiceCallbackUrl = `${appUrl}/api/fulfillment-services/${fulfillmentProviderName}`

    const fulfillmentServices = await api.receiveAListOfAllFulfillmentService()

    const isExistedFulfillmentService = fulfillmentServices.find(
      (service: { id: string; serviceName: string; callbackUrl: string }) =>
        service.serviceName === fulfillmentServiceName && service.callbackUrl === fulfillmentServiceCallbackUrl
    )

    if (isExistedFulfillmentService) return true

    // Create fulfillment service
    const data = await api.createFulfillmentService({
      name: fulfillmentServiceName,
      callbackUrl: fulfillmentServiceCallbackUrl,
      inventoryManagement: true,
      trackingSupport: true,
    })

    return data
  } catch (e) {
    console.log(e)

    throw new Error(formatErrorMessage(e))
  }
}

/**
 * @description Get fulfillment service name on Shopify
 * @param appName
 * @param fulfillmentProviderName
 * @returns
 */
export function getFulfillmentServiceName(appName: string, fulfillmentProviderName: string, isSlug = false) {
  const fulfillmentServiceName = `${appName} x ${fulfillmentProviderName}`

  // When a slug version is requested, leverage the existing `stringToSlug` utility
  // to ensure we produce a clean, single-hyphen-separated slug (e.g. converts
  // "TailorKit - Dev App x Printify" → "tailorkit-dev-app-x-printify").
  return isSlug ? stringToSlug(fulfillmentServiceName) : fulfillmentServiceName
}

/**
 * @description Cleanup delivery profiles
 * @param admin
 */
export async function cleanupDeliveryProfiles(admin: AdminApiContext, shopDomain: string) {
  // Only check and clean up if the shop reInstall
  const _isShopReInstalled = await isShopReInstalled(shopDomain)
  if (!_isShopReInstalled) return

  const api = new ShopifyApiClient(admin)
  // Get all delivery profiles
  const deliveryProfiles = await api.getAllDeliveryProfiles()

  const deliveryProfilePrefix = FULFILLMENT_PROVIDERS.map(provider => getFulfillmentServiceName(appName, provider))
  // Filter delivery profiles by start with service name
  const deliveryProfilesToDelete = deliveryProfiles.filter((deliveryProfile: DeliveryProfile) =>
    deliveryProfilePrefix.some(prefix => deliveryProfile.name.startsWith(prefix))
  )

  // Chunk delivery profiles to delete
  const deliveryProfilesToDeleteChunks = chunkArray(deliveryProfilesToDelete, 10)

  for (const deliveryProfilesToDeleteChunk of deliveryProfilesToDeleteChunks) {
    await Promise.all(
      deliveryProfilesToDeleteChunk.map(async (deliveryProfile: DeliveryProfile & { id: string }) => {
        try {
          await api.deliveryProfileRemove(deliveryProfile.id)
        } catch (e) {
          console.error(`Error while deleting delivery profile ${deliveryProfile.name}`, e)
        }
      })
    )
  }
}

export async function getDefaultProductTemplate(
  context: { admin: AdminApiContext; session: SessionData },
  themeId?: string
): Promise<Asset> {
  return getThemeAsset(context, 'templates/product.json', themeId)
}

export async function getThemeAsset(
  context: { admin: AdminApiContext; session: SessionData },
  assetKey: string,
  themeId?: string
): Promise<Asset> {
  try {
    const { admin, session } = context

    // Get theme ID
    themeId = themeId || (await getMainThemeId(context))

    // Get theme asset
    const result = await admin.rest.resources.Asset.all({
      session,
      theme_id: themeId,
      asset: { key: assetKey },
    })

    return result.data?.[0]
  } catch (error) {
    console.warn('Error while getting theme asset')
    return null
  }
}

export async function getMainThemeId(context: { admin: AdminApiContext; session: SessionData }) {
  const { admin, session } = context

  const result = await admin.rest.resources.Theme.all({ session })
  const theme = result.data?.find((theme: any) => theme.role === 'main')

  return theme.id
}

export async function getAppSlug(admin: AdminApiContext): Promise<string> {
  // Get app info
  const api = new ShopifyApiClient(admin)

  return stringToSlug(await api.getAppTitle())
}

export async function getAppHandle(shopDomain: string, admin?: AdminApiContext): Promise<string> {
  if (process.env.APP_HANDLE) {
    return process.env.APP_HANDLE
  }

  // Get app info
  const api = await getShopifyApiClient(shopDomain, admin)

  return api.getAppHandle()
}

export function stringToSlug(str: string, replacement = '-', replaceInvalid = ''): string {
  str = str.replace(/^\s+|\s+$/g, '').toLowerCase()

  // Remove accents, swap ñ for n, etc.
  const from: string = 'àáãäâèéëêìíïîòóöôùúüûñç·/_,:;'
  const to: string = 'aaaaaeeeeiiiioooouuuunc------'

  for (let i = 0, l = from.length; i < l; i++) {
    str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i))
  }

  str = str
    .replace(/[^a-z0-9 -]/g, replaceInvalid)
    .replace(/\s+/g, '-')
    .replace(/-+/g, replacement)

  return str
}

/**
 * Check if a shop has accepted all required scopes
 * @param shopDomain The shop's domain
 * @returns Promise<boolean> True if all scopes are accepted, false otherwise
 */
export async function hasRequiredScopes(shopDomain: string): Promise<boolean> {
  try {
    const api = await getShopifyApiClient(shopDomain)
    // Make a test API call that requires various scopes
    await Promise.all([
      api.getAppId(), // Basic app info
      api.getProducts({ first: 1 }), // Product access
      api.getWebhooks(), // Webhook access
      api.getAllDeliveryProfiles(), // Shipping access
    ])
    return true
  } catch (error) {
    console.log('Scope check failed:', error)
    return false
  }
}
