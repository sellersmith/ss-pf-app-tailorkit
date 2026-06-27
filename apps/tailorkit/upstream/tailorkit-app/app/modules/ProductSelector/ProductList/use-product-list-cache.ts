import { useCallback, useEffect, useRef } from 'react'

/**
 * Custom hook for managing product list caching and debounced fetching.
 * Used for categories cache management (categories don't change frequently).
 * Products are always fetched fresh to ensure integrated status is up-to-date.
 */
export function useProductListCache() {
  const cacheKeysRef = useRef<Set<string>>(new Set())
  const timerRef = useRef<NodeJS.Timeout>()

  const addCacheKey = useCallback((key: string) => {
    cacheKeysRef.current.add(key)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
  }, [])

  const setTimer = useCallback(
    (callback: () => void, delay: number) => {
      clearTimer()
      timerRef.current = setTimeout(callback, delay)
    },
    [clearTimer]
  )

  const getCacheKeys = useCallback(() => {
    return Array.from(cacheKeysRef.current)
  }, [])

  const clearCacheKeys = useCallback(() => {
    cacheKeysRef.current.clear()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [clearTimer])

  return {
    addCacheKey,
    clearTimer,
    setTimer,
    getCacheKeys,
    clearCacheKeys,
  }
}

/**
 * Interface for ProductList ref methods
 */
export interface ProductListRef {
  getCacheKeys: () => string[]
  clearCacheKeys: () => void
}
