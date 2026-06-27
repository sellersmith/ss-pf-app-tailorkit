// TailorKit backend code must access Shopify theme state only through app-platform ports.
import type {
  AppBackendRegisterContext,
  AppContext,
  ThemeSurfaceContribution,
} from '../../../../web/server/src/app-platform/contracts'
import { TAILORKIT_CAPABILITIES } from '../domain/capabilities'
import { readTailorKitAppSettings } from './app-settings-repository'

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

  // App-embed / app-block install detection removed: PageFly hosts the personalization surface and the
  // merchant-facing "set up your storefront" modal that consumed enabledAppEmbed is gone. Skipping the
  // settings_data.json fetch + block scan collapses this probe from 3 Shopify calls to 1 (asset keys for
  // OS2 detection). The deep-link fields are kept (cheap string builds) for any non-blocking link surface.
  return {
    isOS2Theme,
    productThemeLink,
    enabledAppEmbed: false,
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
      return { body: { success: true, appConfig } satisfies TailorKitThemeConfigResponse }
    },
  })
}
