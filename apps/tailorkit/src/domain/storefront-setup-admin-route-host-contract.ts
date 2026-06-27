// Storefront-setup (Sales Tools) admin route family for the copied-route runtime host. Sibling to the
// Product Personalizer + Orders contracts — same structure, disjoint namespace (`/storefront-setup*`).
//
// SINGLE-SHELL model (NOT nested parent+children): the copied-route runtime renders ONE component per
// routeId and the `@remix-run/react` `Outlet` shim returns null. The upstream Sales Tools screen is a real
// parent route with `<Outlet/>` wrapping 3 tab children — registering the verbatim parent would render its
// `<Outlet/>` as null and never mount the tab bodies. Instead PageFly registers ONE id `storefront-setup`
// whose loaded module is a PageFly-owned shell (`storefront-setup-shell.tsx`) that replicates the parent
// layout and pathname-switches between the 3 verbatim tab bodies. This matcher maps every in-scope
// `/storefront-setup*` path to that single id; the shell reads the tab segment to pick the body.
import type {
  TailorKitCopiedRouteHostDecisionBase,
  TailorKitMatchedCopiedRoute,
} from './copied-route-id'

export type TailorKitStorefrontSetupAdminRouteId = 'storefront-setup'

const pageflyTailorKitRouteBase = '/app-extensions/tailorkit'

/**
 * In-scope path segments the shell can render. Two kinds:
 *  - tabs (`storefront`, `ai-tools`) — rendered inside the tab layout;
 *  - `styling` — the "Personalization box styling" full-page sub-view the Storefront tab links to (it is NOT
 *    a tab and has no nav slot, but it must resolve or the StorefrontStylingCard button banners out).
 * Out-of-scope upstream routes are dropped per operator and resolve to null: quick-prompts/checkboxes
 * (full-page routes) and `sales` (the Upsell tab — OneTick, a separate product, not TailorKit).
 */
export const TAILORKIT_STOREFRONT_SETUP_TAB_SEGMENTS = ['storefront', 'ai-tools', 'styling'] as const

export const tailorkitStorefrontSetupAdminRouteHostDecisions = [
  {
    routeId: 'storefront-setup',
    // Parity reference only — the loaded module is the PageFly shell, not this upstream parent.
    upstreamSource: 'app/routes/storefront-setup/route.tsx',
    tailorkitPathPattern: '/storefront-setup',
    pageflyPathPatterns: ['/app-extensions/tailorkit/storefront-setup'],
    // The shell exports only a default component (no clientLoader; tab bodies read root loader via hooks).
    requiredExports: ['export default'],
    requiredHostCapabilities: [
      'AdminAppHost',
      'Remix useNavigate/useLocation compatibility',
      'SaleToolsSaveBar provider + ContextualSaveBar shim',
    ],
    status: 'runtime-hosted',
    notes:
      'Sales Tools screen hosted via a PageFly single-shell that owns the tab layout (Storefront + AI Tools) + the styling full-page sub-view, pathname-switching the verbatim tab bodies. Upsell/checkboxes/quick-prompts dropped (graft-and-prune).',
  },
] as const satisfies readonly (TailorKitCopiedRouteHostDecisionBase & {
  routeId: TailorKitStorefrontSetupAdminRouteId
})[]

function decisionFor(routeId: TailorKitStorefrontSetupAdminRouteId): TailorKitCopiedRouteHostDecisionBase {
  const decision = tailorkitStorefrontSetupAdminRouteHostDecisions.find(item => item.routeId === routeId)
  if (!decision) throw new Error(`Missing TailorKit Storefront-setup route decision for ${routeId}`)
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
  pageflyPathname: string,
  tailorkitPathname: string,
  params: Readonly<Record<string, string>> = {}
): TailorKitMatchedCopiedRoute {
  return { routeId: 'storefront-setup', decision: decisionFor('storefront-setup'), pageflyPathname, tailorkitPathname, params }
}

/**
 * Pure path → storefront-setup matcher. Matches the bare `/storefront-setup` base (the shell client-
 * redirects to the default tab) and `/storefront-setup/<seg>` where seg is in-scope (the two tabs or the
 * styling sub-view). Returns null for any other path (so the PP + Orders matchers keep precedence; disjoint
 * namespaces never collide), and for out-of-scope segments so dropped routes (Upsell/quick-prompts/
 * checkboxes) do not resolve.
 */
export function matchTailorKitStorefrontSetupCopiedRoute(inputPathname: string): TailorKitMatchedCopiedRoute | null {
  const pageflyPathname = normalizeRoutePathname(inputPathname)
  const base = `${pageflyTailorKitRouteBase}/storefront-setup`

  if (pageflyPathname === base) {
    return buildMatchedRoute(pageflyPathname, '/storefront-setup')
  }

  const tabPrefix = `${base}/`
  if (pageflyPathname.startsWith(tabPrefix)) {
    const segment = pageflyPathname.slice(tabPrefix.length)
    if (!segment || segment.includes('/')) return null
    if (!TAILORKIT_STOREFRONT_SETUP_TAB_SEGMENTS.includes(segment as (typeof TAILORKIT_STOREFRONT_SETUP_TAB_SEGMENTS)[number])) {
      return null
    }
    return buildMatchedRoute(pageflyPathname, `/storefront-setup/${segment}`, { tab: segment })
  }

  return null
}
