import { useCallback, useEffect, useState } from 'react'
import { AchievementsService, type PTEStatusResponse } from '~/api/services/achievements'
import { ApiError } from '~/api/core/httpClient'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { GLOBAL_EVENTS_TRANSMITTER } from '~/constants/events-transmitter'

interface UsePTEStatusReturn {
  data: PTEStatusResponse | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook to fetch Publish to Earn (PTE) status data
 * Fetches published count and badge unlock status from the API
 * Uses AchievementsService following the API layer pattern
 *
 * Features:
 * - Automatically refetches when PUBLISHED_PRODUCT event is triggered
 */
export function usePTEStatus(): UsePTEStatusReturn {
  const [data, setData] = useState<PTEStatusResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await AchievementsService.getPTEStatus()
      setData(response)
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Unknown error'
      const errorObj = new Error(errorMessage)
      setError(errorObj)
      console.error('Error fetching PTE status:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch on mount
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Listen for publish/unpublish events and refetch data
  useEffect(() => {
    const handlePublishedProduct = () => {
      fetchData()
    }

    // Listen to PUBLISHED_PRODUCT event
    Transmitter.listen(GLOBAL_EVENTS_TRANSMITTER.PUBLISHED_PRODUCT, handlePublishedProduct)

    return () => {
      Transmitter.remove(GLOBAL_EVENTS_TRANSMITTER.PUBLISHED_PRODUCT, handlePublishedProduct)
    }
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  }
}
