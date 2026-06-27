import { useEffect, useRef } from 'react'
import { useWindowSize } from './useWindowSize'

/**
 * Observe the element selector changes
 *
 * @param selector string
 * @param callback () => void
 */
export function useElementObserver(selector: string, callback: () => void) {
  const { width: windowWidth, height: windowHeight } = useWindowSize()

  const observerRef = useRef<ResizeObserver | null>(null)

  // Handle card positioning and highlighting on step changes
  useEffect(() => {
    callback()
  }, [windowWidth, windowHeight, callback])

  // Observer the element selector changes
  useEffect(() => {
    ;(async () => {
      const element = document.querySelector(selector)
      if (!element || !callback) return

      // Create a ResizeObserver
      observerRef.current = new ResizeObserver(callback)

      // Observe the target element
      observerRef.current.observe(element)
    })()

    // Cleanup function to disconnect observer
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [selector, callback])

  // Handle window scroll and Polaris-Page height changes
  usePageObserver(callback)
}

/**
 * Observe the page changes
 *
 * @param callback () => void
 */
export function usePageObserver(callback: () => void) {
  // Handle window scroll and Polaris-Page height changes
  useEffect(() => {
    // Create an empty argument function
    function onMoveCardPosition() {
      return callback()
    }

    window.addEventListener('scroll', onMoveCardPosition)

    const polarisPage = document.querySelector('.Polaris-Page')
    const resizeObserver = new ResizeObserver(onMoveCardPosition)

    // Watch Polaris-Page height changes to reposition card
    if (polarisPage) {
      resizeObserver.observe(polarisPage)
    }

    return () => {
      window.removeEventListener('scroll', onMoveCardPosition)

      resizeObserver?.disconnect()
    }
  }, [callback])
}
