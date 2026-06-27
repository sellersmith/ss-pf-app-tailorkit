const DASHBOARD_CREATE_FLOW_PATH = '/dashboard'
const TAILORKIT_ROOT_PATH = '/'
const PRODUCT_PERSONALIZER_LIST_PATH = '/personalized-products'

// Sales Tools sub-routes that exist upstream but are dropped from the PageFly port (operator scope). Their
// in-app links would otherwise resolve to nothing → "route does not map" banner. Each maps to the nearest
// in-scope screen so the link degrades to a harmless no-op instead of crashing.
const STOREFRONT_SETUP_DROPPED_ROUTE_FALLBACKS: Record<string, string> = {
  // AI Tools tab's "Manage AI effects" → quick-prompts page (AI effects feature not ported); keep the
  // merchant on the AI Tools tab instead of bannering.
  '/storefront-setup/quick-prompts': '/storefront-setup/ai-tools',
}

// TailorKit upstream route pathnames PageFly hosts. A copied route navigates with its own absolute
// TailorKit path (e.g. the orders list row does `navigate('/orders/123')`); the host must re-prefix that
// with the PageFly routeBase (`/app-extensions/tailorkit`) so React Router resolves the hosted screen instead
// of leaving the embed at a bare `/orders/123` that maps to nothing (→ blank screen).
const HOSTED_TAILORKIT_PATH_PREFIXES = [PRODUCT_PERSONALIZER_LIST_PATH, '/orders', '/storefront-setup'] as const

export function mapTailorKitProductPersonalizerPathToPageFlyPath(routeBase: string, target: string): string {
  const url = new URL(target, 'https://tailorkit.local')
  const isHostedPath = HOSTED_TAILORKIT_PATH_PREFIXES.some(
    prefix => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
  )
  if (!isHostedPath) return target

  // Idempotent: if the path is already routeBase-prefixed (some callers pass the PageFly path), don't double it.
  if (url.pathname.startsWith(`${routeBase}/`) || url.pathname === routeBase) {
    return `${url.pathname}${url.search}${url.hash}`
  }

  return `${routeBase}${url.pathname}${url.search}${url.hash}`
}

/**
 * TailorKit centralizes create-flow launch on `/dashboard?openCreateFlow=...`.
 * PageFly V0.1 hosts only Product Personalizer routes, so route that intent back
 * into the copied listing route where the existing ProductSelector auto-open runs.
 * TailorKit also uses `/` as an in-app escape target when save-bar navigation is
 * requested; under PageFly that must stay inside the hosted Product Personalizer.
 */
export function mapTailorKitCreateFlowNavigationTarget(target: string): string {
  const url = new URL(target, 'https://tailorkit.local')
  if (url.pathname === TAILORKIT_ROOT_PATH) return `${PRODUCT_PERSONALIZER_LIST_PATH}${url.search}${url.hash}`

  const droppedFallback = STOREFRONT_SETUP_DROPPED_ROUTE_FALLBACKS[url.pathname]
  if (droppedFallback) return `${droppedFallback}${url.search}${url.hash}`

  const flow = url.pathname === DASHBOARD_CREATE_FLOW_PATH ? url.searchParams.get('openCreateFlow') : null

  if (!flow) return target

  const next = new URLSearchParams()
  next.set('openProductSelector', 'true')
  next.set('defaultSource', 'existing')
  if (flow === 'charm_builder') next.set('charmMode', 'true')

  return `${PRODUCT_PERSONALIZER_LIST_PATH}?${next.toString()}`
}
