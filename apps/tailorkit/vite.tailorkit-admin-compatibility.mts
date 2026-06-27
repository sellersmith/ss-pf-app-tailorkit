import type { Plugin } from 'vite'

const PRODUCT_EDITOR_PARAMS_HOOK_SOURCE = '/upstream/tailorkit-app/app/modules/ProductEditor/hooks/useEditorParams.ts'
const TAILORKIT_EDITOR_ROUTE_PREDICATE = "window.location.pathname.startsWith('/personalized-products/')"
const PAGEFLY_HOSTED_EDITOR_ROUTE_PREDICATE =
  "(window.location.pathname.startsWith('/personalized-products/') || window.location.pathname.startsWith('/app-extensions/tailorkit/personalized-products/'))"

/**
 * Applies tiny runtime-only compatibility fixes to copied TailorKit admin source
 * while keeping `apps/tailorkit/upstream/**` byte-for-byte identical to upstream.
 */
export function createTailorKitAdminCompatibilityPlugin(): Plugin {
  return {
    name: 'pagefly-tailorkit-admin-compatibility',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes(PRODUCT_EDITOR_PARAMS_HOOK_SOURCE)) return null

      if (!code.includes(TAILORKIT_EDITOR_ROUTE_PREDICATE)) {
        this.error('TailorKit useEditorParams route predicate changed upstream; review PageFly compatibility transform.')
      }

      return {
        code: code.replace(TAILORKIT_EDITOR_ROUTE_PREDICATE, PAGEFLY_HOSTED_EDITOR_ROUTE_PREDICATE),
        map: null,
      }
    },
  }
}
