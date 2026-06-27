import { useCallback, useEffect, useRef, useState } from 'react'
import { ImageLoadingStore } from '~/stores/modules/image-loading-store'

export function useRemoveBackgroundWithStore() {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const progressInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const stopLoading = useCallback((layerId: string) => {
    // Just complete the progress to 100% and clean up intervals
    // Don't clear the loading state - let the image renderer handle that
    setIsLoading(false)
    setProgress(100)

    // Update store to show 100% - keep loading state active
    ImageLoadingStore.dispatch({
      type: 'SET_IMAGE_LOADING',
      payload: { layerId, isLoading: true, progress: 100 },
    })

    // Clean up intervals
    if (progressInterval.current) {
      clearInterval(progressInterval.current)
      progressInterval.current = undefined
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }
  }, [])

  const startLoading = useCallback(
    (layerId: string) => {
      setIsLoading(true)
      setProgress(0)

      // Update store immediately
      ImageLoadingStore.dispatch({
        type: 'SET_IMAGE_LOADING',
        payload: { layerId, isLoading: true, progress: 0 },
      })

      // Start progress simulation
      let currentProgress = 0
      progressInterval.current = setInterval(() => {
        currentProgress += Math.random() * (20 - 5) + 5 // Random increment between 5-20

        // Slow down as we approach completion
        if (currentProgress > 70) {
          currentProgress += Math.random() * (10 - 2) + 2 // Slower increment between 2-10
        }

        // Cap at 95% until API completes
        if (currentProgress > 95) {
          currentProgress = 95
        }

        setProgress(currentProgress)

        // Update store with new progress
        ImageLoadingStore.dispatch({
          type: 'SET_IMAGE_LOADING',
          payload: { layerId, isLoading: true, progress: currentProgress },
        })
      }, 200)

      // Fallback timeout after 10 seconds
      timeoutRef.current = setTimeout(() => {
        stopLoading(layerId)
      }, 10000)
    },
    [stopLoading]
  )

  const resetProgress = useCallback((layerId: string) => {
    setIsLoading(false)
    setProgress(0)

    // Clear store immediately
    ImageLoadingStore.dispatch({
      type: 'CLEAR_IMAGE_LOADING',
      payload: { layerId },
    })

    // Clean up intervals
    if (progressInterval.current) {
      clearInterval(progressInterval.current)
      progressInterval.current = undefined
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    isLoading,
    progress,
    startLoading,
    stopLoading,
    resetProgress,
  }
}
