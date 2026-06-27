/**
 * Pinch-Zoom Feature
 *
 * Provides <tailorkit-zoom> Web Component for wrapping any element
 * with pinch-zoom, pan, and double-tap functionality.
 *
 * The component uses react-zoom-pan-pinch internally with CSS transforms
 * (translate3d/scale3d) for GPU-accelerated zooming.
 *
 * Usage:
 * - This module is loaded via script tag in customizer.liquid
 * - It registers the <tailorkit-zoom> custom element globally
 * - product-personalizer uses it to wrap canvas at render time
 *
 * This approach:
 * - Follows SOLID principles (encapsulation)
 * - Component owns its canvas features
 * - No external DOM queries into internal structure
 */

// Import the feature loader notification function
import { notifyFeatureReady } from '../../utils/feature-loader'
import type { PinchZoomFeatureModule } from '../../utils/feature-loader.types'

// Import for feature module registration (also registers custom element as side effect)
import { TailorKitZoom } from './TailorKitZoom'
import { getZoomSettings } from './settings'
import { removeThemeZoom } from '../../utils/theme-zoom-remover'

// Export for use by product-personalizer
export { TailorKitZoom, getZoomSettings, removeThemeZoom }
export type { ZoomSettings } from './settings'
export type { ViewPort } from './types'

// Register globally using the universal feature loader pattern
const pinchZoomModule: PinchZoomFeatureModule = {
  TailorKitZoom,
  getZoomSettings,
  removeThemeZoom,
  ready: true,
}

// Notify the feature loader that pinch-zoom is ready
notifyFeatureReady('pinch-zoom', pinchZoomModule)
