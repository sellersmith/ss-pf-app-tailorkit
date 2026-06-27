/**
 * PinchZoomManager - Handles pinch-to-zoom and double-tap gestures on Konva Stage
 *
 * Uses AlloyFinger (Tencent's gesture library) for reliable multi-touch handling.
 * This replaces the custom touch event handling with a battle-tested library.
 *
 * Features:
 * - Pinch-to-zoom with smooth scaling (via AlloyFinger's evt.zoom)
 * - Pan while zoomed (via AlloyFinger's pressMove)
 * - Double-tap to toggle 2x zoom (via AlloyFinger's doubleTap)
 * - Smooth animations for zoom transitions
 */

import Konva from 'konva'
import AlloyFinger from 'alloyfinger'
import type { PinchZoomConfig, ViewPort } from './types'
import { ZoomIndicator } from './zoom-indicator'

/** Default configuration values */
const DEFAULT_CONFIG = {
  maxZoomMultiplier: 3,
  doubleTapZoomFactor: 2,
  showIndicator: true,
  /** Minimum zoom change to apply (prevents jitter) */
  zoomThreshold: 0.005,
}

export class PinchZoomManager {
  private stage: Konva.Stage
  private config: Required<Omit<PinchZoomConfig, 'stage' | 'onViewportChange' | 'onZoomStart' | 'onZoomEnd'>> & {
    onViewportChange?: PinchZoomConfig['onViewportChange']
    onZoomStart?: PinchZoomConfig['onZoomStart']
    onZoomEnd?: PinchZoomConfig['onZoomEnd']
  }
  private container: HTMLElement | null = null

  // Initial scale when manager was created
  private initialScale: number = 1
  private initialPosition: { x: number; y: number } = { x: 0, y: 0 }

  // Current viewport state
  private viewport: ViewPort = { scale: 1, left: 0, top: 0 }

  // Gesture state
  private gestureStartScale: number = 1
  private gestureStartPosition: { x: number; y: number } = { x: 0, y: 0 }
  private isPinching = false

  // AlloyFinger instance
  private alloyFinger: AlloyFinger | null = null

  // Animation
  private animationFrame: number | null = null

  // Sub-components
  private zoomIndicator: ZoomIndicator | null = null

  constructor(config: PinchZoomConfig) {
    this.stage = config.stage
    this.container = this.stage.container()

    // Initialize viewport from current stage state
    const stageScale = this.stage.scaleX() || 1
    const stagePos = this.stage.position()
    this.viewport = {
      scale: stageScale,
      left: stagePos.x || 0,
      top: stagePos.y || 0,
    }

    // Store initial state for reset
    this.initialScale = stageScale
    this.initialPosition = { x: stagePos.x || 0, y: stagePos.y || 0 }

    // Calculate min/max scale
    const minScale = this.initialScale * 0.99 // Small tolerance for float drift
    const maxScale = this.initialScale * DEFAULT_CONFIG.maxZoomMultiplier

    this.config = {
      enabled: config.enabled,
      minScale: config.minScale ?? minScale,
      maxScale: config.maxScale ?? maxScale,
      doubleTapZoomFactor: config.doubleTapZoomFactor ?? DEFAULT_CONFIG.doubleTapZoomFactor,
      showIndicator: config.showIndicator ?? DEFAULT_CONFIG.showIndicator,
      onViewportChange: config.onViewportChange,
      onZoomStart: config.onZoomStart,
      onZoomEnd: config.onZoomEnd,
    }

    console.log('[TailorKit] PinchZoom: Initial scale:', this.initialScale, 'Min:', minScale, 'Max:', maxScale)

    if (this.config.enabled) {
      this.init()
    }
  }

  /**
   * Initialize AlloyFinger and event listeners
   */
  private init(): void {
    if (!this.container) return

    // Ensure container receives touch events
    this.container.style.zIndex = '100'
    this.container.style.touchAction = 'none' // Prevent browser gestures

    // Initialize AlloyFinger
    this.alloyFinger = new AlloyFinger(this.container, {
      multipointStart: this.handleMultipointStart.bind(this),
      multipointEnd: this.handleMultipointEnd.bind(this),
      pinch: this.handlePinch.bind(this),
      pressMove: this.handlePressMove.bind(this),
      doubleTap: this.handleDoubleTap.bind(this),
    })

    // Show zoom indicator if enabled
    if (this.config.showIndicator) {
      this.showZoomIndicator()
    }

    console.log('[TailorKit] PinchZoomManager initialized with AlloyFinger')
  }

  /**
   * Handle multi-point gesture start (2+ fingers)
   */
  private handleMultipointStart(): void {
    if (!this.config.enabled) return

    this.isPinching = true

    // Disable Konva interactions during pinch
    Konva.hitOnDragEnabled = false
    if (Konva.DD && Konva.DD.node) {
      Konva.DD.node.stopDrag()
    }

    // Store gesture start state
    this.gestureStartScale = this.viewport.scale
    this.gestureStartPosition = { x: this.viewport.left, y: this.viewport.top }

    this.config.onZoomStart?.()
  }

  /**
   * Handle multi-point gesture end
   */
  private handleMultipointEnd(): void {
    if (!this.config.enabled) return

    this.isPinching = false

    // Re-enable Konva interactions
    Konva.hitOnDragEnabled = true

    // Snap to initial if close
    if (Math.abs(this.viewport.scale - this.initialScale) < 0.02) {
      this.viewport.scale = this.initialScale
      this.viewport.left = this.initialPosition.x
      this.viewport.top = this.initialPosition.y
      this.applyViewport()
    }

    this.config.onZoomEnd?.()
  }

  /**
   * Handle pinch gesture
   * AlloyFinger provides evt.zoom as cumulative scale from gesture start
   */
  private handlePinch(evt: { zoom: number; center: { x: number; y: number } }): void {
    if (!this.config.enabled || !this.isPinching) return

    const { zoom, center } = evt

    // Calculate new scale (cumulative from gesture start)
    let newScale = this.gestureStartScale * zoom

    // Check threshold to prevent jitter
    const scaleDiff = Math.abs(newScale - this.viewport.scale)
    if (scaleDiff < DEFAULT_CONFIG.zoomThreshold) return

    // Clamp scale to bounds
    newScale = Math.max(this.config.minScale, Math.min(this.config.maxScale, newScale))

    // Get pinch center relative to container
    const containerRect = this.container?.getBoundingClientRect()
    if (!containerRect) return

    const pinchCenter = {
      x: center.x - containerRect.left,
      y: center.y - containerRect.top,
    }

    // Calculate the point we're zooming toward in scene coordinates
    const pointTo = {
      x: (pinchCenter.x - this.viewport.left) / this.viewport.scale,
      y: (pinchCenter.y - this.viewport.top) / this.viewport.scale,
    }

    // Calculate new position to keep pointTo under pinch center
    const newLeft = pinchCenter.x - pointTo.x * newScale
    const newTop = pinchCenter.y - pointTo.y * newScale

    // Update viewport
    this.viewport = {
      scale: newScale,
      left: newLeft,
      top: newTop,
    }

    this.applyViewport()
    this.config.onViewportChange?.(this.viewport)
  }

  /**
   * Handle press move (pan) gesture
   * AlloyFinger provides evt.deltaX/deltaY for movement
   */
  private handlePressMove(evt: { deltaX: number; deltaY: number }): void {
    if (!this.config.enabled) return

    // Only allow panning when zoomed in
    if (this.viewport.scale <= this.initialScale * 1.05) return

    // Skip if currently pinching (pinch handles its own movement)
    if (this.isPinching) return

    this.viewport.left += evt.deltaX
    this.viewport.top += evt.deltaY

    this.applyViewport()
    this.config.onViewportChange?.(this.viewport)
  }

  /**
   * Handle double-tap gesture
   * Toggle between initial scale and 2x zoom
   */
  private handleDoubleTap(evt: { changedTouches: TouchList }): void {
    if (!this.config.enabled) return

    // Prevent theme's default behavior
    const nativeEvent = evt as unknown as TouchEvent
    nativeEvent.preventDefault?.()
    nativeEvent.stopPropagation?.()

    const touch = evt.changedTouches?.[0]
    if (!touch) return

    const containerRect = this.container?.getBoundingClientRect()
    if (!containerRect) return

    const tapPosition = {
      x: touch.clientX - containerRect.left,
      y: touch.clientY - containerRect.top,
    }

    // Determine if we're zoomed in
    const isZoomedIn = this.viewport.scale > this.initialScale * 1.1
    const targetScale = isZoomedIn ? this.initialScale : this.initialScale * this.config.doubleTapZoomFactor

    if (isZoomedIn) {
      // Reset to initial state
      this.animateViewport({
        scale: this.initialScale,
        left: this.initialPosition.x,
        top: this.initialPosition.y,
      })
    } else {
      // Zoom in centered on tap
      const pointTo = {
        x: (tapPosition.x - this.viewport.left) / this.viewport.scale,
        y: (tapPosition.y - this.viewport.top) / this.viewport.scale,
      }

      this.animateViewport({
        scale: targetScale,
        left: tapPosition.x - pointTo.x * targetScale,
        top: tapPosition.y - pointTo.y * targetScale,
      })
    }

    console.log('[TailorKit] PinchZoom: Double-tap', isZoomedIn ? 'reset' : 'zoom in', 'to scale:', targetScale)
  }

  /**
   * Animate viewport change with easing
   */
  private animateViewport(targetViewport: ViewPort, duration = 200): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
    }

    const startViewport = { ...this.viewport }
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)

      this.viewport = {
        scale: startViewport.scale + (targetViewport.scale - startViewport.scale) * eased,
        left: startViewport.left + (targetViewport.left - startViewport.left) * eased,
        top: startViewport.top + (targetViewport.top - startViewport.top) * eased,
      }

      this.applyViewport()
      this.config.onViewportChange?.(this.viewport)

      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(animate)
      } else {
        this.animationFrame = null
        // Snap to exact target
        this.viewport = targetViewport
        this.applyViewport()
      }
    }

    this.animationFrame = requestAnimationFrame(animate)
  }

  /**
   * Apply viewport to Konva stage
   */
  private applyViewport(): void {
    this.stage.scale({ x: this.viewport.scale, y: this.viewport.scale })
    this.stage.position({ x: this.viewport.left, y: this.viewport.top })
    this.stage.batchDraw()
  }

  /**
   * Show zoom indicator
   */
  public showZoomIndicator(): void {
    if (!this.container) return

    this.zoomIndicator = new ZoomIndicator({
      container: this.container,
      message: 'Pinch to zoom',
      fadeDelay: 3000,
      showOncePerSession: true,
    })
  }

  /**
   * Reset viewport to initial state
   */
  public resetViewport(): void {
    this.animateViewport({
      scale: this.initialScale,
      left: this.initialPosition.x,
      top: this.initialPosition.y,
    })
  }

  /**
   * Get current viewport state
   */
  public getViewport(): ViewPort {
    return { ...this.viewport }
  }

  /**
   * Check if currently pinching
   */
  public isPinchingNow(): boolean {
    return this.isPinching
  }

  /**
   * Enable pinch zoom
   */
  public enable(): void {
    if (this.config.enabled) return
    this.config.enabled = true
    this.init()
  }

  /**
   * Disable pinch zoom
   */
  public disable(): void {
    this.config.enabled = false
    this.destroy()
  }

  /**
   * Clean up
   */
  public destroy(): void {
    if (this.alloyFinger) {
      this.alloyFinger.destroy()
      this.alloyFinger = null
    }

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
    }

    this.zoomIndicator?.destroy()

    console.log('[TailorKit] PinchZoomManager destroyed')
  }
}
