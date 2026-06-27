/**
 * Overlay Compositor Utility
 * Re-exports from shared utils for backward compatibility
 *
 * @see app/shared/utils/overlay-compositor.ts for the actual implementation
 */

export {
  compositeImageWithOverlay,
  hasVisualOverlay,
  createCachedCompositor,
  type OverlayMetadata,
  type OverlayData,
  type OverlayCompositorOptions,
  type CompositorResult,
} from '~/shared/utils/overlay-compositor'

export { default } from '~/shared/utils/overlay-compositor'
