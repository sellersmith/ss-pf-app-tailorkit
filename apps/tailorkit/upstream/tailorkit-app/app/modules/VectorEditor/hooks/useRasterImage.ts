import { useState, useEffect, useCallback, useRef } from 'react'
import type { RasterImageInfo } from '../types'

interface UseRasterImageOptions {
  /** Image URL to load */
  imageUrl?: string
  /** Whether the hook should load the image (default: true) */
  enabled?: boolean
}

interface UseRasterImageReturn {
  /** Loaded HTMLImageElement (for canvas rendering if needed) */
  imageElement: HTMLImageElement | null
  /** Image information including dimensions */
  imageInfo: RasterImageInfo | null
  /** Loading state */
  isLoading: boolean
  /** Error message if loading failed */
  error: string | null
  /** Retry loading the image */
  retry: () => void
}

/**
 * Hook for loading and managing raster images for overlay mode.
 * Handles image loading, error states, and cleanup.
 */
export function useRasterImage({ imageUrl, enabled = true }: UseRasterImageOptions): UseRasterImageReturn {
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null)
  const [imageInfo, setImageInfo] = useState<RasterImageInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  // Track blob URLs so we can revoke them on cleanup
  const blobUrlRef = useRef<string | null>(null)

  const loadImage = useCallback((url: string) => {
    setIsLoading(true)
    setError(null)

    // Convert data: URLs to blob: URLs for better browser caching & smaller prop strings
    let effectiveUrl = url
    if (url.startsWith('data:')) {
      try {
        const [header, b64] = url.split(',')
        const mime = header.match(/data:(.*?);/)?.[1] || 'image/png'
        const binary = atob(b64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const blob = new Blob([bytes], { type: mime })
        effectiveUrl = URL.createObjectURL(blob)
        // Revoke previous blob URL if any
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = effectiveUrl
      } catch {
        // Fallback to original data URL if conversion fails
        effectiveUrl = url
      }
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      setImageElement(img)
      setImageInfo({
        url: effectiveUrl,
        width: img.naturalWidth,
        height: img.naturalHeight,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      })
      setIsLoading(false)
      setError(null)
    }

    img.onerror = () => {
      setError('Failed to load image. Please check the URL and try again.')
      setIsLoading(false)
      setImageElement(null)
      setImageInfo(null)
    }

    img.src = effectiveUrl

    // Return cleanup function
    return () => {
      img.onload = null
      img.onerror = null
      img.src = ''
    }
  }, [])

  useEffect(() => {
    // Reset state when URL changes or becomes empty
    if (!enabled || !imageUrl) {
      setImageElement(null)
      setImageInfo(null)
      setIsLoading(false)
      setError(null)
      // Revoke blob URL when image is removed
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      return
    }

    return loadImage(imageUrl)
  }, [imageUrl, enabled, retryCount, loadImage])

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      setImageElement(null)
      setImageInfo(null)
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [])

  const retry = useCallback(() => {
    setRetryCount(c => c + 1)
  }, [])

  return {
    imageElement,
    imageInfo,
    isLoading,
    error,
    retry,
  }
}

export default useRasterImage
