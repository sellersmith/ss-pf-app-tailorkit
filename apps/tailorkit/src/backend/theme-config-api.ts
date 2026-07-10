// TailorKit backend code must access Shopify theme state only through app-platform ports.
import type {
  AppBackendRegisterContext,
  AppContext,
  ThemeSurfaceContribution,
} from '../../../../web/server/src/app-platform/contracts'
import { TAILORKIT_CAPABILITIES } from '../domain/capabilities'
import { TAILORKIT_HIDDEN_PRICING_PRODUCT } from '../domain/hidden-pricing-product-config'
import { readTailorKitAppSettings } from './app-settings-repository'

// The upstream client trigger that fired /api/option-pricing (storefront-setup "Sales" tab →
// UpsellPricingPersonalization → InstallAppEmbedActivator.onThemeExtensionEnabled) is NOT ported into the
// PageFly admin shell (only the storefront + ai-tools tabs are), so the hidden pricing product was never
// provisioned. Provision it server-side instead: once the merchant has enabled the app embed, ensure the
// product exists via the idempotent host capability. Fire-and-forget + once-per-process-per-shop so we
// never block the theme-config response nor re-publish on every admin load.
const ensuredHiddenPricingShops = new Set<string>()

function ensureHiddenPricingProductWhenEmbedEnabled(
  app: AppBackendRegisterContext,
  ctx: AppContext,
  enabledAppEmbed: boolean
): void {
  const shopKey = ctx.shopDomain
  if (!enabledAppEmbed || !shopKey || ensuredHiddenPricingShops.has(shopKey)) return

  ensuredHiddenPricingShops.add(shopKey)
  void app.ports.shopifyResources
    .ensureHiddenPricingProduct(ctx, { ...TAILORKIT_HIDDEN_PRICING_PRODUCT })
    .catch((error: unknown) => {
      // Retry on the next admin load if provisioning failed (e.g. transient Shopify error / server not
      // yet carrying the host capability).
      ensuredHiddenPricingShops.delete(shopKey)
      console.warn('[TailorKit] ensureHiddenPricingProduct failed:', error)
    })
}

export interface TailorKitThemeConfig {
  isOS2Theme: boolean
  productThemeLink: string
  enabledAppEmbed: boolean
  enabledAppBlock: boolean
  themeEditCodeLink: string
  appEmbedLink: string
  customizerLink: string
  /** Persisted storefront settings the Storefront tab form loads (`appConfig.appMetafields`). */
  appMetafields: Record<string, unknown>
}

export interface TailorKitThemeConfigResponse {
  success: true
  appConfig: TailorKitThemeConfig
}

export const emptyThemeConfig: TailorKitThemeConfig = {
  isOS2Theme: false,
  productThemeLink: '',
  enabledAppEmbed: false,
  enabledAppBlock: false,
  themeEditCodeLink: '',
  appEmbedLink: '',
  customizerLink: '',
  appMetafields: {},
}

function generatedHandle(generatedName?: string): string {
  return String(generatedName || '').replace(/\.liquid$/, '')
}

function themeEditorDeepLinkAppId(): string {
  return process.env.SHOPIFY_API_KEY || process.env.SHOPIFY_PAGEFLY_THEME_HELPER_ID || ''
}

function shopAdminSubdomain(shopDomain: string): string {
  return shopDomain.replace(/\.myshopify\.com$/i, '').split('.')[0]
}

function themeIdForUrl(id: string | number): string {
  const value = String(id)
  return value.includes('/') ? value.split('/').filter(Boolean).pop() || value : value
}

function productTemplateKeys(assetKeys: string[]): string[] {
  return assetKeys.filter(key => /^templates\/product(?:\.[^/]+)?\.json$/.test(key))
}

/**
 * Detects whether a TailorKit app-embed block is enabled in the merchant's current theme, by reading
 * `config/settings_data.json` and scanning `settings.current.blocks` (OS2 themes store their enabled
 * app embeds there — top-level `current.blocks` entries ARE the app-embed blocks).
 *
 * A block is considered "ours" when its `type` string (e.g. `shopify://apps/<app>/blocks/<handle>/<uuid>`)
 * includes one of the known TailorKit identifiers (raw embed generatedName, its sanitized handle, or the
 * deep-link app id). If none of those identifiers resolved, fall back to a generic app-embed shape check
 * (`/app-embed` or `/blocks/app-embed` in the type) so detection never hard-fails — this is a looser match
 * and may pick up other apps' embeds, but only triggers when we have no better signal.
 *
 * Never throws: any failure (missing asset, malformed JSON, unexpected shape) resolves to `false`.
 */
async function detectTailorKitAppEmbedEnabled(
  app: AppBackendRegisterContext,
  ctx: AppContext,
  identifiers: { generatedName?: string; embedHandle?: string; deepLinkAppId?: string }
): Promise<boolean> {
  try {
    const asset = await app.ports.shopifyTheme.getAsset(ctx, 'config/settings_data.json')
    if (!asset?.value) return false

    const settings = JSON.parse(asset.value)
    const blocks = settings?.current?.blocks
    if (!blocks || typeof blocks !== 'object') return false

    const identifierMatchers = [identifiers.generatedName, identifiers.embedHandle, identifiers.deepLinkAppId].filter(
      (value): value is string => Boolean(value)
    )

    const isTailorKitEmbedBlockType = (type: string): boolean =>
      identifierMatchers.length > 0
        ? identifierMatchers.some(matcher => type.includes(matcher))
        : type.includes('/app-embed') || type.includes('/blocks/app-embed')

    return Object.values(blocks as Record<string, unknown>).some(block => {
      if (!block || typeof block !== 'object') return false
      const { type, disabled } = block as { type?: unknown; disabled?: unknown }
      return typeof type === 'string' && isTailorKitEmbedBlockType(type) && !disabled
    })
  } catch {
    return false
  }
}

export async function getTailorKitThemeConfig(
  ctx: AppContext,
  app: AppBackendRegisterContext,
  themeSurfaces?: ThemeSurfaceContribution
): Promise<TailorKitThemeConfig> {
  // Storefront-tab settings the form loads via `appConfig.appMetafields`. Read independently of theme
  // state so saved settings survive even when no main theme is resolvable.
  const appSettings = await readTailorKitAppSettings(app.ports, ctx)
  const appMetafields = appSettings?.appMetafields || {}

  const mainTheme = await app.ports.shopifyTheme.getMainTheme(ctx)
  if (!mainTheme?.id) return { ...emptyThemeConfig, appMetafields }

  // Key-only listing (Shopify `fields=key`) for OS2 detection — avoids the
  // multi-megabyte full-asset payload of listAssets. The merchant-facing app
  // block install check (enabledAppBlock) was dropped: upstream now relies on a
  // storefront fallback injector for missing blocks (TailorKit HeaderBar), and
  // PageFly surfaces personalization through an editor element, so dredging every
  // product template + section to detect an installed block is unnecessary cost.
  const assetKeys = await app.ports.shopifyTheme.listAssetKeys(ctx)
  const isOS2Theme = productTemplateKeys(assetKeys).length > 0
  const themeId = themeIdForUrl(mainTheme.id)
  const shopSubdomain = shopAdminSubdomain(ctx.shopDomain)
  const productThemeLink = `https://admin.shopify.com/store/${shopSubdomain}/themes/${themeId}/editor?template=product`
  const themeEditCodeLink = `https://admin.shopify.com/store/${shopSubdomain}/themes/${themeId}`
  const deepLinkAppId = themeEditorDeepLinkAppId()
  const embedHandle = generatedHandle(themeSurfaces?.appEmbeds?.[0]?.generatedName)
  const customizerHandle = generatedHandle(themeSurfaces?.appBlocks?.[0]?.generatedName)
  const canDeepLinkAppEmbed = Boolean(isOS2Theme && deepLinkAppId && embedHandle)
  const canDeepLinkCustomizer = Boolean(isOS2Theme && deepLinkAppId && customizerHandle)

  // App-block install detection stays removed: PageFly hosts the personalization surface directly and the
  // merchant-facing "set up your storefront" modal that consumed enabledAppBlock is gone, so dredging every
  // product template + section for a block is unnecessary cost.
  // App-embed detection IS required: the admin `InstallAppEmbedActivator` / `UpsellPricingPersonalization`
  // gate hidden-pricing-product provisioning (`/api/option-pricing` ENSURE_PRICING_PRODUCT) on
  // appConfig.enabledAppEmbed, so it must reflect real theme state. This adds one Shopify call
  // (settings_data.json) on top of the existing asset-keys call.
  const enabledAppEmbed = await detectTailorKitAppEmbedEnabled(app, ctx, {
    generatedName: themeSurfaces?.appEmbeds?.[0]?.generatedName,
    embedHandle,
    deepLinkAppId,
  })

  return {
    isOS2Theme,
    productThemeLink,
    enabledAppEmbed,
    enabledAppBlock: false,
    themeEditCodeLink,
    appEmbedLink: canDeepLinkAppEmbed
      ? `${productThemeLink}&context=apps&activateAppId=${deepLinkAppId}/${embedHandle}`
      : productThemeLink,
    customizerLink: canDeepLinkCustomizer
      ? `${productThemeLink}&addAppBlockId=${deepLinkAppId}/${customizerHandle}&target=mainSection`
      : productThemeLink,
    appMetafields,
  }
}

export function registerTailorKitThemeConfigApi(app: AppBackendRegisterContext): void {
  app.api.route({
    method: 'GET',
    path: '/theme-config',
    capability: TAILORKIT_CAPABILITIES.readThemeConfig,
    async handler(request) {
      const appConfig = await getTailorKitThemeConfig(request.context, app, app.app.manifest.themeSurfaces)
      // Server-side provisioning of the hidden pricing product (the ported admin has no client trigger).
      ensureHiddenPricingProductWhenEmbedEnabled(app, request.context, appConfig.enabledAppEmbed)
      return { body: { success: true, appConfig } satisfies TailorKitThemeConfigResponse }
    },
  })
}
