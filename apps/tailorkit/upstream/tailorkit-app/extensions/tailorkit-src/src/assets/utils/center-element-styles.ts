/**
 * Utility functions for applying and restoring centering styles to elements.
 * Used to center elements absolutely within their container using transform.
 */

const PREV_STYLE_KEYS = [
  '__prevPosition',
  '__prevTop',
  '__prevLeft',
  '__prevTransform',
  '__prevMaxWidth',
  '__prevWidth',
  '__prevHeight',
] as const

interface CenteringOptions {
  /** Whether to also set width/height to 100% (default: false) */
  fillContainer?: boolean
}

/**
 * Save current inline styles to dataset before applying centering styles.
 */
export function saveCenteringStyles(el: HTMLElement, options?: CenteringOptions): void {
  el.dataset.__prevPosition = el.style.position || ''
  el.dataset.__prevTop = el.style.top || ''
  el.dataset.__prevLeft = el.style.left || ''
  el.dataset.__prevTransform = el.style.transform || ''
  el.dataset.__prevMaxWidth = el.style.maxWidth || ''

  if (options?.fillContainer) {
    el.dataset.__prevWidth = el.style.width || ''
    el.dataset.__prevHeight = el.style.height || ''
  }
}

/**
 * Apply centering styles to position element absolutely centered in container.
 * Matches the canvas positioning from render-canvas-to-main-container.ts
 *
 * @param el - The element to center
 * @param options - Optional settings
 * @param options.fillContainer - If true, also sets width/height to 100%
 */
export function applyCenteringStyles(el: HTMLElement, options?: CenteringOptions): void {
  el.style.position = 'absolute'
  el.style.top = '50%'
  el.style.left = '50%'
  el.style.transform = 'translate(-50%, -50%)'
  el.style.maxWidth = '100%'

  if (options?.fillContainer) {
    el.style.width = '100%'
    el.style.height = '100%'
  }
}

/**
 * Restore original inline styles from dataset.
 */
export function restoreCenteringStyles(el: HTMLElement): void {
  el.style.position = el.dataset.__prevPosition || ''
  el.style.top = el.dataset.__prevTop || ''
  el.style.left = el.dataset.__prevLeft || ''
  el.style.transform = el.dataset.__prevTransform || ''
  el.style.maxWidth = el.dataset.__prevMaxWidth || ''

  // Only restore width/height if they were saved
  if (el.dataset.__prevWidth !== undefined) {
    el.style.width = el.dataset.__prevWidth || ''
  }
  if (el.dataset.__prevHeight !== undefined) {
    el.style.height = el.dataset.__prevHeight || ''
  }

  // Clean up dataset
  for (const key of PREV_STYLE_KEYS) {
    delete el.dataset[key]
  }
}
