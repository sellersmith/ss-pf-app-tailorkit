import { useEffect, useMemo, useRef } from 'react'

/**
 * Returns a stable debounced function that delays invoking the provided callback
 * until after the specified delay has elapsed since the last time it was invoked.
 * If delay is 0/undefined, the callback is invoked immediately with a stable identity.
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay?: number
): (...args: TArgs) => void {
  const callbackRef = useRef(callback)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Always keep the freshest callback without changing the debounced fn identity
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  // Create a stable function respecting the current delay
  const debounced = useMemo(() => {
    // No debounce requested: return a stable passthrough function
    if (!delay || delay <= 0) {
      return (...args: TArgs) => {
        callbackRef.current(...args)
      }
    }

    return (...args: TArgs) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    }
  }, [delay])

  // Clear pending timeout on unmount or when delay changes
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return debounced
}

export default useDebouncedCallback
