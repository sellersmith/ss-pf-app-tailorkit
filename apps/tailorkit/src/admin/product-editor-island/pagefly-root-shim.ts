import { useTailorKitProductEditorLoaderData } from './pagefly-product-editor-loader-context'
import { resolvePageFlyAdminAppHandleFallback } from './pagefly-app-handle-fallback'
import { TAILORKIT_PROPERTY_PREFIX } from '../../domain/order-property-matchers'

const DEFAULT_STORE_ASSET_DOMAIN = 'sample-store-tailorkit.myshopify.com'

/**
 * PageFly root-loader seam for copied TailorKit UI that imports `~/root`.
 * It replaces Remix server root imports without changing ProductEditor source.
 */
export function useRootLoaderData() {
  const loaderData = useTailorKitProductEditorLoaderData()

  if (loaderData?.rootLoaderData) return loaderData.rootLoaderData

  return {
    isDealActive: false,
    isDealEligible: false,
    // Copied screens read PROPERTY_PREFIX off the root loader to group personalization properties.
    PROPERTY_PREFIX: TAILORKIT_PROPERTY_PREFIX,
    PUBLIC_ENV: {
      BASE_URL: '/app-platform/apps/tailorkit/',
      APP_HANDLE: resolvePageFlyAdminAppHandleFallback(),
      STORE_ASSET_DOMAIN: DEFAULT_STORE_ASSET_DOMAIN,
    },
    shopData: {
      shopDomain: DEFAULT_STORE_ASSET_DOMAIN,
      shopConfig: {
        currency: 'USD',
        money_format: '${{amount}}',
        myshopify_domain: DEFAULT_STORE_ASSET_DOMAIN,
      },
      usages: {
        totalPublishedIntegrations: 0,
      },
    },
  }
}
