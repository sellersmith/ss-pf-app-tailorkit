// Orders admin route family for the copied-route runtime host. Sibling to the Product Personalizer
// contract — same structure, disjoint path namespace (`/orders*`). Mirrors
// `product-personalizer-admin-route-host-contract.ts`; the runtime host treats both uniformly via the
// generalized `TailorKitCopiedRouteId` backbone. NO `.loading` route — orders has no import/create flow.
import type {
  TailorKitCopiedRouteHostDecisionBase,
  TailorKitMatchedCopiedRoute,
} from './copied-route-id'

export type TailorKitOrdersAdminRouteId = 'orders._index' | 'orders.$id'

const pageflyTailorKitRouteBase = '/app-extensions/tailorkit'

export const tailorkitOrdersAdminRouteHostDecisions = [
  {
    routeId: 'orders._index',
    upstreamSource: 'app/routes/orders._index/route.tsx',
    tailorkitPathPattern: '/orders',
    pageflyPathPatterns: ['/app-extensions/tailorkit/orders'],
    // The copied list route exports only a default component (clientLoader-less; ListTable self-fetches).
    requiredExports: ['export default'],
    requiredHostCapabilities: [
      'AdminAppHost',
      'Remix useNavigate/useLocation compatibility',
      'ListTable dataSource authenticatedFetch bridge',
    ],
    status: 'runtime-hosted',
    notes: 'Orders listing reads captured orders through GET /orders. Fulfillment UI pruned (graft-and-prune).',
  },
  {
    routeId: 'orders.$id',
    upstreamSource: 'app/routes/orders.$id/route.tsx',
    tailorkitPathPattern: '/orders/:id',
    pageflyPathPatterns: ['/app-extensions/tailorkit/orders/:id'],
    requiredExports: ['export const clientLoader', 'export default'],
    requiredHostCapabilities: [
      'AdminAppHost',
      'Remix params/request clientLoader bridge',
      'Remix useNavigation idle-state compatibility',
      'authenticatedFetch detail bridge (GET /orders?filter__id=...)',
    ],
    status: 'runtime-hosted',
    notes: 'Order detail reads a single captured order via the list endpoint id filter. Fulfillment + trigger-flow pruned.',
  },
] as const satisfies readonly (TailorKitCopiedRouteHostDecisionBase & { routeId: TailorKitOrdersAdminRouteId })[]

function decisionFor(routeId: TailorKitOrdersAdminRouteId): TailorKitCopiedRouteHostDecisionBase {
  const decision = tailorkitOrdersAdminRouteHostDecisions.find(item => item.routeId === routeId)
  if (!decision) throw new Error(`Missing TailorKit Orders route decision for ${routeId}`)
  return decision
}

function normalizeRoutePathname(input: string): string {
  const pathname = input.match(/^https?:\/\//) ? new URL(input).pathname : input.split(/[?#]/)[0] || '/'
  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`
  const routeBaseIndex = withLeadingSlash.indexOf(pageflyTailorKitRouteBase)
  const scopedPathname = routeBaseIndex >= 0 ? withLeadingSlash.slice(routeBaseIndex) : withLeadingSlash
  return scopedPathname.replace(/\/+$/, '') || '/'
}

function buildMatchedRoute(
  routeId: TailorKitOrdersAdminRouteId,
  pageflyPathname: string,
  tailorkitPathname: string,
  params: Readonly<Record<string, string>> = {}
): TailorKitMatchedCopiedRoute {
  return { routeId, decision: decisionFor(routeId), pageflyPathname, tailorkitPathname, params }
}

/**
 * Pure path → orders route matcher. Returns null for any non-orders path (so the PP matcher, which runs
 * first in the backbone composer, keeps precedence and the two never collide — disjoint namespaces).
 */
export function matchTailorKitOrdersCopiedRoute(inputPathname: string): TailorKitMatchedCopiedRoute | null {
  const pageflyPathname = normalizeRoutePathname(inputPathname)
  const listPath = `${pageflyTailorKitRouteBase}/orders`

  if (pageflyPathname === listPath) {
    return buildMatchedRoute('orders._index', pageflyPathname, '/orders')
  }

  const detailPrefix = `${listPath}/`
  if (pageflyPathname.startsWith(detailPrefix)) {
    const rawId = pageflyPathname.slice(detailPrefix.length)
    if (!rawId || rawId.includes('/')) return null
    return buildMatchedRoute('orders.$id', pageflyPathname, `/orders/${rawId}`, { id: decodeURIComponent(rawId) })
  }

  return null
}
