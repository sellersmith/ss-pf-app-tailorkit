/**
 * ZoomIndicator - Displays a "Pinch to zoom" message that fades out
 *
 * Shows a visual indicator to inform users that pinch-to-zoom is available.
 * The indicator fades in on display and automatically fades out after a delay.
 *
 * Features:
 * - Fade in/out animation
 * - Auto-dismiss after configurable delay
 * - Session-based "show once" behavior
 * - Accessible with proper contrast
 */

import { translate } from '../../libraries/translation'
import type { ZoomIndicatorConfig } from './types'

/** Storage key for session-based "shown" flag */
const STORAGE_KEY = 'tailorkit-zoom-indicator-shown'

/** Default configuration values */
const DEFAULT_CONFIG = {
  message: translate('pinch-to-zoom'),
  fadeDelay: 3000,
  showOncePerSession: true,
}

export class ZoomIndicator {
  private container: HTMLElement
  private config: Required<ZoomIndicatorConfig>
  private element: HTMLElement | null = null
  private fadeTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(config: ZoomIndicatorConfig) {
    this.container = config.container
    this.config = {
      container: config.container,
      message: config.message ?? DEFAULT_CONFIG.message,
      fadeDelay: config.fadeDelay ?? DEFAULT_CONFIG.fadeDelay,
      showOncePerSession: config.showOncePerSession ?? DEFAULT_CONFIG.showOncePerSession,
    }

    this.show()
  }

  /**
   * Check if indicator should be shown (respects showOncePerSession)
   */
  private shouldShow(): boolean {
    if (!this.config.showOncePerSession) return true

    try {
      const shown = sessionStorage.getItem(STORAGE_KEY)
      return !shown
    } catch {
      // sessionStorage not available, show anyway
      return true
    }
  }

  /**
   * Mark indicator as shown in session storage
   */
  private markAsShown(): void {
    if (!this.config.showOncePerSession) return

    try {
      sessionStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // sessionStorage not available, ignore
    }
  }

  /**
   * Create and show the indicator element
   */
  private show(): void {
    if (!this.shouldShow()) return

    // Create indicator element
    this.element = document.createElement('div')
    this.element.className = 'emtlkit-zoom-indicator'
    this.element.setAttribute('role', 'status')
    this.element.setAttribute('aria-live', 'polite')

    // Create icon (pinch gesture icon using SVG)
    const icon = document.createElement('span')
    icon.className = 'emtlkit-zoom-indicator__icon'
    icon.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 9L5 5M9 9V5M9 9H5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M15 15L19 19M15 15V19M15 15H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `

    // Create message text
    const text = document.createElement('span')
    text.className = 'emtlkit-zoom-indicator__text'
    text.textContent = this.config.message

    this.element.appendChild(icon)
    this.element.appendChild(text)

    // Apply styles
    this.applyStyles()

    // Add to container
    this.container.style.position = 'relative'
    this.container.appendChild(this.element)

    // Mark as shown
    this.markAsShown()

    // Trigger fade in
    requestAnimationFrame(() => {
      if (this.element) {
        this.element.style.opacity = '1'
      }
    })

    // Schedule fade out
    this.fadeTimeout = setTimeout(() => {
      this.fadeOut()
    }, this.config.fadeDelay)
  }

  /**
   * Apply inline styles to the indicator
   */
  private applyStyles(): void {
    if (!this.element) return

    Object.assign(this.element.style, {
      position: 'absolute',
      bottom: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      color: 'white',
      borderRadius: '20px',
      fontSize: '14px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: '500',
      opacity: '0',
      transition: 'opacity 0.3s ease-in-out',
      pointerEvents: 'none',
      zIndex: '100',
      whiteSpace: 'nowrap',
    })

    // Style icon
    const icon = this.element.querySelector('.emtlkit-zoom-indicator__icon') as HTMLElement
    if (icon) {
      Object.assign(icon.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      })
    }
  }

  /**
   * Fade out and remove the indicator
   */
  private fadeOut(): void {
    if (!this.element) return

    this.element.style.opacity = '0'

    // Remove element after fade animation
    setTimeout(() => {
      this.remove()
    }, 300)
  }

  /**
   * Remove the indicator element from DOM
   */
  private remove(): void {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element)
      this.element = null
    }
  }

  /**
   * Clean up indicator
   */
  public destroy(): void {
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout)
      this.fadeTimeout = null
    }
    this.remove()
  }
}
