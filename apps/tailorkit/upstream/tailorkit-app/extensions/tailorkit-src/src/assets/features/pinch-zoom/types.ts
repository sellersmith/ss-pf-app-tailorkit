/**
 * Pinch-Zoom Feature Types
 *
 * TypeScript interfaces for the storefront pinch-zoom module.
 */

/**
 * Viewport state representing the current zoom and pan position
 */
export interface ViewPort {
  /** Current scale factor (1 = 100%) */
  scale: number
  /** Horizontal offset in pixels */
  left: number
  /** Vertical offset in pixels */
  top: number
}

/**
 * Zoom indicator configuration
 */
export interface ZoomIndicatorConfig {
  /** Container element to append indicator to */
  container: HTMLElement
  /** Message to display (default: "Pinch to zoom") */
  message?: string
  /** Duration before fade out in ms (default: 3000) */
  fadeDelay?: number
  /** Whether to only show once per session (default: true) */
  showOncePerSession?: boolean
}

/**
 * TailorKitZoom Web Component attributes
 */
export interface TailorKitZoomAttributes {
  /** Minimum zoom scale (default: 1) */
  'min-scale'?: string
  /** Maximum zoom scale (default: 3) */
  'max-scale'?: string
  /** Double-tap zoom scale (default: 2) */
  'double-tap-scale'?: string
  /** Whether zoom is enabled (default: true) */
  enabled?: 'true' | 'false'
  /** Whether to show zoom indicator (default: true) */
  'show-indicator'?: 'true' | 'false'
}

/**
 * TailorKitZoom custom event detail
 */
export interface ZoomChangeEventDetail {
  /** Current zoom scale */
  scale: number
  /** Previous zoom scale */
  previousScale: number
}

/**
 * TailorKitZoom custom events
 */
export interface TailorKitZoomEventMap {
  'zoom-change': CustomEvent<ZoomChangeEventDetail>
}

// Augment global HTMLElementTagNameMap for TypeScript support
declare global {
  interface HTMLElementTagNameMap {
    'tailorkit-zoom': HTMLElement & {
      /** Current zoom scale */
      readonly scale: number
      /** Reset zoom to initial state */
      reset(): void
      /** Zoom in by step (default: 0.5) */
      zoomIn(step?: number): void
      /** Zoom out by step (default: 0.5) */
      zoomOut(step?: number): void
      /** Set zoom to specific scale */
      setScale(scale: number): void
      /** Center the content */
      center(): void
    }
  }
}
