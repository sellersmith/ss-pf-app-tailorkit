import { useEffect } from 'react'

/**
 * Custom hook to prevent the underlying page from scrolling
 * when a modal or overlay is active.
 *
 * @param {boolean} active - Indicates whether the scroll prevention is active.
 */
export const usePreventPageScroll = (active: boolean) => {
  useEffect(() => {
    if (active) {
      // Disable page scrolling by setting the overflow property to 'hidden'
      document.documentElement.style.setProperty('overflow', 'hidden')
    }
    return () => {
      // Re-enable page scrolling by removing the overflow property
      document.documentElement.style.removeProperty('overflow')
    }
  }, [active])
}
