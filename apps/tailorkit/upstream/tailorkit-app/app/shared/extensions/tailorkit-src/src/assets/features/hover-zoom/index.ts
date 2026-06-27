/**
 * Hover-Zoom Feature
 *
 * Provides lens-style magnification for desktop users.
 * When hovering over the canvas, a circular magnifying lens
 * follows the cursor showing a 2x magnified view.
 *
 * This feature complements the pinch-zoom feature:
 * - Desktop: Hover-zoom (lens following cursor)
 * - Mobile/Tablet: Pinch-zoom (via <tailorkit-zoom> component)
 *
 * Usage:
 * - Import HoverZoomManager
 * - Create instance with container and canvas elements
 * - Call destroy() on cleanup
 */

export { HoverZoomManager } from './HoverZoomManager'
export { HoverZoomLens } from './HoverZoomLens'
export type { HoverZoomConfig, HoverZoomConfigResolved } from './types'
