import { useCallback, useEffect, useState } from 'react'
import { authenticatedFetch } from '~/shopify/fns.client'

/**
 * Reusable hook for fetching and keeping the latest `appConfig` from the shop's preferences API.
 *
 * Many components need to know if the TailorKit theme extension is enabled (and other
 * related settings) and were individually duplicating the same fetch logic. This hook
 * centralises that logic and exposes a `refetch` helper for manual re-validation when
 * something changes (e.g. after saving settings or enabling the theme extension).
 */
export function useAppConfig(initialConfig: any = null) {
  const [fetched, setFetched] = useState(false)
  const [appConfig, setAppConfig] = useState<any>(initialConfig)

  const refetch = useCallback(async () => {
    try {
      const data = await authenticatedFetch('/api/preferences?themeConfig=true')
      setAppConfig(data?.appConfig)
    } catch (error) {
      console.error('Failed to fetch appConfig', error)
    } finally {
      setFetched(true)
    }
  }, [])

  // Ensure we have the latest config on mount when none was provided
  useEffect(() => {
    // Fire-and-forget
    refetch()
  }, [refetch])

  return { appConfig, refetch, fetched }
}
