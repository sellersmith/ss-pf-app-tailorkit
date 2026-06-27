import { useCallback, useRef, useEffect } from 'react'

interface UseResourceCleanupReturn {
  blobUrlsRef: React.MutableRefObject<Set<string>>
  debounceTimerRef: React.MutableRefObject<NodeJS.Timeout | null>
  isUnmountedRef: React.MutableRefObject<boolean>
  cleanup: () => void
  debounce: (fn: () => void, delay?: number, immediate?: boolean) => void
  addBlobUrl: (url: string) => void
  removeBlobUrl: (url: string) => void
}

/**
 * Custom hook for comprehensive resource cleanup and memory management
 * Handles blob URLs, timers, and provides a debounce utility
 */
export function useResourceCleanup(): UseResourceCleanupReturn {
  // Resource tracking refs
  const blobUrlsRef = useRef<Set<string>>(new Set())
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isUnmountedRef = useRef(false)

  /**
   * Add a blob URL to the cleanup tracking set
   */
  const addBlobUrl = useCallback((url: string): void => {
    blobUrlsRef.current.add(url)
  }, [])

  /**
   * Remove and revoke a blob URL
   */
  const removeBlobUrl = useCallback((url: string): void => {
    try {
      URL.revokeObjectURL(url)
      blobUrlsRef.current.delete(url)
    } catch (error) {
      console.warn('Failed to revoke blob URL:', error)
    }
  }, [])

  /**
   * Debounce function with immediate execution option and smart delay adjustment
   */
  const debounce = useCallback((fn: () => void, delay: number = 100, immediate: boolean = false): void => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (immediate || delay === 0) {
      fn()
      return
    }

    // Use RAF for better performance on short delays
    if (delay < 50) {
      debounceTimerRef.current = setTimeout(() => {
        if (!isUnmountedRef.current) {
          requestAnimationFrame(fn)
        }
      }, delay) as any
    } else {
      debounceTimerRef.current = setTimeout(() => {
        if (!isUnmountedRef.current) {
          fn()
        }
      }, delay)
    }
  }, [])

  /**
   * Comprehensive cleanup function to dispose of resources and prevent memory leaks
   */
  const cleanup = useCallback((): void => {
    // Clean up blob URLs
    blobUrlsRef.current.forEach(url => {
      try {
        URL.revokeObjectURL(url)
      } catch (error) {
        console.warn('Failed to revoke blob URL:', error)
      }
    })
    blobUrlsRef.current.clear()

    // Clear timers
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true
      cleanup()
    }
  }, [cleanup])

  return {
    blobUrlsRef,
    debounceTimerRef,
    isUnmountedRef,
    cleanup,
    debounce,
    addBlobUrl,
    removeBlobUrl,
  }
}
