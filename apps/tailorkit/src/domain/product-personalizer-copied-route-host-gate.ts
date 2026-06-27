import { matchTailorKitProductPersonalizerCopiedRoute } from './product-personalizer-admin-route-host-contract'
import { matchTailorKitOrdersCopiedRoute } from './orders-admin-route-host-contract'
import { matchTailorKitStorefrontSetupCopiedRoute } from './storefront-setup-admin-route-host-contract'
import type { TailorKitMatchedCopiedRoute } from './copied-route-id'
import {
  getTailorKitCopiedRouteModuleManifestEntry,
  type TailorKitCopiedRouteModuleManifestEntry,
} from './product-personalizer-copied-route-module-manifest'
import {
  assertTailorKitProductPersonalizerRouteHostCanActivate,
  type TailorKitRouteHostReadiness,
} from './product-personalizer-route-host-readiness'

export interface TailorKitCopiedRouteHostGateResult {
  route: TailorKitMatchedCopiedRoute
  routeModule: TailorKitCopiedRouteModuleManifestEntry
  readiness: TailorKitRouteHostReadiness
}

/** Host entrypoint: match copied TailorKit routes, then expose route module metadata after readiness clears. */
export function resolveTailorKitCopiedRouteForHost(inputPathname: string): TailorKitCopiedRouteHostGateResult | null {
  const route =
    matchTailorKitProductPersonalizerCopiedRoute(inputPathname) ??
    matchTailorKitOrdersCopiedRoute(inputPathname) ??
    matchTailorKitStorefrontSetupCopiedRoute(inputPathname)

  if (!route) return null

  return {
    route,
    routeModule: getTailorKitCopiedRouteModuleManifestEntry(route.routeId),
    readiness: assertTailorKitProductPersonalizerRouteHostCanActivate(),
  }
}
