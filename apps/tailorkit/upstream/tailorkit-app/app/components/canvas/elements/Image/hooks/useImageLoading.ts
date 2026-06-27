import { useState, useCallback, useRef, useEffect } from 'react'

interface UseImageLoadingProps {
  src?: string
  maskSrc?: string
  visible?: boolean
  width: number
  height: number
  onImageLoad?: () => void
}

interface UseImageLoadingReturn {
  img: HTMLImageElement | null
  maskImg: HTMLImageElement | null
  isLoading: boolean
  error: string | null
  loadImage: () => Promise<void>
}

/**
 * Custom hook to handle image and mask loading with proper resource management
 * Implements abort controller pattern for cancelling pending operations
 */
export function useImageLoading({
  src,
  maskSrc,
  visible,
  width,
  height,
  onImageLoad,
}: UseImageLoadingProps): UseImageLoadingReturn {
  // State management
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [maskImg, setMaskImg] = useState<HTMLImageElement | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs for resource management
  const abortControllerRef = useRef<AbortController | null>(null)
  const isUnmountedRef = useRef(false)

  /**
   * Helper to load an image with proper error handling and abort support
   */
  const loadHtmlImage = useCallback((url: string, signal: AbortSignal): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const imgElement = new Image()
      imgElement.crossOrigin = 'anonymous'

      const cleanupListeners = () => {
        imgElement.onload = null
        imgElement.onerror = null
      }

      const handleAbort = () => {
        cleanupListeners()
        reject(new Error('Operation aborted'))
      }

      const handleLoad = () => {
        if (signal.aborted) return handleAbort()
        cleanupListeners()
        resolve(imgElement)
      }

      const handleError = () => {
        if (signal.aborted) return handleAbort()
        cleanupListeners()
        reject(new Error(`Failed to load image: ${url}`))
      }

      imgElement.onload = handleLoad
      imgElement.onerror = handleError

      signal.addEventListener('abort', handleAbort, { once: true })

      imgElement.src = url
    })
  }, [])

  /**
   * Load main image and optional mask image with abort controller support
   */
  const loadImage = useCallback(async (): Promise<void> => {
    if (!src || isUnmountedRef.current) {
      setImg(null)
      setMaskImg(null)
      setError(null)
      return
    }

    // Cancel previous operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    const { signal } = abortControllerRef.current

    setIsLoading(true)
    setError(null)

    try {
      // Start loading both images in parallel (if maskSrc exists)
      const mainImagePromise = loadHtmlImage(src, signal)
      const maskImagePromise = maskSrc
        ? loadHtmlImage(maskSrc, signal).catch(err => {
            // Capture mask load failure but don't reject whole chain
            if (!signal.aborted) {
              console.error('Mask loading failed:', err)
              setError(`Mask loading failed: ${err.message}`)
            }
            return null
          })
        : Promise.resolve(null)

      const [loadedImage, loadedMask] = await Promise.all([mainImagePromise, maskImagePromise])

      if (signal.aborted || isUnmountedRef.current) return

      setImg(loadedImage)
      setMaskImg(loadedMask)
      onImageLoad?.()
    } catch (loadError) {
      if (!signal.aborted) {
        const errorMessage = loadError instanceof Error ? loadError.message : 'Failed to load image'
        console.error('Failed to load image:', loadError)
        setError(errorMessage)
        setImg(null)
        setMaskImg(null)
      }
    } finally {
      if (!signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [src, maskSrc, loadHtmlImage, onImageLoad])

  // Load images when component mounts or visibility changes
  useEffect(() => {
    if (visible || visible === undefined) {
      loadImage()
    }
  }, [visible, loadImage])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [])

  return {
    img,
    maskImg,
    isLoading,
    error,
    loadImage,
  }
}
