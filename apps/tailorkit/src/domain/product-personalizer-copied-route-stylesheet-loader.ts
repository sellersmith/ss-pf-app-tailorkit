import {
  getTailorKitCopiedRouteModuleManifestEntry,
  inspectTailorKitCopiedRouteHostTarget,
  type TailorKitCopiedRouteHostInspection,
  type TailorKitCopiedRouteStylesheetLink,
} from './product-personalizer-copied-route-module-manifest'
import type { TailorKitCopiedRouteId } from './copied-route-id'

export type TailorKitCopiedRouteStylesheetResolutionStatus =
  | 'resolved'
  | 'missing-css-url-assets'
  | 'pending-link-array-spread'

export type TailorKitCopiedRouteStylesheetLinkStatus =
  | 'resolved-asset'
  | 'missing-asset'
  | 'pending-bundled-link-array'

export type TailorKitCopiedRouteStylesheetAssetValue = string | readonly string[]
export type TailorKitCopiedRouteStylesheetAssetMap = Readonly<Record<string, TailorKitCopiedRouteStylesheetAssetValue>>

export interface TailorKitCopiedRouteStylesheetLinkResolution {
  identifier: string
  importSource: string
  kind: TailorKitCopiedRouteStylesheetLink['kind']
  status: TailorKitCopiedRouteStylesheetLinkStatus
  href: string | null
  hrefs: readonly string[]
}

export interface TailorKitCopiedRouteStylesheetResolution {
  routeId: TailorKitCopiedRouteId
  status: TailorKitCopiedRouteStylesheetResolutionStatus
  links: readonly TailorKitCopiedRouteStylesheetLinkResolution[]
  resolvedHrefs: readonly string[]
  missingAssetKeys: readonly string[]
  pendingSpreadIdentifiers: readonly string[]
}

export interface TailorKitCopiedRouteStylesheetHostInspection extends TailorKitCopiedRouteHostInspection {
  stylesheets: TailorKitCopiedRouteStylesheetResolution
}

function assetKey(link: TailorKitCopiedRouteStylesheetLink): string {
  return link.importSource
}

function statusFor(
  links: readonly TailorKitCopiedRouteStylesheetLinkResolution[]
): TailorKitCopiedRouteStylesheetResolutionStatus {
  if (links.some(link => link.status === 'missing-asset')) return 'missing-css-url-assets'
  if (links.some(link => link.status === 'pending-bundled-link-array')) return 'pending-link-array-spread'
  return 'resolved'
}

function hrefsFor(value: TailorKitCopiedRouteStylesheetAssetValue | undefined): readonly string[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

/** Resolves direct CSS URL imports and leaves spread link arrays pending for the copied-route bundle. */
export function resolveTailorKitCopiedRouteStylesheets(
  routeId: TailorKitCopiedRouteId,
  assets: TailorKitCopiedRouteStylesheetAssetMap = {}
): TailorKitCopiedRouteStylesheetResolution {
  const routeModule = getTailorKitCopiedRouteModuleManifestEntry(routeId)
  const links = routeModule.stylesheetLinks.map<TailorKitCopiedRouteStylesheetLinkResolution>(link => {
    if (link.kind === 'link-array-spread') {
      const hrefs = hrefsFor(assets[link.identifier] || assets[link.importSource])

      if (hrefs.length) {
        return {
          identifier: link.identifier,
          importSource: link.importSource,
          kind: link.kind,
          status: 'resolved-asset',
          href: hrefs[0] || null,
          hrefs,
        }
      }

      return {
        identifier: link.identifier,
        importSource: link.importSource,
        kind: link.kind,
        status: 'pending-bundled-link-array',
        href: null,
        hrefs: [],
      }
    }

    const hrefs = hrefsFor(assets[assetKey(link)] || assets[link.identifier])
    const href = hrefs[0] || null

    return {
      identifier: link.identifier,
      importSource: link.importSource,
      kind: link.kind,
      status: href ? 'resolved-asset' : 'missing-asset',
      href,
      hrefs,
    }
  })

  return {
    routeId,
    status: statusFor(links),
    links,
    resolvedHrefs: links.flatMap(link => link.hrefs),
    missingAssetKeys: links.flatMap(link => (link.status === 'missing-asset' ? [link.importSource] : [])),
    pendingSpreadIdentifiers: links.flatMap(link =>
      link.status === 'pending-bundled-link-array' ? [link.identifier] : []
    ),
  }
}

/** Maps PageFly route host path to stylesheet resolution without importing TailorKit route modules. */
export function inspectTailorKitCopiedRouteStylesheetHostTarget(
  inputPathname: string,
  assets: TailorKitCopiedRouteStylesheetAssetMap = {}
): TailorKitCopiedRouteStylesheetHostInspection | null {
  const inspection = inspectTailorKitCopiedRouteHostTarget(inputPathname)

  if (!inspection) return null

  return {
    ...inspection,
    stylesheets: resolveTailorKitCopiedRouteStylesheets(inspection.route.routeId, assets),
  }
}
