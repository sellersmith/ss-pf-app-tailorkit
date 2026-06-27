// Publishes TailorKit global styling to the `em_tailorkit.global_styling` app metafield read by the
// copied storefront Liquid (app-embed builds `tailorkit-storefront-config.globalStyling` from it).
import type { AppBackendPorts, AppContext, AppDataMetafieldInput } from '../../../../web/server/src/app-platform/contracts'
import { readTailorKitGlobalStyling } from './global-styling-repository'
import {
  TAILORKIT_GLOBAL_STYLING_METAFIELD,
  TAILORKIT_STOREFRONT_ACCESS_TOKEN_NAMESPACE,
} from './storefront-metafield-keys'

/**
 * App-embed Liquid reads the proxy base from `em_storefront.app_proxy_path` (fallback `/apps/pagefly`).
 * The subpath is env-specific (`/apps/pagefly` prod, `/a/wip-proxy` dev, `/a/beta-proxy` beta), so the
 * value comes from `APP_PROXY_PATH` — the same env PageFly's main server resolves it from (utils/secrets).
 * Without this, storefront proxy fetches always hit the hardcoded prod subpath.
 */
function createTailorKitAppProxyPathMetafield(reason: string): AppDataMetafieldInput | null {
  const appProxyPath = process.env.APP_PROXY_PATH
  if (!appProxyPath) return null
  return {
    namespace: TAILORKIT_STOREFRONT_ACCESS_TOKEN_NAMESPACE,
    key: 'app_proxy_path',
    type: 'json',
    owner: 'app-installation',
    value: appProxyPath,
    reason,
  }
}

export function createTailorKitGlobalStylingMetafield(
  styling: Record<string, unknown>,
  reason: string
): AppDataMetafieldInput {
  return {
    namespace: TAILORKIT_GLOBAL_STYLING_METAFIELD.namespace,
    key: TAILORKIT_GLOBAL_STYLING_METAFIELD.key,
    type: 'json',
    owner: 'app-installation',
    value: styling,
    reason,
  }
}

/**
 * Host activation provider: runs whenever the storefront runtime publishes. Returns the global
 * styling metafield so an unset record publishes an empty object (Liquid falls back to defaults).
 */
export async function createTailorKitStorefrontActivationMetafields(
  ports: AppBackendPorts,
  ctx: AppContext
): Promise<AppDataMetafieldInput[]> {
  const record = await readTailorKitGlobalStyling(ports, ctx)
  const metafields: AppDataMetafieldInput[] = [
    createTailorKitGlobalStylingMetafield(record?.styling ?? {}, 'tailorkit-global-styling-runtime-sync'),
  ]

  const proxyPathMetafield = createTailorKitAppProxyPathMetafield('tailorkit-app-proxy-path-runtime-sync')
  if (proxyPathMetafield) metafields.push(proxyPathMetafield)

  return metafields
}
