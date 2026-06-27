import type { AdminAppHost } from '../../../../../web/core/src/app-platform/admin'
import type {
  TailorKitProductEditorIslandHandle,
  TailorKitProductEditorRuntimeProps,
} from './runtime-entry'
import {
  collectTailorKitViteManifestEntryAssets,
  type TailorKitViteManifest,
} from '../../domain/vite-manifest-assets'

const RUNTIME_MANIFEST_PATH = 'admin/product-editor-island/manifest.json'
const RUNTIME_ENTRY_SOURCE = 'src/admin/product-editor-island/runtime-entry.tsx'

export interface TailorKitProductEditorRuntimeAssets {
  entryFile: string
  cssFiles: string[]
}

export interface TailorKitProductEditorRuntimeModule {
  renderTailorKitProductEditorIsland(
    target: HTMLElement,
    props: TailorKitProductEditorRuntimeProps
  ): TailorKitProductEditorIslandHandle
}

export type TailorKitProductEditorRuntimeManifest = TailorKitViteManifest

export function collectTailorKitProductEditorRuntimeAssets(
  manifest: TailorKitProductEditorRuntimeManifest
): TailorKitProductEditorRuntimeAssets {
  return collectTailorKitViteManifestEntryAssets(
    manifest,
    RUNTIME_ENTRY_SOURCE,
    'TailorKit ProductEditor runtime manifest is missing the runtime entry'
  )
}

export async function loadTailorKitProductEditorRuntime(host: AdminAppHost): Promise<TailorKitProductEditorRuntimeModule> {
  const manifestUrl = host.ports.assets.resolveAppAssetUrl(RUNTIME_MANIFEST_PATH)
  const response = await fetch(manifestUrl)
  if (!response.ok) {
    throw new Error('Cannot load TailorKit ProductEditor runtime manifest')
  }

  const manifest = (await response.json()) as TailorKitProductEditorRuntimeManifest
  const assets = collectTailorKitProductEditorRuntimeAssets(manifest)

  await Promise.all(
    assets.cssFiles.map(cssFile =>
      host.ports.assets.loadStylesheet(`admin/product-editor-island/${cssFile}`, {
        key: `tailorkit-product-editor:${cssFile}`,
      })
    )
  )

  const entryUrl = host.ports.assets.resolveAppAssetUrl(`admin/product-editor-island/${assets.entryFile}`)
  const runtimeModule = (await import(/* @vite-ignore */ entryUrl)) as TailorKitProductEditorRuntimeModule

  if (typeof runtimeModule.renderTailorKitProductEditorIsland !== 'function') {
    throw new Error('TailorKit ProductEditor runtime module does not export renderTailorKitProductEditorIsland')
  }

  return runtimeModule
}
