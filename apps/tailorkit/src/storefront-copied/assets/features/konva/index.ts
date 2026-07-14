/**
 * Konva Feature Module
 *
 * Entry point for the standalone Konva bundle.
 * Exposes KonvaCanvasManager, raw Konva, initKonvaEditor, and related utilities globally
 * for consumption by product-personalizer and image-editor.
 *
 * StorefrontInteractiveCanvasManager is exported from THIS bundle (not tailorkit.js)
 * so that it shares the SINGLE Konva instance bundled here. Keeping it in a separate bundle
 * would cause a second Konva instance → Konva warning "Several Konva instances detected".
 */

// Import the manager and raw Konva for global registration
import { KonvaCanvasManager } from '../../../shared/libraries/konva/core'
import Konva from 'konva'

// Import the Konva editor initializer (this includes all editor components)
import { initKonvaEditor } from '../../handlers/event-handlers/image-editor/konva-editor'

// Import StorefrontInteractiveCanvasManager — lives HERE so it uses the same Konva instance
import { StorefrontInteractiveCanvasManager } from '../../utils/storefront-interactive-canvas-manager'

// Import the feature loader notification function
import { notifyFeatureReady } from '../../utils/feature-loader'
import type { KonvaFeatureModule } from '../../utils/feature-loader.types'

// Re-export the entire Konva library bundle
export { KonvaCanvasManager } from '../../../shared/libraries/konva/core'
export { default as Konva } from 'konva'
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

// Register globally using the universal feature loader pattern
const konvaModule: KonvaFeatureModule = {
  Konva,
  KonvaCanvasManager,
  initKonvaEditor,
  StorefrontInteractiveCanvasManager,
  ready: true,
}

// Notify the feature loader that Konva is ready
// This handles window registration, callbacks, and event dispatch
notifyFeatureReady('konva', konvaModule)

// Also fire legacy callbacks for backward compatibility
if (window.__tailorkit_konva_ready_callbacks__) {
  window.__tailorkit_konva_ready_callbacks__.forEach(cb => cb())
  delete window.__tailorkit_konva_ready_callbacks__
}
