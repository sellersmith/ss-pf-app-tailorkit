/**
 * Utility functions for performance optimization
 */

/**
 * Debounces a function call to reduce repeated executions
 * @param func Function to debounce
 * @param wait Wait time in milliseconds
 */
export function debounce(func: Function, wait: number): Function {
  let timeout: number | null = null
  return function (...args: any[]) {
    const later = () => {
      timeout = null
      func(...args)
    }
    if (timeout !== null) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait) as unknown as number
  }
}

/**
 * Throttles a function call to limit execution frequency
 * @param func Function to throttle
 * @param limit Minimum time between executions in milliseconds
 */
export function throttle(func: Function, limit: number): Function {
  let lastCall = 0
  return function (...args: any[]) {
    const now = Date.now()
    if (now - lastCall >= limit) {
      lastCall = now
      func(...args)
    }
  }
}
