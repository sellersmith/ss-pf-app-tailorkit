/**
 * Konva Feature Module
 *
 * Entry point for the lazy Konva feature bundle.
 * Exposes KonvaCanvasManager, CDN/global Konva, initKonvaEditor, and related utilities globally
 * for consumption by product-personalizer and image-editor.
 */

import { loadTailorKitKonva } from '../../../../storefront/konva-loader'
import { KonvaCanvasManager } from '../../../shared/libraries/konva/core'
import { setTailorKitKonvaRuntime, TailorKitKonva } from '../../../shared/libraries/konva/runtime-konva'
import { initKonvaEditor } from '../../handlers/event-handlers/image-editor/konva-editor'
import { StorefrontInteractiveCanvasManager } from '../../utils/storefront-interactive-canvas-manager'
import { notifyFeatureReady } from '../../utils/feature-loader'
import type { KonvaFeatureModule } from '../../utils/feature-loader.types'

export { KonvaCanvasManager } from '../../../shared/libraries/konva/core'
export { TailorKitKonva as Konva } from '../../../shared/libraries/konva/runtime-konva'
export { initKonvaEditor } from '../../handlers/event-handlers/image-editor/konva-editor'
export { StorefrontInteractiveCanvasManager } from '../../utils/storefront-interactive-canvas-manager'
export type { IMaskConfig } from '../../../shared/libraries/konva/core/konva-canvas-manager'
export type {
  KonvaEditor,
  KonvaEditorConfig,
  KonvaEditorState,
} from '../../handlers/event-handlers/image-editor/types/editor-types'
export * from '../../../shared/libraries/konva/text'
export * from '../../../shared/libraries/konva/image'
export * from '../../../shared/libraries/konva/effects/utils'

async function registerKonvaFeature(): Promise<void> {
  const Konva = await loadTailorKitKonva()
  setTailorKitKonvaRuntime(Konva)

  const konvaModule: KonvaFeatureModule = {
    Konva,
    KonvaCanvasManager,
    initKonvaEditor,
    StorefrontInteractiveCanvasManager,
    ready: true,
  }

  notifyFeatureReady('konva', konvaModule)

  if (window.__tailorkit_konva_ready_callbacks__) {
    window.__tailorkit_konva_ready_callbacks__.forEach(cb => cb())
    delete window.__tailorkit_konva_ready_callbacks__
  }
}

registerKonvaFeature().catch(error => {
  console.error('[TailorKit] Failed to load Konva feature', error)
})
