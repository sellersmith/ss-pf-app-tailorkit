/**
 * TailorKitZoom - Custom Web Component for Pinch-Zoom
 *
 * A framework-agnostic Web Component that wraps any element with
 * pinch-zoom, pan, and double-tap functionality.
 *
 * Usage:
 * ```html
 * <tailorkit-zoom min-scale="1" max-scale="3">
 *   <img src="image.jpg" />
 * </tailorkit-zoom>
 * ```
 *
 * JavaScript API:
 * ```javascript
 * const zoom = document.querySelector('tailorkit-zoom');
 * zoom.reset();     // Reset to initial state
 * zoom.zoomIn();    // Zoom in
 * zoom.zoomOut();   // Zoom out
 * zoom.scale;       // Current scale
 * ```
 */

import { h, render } from 'preact'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { ZoomIndicator } from './zoom-indicator'
import { translate } from '../../libraries/translation'
import { removeThemeZoom } from '../../utils/theme-zoom-remover'

// Store reference to TransformWrapper instance for API access
interface ZoomState {
  ref: ReactZoomPanPinchRef | null
  currentScale: number
}

/**
 * TailorKitZoom Custom Element
 *
 * Uses light DOM for better compatibility with existing styles.
 */
export class TailorKitZoom extends HTMLElement {
  private zoomState: ZoomState = {
    ref: null,
    currentScale: 1,
  }
  private wrapperElement: HTMLDivElement | null = null
  private contentContainer: HTMLDivElement | null = null
  private indicatorInstance: ZoomIndicator | null = null
  private initialized = false
  private childObserver: MutationObserver | null = null

  static get observedAttributes(): string[] {
    return ['min-scale', 'max-scale', 'double-tap-scale', 'enabled', 'show-indicator', 'selector', 'wheel-zoom']
  }

  // Default attribute values
  private get minScale(): number {
    return parseFloat(this.getAttribute('min-scale') || '1')
  }

  private get maxScale(): number {
    return parseFloat(this.getAttribute('max-scale') || '3')
  }

  private get doubleTapScale(): number {
    return parseFloat(this.getAttribute('double-tap-scale') || '2')
  }

  private get enabled(): boolean {
    const attr = this.getAttribute('enabled')
    return attr === null || attr !== 'false'
  }

  private get showIndicator(): boolean {
    const attr = this.getAttribute('show-indicator')
    return attr === null || attr !== 'false'
  }

  private get targetSelector(): string | null {
    return this.getAttribute('selector')
  }

  private get wheelZoomEnabled(): boolean {
    const attr = this.getAttribute('wheel-zoom')
    // Default to false - wheel zoom disabled to allow page scrolling
    // Pinch-to-zoom and double-tap still work on touch devices
    return attr === 'true'
  }

  // Public API - Current scale
  get scale(): number {
    return this.zoomState.currentScale
  }

  connectedCallback(): void {
    // Apply base styles immediately
    this.style.display = 'block'
    this.style.width = '100%'
    this.style.height = '100%'
    this.style.position = 'relative'
    this.style.overflow = 'hidden'
    // Default 'pan-x pan-y' so all native single-finger gestures pass through:
    //   • vertical → page scroll
    //   • horizontal → slideshow / Swiper
    // Pinch (multi-finger) is blocked at the browser level → library JS handles the zoom.
    // Switched to 'none' in handleTransformed when scale > 1 so the library can pan the
    // zoomed image with a single finger. Layer drag / transformer anchors still work
    // because their touchstart handlers call preventDefault to cancel the browser pan.
    this.style.touchAction = 'pan-x pan-y'

    // If already initialized (element was moved, not newly added), skip re-initialization
    if (this.initialized) {
      return
    }

    // Wait for children to be added before initializing
    // This handles the case where children are appended after insertion
    this.waitForChildren()
  }

  disconnectedCallback(): void {
    // Stop observing immediately
    if (this.childObserver) {
      this.childObserver.disconnect()
      this.childObserver = null
    }

    // Defer cleanup to handle DOM moves gracefully
    // When element is moved (not removed), it's disconnected then immediately reconnected
    // Using microtask allows us to check if we're still disconnected before destroying content
    queueMicrotask(() => {
      if (!this.isConnected) {
        // Actually removed from DOM, do full cleanup
        this.cleanup()
      }
      // If still connected, we were just moved - keep everything intact
    })
  }

  /**
   * Full cleanup when element is permanently removed
   */
  private cleanup(): void {
    if (this.wrapperElement) {
      render(null, this.wrapperElement)
      this.wrapperElement.remove()
      this.wrapperElement = null
    }

    this.contentContainer = null
    this.indicatorInstance = null
    this.initialized = false
  }

  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
    if (oldVal === newVal || !this.initialized) return

    // Re-initialize if attributes change
    this.cleanup()
    this.waitForChildren()
  }

  /**
   * Wait for children to be added before initializing zoom
   */
  private waitForChildren(): void {
    // Check if we already have meaningful children (not just text nodes)
    const hasElementChildren = Array.from(this.childNodes).some(
      node => node.nodeType === Node.ELEMENT_NODE && !(node as Element).classList?.contains('tailorkit-zoom-wrapper')
    )

    if (hasElementChildren) {
      // Children already present, initialize immediately
      this.initZoom()
      return
    }

    // No children yet, observe for additions
    this.childObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if a real element was added (not our wrapper)
          const hasNewElement = Array.from(mutation.addedNodes).some(
            node =>
              node.nodeType === Node.ELEMENT_NODE && !(node as Element).classList?.contains('tailorkit-zoom-wrapper')
          )

          if (hasNewElement && !this.initialized) {
            this.childObserver?.disconnect()
            this.childObserver = null
            this.initZoom()
            return
          }
        }
      }
    })

    this.childObserver.observe(this, { childList: true })
  }

  /**
   * Initialize the zoom functionality
   */
  private initZoom(): void {
    if (this.initialized) return
    this.initialized = true

    if (!this.enabled) {
      // If disabled, just keep children as-is
      return
    }

    // Remove conflicting theme zoom elements
    removeThemeZoom()

    // If selector provided, find and wrap only that element
    if (this.targetSelector) {
      this.initZoomWithSelector()
      return
    }

    // Default behavior: wrap all children
    this.initZoomAllChildren()
  }

  /**
   * Initialize zoom for a specific element matching the selector
   */
  private initZoomWithSelector(): void {
    const targetElement = this.querySelector(this.targetSelector!)
    if (!targetElement) {
      console.warn(`[TailorKit] PinchZoom: Selector "${this.targetSelector}" not found`)
      return
    }

    // Create wrapper for Preact rendering
    this.wrapperElement = document.createElement('div')
    this.wrapperElement.className = 'tailorkit-zoom-wrapper'
    this.wrapperElement.style.width = '100%'
    this.wrapperElement.style.height = '100%'

    // Insert wrapper before target element
    targetElement.parentElement?.insertBefore(this.wrapperElement, targetElement)

    // Use target element directly as content (no extra wrapper needed)
    this.contentContainer = targetElement as HTMLDivElement

    // Render Preact component
    this.renderZoomComponent()

    // Show zoom indicator if enabled
    if (this.showIndicator) {
      this.indicatorInstance = new ZoomIndicator({
        container: this,
        message: translate('pinch-to-zoom'),
        fadeDelay: 3000,
        showOncePerSession: true,
      })
    }
  }

  /**
   * Initialize zoom for all children (default behavior)
   */
  private initZoomAllChildren(): void {
    // Capture original children before modifying DOM
    // Filter out any existing wrapper (shouldn't happen, but be safe)
    const originalChildren = Array.from(this.childNodes).filter(
      node => !(node as Element).classList?.contains('tailorkit-zoom-wrapper')
    )

    if (originalChildren.length === 0) {
      console.warn('[TailorKit] PinchZoom: No children to wrap')
      return
    }

    // Create wrapper for Preact rendering
    this.wrapperElement = document.createElement('div')
    this.wrapperElement.className = 'tailorkit-zoom-wrapper'
    this.wrapperElement.style.width = '100%'
    this.wrapperElement.style.height = '100%'

    // Create content container for original children
    this.contentContainer = document.createElement('div')
    this.contentContainer.className = 'tailorkit-zoom-content'
    this.contentContainer.style.width = '100%'
    this.contentContainer.style.height = '100%'

    // Move original children to content container
    originalChildren.forEach(child => {
      this.contentContainer!.appendChild(child)
    })

    // Render Preact component with content container already populated
    this.renderZoomComponent()

    // Append wrapper to this element
    this.appendChild(this.wrapperElement)

    // Show zoom indicator if enabled
    if (this.showIndicator) {
      this.indicatorInstance = new ZoomIndicator({
        container: this,
        message: translate('pinch-to-zoom'),
        fadeDelay: 3000,
        showOncePerSession: true,
      })
    }
  }

  /**
   * Render the Preact zoom component
   */
  private renderZoomComponent(): void {
    if (!this.wrapperElement || !this.contentContainer) return

    const contentContainer = this.contentContainer

    const handleZoomChange = (ref: ReactZoomPanPinchRef) => {
      this.zoomState.ref = ref
    }

    const handleTransformed = (_ref: ReactZoomPanPinchRef, state: { scale: number }) => {
      const oldScale = this.zoomState.currentScale
      this.zoomState.currentScale = state.scale

      // While zoomed in, library needs full single-finger touch control to pan the zoomed
      // image. At default scale, restore 'pan-x pan-y' so native page scroll and slideshow
      // swipe work when the finger is on the canvas.
      this.style.touchAction = state.scale > 1.001 ? 'none' : 'pan-x pan-y'

      // Update cursor based on zoom level
      this.updateCursor(state.scale)

      // Dispatch custom event
      if (oldScale !== state.scale) {
        this.dispatchEvent(
          new CustomEvent('zoom-change', {
            detail: { scale: state.scale, previousScale: oldScale },
            bubbles: true,
            composed: true,
          })
        )
      }
    }

    render(
      h(
        TransformWrapper,
        {
          initialScale: 1,
          minScale: this.minScale,
          maxScale: this.maxScale,
          centerOnInit: true,
          doubleClick: {
            mode: 'toggle',
            step: this.doubleTapScale - 1,
          },
          panning: {
            velocityDisabled: true,
            excluded: ['konvajs-content'], // Let Konva handle touch-drag on canvas
          },
          wheel: {
            disabled: !this.wheelZoomEnabled,
            step: 0.1,
            smoothStep: 0.004,
          },
          onInit: handleZoomChange,
          onTransformed: handleTransformed,
        },
        h(TransformComponent, {
          wrapperStyle: {
            width: '100%',
            height: '100%',
            overflow: 'hidden',
          },
          contentStyle: {
            width: '100%',
            height: '100%',
          },
          // Cast to any: Preact VNode is compatible at runtime but not with React types
          children: h('div', {
            ref: (el: HTMLDivElement | null) => {
              if (el && contentContainer.parentElement !== el) {
                el.appendChild(contentContainer)
              }
            },
            style: {
              width: '100%',
              height: '100%',
            },
          }) as any,
        })
      ),
      this.wrapperElement
    )

    // Initialize cursor style for wheel zoom
    this.initCursor()
  }

  // Public API Methods

  /**
   * Reset zoom to initial state (scale = 1, centered)
   */
  reset(): void {
    if (this.zoomState.ref) {
      this.zoomState.ref.resetTransform()
    }
  }

  /**
   * Zoom in by one step
   */
  zoomIn(step = 0.5): void {
    if (this.zoomState.ref) {
      this.zoomState.ref.zoomIn(step)
    }
  }

  /**
   * Zoom out by one step
   */
  zoomOut(step = 0.5): void {
    if (this.zoomState.ref) {
      this.zoomState.ref.zoomOut(step)
    }
  }

  /**
   * Set zoom to a specific scale
   */
  setScale(scale: number): void {
    if (this.zoomState.ref) {
      const clampedScale = Math.min(Math.max(scale, this.minScale), this.maxScale)
      this.zoomState.ref.setTransform(0, 0, clampedScale)
    }
  }

  /**
   * Center the content
   */
  center(): void {
    if (this.zoomState.ref) {
      this.zoomState.ref.centerView()
    }
  }

  /**
   * Update cursor based on current zoom level
   * Shows zoom-in when at min scale, zoom-out when zoomed in
   */
  private updateCursor(scale: number): void {
    if (!this.wheelZoomEnabled) {
      this.style.cursor = 'default'
      return
    }

    // At minimum scale, show zoom-in cursor
    // When zoomed in, show zoom-out cursor (scrolling up zooms out)
    if (scale <= this.minScale) {
      this.style.cursor = 'zoom-in'
    } else if (scale >= this.maxScale) {
      this.style.cursor = 'zoom-out'
    } else {
      // In between - default to zoom-in for scroll down, but zoom-out is also possible
      // Use a generic cursor that indicates zoom capability
      this.style.cursor = 'zoom-in'
    }
  }

  /**
   * Initialize cursor style on hover
   */
  private initCursor(): void {
    if (this.wheelZoomEnabled) {
      this.updateCursor(this.zoomState.currentScale)
    }
  }
}

// Register custom element
if (!customElements.get('tailorkit-zoom')) {
  customElements.define('tailorkit-zoom', TailorKitZoom)
}

export default TailorKitZoom
