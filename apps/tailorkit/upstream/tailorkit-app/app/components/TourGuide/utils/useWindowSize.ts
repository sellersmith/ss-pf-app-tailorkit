import { useEffect, useState } from 'react'

interface WindowSize {
  width: number
  height: number
}

/**
 * Custom hook to track window dimensions
 * Returns an object containing the current window width and height
 *
 * @returns {WindowSize} Object containing window dimensions
 * @property {number} width - Current window width in pixels
 * @property {number} height - Current window height in pixels
 */
export const useWindowSize = (): WindowSize => {
  // Initialize with SSR-safe values and handle potential undefined window object
  const [windowSize, setWindowSize] = useState<WindowSize>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }))

  useEffect(() => {
    // Skip effect if window is undefined (SSR)
    if (typeof window === 'undefined') return

    const handleResize = () => {
      // Debounce resize updates to prevent excessive re-renders
      requestAnimationFrame(() => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        })
      })
    }

    window.addEventListener('resize', handleResize)

    // Initial size calculation
    handleResize()

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return windowSize
}
