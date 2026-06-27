// Orders copied-route module manifest entries — the orders-family counterpart to the PP module manifest.
// The backbone manifest lookup (`getTailorKitCopiedRouteModuleManifestEntry`) composes PP ∪ orders. Orders
// routes use Polaris only (no route-specific css-url imports), so `stylesheetLinks` is empty.
import type { TailorKitCopiedRouteModuleManifestEntry } from './product-personalizer-copied-route-module-manifest'
import { tailorkitOrdersAdminRouteHostDecisions } from './orders-admin-route-host-contract'

const ORDERS_MIRROR_ROOT = 'apps/tailorkit/upstream/tailorkit-app'

/** Support sources kept after graft-and-prune (fulfillment-only files excluded). */
const ordersSupportSources: Record<string, readonly string[]> = {
  'orders._index': [
    'app/routes/orders._index/components/RowMarkupDesktop.tsx',
    'app/routes/orders._index/components/RowMarkupMobile.tsx',
    'app/routes/orders._index/components/OrderProperties.tsx',
    'app/routes/orders._index/components/status.tsx',
    'app/routes/orders._index/fns.ts',
  ],
  'orders.$id': [
    'app/routes/orders.$id/components/OrderDetailsCard.tsx',
    'app/routes/orders.$id/components/CustomerCard.tsx',
    'app/routes/orders.$id/components/PreviewPrintImage.tsx',
    'app/routes/orders.$id/components/CharmNestedRow.tsx',
    'app/routes/orders.$id/components/OrderStateBadge.tsx',
    'app/routes/orders._index/components/status.tsx',
    'app/routes/orders.$id/fns.client.ts',
  ],
}

const ordersAuthenticatedFetchSurfaces: Record<string, readonly string[]> = {
  'orders._index': ['GET /orders via ListTable dataSource'],
  'orders.$id': ['GET /orders?filter__id=string__eq__:id'],
}

export const tailorkitOrdersCopiedRouteModuleManifest =
  tailorkitOrdersAdminRouteHostDecisions.map<TailorKitCopiedRouteModuleManifestEntry>(decision => ({
    routeId: decision.routeId,
    runtimeStatus: 'runtime-hosted-via-copied-route-bundle',
    upstreamSource: decision.upstreamSource,
    mirrorRoot: ORDERS_MIRROR_ROOT,
    modulePath: `${ORDERS_MIRROR_ROOT}/${decision.upstreamSource}`,
    tailorkitPathPattern: decision.tailorkitPathPattern,
    pageflyPathPatterns: decision.pageflyPathPatterns,
    requiredExports: decision.requiredExports,
    supportSources: ordersSupportSources[decision.routeId] ?? [],
    authenticatedFetchSurfaces: ordersAuthenticatedFetchSurfaces[decision.routeId] ?? [],
    stylesheetLinks: [],
    notes: 'PageFly hosts this graft-and-pruned TailorKit orders route through the app-owned runtime bundle.',
  }))
