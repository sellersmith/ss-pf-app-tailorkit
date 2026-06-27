import { useEffect } from 'react'
import { useLocation } from '@remix-run/react'
/**
 * Custom hook to scroll an element into view with smooth behavior
 *
 * @param {string} id - The ID of the element to scroll into view
 */
export const useScrollIntoView = ({ paramKey, delay = 100 }: { paramKey: string; delay?: number }) => {
  const location = useLocation()

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const gotoId = searchParams.get(paramKey)
    if (!gotoId) return

    const element = document.getElementById(gotoId)
    if (!element) return

    const timeoutId = setTimeout(() => {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, delay)

    // Cleanup timeout if component unmounts or dependencies change
    return () => clearTimeout(timeoutId)
  }, [delay, location.search, paramKey])
}
