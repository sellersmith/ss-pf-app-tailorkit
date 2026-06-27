import type { VectorConversionParameters, ShapeSelection, VectorResult } from '../types'
import { useState, useCallback, useRef } from 'react'
import { processImage, reprocessImage } from '../utils/imageProcessing'
import { TEMPLATES_ACTIONS } from '~/routes/api.templates/constants'

/**
 * Hook for managing image processing operations - Vector conversion
 */
export function useImageProcessing(
  imageUrl: string,
  apiEndpoint: string,
  onError?: (error: string) => void,
  onApply?: (results: VectorResult[]) => void
) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isReprocessing, setIsReprocessing] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [vectorResults, setVectorResults] = useState<VectorResult[]>([])

  const abortControllerRef = useRef<AbortController | null>(null)
  const reprocessTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Process image with current settings - Convert to SVG vectors
   */
  const handleProcessImage = useCallback(
    async (
      shapeSelections: ShapeSelection[],
      processingParameters: VectorConversionParameters,
      t: (key: string) => string
    ) => {
      setIsProcessing(true)

      try {
        const result = await processImage(imageUrl, shapeSelections, processingParameters, apiEndpoint)

        if (result.success) {
          setVectorResults(result.results)
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
    [imageUrl, apiEndpoint, onError]
  )

  /**
   * Reprocess image with new parameters (debounced)
   */
  const handleReprocessImage = useCallback(
    async (
      shapeSelections: ShapeSelection[],
      newParameters: VectorConversionParameters,
      t: (key: string) => string
    ) => {
      if (vectorResults.length === 0) return

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
          const result = await reprocessImage(
            imageUrl,
            shapeSelections,
            newParameters,
            apiEndpoint,
            abortController.signal
          )

          if (abortController.signal.aborted) return

          if (result.success) {
            setVectorResults(result.results)
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
      }, 800) // 800ms debounce
    },
    [vectorResults, imageUrl, apiEndpoint, onError]
  )

  /**
   * Upload SVG blob to Shopify via templates API (MockupWizard pattern)
   */
  const uploadSvgToShopify = async (svgDataUri: string, fileName: string): Promise<string | null> => {
    try {
      // Convert data URI to blob
      const response = await fetch(svgDataUri)
      const blob = await response.blob()

      // Create a File object from the blob
      const file = new File([blob], fileName, { type: 'image/svg+xml' })

      // Create FormData for multipart upload
      const formData = new FormData()
      formData.append('files', file)
      formData.append('fileUploadType', 'image')

      // Make the API call
      const uploadResponse = await fetch(`/api/templates?action=${TEMPLATES_ACTIONS.UPLOAD_FILES}`, {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error(`HTTP error! status: ${uploadResponse.status}`)
      }

      const result = await uploadResponse.json()

      if (!result.success) {
        throw new Error(`Upload failed: ${result.message || 'Unknown error'}`)
      }

      // Extract the upload result from the API response
      const { data } = result
      if (data && data.uploadedFiles && data.uploadedFiles.length > 0) {
        const uploadedFile = data.uploadedFiles[0]
        return uploadedFile.image?.originalSrc || uploadedFile.url
      }

      return null
    } catch (error) {
      console.error('Error uploading SVG to Shopify:', error)
      return null
    }
  }

  /**
   * Apply the vector results - Upload to Shopify or download
   * @returns Promise with the first uploaded CDN URL (or null if download mode or error)
   */
  const handleApplyVectors = useCallback(
    async (
      shapeSelections: ShapeSelection[],
      processingParameters: VectorConversionParameters,
      t: (key: string) => string
    ): Promise<string | null> => {
      if (vectorResults.length === 0) return null

      setIsApplying(true)

      try {
        // If onApply is provided, upload to Shopify and pass results
        if (onApply) {
          // Upload each SVG to Shopify and collect results with CDN URLs
          const uploadedResults: VectorResult[] = await Promise.all(
            vectorResults.map(async (result, index) => {
              if (result.error || !result.svgDataUri) {
                return result // Return as-is if there's an error or no data
              }

              const fileName = `vector-${result.shapeId}-${Date.now()}.svg`
              const shopifyUrl = await uploadSvgToShopify(result.svgDataUri, fileName)

              return {
                ...result,
                svgUrl: shopifyUrl || undefined, // Set Shopify CDN URL
              }
            })
          )

          // Filter out results with errors and pass to callback
          const validResults = uploadedResults.filter(r => !r.error && (r.svgUrl || r.svgDataUri))
          setVectorResults(uploadedResults)
          onApply(validResults)

          // Return the first CDN URL for tracking
          const firstUrl = uploadedResults.find(r => r.svgUrl)?.svgUrl
          return firstUrl || null
        }
        // No onApply callback - download all SVGs
        vectorResults.forEach((result, index) => {
          if (result.svgDataUri) {
            const filename = `vector-${index + 1}.svg`
            downloadSvg(result.svgDataUri, filename)
          }
        })
        return null
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t('unknown-error-occurred')
        onError?.(errorMessage)
        return null
      } finally {
        setIsApplying(false)
      }
    },
    [vectorResults, onApply, onError]
  )

  /**
   * Download SVG file
   */
  const downloadSvg = (dataUri: string, filename: string) => {
    const link = document.createElement('a')
    link.href = dataUri
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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
   * Update a single vector result (e.g., after editing in VectorEditor)
   */
  const updateVectorResult = useCallback((shapeId: string, editedSvgDataUri: string) => {
    setVectorResults(prev =>
      prev.map(result => (result.shapeId === shapeId ? { ...result, svgDataUri: editedSvgDataUri } : result))
    )
  }, [])

  /**
   * Navigate back to canvas view without clearing data
   */
  const backToCanvas = useCallback(() => {
    // Only clear the view state, keep all processing data intact
    setVectorResults([])

    // Clean up any pending operations for safety
    resetProcessing()
  }, [resetProcessing])

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

  return {
    // State
    isProcessing,
    isReprocessing,
    isApplying,
    vectorResults,
    showResult: vectorResults.length > 0,

    // Actions
    processImage: handleProcessImage,
    reprocessImage: handleReprocessImage,
    applyVectors: handleApplyVectors,
    updateVectorResult,
    resetProcessing,
    backToCanvas,
    cleanup,
  }
}
