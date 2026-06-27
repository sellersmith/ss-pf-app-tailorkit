/**
 * Charm-Builder Feature Module
 *
 * Lazy-loaded feature that provides:
 * - <tailorkit-charm-picker> Web Component registration
 * - Charm node layer rendering on storefront canvas
 *
 * Loaded on-demand via loadFeature('charm-builder') when a product
 * has charm-node layers. This keeps the main tailorkit.js bundle lean
 * for pages without charm products.
 *
 * Pattern: same as pinch-zoom feature (IIFE + notifyFeatureReady)
 */

import { notifyFeatureReady } from '../../utils/feature-loader'
import type { CharmBuilderFeatureModule } from '../../utils/feature-loader.types'
import { registerCharmPickerElement, CHARM_CHANGE_EVENT } from '../../../shared/components/CharmPicker'
import {
  renderCharmNodeLayer,
  getSlotAssignments,
  getFreeModePositions,
  freeSlotInCache,
} from '../../services/charm-layer-renderer'

// Re-export for consumer access via window.TailorKitCharmBuilder
export {
  registerCharmPickerElement,
  renderCharmNodeLayer,
  CHARM_CHANGE_EVENT,
  getSlotAssignments,
  getFreeModePositions,
  freeSlotInCache,
}
export { CharmBuilderStore } from './store'
export { StorefrontCharmCanvas } from './canvas'
export type {
  CharmBuilderState,
  CharmNodeLayer,
  CharmSlotNode,
  CharmLinkedProduct,
  CharmNodeSettings,
  CharmBuilderAction,
} from './types'
export {
  extractCharmNodeFromPrintAreas,
  buildDefaultAssignments,
  buildDefaultPositions,
  countAssignedSlots,
  resolveSlotById,
} from './utils'

// Auto-register <tailorkit-charm-picker> custom element when this module loads.
// product-personalizer.ts calls loadFeature('charm-builder') then immediately creates
// <tailorkit-charm-picker> elements — the element must be registered by then.
registerCharmPickerElement()

// Register the charm-builder feature module
const charmBuilderModule: CharmBuilderFeatureModule = {
  registerCharmPickerElement,
  renderCharmNodeLayer,
  CHARM_CHANGE_EVENT,
  getSlotAssignments,
  getFreeModePositions,
  freeSlotInCache,
  ready: true,
}

// Notify feature-loader — sets window.TailorKitCharmBuilder and fires ready event
notifyFeatureReady('charm-builder', charmBuilderModule)
