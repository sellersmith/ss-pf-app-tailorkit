import {
  matchTailorKitProductPersonalizerCopiedRoute,
  tailorkitProductPersonalizerAdminRouteHostDecisions,
  tailorkitProductPersonalizerCopiedRouteHostContract,
  tailorkitProductPersonalizerCopiedRouteSourceMaps,
  type TailorKitProductPersonalizerAdminRouteId,
} from './product-personalizer-admin-route-host-contract'
import { matchTailorKitOrdersCopiedRoute } from './orders-admin-route-host-contract'
import { tailorkitOrdersCopiedRouteModuleManifest } from './orders-copied-route-module-manifest'
import { matchTailorKitStorefrontSetupCopiedRoute } from './storefront-setup-admin-route-host-contract'
import { tailorkitStorefrontSetupCopiedRouteModuleManifest } from './storefront-setup-copied-route-module-manifest'
import type { TailorKitCopiedRouteId, TailorKitMatchedCopiedRoute } from './copied-route-id'

export type TailorKitCopiedRouteModuleRuntimeStatus = 'runtime-hosted-via-copied-route-bundle'

export interface TailorKitCopiedRouteModuleManifestEntry {
  routeId: TailorKitCopiedRouteId
  runtimeStatus: TailorKitCopiedRouteModuleRuntimeStatus
  upstreamSource: string
  mirrorRoot: string
  modulePath: string
  tailorkitPathPattern: string
  pageflyPathPatterns: readonly string[]
  requiredExports: readonly string[]
  supportSources: readonly string[]
  authenticatedFetchSurfaces: readonly string[]
  stylesheetLinks: readonly TailorKitCopiedRouteStylesheetLink[]
  notes: string
}

export interface TailorKitCopiedRouteHostInspection {
  route: TailorKitMatchedCopiedRoute
  routeModule: TailorKitCopiedRouteModuleManifestEntry
}

export interface TailorKitCopiedRouteStylesheetLink {
  identifier: string
  importSource: string
  linkReference: string
  kind: 'css-url-import' | 'link-array-spread'
}

const routeStylesheetLinks: Record<TailorKitProductPersonalizerAdminRouteId, readonly TailorKitCopiedRouteStylesheetLink[]> = {
  'personalized-products._index': [
    {
      identifier: 'reactQuillStyles',
      importSource: 'react-quill-new/dist/quill.snow.css?url',
      linkReference: "{ rel: 'stylesheet', href: reactQuillStyles }",
      kind: 'css-url-import',
    },
    {
      identifier: 'richTextEditorStyles',
      importSource: '~/components/.client/RichTextEditor/styles.css?url',
      linkReference: "{ rel: 'stylesheet', href: richTextEditorStyles }",
      kind: 'css-url-import',
    },
  ],
  'personalized-products.$id': [
    {
      identifier: 'themeHelperStyles',
      importSource: '../../shared/extensions/tailorkit-src/src/assets/tailorkit.css?url',
      linkReference: "{ rel: 'stylesheet', href: themeHelperStyles }",
      kind: 'css-url-import',
    },
    {
      identifier: 'integrationEditorStyles',
      importSource: '~/modules/ProductEditor/styles.css?url',
      linkReference: "{ rel: 'stylesheet', href: integrationEditorStyles }",
      kind: 'css-url-import',
    },
    {
      identifier: 'linksSortableCSS',
      importSource: '~/components/common/SortableList',
      linkReference: '...linksSortableCSS',
      kind: 'link-array-spread',
    },
    {
      identifier: 'linksImageModalCSS',
      importSource: '~/modules/modals',
      linkReference: '...linksImageModalCSS',
      kind: 'link-array-spread',
    },
    {
      identifier: 'templateEditorCSS',
      importSource: '~/modules/TemplateEditor',
      linkReference: '...templateEditorCSS',
      kind: 'link-array-spread',
    },
    {
      identifier: 'reactQuillStyles',
      importSource: 'react-quill-new/dist/quill.snow.css?url',
      linkReference: "{ rel: 'stylesheet', href: reactQuillStyles }",
      kind: 'css-url-import',
    },
    {
      identifier: 'richTextEditorStyles',
      importSource: '~/components/.client/RichTextEditor/styles.css?url',
      linkReference: "{ rel: 'stylesheet', href: richTextEditorStyles }",
      kind: 'css-url-import',
    },
  ],
  'personalized-products.loading': [
    {
      identifier: 'themeHelperStyles',
      importSource: '../../shared/extensions/tailorkit-src/src/assets/tailorkit.css?url',
      linkReference: "{ rel: 'stylesheet', href: themeHelperStyles }",
      kind: 'css-url-import',
    },
    {
      identifier: 'integrationEditorStyles',
      importSource: '~/modules/ProductEditor/styles.css?url',
      linkReference: "{ rel: 'stylesheet', href: integrationEditorStyles }",
      kind: 'css-url-import',
    },
    {
      identifier: 'templateEditorCSS',
      importSource: '~/modules/TemplateEditor',
      linkReference: '...templateEditorCSS',
      kind: 'link-array-spread',
    },
  ],
}

function sourceMapFor(routeId: TailorKitProductPersonalizerAdminRouteId) {
  const sourceMap = tailorkitProductPersonalizerCopiedRouteSourceMaps.find(item => item.routeId === routeId)

  if (!sourceMap) {
    throw new Error(`Missing TailorKit copied route source map for ${routeId}`)
  }

  return sourceMap
}

/** Source manifest for copied TailorKit Remix routes executed by the app-owned runtime bundle. */
export const tailorkitProductPersonalizerCopiedRouteModuleManifest =
  tailorkitProductPersonalizerAdminRouteHostDecisions.map<TailorKitCopiedRouteModuleManifestEntry>(decision => {
    const sourceMap = sourceMapFor(decision.routeId)

    return {
      routeId: decision.routeId,
      runtimeStatus: 'runtime-hosted-via-copied-route-bundle',
      upstreamSource: decision.upstreamSource,
      mirrorRoot: tailorkitProductPersonalizerCopiedRouteHostContract.upstreamRoot,
      modulePath: `${tailorkitProductPersonalizerCopiedRouteHostContract.upstreamRoot}/${decision.upstreamSource}`,
      tailorkitPathPattern: decision.tailorkitPathPattern,
      pageflyPathPatterns: decision.pageflyPathPatterns,
      requiredExports: decision.requiredExports,
      supportSources: sourceMap.supportSources,
      authenticatedFetchSurfaces: sourceMap.authenticatedFetchSurfaces,
      stylesheetLinks: routeStylesheetLinks[decision.routeId],
      notes: 'PageFly hosts this copied TailorKit route through the app-owned runtime bundle and app-platform adapters.',
    }
  })

// Backbone manifest = PP ∪ orders ∪ storefront-setup. The sibling manifests import only the entry TYPE from
// this module (erased at runtime), so these value imports create no runtime cycle.
const allCopiedRouteModuleManifestEntries: readonly TailorKitCopiedRouteModuleManifestEntry[] = [
  ...tailorkitProductPersonalizerCopiedRouteModuleManifest,
  ...tailorkitOrdersCopiedRouteModuleManifest,
  ...tailorkitStorefrontSetupCopiedRouteModuleManifest,
]

export function getTailorKitCopiedRouteModuleManifestEntry(
  routeId: TailorKitCopiedRouteId
): TailorKitCopiedRouteModuleManifestEntry {
  const entry = allCopiedRouteModuleManifestEntries.find(item => item.routeId === routeId)

  if (!entry) {
    throw new Error(`Missing TailorKit copied route module manifest entry for ${routeId}`)
  }

  return entry
}

/**
 * Maps a PageFly admin path to copied route source metadata. The PP matcher runs FIRST (precedence), then
 * orders, then storefront-setup. All return null for foreign paths and match disjoint namespaces
 * (`/personalized-products*` vs `/orders*` vs `/storefront-setup*`), so the order is safe.
 */
export function inspectTailorKitCopiedRouteHostTarget(inputPathname: string): TailorKitCopiedRouteHostInspection | null {
  const route =
    matchTailorKitProductPersonalizerCopiedRoute(inputPathname) ??
    matchTailorKitOrdersCopiedRoute(inputPathname) ??
    matchTailorKitStorefrontSetupCopiedRoute(inputPathname)

  if (!route) return null

  return {
    route,
    routeModule: getTailorKitCopiedRouteModuleManifestEntry(route.routeId),
  }
}
