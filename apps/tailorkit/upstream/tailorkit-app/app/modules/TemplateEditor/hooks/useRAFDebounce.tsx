import { useCallback, useRef } from 'react'

/**
 * @description Debounce function using requestAnimationFrame
 * @param callback - The function to debounce
 * @param delay - The delay in milliseconds
 * @returns The debounced function
 */
export const useRAFDebounce = (callback: Function, delay: number = 0) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const rafRef = useRef<number | null>(null)

  return useCallback(
    (...args: any[]) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)

      if (delay > 0) {
        timeoutRef.current = setTimeout(() => {
          rafRef.current = requestAnimationFrame(() => callback(...args))
        }, delay)
      } else {
        rafRef.current = requestAnimationFrame(() => callback(...args))
      }
    },
    [callback, delay]
  )
}
