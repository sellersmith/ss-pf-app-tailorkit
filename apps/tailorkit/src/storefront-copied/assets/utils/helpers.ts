/**
 * Checks if a string value is empty (null, undefined, or whitespace-only)
 *
 * @param value - The string value to check
 * @returns true if value is null, undefined, or whitespace-only
 *
 * @example
 * isEmpty(null)        // true
 * isEmpty('')          // true
 * isEmpty('   ')       // true (whitespace-only)
 * isEmpty('Hello')     // false
 */
export function isEmpty(value: string | null | undefined): boolean {
  if (value === null || value === undefined) {
    return true
  }
  return value.trim().length === 0
}

// Helper function to escape HTML to prevent XSS
export const escapeHtml = (unsafe: string) =>
  unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

// Helper function to capitalize the first letter
export const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)

// Helper function to parse JSON attribute
export const parseJSONAttribute = (element: HTMLElement, attr: string, defaultValue: any = {}) => {
  return JSON.parse(element.getAttribute(attr) || JSON.stringify(defaultValue))
}

/**
 * Wait for an element to appear in the DOM using requestAnimationFrame
 * This avoids memory leaks associated with MutationObserver
 */
export function waitForElement(selector: string, timeout = 10_000): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const startTime = performance.now()
    let cleanupListener: (() => void) | undefined

    // Check if the element exists immediately
    const existing = document.querySelector<HTMLElement>(selector)
    if (existing) {
      return resolve(existing)
    }

    // Otherwise poll for it using requestAnimationFrame
    let rafId: number

    function checkForElement(timestamp: number) {
      // Check if the element exists now
      const element = document.querySelector<HTMLElement>(selector)

      if (element) {
        // Element found, resolve the promise
        cleanup()
        resolve(element)
        return
      }

      // Check if we've hit the timeout
      if (timeout > 0 && timestamp - startTime > timeout) {
        cleanup()
        reject(new Error(`Timed out waiting for element: ${selector}`))
        return
      }

      // Continue checking in the next frame
      rafId = requestAnimationFrame(checkForElement)
    }

    // Cleanup function to cancel animation frame and remove event listener
    function cleanup() {
      if (rafId) cancelAnimationFrame(rafId)
      if (cleanupListener) cleanupListener()
    }

    // Start the polling
    rafId = requestAnimationFrame(checkForElement)

    // If this is running in a page that might unload, add cleanup
    if (typeof window !== 'undefined') {
      const onBeforeUnload = () => {
        if (rafId) cancelAnimationFrame(rafId)
      }

      window.addEventListener('beforeunload', onBeforeUnload, { once: true })

      cleanupListener = () => {
        window.removeEventListener('beforeunload', onBeforeUnload)
      }
    }
  })
}
