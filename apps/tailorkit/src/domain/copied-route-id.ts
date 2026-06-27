// Backbone-level identity for the copied-route runtime host. The host was first built for Product
// Personalizer (PP) routes; Orders is a sibling route family added beside it. To host both without
// rewriting PP, the shared plumbing keys on this generalized id union + a structural matched-route type.
// PP's own `TailorKitProductPersonalizerMatchedCopiedRoute` stays untouched and remains structurally
// assignable to `TailorKitMatchedCopiedRoute` (PP ids ⊂ this union; PP decision satisfies the base shape).
//
// This file is a LEAF: it imports nothing, so every contract/manifest can depend on it without cycles.

export type TailorKitCopiedRouteId =
  | 'personalized-products._index'
  | 'personalized-products.$id'
  | 'personalized-products.loading'
  | 'orders._index'
  | 'orders.$id'
  | 'storefront-setup'

/** The common 8-field shape both the PP and Orders route-host decisions satisfy. */
export interface TailorKitCopiedRouteHostDecisionBase {
  routeId: TailorKitCopiedRouteId
  upstreamSource: string
  tailorkitPathPattern: string
  pageflyPathPatterns: readonly string[]
  requiredExports: readonly string[]
  requiredHostCapabilities: readonly string[]
  status: 'runtime-hosted' | 'pending-remix-compatibility'
  notes: string
}

/** Generalized matched copied route — the runtime reads only routeId/tailorkitPathname/params off it. */
export interface TailorKitMatchedCopiedRoute {
  routeId: TailorKitCopiedRouteId
  decision: TailorKitCopiedRouteHostDecisionBase
  pageflyPathname: string
  tailorkitPathname: string
  params: Readonly<Record<string, string>>
}
