import type { AdminAppHost } from '../../../../../web/core/src/app-platform/admin'
import {
  createTailorKitCopiedRouteExecutionPlanFromViteManifest,
  type TailorKitCopiedRouteExecutionPlan,
} from '../../domain/product-personalizer-copied-route-execution-plan'
import {
  collectTailorKitViteManifestEntryAssets,
  type TailorKitViteManifest,
} from '../../domain/vite-manifest-assets'

const RUNTIME_MANIFEST_PATH = 'admin/copied-routes/manifest.json'
const RUNTIME_ENTRY_SOURCE = 'src/admin/copied-routes/runtime-entry.ts'
const RUNTIME_CACHE_BUST_PARAM = 'pf_runtime_v'

// Session-stable cache-bust token. The runtime entry filename is NOT content-hashed, so a query param
// is still needed to bust across deploys — but it must stay CONSTANT within a session. A per-call
// `Date.now()` made every remount (list <-> editor) re-fetch + re-evaluate the entry from the network
// instead of the browser's ES-module cache. Evaluated once at module load: same token all session →
// remounts hit cache; a new admin page load after a deploy re-evaluates the module → fresh token.
const RUNTIME_SESSION_CACHE_BUST = Date.now().toString(36)

/** TailorKit wholesale copy-first migration: loads the copied-route runtime asset without importing route modules. */
export interface TailorKitCopiedRouteRuntimeAssets {
  entryFile: string
  cssFiles: string[]
}

export interface TailorKitCopiedRouteRuntimePlan {
  runtimeAssets: TailorKitCopiedRouteRuntimeAssets
  executionPlan: TailorKitCopiedRouteExecutionPlan | null
}

export interface TailorKitCopiedRouteRuntimeModule {
  renderTailorKitCopiedRoute(
    target: HTMLElement,
    props: {
      apiClient: AdminAppHost['api']
      executionPlan: TailorKitCopiedRouteExecutionPlan
      rootLoaderData?: unknown
      routeState?: unknown
      onNavigate?(path: string, options?: { replace?: boolean; state?: unknown }): void
    }
  ): { unmount(): void }
}

export type TailorKitCopiedRouteRuntimeManifest = TailorKitViteManifest

export function collectTailorKitCopiedRouteRuntimeAssets(
  manifest: TailorKitCopiedRouteRuntimeManifest
): TailorKitCopiedRouteRuntimeAssets {
  return collectTailorKitViteManifestEntryAssets(
    manifest,
    RUNTIME_ENTRY_SOURCE,
    'TailorKit copied route runtime manifest is missing the runtime entry'
  )
}

export function createTailorKitCopiedRouteRuntimePlanFromManifest(
  fullPath: string,
  manifest: TailorKitCopiedRouteRuntimeManifest
): TailorKitCopiedRouteRuntimePlan {
  return {
    runtimeAssets: collectTailorKitCopiedRouteRuntimeAssets(manifest),
    executionPlan: createTailorKitCopiedRouteExecutionPlanFromViteManifest(fullPath, manifest),
  }
}

export function appendTailorKitRuntimeCacheBust(rawUrl: string, token = RUNTIME_SESSION_CACHE_BUST): string {
  const hashIndex = rawUrl.indexOf('#')
  const urlWithoutHash = hashIndex === -1 ? rawUrl : rawUrl.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : rawUrl.slice(hashIndex)
  const separator = urlWithoutHash.includes('?') ? '&' : '?'

  return `${urlWithoutHash}${separator}${RUNTIME_CACHE_BUST_PARAM}=${encodeURIComponent(token)}${hash}`
}

export function createTailorKitCopiedRouteRuntimeEntryUrl(
  host: AdminAppHost,
  runtimePlan: TailorKitCopiedRouteRuntimePlan,
  cacheBustToken = RUNTIME_SESSION_CACHE_BUST
): string {
  const entryUrl = host.ports.assets.resolveAppAssetUrl(`admin/copied-routes/${runtimePlan.runtimeAssets.entryFile}`)
  return appendTailorKitRuntimeCacheBust(entryUrl, cacheBustToken)
}

export async function loadTailorKitCopiedRouteRuntimePlan(host: AdminAppHost): Promise<TailorKitCopiedRouteRuntimePlan> {
  const manifestUrl = host.ports.assets.resolveAppAssetUrl(RUNTIME_MANIFEST_PATH)
  const response = await fetch(manifestUrl, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error('Cannot load TailorKit copied route runtime manifest')
  }

  const manifest = (await response.json()) as TailorKitCopiedRouteRuntimeManifest
  return createTailorKitCopiedRouteRuntimePlanFromManifest(host.route.fullPath, manifest)
}

function uniqueValues(values: readonly string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

async function loadRuntimeStyles(host: AdminAppHost, runtimePlan: TailorKitCopiedRouteRuntimePlan) {
  const routeCss = runtimePlan.executionPlan?.viteAssets?.routeEntryCssFiles || []
  const resolvedRouteLinks = runtimePlan.executionPlan?.stylesheets.resolvedHrefs || []
  const cssFiles = uniqueValues([...runtimePlan.runtimeAssets.cssFiles, ...routeCss, ...resolvedRouteLinks])

  await Promise.all(
    cssFiles.map(cssFile =>
      host.ports.assets.loadStylesheet(`admin/copied-routes/${cssFile}`, {
        key: `tailorkit-copied-route:${cssFile}`,
      })
    )
  )
}

export async function loadTailorKitCopiedRouteRuntime(host: AdminAppHost) {
  const runtimePlan = await loadTailorKitCopiedRouteRuntimePlan(host)

  if (!runtimePlan.executionPlan) {
    throw new Error('Current PageFly route is not a TailorKit copied route')
  }

  if (!runtimePlan.executionPlan.canExecuteRouteModule) {
    throw new Error(`TailorKit copied route runtime is blocked: ${runtimePlan.executionPlan.blockers.join(', ')}`)
  }

  await loadRuntimeStyles(host, runtimePlan)

  const entryUrl = createTailorKitCopiedRouteRuntimeEntryUrl(host, runtimePlan)
  const runtimeModule = (await import(/* @vite-ignore */ entryUrl)) as TailorKitCopiedRouteRuntimeModule

  if (typeof runtimeModule.renderTailorKitCopiedRoute !== 'function') {
    throw new Error('TailorKit copied route runtime does not export renderTailorKitCopiedRoute')
  }

  return {
    runtimePlan,
    runtimeModule,
  }
}
