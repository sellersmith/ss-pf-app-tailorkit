import type { TailorKitCopiedRouteId } from './copied-route-id'
import { getTailorKitCopiedRouteModuleManifestEntry } from './product-personalizer-copied-route-module-manifest'
import type {
  TailorKitCopiedRouteStylesheetAssetMap,
  TailorKitCopiedRouteStylesheetAssetValue,
} from './product-personalizer-copied-route-stylesheet-loader'
import {
  collectTailorKitViteManifestEntryAssets,
  type TailorKitViteManifest,
} from './vite-manifest-assets'

export interface TailorKitCopiedRouteViteAssetDiscovery {
  routeId: TailorKitCopiedRouteId
  routeEntryKey: string
  routeEntryFile: string
  routeEntryCssFiles: readonly string[]
  assetMap: TailorKitCopiedRouteStylesheetAssetMap
  resolvedIdentifiers: readonly string[]
  unresolvedIdentifiers: readonly string[]
}

function stripUrlQuery(value: string) {
  return value.replace(/\?url$/, '')
}

function normalizePath(value: string) {
  return value.replace(/\\/g, '/')
}

function normalizeAliasSource(value: string) {
  if (value.startsWith('~/')) return `app/${value.slice(2)}`
  if (value.startsWith('../../shared/')) return `app/shared/${value.slice('../../shared/'.length)}`
  return value
}

function sourceCandidates(importSource: string): readonly string[] {
  const normalized = normalizeAliasSource(importSource)
  const withoutUrl = stripUrlQuery(normalized)
  const candidates = new Set([importSource, normalized, withoutUrl])
  const rootCandidates = [withoutUrl]

  if (withoutUrl.startsWith('app/')) {
    const appLevelMirrorPath = `upstream/tailorkit-app/${withoutUrl}`
    candidates.add(appLevelMirrorPath)
    rootCandidates.push(appLevelMirrorPath)
  }

  for (const candidate of rootCandidates) {
    if (!/\.[cm]?[jt]sx?$|\.css$/.test(candidate)) {
      candidates.add(`${candidate}.ts`)
      candidates.add(`${candidate}.tsx`)
      candidates.add(`${candidate}/index.ts`)
      candidates.add(`${candidate}/index.tsx`)
    }
  }

  return [...candidates]
}

const spreadLinkCssSources: Record<string, readonly string[]> = {
  linksSortableCSS: [
    'app/components/common/SortableList/components/SortableItem/SortableItem.css',
    'app/components/common/SortableList/SortableList.css',
  ],
  linksImageModalCSS: ['app/modules/modals/ImageSelector/styles.css'],
  templateEditorCSS: ['app/modules/TemplateEditor/styles/consolidated.css'],
}

function manifestEntryPath(manifest: TailorKitViteManifest, key: string) {
  return normalizePath(manifest[key]?.src || key)
}

function pathMatchesCandidate(pathname: string, candidate: string) {
  const normalizedCandidate = normalizePath(stripUrlQuery(candidate))
  return pathname === normalizedCandidate || pathname.endsWith(`/${normalizedCandidate}`)
}

function findManifestKey(manifest: TailorKitViteManifest, importSource: string): string | null {
  const candidates = sourceCandidates(importSource)
  const directMatch = candidates.find(candidate => manifest[candidate])

  if (directMatch) return directMatch

  return (
    Object.keys(manifest).find(key => {
      const entryPath = manifestEntryPath(manifest, key)
      return candidates.some(candidate => pathMatchesCandidate(entryPath, candidate))
    }) || null
  )
}

function assetValueForManifestKey(
  manifest: TailorKitViteManifest,
  manifestKey: string,
  importSource: string
): TailorKitCopiedRouteStylesheetAssetValue | null {
  const entry = manifest[manifestKey]
  if (!entry) return null

  if (stripUrlQuery(importSource).endsWith('.css')) {
    return entry.file || null
  }

  const assets = collectTailorKitViteManifestEntryAssets(manifest, manifestKey, `Missing Vite manifest entry for ${manifestKey}`)
  return assets.cssFiles.length ? assets.cssFiles : null
}

function assetValuesForCssSources(
  manifest: TailorKitViteManifest,
  sources: readonly string[]
): TailorKitCopiedRouteStylesheetAssetValue | null {
  const files = sources.flatMap(source => {
    const manifestKey = findManifestKey(manifest, source)
    const file = manifestKey ? manifest[manifestKey]?.file : null
    return file ? [file] : []
  })

  return files.length ? Array.from(new Set(files)) : null
}

function assetValueForLink(
  manifest: TailorKitViteManifest,
  identifier: string,
  importSource: string
): TailorKitCopiedRouteStylesheetAssetValue | null {
  const manifestKey = findManifestKey(manifest, importSource)
  const manifestValue = manifestKey ? assetValueForManifestKey(manifest, manifestKey, importSource) : null

  if (manifestValue) return manifestValue

  return assetValuesForCssSources(manifest, spreadLinkCssSources[identifier] || [])
}

/**
 * Resolves the Vite-manifest entry key for a route's actually-built module. For PP/Orders the built entry
 * is the upstream route (`modulePath` = `${mirrorRoot}/${upstreamSource}`). For single-shell screens (e.g.
 * Sales Tools) the built entry is a PageFly shell whose `upstreamSource` is parity-reference only and is NOT
 * a build input — so keying off `upstreamSource` throws "manifest is missing". The manifest keys are
 * Vite-root-relative (`apps/tailorkit/`); stripping that prefix from `modulePath` yields the exact key for
 * both shapes. Falls back to `upstreamSource` for safety.
 */
function resolveRouteEntryKey(
  manifest: TailorKitViteManifest,
  modulePath: string,
  upstreamSource: string
): string {
  const moduleRelative = modulePath.replace(/^apps\/tailorkit\//, '')
  return (
    findManifestKey(manifest, moduleRelative) ||
    findManifestKey(manifest, upstreamSource) ||
    moduleRelative
  )
}

/** Discovers explicit stylesheet assets for a copied TailorKit route from a Vite manifest. */
export function discoverTailorKitCopiedRouteStylesheetAssetsFromViteManifest(
  routeId: TailorKitCopiedRouteId,
  manifest: TailorKitViteManifest
): TailorKitCopiedRouteViteAssetDiscovery {
  const routeModule = getTailorKitCopiedRouteModuleManifestEntry(routeId)
  const routeEntryKey = resolveRouteEntryKey(manifest, routeModule.modulePath, routeModule.upstreamSource)
  const routeAssets = collectTailorKitViteManifestEntryAssets(
    manifest,
    routeEntryKey,
    `TailorKit copied route Vite manifest is missing ${routeModule.modulePath}`
  )
  const assetMap: Record<string, TailorKitCopiedRouteStylesheetAssetValue> = {}
  const resolvedIdentifiers: string[] = []
  const unresolvedIdentifiers: string[] = []

  for (const link of routeModule.stylesheetLinks) {
    const value = assetValueForLink(manifest, link.identifier, link.importSource)

    if (value) {
      assetMap[link.identifier] = value
      assetMap[link.importSource] = value
      resolvedIdentifiers.push(link.identifier)
    } else {
      unresolvedIdentifiers.push(link.identifier)
    }
  }

  return {
    routeId,
    routeEntryKey,
    routeEntryFile: routeAssets.entryFile,
    routeEntryCssFiles: routeAssets.cssFiles,
    assetMap,
    resolvedIdentifiers,
    unresolvedIdentifiers,
  }
}
