import { useState, useCallback, useRef, useEffect } from 'react'
import type { IMaskConfig } from '../KonvaImageWithMask.client'
import { useCanvasOperations } from './useCanvasOperations'
import { useBrowserCapabilities } from './useBrowserCapabilities'
import { useResourceCleanup } from './useResourceCleanup'

interface MaskedImageConfig {
  smoothEdges?: boolean
  smoothingStrength?: number
  useDevicePixelRatio?: boolean
}

interface UseMaskedImageProps {
  img: HTMLImageElement | null
  maskImg: HTMLImageElement | null
  processedMask: HTMLCanvasElement | null
  mask?: IMaskConfig
  width: number
  height: number
  config?: MaskedImageConfig
}

interface UseMaskedImageReturn {
  maskedImage: HTMLImageElement | null
  isGenerating: boolean
  createMaskedImage: () => Promise<HTMLImageElement | null>
}

const DEFAULT_CONFIG: Required<MaskedImageConfig> = {
  smoothEdges: true,
  smoothingStrength: 0.25,
  useDevicePixelRatio: true,
}

/**
 * Custom hook for creating masked images with optimized performance
 * Handles the complex process of combining images with masks
 */
export function useMaskedImage({
  img,
  maskImg,
  processedMask,
  mask,
  width,
  height,
  config = {},
}: UseMaskedImageProps): UseMaskedImageReturn {
  const { smoothEdges, smoothingStrength, useDevicePixelRatio } = { ...DEFAULT_CONFIG, ...config }

  // State management
  const [maskedImage, setMaskedImage] = useState<HTMLImageElement | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Hooks for dependencies
  const { getOrCreateCanvas, getOrCreateHDPICanvas } = useCanvasOperations({ useDevicePixelRatio })
  const { supportsFeature } = useBrowserCapabilities()
  const { addBlobUrl, removeBlobUrl, isUnmountedRef, debounce } = useResourceCleanup()

  // Refs for managing async operations
  const maskGenerationRef = useRef<AbortController | null>(null)
  const maskGenerationIdRef = useRef(0)
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null)

  /**
   * Create final masked image by combining main image with processed mask
   */
  const createMaskedImage = useCallback(async (): Promise<HTMLImageElement | null> => {
    if (!img || !mask?.src || !maskImg || isUnmountedRef.current) return null

    setIsGenerating(true)

    try {
      // Capture the generation context at invocation time to detect staleness later
      const currentGenerationId = maskGenerationIdRef.current
      const signal = maskGenerationRef.current?.signal

      const canvas = useDevicePixelRatio
        ? getOrCreateHDPICanvas(tempCanvasRef, width, height)
        : getOrCreateCanvas(tempCanvasRef, width, height)

      if (!canvas) return null

      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      // Early abort/stale check before heavy work
      if (signal?.aborted || currentGenerationId !== maskGenerationIdRef.current || isUnmountedRef.current) {
        return null
      }

      // Clear canvas
      ctx.clearRect(0, 0, width, height)

      // Draw main image
      ctx.save()
      ctx.imageSmoothingEnabled = smoothEdges
      if (smoothEdges && supportsFeature('imageSmoothingQuality')) {
        ctx.imageSmoothingQuality = smoothingStrength > 0.5 ? 'high' : 'medium'
      }
      ctx.drawImage(img, 0, 0, width, height)
      ctx.restore()

      // Apply processed mask or create one for ultra-large images
      if (processedMask) {
        // Use pre-processed mask from hook
        ctx.save()
        ctx.globalCompositeOperation = mask.globalCompositeOperation ?? 'destination-in'
        ctx.imageSmoothingEnabled = smoothEdges
        if (smoothEdges && supportsFeature('imageSmoothingQuality')) {
          ctx.imageSmoothingQuality = smoothingStrength > 0.5 ? 'high' : 'medium'
        }
        ctx.drawImage(processedMask, 0, 0)
        ctx.restore()
      } else if (maskImg) {
        // Handle ultra-large images directly (>50MP) with simplified processing
        const imageSize = width * height
        if (imageSize > 50 * 1e6) {
          console.log(`Processing ultra-large image directly (${(imageSize / 1e6).toFixed(1)}MP)`)

          // Create temporary canvas for mask processing
          const tempCanvas = getOrCreateCanvas(tempCanvasRef, width, height)
          const tempCtx = tempCanvas?.getContext('2d')

          if (tempCanvas && tempCtx) {
            // Clear and draw mask
            tempCtx.clearRect(0, 0, width, height)
            tempCtx.drawImage(maskImg, 0, 0, width, height)

            // Simple inversion for ultra-large images
            if (mask.invert) {
              tempCtx.globalCompositeOperation = 'difference'
              tempCtx.fillStyle = 'white'
              tempCtx.fillRect(0, 0, width, height)
              tempCtx.globalCompositeOperation = 'source-over'
            }

            // Apply the processed mask
            ctx.save()
            ctx.globalCompositeOperation = mask.globalCompositeOperation ?? 'destination-in'
            ctx.imageSmoothingEnabled = false // Disable for performance
            ctx.drawImage(tempCanvas, 0, 0)
            ctx.restore()
          }
        }
      }

      // Convert to HTMLImageElement
      return new Promise(resolve => {
        canvas.toBlob(blob => {
          // If blob creation failed or this generation is no longer valid, bail out
          if (!blob) {
            resolve(null)
            return
          }

          const url = URL.createObjectURL(blob)
          addBlobUrl(url)

          // Stale/aborted/unmounted after blob creation: revoke immediately
          if (isUnmountedRef.current || signal?.aborted || currentGenerationId !== maskGenerationIdRef.current) {
            removeBlobUrl(url)
            resolve(null)
            return
          }

          const maskedImg = new Image()
          maskedImg.crossOrigin = 'anonymous'
          maskedImg.onload = () => {
            // Clean up the blob URL regardless of state to avoid leaks
            removeBlobUrl(url)

            // If the generation is still current and not aborted, resolve; otherwise ignore
            if (!isUnmountedRef.current && !signal?.aborted && currentGenerationId === maskGenerationIdRef.current) {
              resolve(maskedImg)
            } else {
              resolve(null)
            }
          }
          maskedImg.onerror = () => {
            removeBlobUrl(url)
            resolve(null)
          }

          maskedImg.src = url
        }, 'image/png')
      })
    } catch (error) {
      console.error('Error creating masked image:', error)
      return null
    } finally {
      setIsGenerating(false)
    }
  }, [
    img,
    mask,
    maskImg,
    processedMask,
    width,
    height,
    smoothEdges,
    smoothingStrength,
    useDevicePixelRatio,
    getOrCreateCanvas,
    getOrCreateHDPICanvas,
    supportsFeature,
    addBlobUrl,
    removeBlobUrl,
    isUnmountedRef,
  ])

  // Create masked image when images are ready
  useEffect(() => {
    // Cancel any pending mask generation
    if (maskGenerationRef.current) {
      maskGenerationRef.current.abort()
      maskGenerationRef.current = null
    }

    if (img && mask?.src && maskImg) {
      const imageSize = width * height
      const isLargeImage = imageSize > 1000000 // 1MP
      const debounceDelay = isLargeImage ? 200 : 0

      // Increment generation ID to track the latest request
      maskGenerationIdRef.current += 1
      const currentGenerationId = maskGenerationIdRef.current

      // Create new abort controller for this mask generation
      maskGenerationRef.current = new AbortController()
      const { signal } = maskGenerationRef.current

      debounce(async () => {
        if (isUnmountedRef.current || signal.aborted) return

        // Check if this is still the latest generation request
        if (currentGenerationId !== maskGenerationIdRef.current) {
          return
        }

        try {
          const maskedImg = await createMaskedImage()

          // Double-check this is still the latest generation after async operation
          if (!isUnmountedRef.current && !signal.aborted && currentGenerationId === maskGenerationIdRef.current) {
            setMaskedImage(maskedImg)
          }
        } catch (error) {
          if (!signal.aborted && currentGenerationId === maskGenerationIdRef.current) {
            console.error('Error generating masked image:', error)
          }
        }
      }, debounceDelay)
    } else if (!mask?.src) {
      // Only clear masked image when mask is completely removed
      maskGenerationIdRef.current += 1
      setMaskedImage(null)
    }

    // Cleanup function
    return () => {
      if (maskGenerationRef.current) {
        maskGenerationRef.current.abort()
        maskGenerationRef.current = null
      }
    }
  }, [img, maskImg, processedMask, mask?.src, createMaskedImage, width, height, debounce, isUnmountedRef])

  return {
    maskedImage,
    isGenerating,
    createMaskedImage,
  }
}
