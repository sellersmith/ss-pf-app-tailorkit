// TailorKit storefront runtime contribution. The browser bundle loads via the generated app-embed
// (`pagefly-tailorkit.js`), so this contribution exists to (1) mark the app as a storefront-runtime
// publisher — so merchant activation runs the storefront publish plan — and (2) carry the
// app-metafield writes the copied storefront Liquid reads under the legacy `em_*` namespace.
import { TAILORKIT_STOREFRONT_ACCESS_TOKEN_NAMESPACE } from './storefront-metafield-keys'

export const TAILORKIT_CONFIG_ELEMENT_ID = 'tailorkit-storefront-config'
export const TAILORKIT_STORE_GLOBAL = '__PAGEFLY_TAILORKIT__'

/**
 * `assetPath` satisfies the host's publish-ready assertion (a runtime with zero resolvable assets
 * yields an `empty` plan that the activation route rejects). The real bundle is injected by the
 * app-embed `javascript` schema, so the generated script tag here is never written to the theme.
 * No `liquidConfigTemplate` — the config script already lives in the generated app-embed Liquid.
 */
export const tailorkitStorefrontContribution = {
  name: 'tailorkit-storefront-runtime',
  assetPath: 'app-platform/apps/tailorkit/storefront/tailorkit.js',
  configElementId: TAILORKIT_CONFIG_ELEMENT_ID,
  globalStoreKey: TAILORKIT_STORE_GLOBAL,
  // Copy-first Liquid reads the Storefront API token from `em_storefront`, not `tailorkit_storefront`.
  storefrontAccessTokenNamespace: TAILORKIT_STOREFRONT_ACCESS_TOKEN_NAMESPACE,
} as const
