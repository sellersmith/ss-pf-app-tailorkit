const DEBOUNCE_DELAY = 10
const THROTTLE_DELAY = 16 // ~60fps

// Utility function to debounce function calls
export function debounce<T extends (...args: any[]) => any>(fn: T, delay = DEBOUNCE_DELAY) {
  let timeout: ReturnType<typeof setTimeout>

  const debouncedFn = function (...args: Parameters<T>) {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), delay)
  }

  // Add cancel method to clear the timeout
  debouncedFn.cancel = function () {
    clearTimeout(timeout)
  }

  return debouncedFn as T & { cancel: () => void }
}

// Utility function to throttle function calls
export function throttle<T extends (...args: any[]) => any>(fn: T, delay = THROTTLE_DELAY) {
  let lastCall = 0
  let timeout: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null

  const throttledFn = function (...args: Parameters<T>) {
    const now = Date.now()
    lastArgs = args

    if (now - lastCall < delay) {
      // If we're within throttle delay, schedule a call after the delay
      if (!timeout) {
        timeout = setTimeout(
          () => {
            lastCall = Date.now()
            timeout = null
            if (lastArgs) fn(...lastArgs)
          },
          delay - (now - lastCall)
        )
      }
      return
    }

    // Execute immediately if we're outside throttle delay
    lastCall = now
    fn(...args)
  }

  // Add cancel method to clear the timeout
  throttledFn.cancel = function () {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
    lastArgs = null
  }

  return throttledFn as T & { cancel: () => void }
}

// Utility function to sleep for a given number of milliseconds
export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Utility function to get a cookie by name
export function getCookie(name: string) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift()
}
