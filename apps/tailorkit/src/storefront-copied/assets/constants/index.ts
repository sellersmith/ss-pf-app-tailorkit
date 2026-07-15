// Copied from TailorKit upstream. Original resolved %{...}% placeholders at build time via
// vite-plugin-transform + env. PageFly is ONE Shopify app with ONE app-proxy subpath per env
// (prod `pagefly`, dev `local-proxy`/`wip-proxy`, beta `beta-proxy`), so the proxy base is read at
// runtime from the app-embed storefront-config (backend injects the env-aware `APP_PROXY_PATH` via
// the em_storefront.app_proxy_path metafield). Fallback `/apps/pagefly` matches OneTick's resolver.
interface TailorKitProxyConfig {
  propertyPrefix?: string
  appProxyPath?: string
  appProxyOrigin?: string
}

function readProxyConfig(): TailorKitProxyConfig {
  if (typeof document === 'undefined') return {}
  const raw = document.getElementById('tailorkit-storefront-config')?.textContent || '{}'
  try {
    return JSON.parse(raw) as TailorKitProxyConfig
  } catch {
    return {}
  }
}

const proxyConfig = readProxyConfig()

/**
 * Property prefix is serving for hiding meta data properties in cart
 */
export const PROPERTY_PREFIX = proxyConfig.propertyPrefix || '__pf_tailorkit'

// PageFly app-proxy base (single proxy, env-aware). Original TailorKit appended `/app_proxy/...`;
// copied callers keep that suffix, so this is the subpath base only (e.g. `/apps/pagefly`).
export const APP_PROXY_PATH = proxyConfig.appProxyPath || '/apps/pagefly'
export const APP_PROXY_ORIGIN =
  proxyConfig.appProxyOrigin || (typeof window !== 'undefined' ? window.location.origin : '')
// Internal app handle for the hidden-pricing product (`tailorkit-item-personalization`); matches the
// PageFly backend product-personalizer (process.env.APP_HANDLE) and the rewrite host's hardcoded handle.
// NOT the Shopify app handle and NOT the proxy subpath.
export const APP_HANDLE = 'tailorkit'

/**
 * Print id is serving for grouping display name properties
 */
export const PRINT_ID_PREFIX = '__print_id__'

export const ProductPersonalizerCustomizerWebComponentTag = 'tailorkit-product-personalizer-customizer'
export const ProductPersonalizerWebComponentTag = 'tailorkit-product-personalizer'

export const ONE_SECOND_IN_MILLISECONDS = 1000
export const ONE_MINUTE_IN_MILLISECONDS = 60 * ONE_SECOND_IN_MILLISECONDS

export const PREVIEW_URL_PROPERTY_KEY_SUFFIX = '_TLK_PREVIEW_URL'
export const CANVAS_PREVIEW_PROPERTY_KEY = '_Preview' //`${PROPERTY_PREFIX}${PREVIEW_URL_PROPERTY_KEY_SUFFIX}`
