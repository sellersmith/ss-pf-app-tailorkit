import {
  inspectTailorKitCopiedRouteHostTarget,
  type TailorKitCopiedRouteModuleManifestEntry,
} from './product-personalizer-copied-route-module-manifest'
import {
  createTailorKitCopiedRouteClientLoaderArgs,
  type TailorKitCopiedRouteClientLoaderArgs,
} from './product-personalizer-copied-route-client-loader-args'
import {
  resolveTailorKitCopiedRouteStylesheets,
  type TailorKitCopiedRouteStylesheetAssetMap,
  type TailorKitCopiedRouteStylesheetResolution,
} from './product-personalizer-copied-route-stylesheet-loader'
import type { TailorKitMatchedCopiedRoute } from './copied-route-id'
import {
  discoverTailorKitCopiedRouteStylesheetAssetsFromViteManifest,
  type TailorKitCopiedRouteViteAssetDiscovery,
} from './product-personalizer-copied-route-vite-assets'
import type { TailorKitViteManifest } from './vite-manifest-assets'

export interface TailorKitCopiedRouteExecutionPlan {
  route: TailorKitMatchedCopiedRoute
  routeModule: TailorKitCopiedRouteModuleManifestEntry
  clientLoaderArgs: TailorKitCopiedRouteClientLoaderArgs
  stylesheets: TailorKitCopiedRouteStylesheetResolution
  viteAssets?: TailorKitCopiedRouteViteAssetDiscovery
  canExecuteRouteModule: boolean
  blockers: readonly string[]
}

function executionBlockers(
  routeModule: TailorKitCopiedRouteModuleManifestEntry,
  stylesheets: TailorKitCopiedRouteStylesheetResolution
) {
  return [
    ...(stylesheets.status === 'resolved' ? [] : [`route-module-stylesheet-pending:${routeModule.routeId}`]),
    ...stylesheets.missingAssetKeys.map(assetKey => `missing-stylesheet-asset:${assetKey}`),
    ...stylesheets.pendingSpreadIdentifiers.map(identifier => `pending-stylesheet-spread:${identifier}`),
  ]
}

/** Prepares copied-route execution inputs without importing or executing TailorKit route modules. */
export function createTailorKitCopiedRouteExecutionPlan(
  inputFullPath: string,
  assets: TailorKitCopiedRouteStylesheetAssetMap = {},
  viteAssets?: TailorKitCopiedRouteViteAssetDiscovery
): TailorKitCopiedRouteExecutionPlan | null {
  const inspection = inspectTailorKitCopiedRouteHostTarget(inputFullPath)

  if (!inspection) return null

  const stylesheets = resolveTailorKitCopiedRouteStylesheets(inspection.route.routeId, assets)
  const blockers = executionBlockers(inspection.routeModule, stylesheets)

  return {
    route: inspection.route,
    routeModule: inspection.routeModule,
    clientLoaderArgs: createTailorKitCopiedRouteClientLoaderArgs(inspection.route, inputFullPath),
    stylesheets,
    viteAssets,
    canExecuteRouteModule: blockers.length === 0,
    blockers,
  }
}

/** Creates an execution plan using stylesheet assets discovered from a copied-route Vite manifest. */
export function createTailorKitCopiedRouteExecutionPlanFromViteManifest(
  inputFullPath: string,
  manifest: TailorKitViteManifest
): TailorKitCopiedRouteExecutionPlan | null {
  const inspection = inspectTailorKitCopiedRouteHostTarget(inputFullPath)

  if (!inspection) return null

  const viteAssets = discoverTailorKitCopiedRouteStylesheetAssetsFromViteManifest(inspection.route.routeId, manifest)

  return createTailorKitCopiedRouteExecutionPlan(inputFullPath, viteAssets.assetMap, viteAssets)
}
