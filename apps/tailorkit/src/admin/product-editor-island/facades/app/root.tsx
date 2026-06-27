import { resolvePageFlyAdminAppHandleFallback } from '../../pagefly-app-handle-fallback'

const ADAPTER_MARKER = 'app-platform-root-loader-adapter'

export const DEFAULT_STORE_ASSET_DOMAIN = 'sample-store-tailorkit.myshopify.com'

export function useRootLoaderData() {
  void ADAPTER_MARKER
  return {
    isDealActive: false,
    isDealEligible: false,
    PUBLIC_ENV: {
      APP_HANDLE: resolvePageFlyAdminAppHandleFallback(),
      STORE_ASSET_DOMAIN: DEFAULT_STORE_ASSET_DOMAIN,
    },
    shopData: {
      shopDomain: DEFAULT_STORE_ASSET_DOMAIN,
      shopConfig: {
        currency: 'USD',
      },
      usages: {
        totalPublishedIntegrations: 0,
      },
    },
  }
}
