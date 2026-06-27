import { useEffect, useState } from 'react'
import { HYDRATED_TIMEOUT } from '~/constants'

/**
 * Hook to hydrate the max modal
 * @returns {boolean} hydrated
 */
export default function useHydrateMaxModal(): boolean {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setTimeout(() => {
      // Make app hydrated to load the editor and animation loading
      setHydrated(true)
    }, HYDRATED_TIMEOUT)
  }, [])

  return hydrated
}
