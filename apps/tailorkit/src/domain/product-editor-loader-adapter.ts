import type { TailorKitIntegrationRecord } from './product-personalizer'
import { TAILORKIT_PROPERTY_PREFIX } from './order-property-matchers'

export const tailorkitProductEditorUpstreamLoaderSource = 'app/routes/personalized-products.$id/route.tsx'
export const tailorkitProductEditorLoaderDataKeys = [
  'id',
  'mockupId',
  'integration',
  'tab',
  'printAreaId',
  'templateId',
  'viewId',
] as const
export const tailorkitProductEditorRootLoaderDataKeys = [
  'isDealActive',
  'isDealEligible',
  'PROPERTY_PREFIX',
  'PUBLIC_ENV',
  'shopData',
] as const
export const tailorkitProductEditorLoaderSearchParams = [
  'mockup',
  'tab',
  'printAreaId',
  'templateId',
  'viewId',
] as const
export const tailorkitProductEditorLoaderDataSource = {
  routePrefix: '/api/integrations/',
  mockupParam: 'mockup',
  populateTemplateParam: 'populateTemplate',
  populateTemplateValue: '1',
} as const

export interface TailorKitProductEditorLoaderQuery {
  mockup?: unknown
  mockupId?: unknown
  tab?: unknown
  printAreaId?: unknown
  templateId?: unknown
  viewId?: unknown
}

export interface TailorKitProductEditorRootLoaderInput {
  shopDomain: string
  currency?: string
  locale?: string
  timezone?: string
  /** Shopify money format string. Optional — defaults to `${{amount}}` when the host has none. */
  moneyFormat?: string
  appHandle?: string
  baseUrl?: string
  storeAssetDomain?: string
  planName?: string
  planTier?: string
  subscriptionGeneration?: number
  appConfig?: Partial<TailorKitProductEditorRootAppConfig>
}

export interface TailorKitProductEditorRootAppConfig {
  appPlatformSubscriptionGeneration?: number
  isOS2Theme?: boolean
  productThemeLink?: string
  enabledAppEmbed?: boolean
  enabledAppBlock?: boolean
  themeEditCodeLink?: string
  appEmbedLink?: string
  customizerLink?: string
  /** Persisted storefront settings the Sales Tools Storefront tab reads (`appConfig.appMetafields`). */
  appMetafields?: Record<string, unknown>
}

export interface TailorKitProductEditorRootLoaderData {
  isDealActive: boolean
  isDealEligible: boolean
  /**
   * TailorKit line-item property prefix. Upstream `~/root` computes it per shop and copied screens read it
   * via `useRootLoaderData()` (e.g. Orders detail groups personalization properties by `_${PROPERTY_PREFIX} `).
   * In PageFly the storefront writes `__pf_tailorkit`, and the matcher convention strips one leading `_`, so
   * this is `_pf_tailorkit` (= the backend `TAILORKIT_PROPERTY_PREFIX`). Empty/undefined here makes the detail
   * card's property + print-area grouping match nothing → blank cart items.
   */
  PROPERTY_PREFIX: string
  PUBLIC_ENV: {
    BASE_URL: string
    APP_HANDLE: string
    STORE_ASSET_DOMAIN: string
  }
  shopData: {
    shopDomain: string
    shopConfig: {
      currency: string
      locale?: string
      timezone?: string
      /** Shopify money format string (e.g. `${{amount}}`). Copied Orders rows pass it to `formatShopifyPrice`,
       *  which does `moneyFormat.replace(...)` and crashes on undefined — so it is always provided. */
      money_format: string
      /** `<subdomain>.myshopify.com`. The copied Orders detail route derives the admin subdomain from it. */
      myshopify_domain: string
    }
    subscription?: {
      plan?: {
        name?: string
        tier?: string
      }
    }
    appConfig: TailorKitProductEditorRootAppConfig
    usages: {
      totalPublishedIntegrations: number
    }
  }
}

export interface TailorKitProductEditorLoaderData {
  id: string
  mockupId: string
  /**
   * The populated editor blob (`record.editorPayload`) — the exact shape the ProductEditor reads on
   * reopen. Falls back to the slim record only for pre-blob legacy records (mounts degraded, no crash).
   */
  integration: Record<string, unknown>
  tab: string
  printAreaId: string
  templateId: string
  viewId: string
  rootLoaderData?: TailorKitProductEditorRootLoaderData
}

function queryText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function hasTextId(value: unknown): boolean {
  return (typeof value === 'string' || typeof value === 'number') && String(value).trim().length > 0
}

function withEditorIntegrationIdentity(record: TailorKitIntegrationRecord): Record<string, unknown> {
  const integration: Record<string, unknown> = record.editorPayload ? { ...record.editorPayload } : { ...record }
  if (!hasTextId(integration._id)) integration._id = record.id
  if (!hasTextId(integration.id)) integration.id = record.id
  return integration
}

export function createTailorKitProductEditorIntegrationDataSource(id: string, mockupId: string): string {
  const params = new URLSearchParams()
  params.set(tailorkitProductEditorLoaderDataSource.mockupParam, mockupId)
  params.set(
    tailorkitProductEditorLoaderDataSource.populateTemplateParam,
    tailorkitProductEditorLoaderDataSource.populateTemplateValue
  )

  return `${tailorkitProductEditorLoaderDataSource.routePrefix}${encodeURIComponent(id)}?${params.toString()}`
}

/**
 * Root-loader snapshot for copied TailorKit UI that imports `~/root`.
 * It is intentionally built from PageFly app-platform safe shop context, not TailorKit Remix server root.
 */
export function createTailorKitProductEditorRootLoaderData(
  input: TailorKitProductEditorRootLoaderInput
): TailorKitProductEditorRootLoaderData {
  const storeAssetDomain = input.storeAssetDomain || 'sample-store-tailorkit.myshopify.com'

  return {
    isDealActive: false,
    isDealEligible: false,
    // Copied screens group personalization properties by `_${PROPERTY_PREFIX} `; this is the same prefix
    // the backend matcher uses (`_pf_tailorkit`), so captured `__pf_tailorkit ...` properties match.
    PROPERTY_PREFIX: TAILORKIT_PROPERTY_PREFIX,
    PUBLIC_ENV: {
      BASE_URL: input.baseUrl || '/app-platform/apps/tailorkit/',
      APP_HANDLE: input.appHandle || 'pagefly',
      STORE_ASSET_DOMAIN: storeAssetDomain,
    },
    shopData: {
      shopDomain: input.shopDomain || storeAssetDomain,
      shopConfig: {
        currency: input.currency || 'USD',
        locale: input.locale,
        timezone: input.timezone,
        // Default Shopify money format. The host has no per-shop money_format yet; this default keeps
        // `formatShopifyPrice` safe (it does `moneyFormat.replace(...)`). Amounts still render with the
        // correct currency symbol via the row's `getCurrencySymbol(currency)` path.
        money_format: input.moneyFormat || '${{amount}}',
        myshopify_domain: input.shopDomain || storeAssetDomain,
      },
      subscription: {
        plan: {
          name: input.planName,
          tier: input.planTier,
        },
      },
      appConfig: {
        ...input.appConfig,
        appPlatformSubscriptionGeneration: input.subscriptionGeneration,
      },
      usages: {
        totalPublishedIntegrations: 0,
      },
    },
  }
}

export function createTailorKitProductEditorLoaderData(
  record: TailorKitIntegrationRecord,
  query: TailorKitProductEditorLoaderQuery = {},
  rootLoaderData?: TailorKitProductEditorRootLoaderData
): TailorKitProductEditorLoaderData {
  // Serve the populated editor blob verbatim (zero reassembly). Legacy records without it degrade
  // to a shallow copy of the slim record — the editor mounts empty rather than crashing on `variant.mockup._id`.
  const integration = withEditorIntegrationIdentity(record)
  const loaderData: TailorKitProductEditorLoaderData = {
    id: record.id,
    mockupId: queryText(query.mockup) || queryText(query.mockupId),
    integration,
    tab: queryText(query.tab),
    printAreaId: queryText(query.printAreaId),
    templateId: queryText(query.templateId),
    viewId: queryText(query.viewId),
  }

  if (rootLoaderData) loaderData.rootLoaderData = rootLoaderData

  return loaderData
}
