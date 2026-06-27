import type { ProcessingParameters, ShapeSelection, TemplatePosition } from '../types'
import { useState, useCallback, useRef, useEffect } from 'react'
import { processImage, reprocessImage, processImageWithTimeout } from '../utils/imageProcessing'
import { uploadProcessedImageViaAPI } from '../fns.client'
import useScreenBreakpoints from '~/utils/hooks/use-screen-breakpoints'
import { loadImage } from '~/utils/loadImage'
import { IMAGE_DIMENSIONS, PROCESSING_TIMEOUTS } from '../constants'

/**
 * Hook for managing image processing operations
 */
export function useImageProcessing(
  imageUrl: string,
  apiEndpoint: string,
  onError?: (error: string) => void,
  onApply?: (
    processedImageUrl: string,
    templatePositions?: TemplatePosition[],
    processedDimensions?: { width: number; height: number }
  ) => void,
  forceServerSide = false
) {
  const { isMobileView } = useScreenBreakpoints()
  // Use ref to avoid callback cascade when isMobileView changes during zoom
  const isMobileViewRef = useRef(isMobileView)
  isMobileViewRef.current = isMobileView

  const [isProcessing, setIsProcessing] = useState(false)
  const [isReprocessing, setIsReprocessing] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null)
  const [transparentAreas, setTransparentAreas] = useState<any[]>([])
  const [templatePositions, setTemplatePositions] = useState<TemplatePosition[]>([])
  // Store processed dimensions for composite canvas scaling
  const [processedDimensions, setProcessedDimensions] = useState<{
    width: number
    height: number
    scale: number
  } | null>(null)

  // Session state for client/server processing preference
  const [useServerSideProcessing, setUseServerSideProcessing] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('mockup-wizard-server-side') === 'true'
    }
    return false
  })
  const [clientSideTimeout, setClientSideTimeout] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const reprocessTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Persist server-side processing preference to session storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('mockup-wizard-server-side', useServerSideProcessing.toString())
    }
  }, [useServerSideProcessing])

  /**
   * Process image with current settings
   */
  const handleProcessImage = useCallback(
    async (
      shapeSelections: ShapeSelection[],
      processingParameters: ProcessingParameters,
      t: (key: string) => string
    ) => {
      if (shapeSelections.length === 0) {
        onError?.(t('please-add-at-least-one-seed-point-or-shape-selection'))
        return
      }

      setIsProcessing(true)

      try {
        let shouldUseServerSide = forceServerSide || useServerSideProcessing

        // Read device type from ref to avoid callback invalidation on breakpoint changes
        const mobile = isMobileViewRef.current

        // Determine force-server threshold based on device type
        const forceServerThreshold = mobile
          ? IMAGE_DIMENSIONS.MOBILE_FORCE_SERVER_THRESHOLD
          : IMAGE_DIMENSIONS.DESKTOP_FORCE_SERVER_THRESHOLD

        // Determine downscale threshold for client-side processing
        const downscaleThreshold = mobile
          ? IMAGE_DIMENSIONS.MOBILE_DOWNSCALE_THRESHOLD
          : IMAGE_DIMENSIONS.DESKTOP_DOWNSCALE_THRESHOLD

        // Force server-side processing for large images to prevent memory issues
        if (!shouldUseServerSide) {
          try {
            const img = await loadImage(imageUrl)
            const maxDimension = Math.max(img.width, img.height)

            // Cleanup image
            img.src = ''

            if (maxDimension > forceServerThreshold) {
              const deviceType = mobile ? 'mobile' : 'desktop'
              console.log(
                `[MockupWizard] Routing to server: image ${maxDimension}px exceeds ${deviceType} threshold of ${forceServerThreshold}px`
              )
              shouldUseServerSide = true
              // Note: Not persisting to sessionStorage to allow recovery to client-side for smaller images
            }
          } catch (dimError) {
            console.warn('Failed to check image dimensions, proceeding with caution:', dimError)
          }
        }

        let result

        if (shouldUseServerSide) {
          // Use server-side processing directly
          result = await processImage(imageUrl, shapeSelections, processingParameters, apiEndpoint)
        } else {
          // Try client-side processing with device-appropriate downscale threshold
          console.log(
            `[MockupWizard] Processing on client with downscale threshold: ${downscaleThreshold}px (${mobile ? 'mobile' : 'desktop'} mode)`
          )
          const timeoutResult = await processImageWithTimeout(
            imageUrl,
            shapeSelections,
            processingParameters,
            downscaleThreshold
          )

          if (timeoutResult.success && timeoutResult.result) {
            result = timeoutResult.result
            // Client-side returned an internal failure (validation error, canvas error, etc.)
            // — fall back to server rather than surfacing a fast-fail error with no retry
            if (!result.success) {
              setUseServerSideProcessing(true)
              result = await processImage(imageUrl, shapeSelections, processingParameters, apiEndpoint)
            }
          } else if (timeoutResult.timedOut) {
            // Client-side processing timed out, set flag and fallback to server
            setUseServerSideProcessing(true)
            setClientSideTimeout(true)

            result = await processImage(imageUrl, shapeSelections, processingParameters, apiEndpoint)
          } else {
            // Client-side processing failed for other reasons, fallback to server
            setUseServerSideProcessing(true)

            result = await processImage(imageUrl, shapeSelections, processingParameters, apiEndpoint)
          }
        }

        if (result.success) {
          setProcessedImageUrl(result.processedImageUrl)
          setTransparentAreas(result.transparentAreas || [])
          // Store processed dimensions for composite canvas scaling
          if (result.processedWidth && result.processedHeight && result.scale) {
            setProcessedDimensions({
              width: result.processedWidth,
              height: result.processedHeight,
              scale: result.scale,
            })
          } else {
            setProcessedDimensions(null)
          }
          // Don't call onApply immediately - let user review first
        } else {
          throw new Error(result.error || t('failed-to-process-image'))
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t('unknown-error-occurred')
        onError?.(errorMessage)
      } finally {
        setIsProcessing(false)
      }
    },
    [imageUrl, apiEndpoint, onError, useServerSideProcessing, forceServerSide]
  )

  /**
   * Reprocess image with new parameters (debounced)
   */
  const handleReprocessImage = useCallback(
    async (shapeSelections: ShapeSelection[], newParameters: ProcessingParameters, t: (key: string) => string) => {
      if (!processedImageUrl) return

      // Clear any existing timeout
      if (reprocessTimeoutRef.current) {
        clearTimeout(reprocessTimeoutRef.current)
      }

      // Abort any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Set up new abort controller
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      // Debounce the reprocessing
      reprocessTimeoutRef.current = setTimeout(async () => {
        setIsReprocessing(true)

        try {
          let shouldUseServerSide = forceServerSide || useServerSideProcessing

          // Read device type from ref to avoid callback invalidation on breakpoint changes
          const mobile = isMobileViewRef.current

          // Determine force-server threshold based on device type
          const forceServerThreshold = mobile
            ? IMAGE_DIMENSIONS.MOBILE_FORCE_SERVER_THRESHOLD
            : IMAGE_DIMENSIONS.DESKTOP_FORCE_SERVER_THRESHOLD

          // Determine downscale threshold for client-side processing
          const downscaleThreshold = mobile
            ? IMAGE_DIMENSIONS.MOBILE_DOWNSCALE_THRESHOLD
            : IMAGE_DIMENSIONS.DESKTOP_DOWNSCALE_THRESHOLD

          // Check image dimensions before attempting client-side reprocessing
          // This prevents memory exhaustion from processing large images
          if (!shouldUseServerSide) {
            try {
              const img = await loadImage(imageUrl)
              const maxDimension = Math.max(img.width, img.height)

              // Cleanup image
              img.src = ''

              if (maxDimension > forceServerThreshold) {
                const deviceType = mobile ? 'mobile' : 'desktop'
                console.log(
                  `[MockupWizard] Routing to server: image ${maxDimension}px exceeds ${deviceType} threshold of ${forceServerThreshold}px`
                )
                shouldUseServerSide = true
                // Note: Not persisting to sessionStorage to allow recovery to client-side for smaller images
              }
            } catch (dimError) {
              console.warn('Failed to check image dimensions during reprocessing:', dimError)
            }
          }

          let result

          if (shouldUseServerSide) {
            // Use server-side processing
            result = await reprocessImage(imageUrl, shapeSelections, newParameters, apiEndpoint, abortController.signal)
          } else {
            // Use client-side processing with device-appropriate downscale threshold
            console.log(
              `[MockupWizard] Processing on client with downscale threshold: ${downscaleThreshold}px (${mobile ? 'mobile' : 'desktop'} mode)`
            )
            const timeoutResult = await processImageWithTimeout(
              imageUrl,
              shapeSelections,
              newParameters,
              downscaleThreshold
            )

            if (timeoutResult.success && timeoutResult.result) {
              result = timeoutResult.result
              if (!result.success) {
                setUseServerSideProcessing(true)
                result = await reprocessImage(
                  imageUrl,
                  shapeSelections,
                  newParameters,
                  apiEndpoint,
                  abortController.signal
                )
              }
            } else {
              // Fallback to server-side if client-side times out or throws
              setUseServerSideProcessing(true)
              result = await reprocessImage(
                imageUrl,
                shapeSelections,
                newParameters,
                apiEndpoint,
                abortController.signal
              )
            }
          }

          if (abortController.signal.aborted) return

          if (result.success) {
            setProcessedImageUrl(result.processedImageUrl)
            setTransparentAreas(result.transparentAreas || [])
            // Update processed dimensions for composite canvas scaling
            if (result.processedWidth && result.processedHeight && result.scale) {
              setProcessedDimensions({
                width: result.processedWidth,
                height: result.processedHeight,
                scale: result.scale,
              })
            } else {
              setProcessedDimensions(null)
            }
          } else {
            throw new Error(result.error || t('failed-to-process-image'))
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return // Request was aborted, ignore
          }
          const errorMessage = error instanceof Error ? error.message : t('unknown-error-occurred')
          onError?.(errorMessage)
        } finally {
          setIsReprocessing(false)
        }
      }, PROCESSING_TIMEOUTS.REPROCESSING_DEBOUNCE)
    },
    [processedImageUrl, imageUrl, apiEndpoint, onError, useServerSideProcessing, forceServerSide]
  )

  /**
   * Apply the mask result and upload to Shopify if needed
   * Note: The result is uploaded at its processed dimensions (no upscaling before upload)
   * Template positions are kept in processed space to match the mask dimensions.
   * @returns Promise with the uploaded CDN URL (or existing URL if already uploaded)
   */
  const handleApplyMask = useCallback(
    async (
      shapeSelections: ShapeSelection[],
      processingParameters: ProcessingParameters,
      t: (key: string) => string
    ): Promise<string | null> => {
      if (!processedImageUrl) return null

      setIsApplying(true)

      try {
        // Get processed dimensions for the callback
        // Template positions are kept in processed space (not upscaled)
        // The mask image is also at processed dimensions, so they match
        const dims = processedDimensions
          ? { width: processedDimensions.width, height: processedDimensions.height, scale: processedDimensions.scale }
          : undefined

        // If the processed image is already a Shopify URL, just use it
        if (processedImageUrl.startsWith('http')) {
          // Pass positions as-is (in processed space) along with processed dimensions
          onApply?.(processedImageUrl, templatePositions, dims)
          return processedImageUrl
        }

        // Otherwise, it's a Base64 data URL - convert to Blob and upload directly
        // Note: Upload at processed dimensions (never upscale before upload)
        const response = await fetch(processedImageUrl)
        const blob = await response.blob()

        // Use client-side upload function directly
        const uploadResult = await uploadProcessedImageViaAPI(blob, `mockup-mask-${Date.now()}.png`)

        if (uploadResult && uploadResult.url) {
          setProcessedImageUrl(uploadResult.url)

          // Pass positions as-is (in processed space) along with processed dimensions
          onApply?.(uploadResult.url, templatePositions, dims)
          return uploadResult.url
        }
        throw new Error(t('failed-to-upload-image'))
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t('unknown-error-occurred')
        onError?.(errorMessage)
        return null
      } finally {
        setIsApplying(false)
      }
    },
    [processedImageUrl, templatePositions, processedDimensions, onApply, onError]
  )

  /**
   * Reset processing state
   */
  const resetProcessing = useCallback(() => {
    setIsProcessing(false)
    setIsReprocessing(false)
    setIsApplying(false)

    // Clean up any pending operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    if (reprocessTimeoutRef.current) {
      clearTimeout(reprocessTimeoutRef.current)
    }
  }, [])

  /**
   * Navigate back to canvas view without clearing data
   */
  const backToCanvas = useCallback(() => {
    // Only clear the view state, keep all processing data intact
    setProcessedImageUrl(null)

    // Clean up any pending operations for safety
    resetProcessing()
  }, [resetProcessing])

  /**
   * Update template positions
   */
  const updateTemplatePositions = useCallback((positions: TemplatePosition[]) => {
    setTemplatePositions(positions)
  }, [])

  /**
   * Cleanup function
   */
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    if (reprocessTimeoutRef.current) {
      clearTimeout(reprocessTimeoutRef.current)
    }
  }, [])

  /**
   * Full reset: Clear all image data and state (for modal close)
   */
  const fullReset = useCallback(() => {
    // Abort any pending operations first
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    if (reprocessTimeoutRef.current) {
      clearTimeout(reprocessTimeoutRef.current)
    }

    // Clear all image data and state
    setProcessedImageUrl(null)
    setTransparentAreas([])
    setTemplatePositions([])
    setProcessedDimensions(null)
    setIsProcessing(false)
    setIsReprocessing(false)
    setIsApplying(false)
  }, [])

  /**
   * Cleanup: Reset state and abort operations on unmount
   */
  useEffect(() => {
    return () => {
      // Abort any pending operations
      cleanup()

      // Reset all state to free memory
      setProcessedImageUrl(null)
      setTransparentAreas([])
      setTemplatePositions([])
      setProcessedDimensions(null)
      setIsProcessing(false)
      setIsReprocessing(false)
      setIsApplying(false)
    }
  }, [cleanup])

  return {
    // State
    isProcessing,
    isReprocessing,
    isApplying,
    processedImageUrl,
    transparentAreas,
    templatePositions,
    processedDimensions,
    showResult: !!processedImageUrl,
    useServerSideProcessing,
    clientSideTimeout,

    // Actions
    processImage: handleProcessImage,
    reprocessImage: handleReprocessImage,
    applyMask: handleApplyMask,
    resetProcessing,
    backToCanvas,
    updateTemplatePositions,
    cleanup,
    fullReset,
  }
}
