/**
 * DoubleTapHandler - Detects double-tap gestures on touch devices
 *
 * Detects when a user double-taps on an element within a specified
 * time window and distance threshold.
 *
 * Configuration:
 * - Time threshold: 300ms between taps
 * - Distance threshold: 30px movement allowed
 */

export interface DoubleTapConfig {
  /** Container element to listen on */
  container: HTMLElement
  /** Callback when double-tap is detected */
  onDoubleTap: (position: { x: number; y: number }) => void
  /** Maximum time between taps in ms (default: 300) */
  timeThreshold?: number
  /** Maximum distance between taps in px (default: 30) */
  distanceThreshold?: number
}

/** Default configuration values */
const DEFAULT_CONFIG = {
  timeThreshold: 300,
  distanceThreshold: 30,
}

export class DoubleTapHandler {
  private container: HTMLElement
  private config: Required<DoubleTapConfig>

  // Double-tap detection state
  private lastTapTime = 0
  private lastTapPosition: { x: number; y: number } | null = null
  private tapTimeout: ReturnType<typeof setTimeout> | null = null

  // Flag to suppress click event after double-tap
  private suppressNextClick = false
  private suppressClickTimeout: ReturnType<typeof setTimeout> | null = null

  // Bound event handlers
  private boundTouchEnd: (e: TouchEvent) => void
  private boundClick: (e: MouseEvent) => void

  constructor(config: DoubleTapConfig) {
    this.container = config.container
    this.config = {
      container: config.container,
      onDoubleTap: config.onDoubleTap,
      timeThreshold: config.timeThreshold ?? DEFAULT_CONFIG.timeThreshold,
      distanceThreshold: config.distanceThreshold ?? DEFAULT_CONFIG.distanceThreshold,
    }

    this.boundTouchEnd = this.handleTouchEnd.bind(this)
    this.boundClick = this.handleClick.bind(this)
    this.init()
  }

  /**
   * Initialize event listeners
   */
  private init(): void {
    // Use passive: false so we can preventDefault to stop theme's default behavior
    this.container.addEventListener('touchend', this.boundTouchEnd, { passive: false })
    // Capture click events at document level to intercept before theme handlers
    // This catches clicks even if theme listens on parent elements
    document.addEventListener('click', this.boundClick, { capture: true })
  }

  /**
   * Handle click - suppress if we just handled a double-tap
   */
  private handleClick(e: MouseEvent): void {
    if (this.suppressNextClick) {
      // Check if click is within our container
      if (this.container.contains(e.target as Node)) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        console.log('[TailorKit] PinchZoom: Suppressed click after double-tap')
        // Reset flag immediately after suppressing
        this.suppressNextClick = false
      }
    }
  }

  /**
   * Handle touch end - detect single tap and check for double-tap pattern
   */
  private handleTouchEnd(e: TouchEvent): void {
    // Only process single-finger taps
    if (e.changedTouches.length !== 1) return

    const touch = e.changedTouches[0]
    const currentTime = Date.now()
    const currentPosition = { x: touch.clientX, y: touch.clientY }

    // Check if this is a potential double-tap
    if (this.lastTapPosition) {
      const timeDiff = currentTime - this.lastTapTime
      const distance = this.getDistance(currentPosition, this.lastTapPosition)

      if (timeDiff < this.config.timeThreshold && distance < this.config.distanceThreshold) {
        // Double-tap detected! Prevent theme's default behavior
        e.preventDefault()
        e.stopPropagation()

        // Set flag to suppress the click event that follows touchend
        this.suppressNextClick = true
        // Clear the flag after a short delay (click events fire ~300ms after touch)
        if (this.suppressClickTimeout) {
          clearTimeout(this.suppressClickTimeout)
        }
        this.suppressClickTimeout = setTimeout(() => {
          this.suppressNextClick = false
          this.suppressClickTimeout = null
        }, 400)

        this.clearTapState()
        this.config.onDoubleTap(currentPosition)
        return
      }
    }

    // Store this tap for potential double-tap detection
    this.lastTapTime = currentTime
    this.lastTapPosition = currentPosition

    // Clear tap state after timeout
    if (this.tapTimeout) {
      clearTimeout(this.tapTimeout)
    }
    this.tapTimeout = setTimeout(() => {
      this.clearTapState()
    }, this.config.timeThreshold)
  }

  /**
   * Calculate distance between two points
   */
  private getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * Clear tap detection state
   */
  private clearTapState(): void {
    this.lastTapTime = 0
    this.lastTapPosition = null
    if (this.tapTimeout) {
      clearTimeout(this.tapTimeout)
      this.tapTimeout = null
    }
  }

  /**
   * Clean up event listeners
   */
  public destroy(): void {
    this.container.removeEventListener('touchend', this.boundTouchEnd)
    document.removeEventListener('click', this.boundClick, { capture: true })
    this.clearTapState()
    if (this.suppressClickTimeout) {
      clearTimeout(this.suppressClickTimeout)
      this.suppressClickTimeout = null
    }
    this.suppressNextClick = false
  }
}
