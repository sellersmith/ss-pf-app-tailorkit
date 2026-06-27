import { useMemo, useCallback, useRef, useEffect } from 'react'
import type { IMaskConfig } from '../KonvaImageWithMask.client'
import { useCanvasOperations } from './useCanvasOperations'
import { useBrowserCapabilities } from './useBrowserCapabilities'
import { calculateGrayScale, MASK_PROCESSING_THRESHOLDS } from '~/utils/canvas'

interface MaskProcessingConfig {
  smoothEdges?: boolean
  smoothingStrength?: number
  useDevicePixelRatio?: boolean
}

interface UseMaskProcessingProps {
  maskImg: HTMLImageElement | null
  mask?: IMaskConfig
  width: number
  height: number
  config?: MaskProcessingConfig
}

interface UseMaskProcessingReturn {
  processedMask: HTMLCanvasElement | null
  applyOptimizedBlur: (maskCtx: CanvasRenderingContext2D, maskCanvas: HTMLCanvasElement, strength: number) => boolean
}

const DEFAULT_CONFIG: Required<MaskProcessingConfig> = {
  smoothEdges: true,
  smoothingStrength: 0.25,
  useDevicePixelRatio: true,
}

/**
 * Custom hook for advanced mask processing with performance optimizations
 * Implements size-based processing strategies for optimal performance
 */
export function useMaskProcessing({
  maskImg,
  mask,
  width,
  height,
  config = {},
}: UseMaskProcessingProps): UseMaskProcessingReturn {
  const { smoothEdges, smoothingStrength, useDevicePixelRatio } = { ...DEFAULT_CONFIG, ...config }
  const { getOrCreateCanvas, getReusableTempCanvas } = useCanvasOperations({ useDevicePixelRatio })
  const { supportsFeature } = useBrowserCapabilities()

  // Persistent canvas ref with cleanup
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null)

  /**
   * Apply optimized blur using CSS filters or canvas smoothing
   */
  const applyOptimizedBlur = useCallback(
    (maskCtx: CanvasRenderingContext2D, maskCanvas: HTMLCanvasElement, strength: number): boolean => {
      // Calculate optimal blur radius
      const blurRadius = Math.max(0.5, Math.min(3, strength * 2))

      // Use CSS filter if available (fastest)
      if (supportsFeature('cssFilter')) {
        try {
          const tempCanvas = getReusableTempCanvas(width, height)
          const tempCtx = tempCanvas.getContext('2d')

          if (tempCtx) {
            // Copy current state to reusable temp canvas
            tempCtx.clearRect(0, 0, width, height)
            tempCtx.drawImage(maskCanvas, 0, 0)

            // Apply blur and redraw
            maskCtx.clearRect(0, 0, width, height)
            maskCtx.filter = `blur(${blurRadius}px)`
            maskCtx.drawImage(tempCanvas, 0, 0)
            maskCtx.filter = 'none'
            return true
          }
        } catch (error) {
          console.warn('CSS filter blur failed:', error)
        }
      }

      // Fallback: Use canvas smoothing quality
      try {
        const tempCanvas = getReusableTempCanvas(width, height)
        const tempCtx = tempCanvas.getContext('2d')

        if (tempCtx) {
          tempCtx.clearRect(0, 0, width, height)
          tempCtx.imageSmoothingEnabled = true
          if (supportsFeature('imageSmoothingQuality')) {
            tempCtx.imageSmoothingQuality = 'high'
          }
          tempCtx.drawImage(maskCanvas, 0, 0)

          maskCtx.clearRect(0, 0, width, height)
          maskCtx.imageSmoothingEnabled = true
          if (supportsFeature('imageSmoothingQuality')) {
            maskCtx.imageSmoothingQuality = 'high'
          }

          // Draw with slight scaling to create smoothing effect
          const scale = 1 + strength * 0.02
          const offset = ((scale - 1) / 2) * width
          maskCtx.drawImage(tempCanvas, -offset, -offset, width * scale, height * scale)
          return true
        }
      } catch (error) {
        console.warn('Canvas smoothing fallback failed:', error)
      }

      return false
    },
    [width, height, getReusableTempCanvas, supportsFeature]
  )

  /**
   * Process mask image with size-based optimizations
   * - Small/Medium images: Full processing with pixel operations
   * - Large images: Batch processing with selective features
   * - Very large images: Minimal processing with CSS filters
   */
  const processedMask = useMemo((): HTMLCanvasElement | null => {
    if (!maskImg || !mask) return null

    const maskCanvas = getOrCreateCanvas(maskCanvasRef, width, height)
    if (!maskCanvas) return null

    const maskCtx = maskCanvas.getContext('2d')
    if (!maskCtx) return null

    try {
      // Clear and draw mask
      maskCtx.clearRect(0, 0, width, height)
      maskCtx.drawImage(maskImg, 0, 0, width, height)

      const imageData = maskCtx.getImageData(0, 0, width, height)
      const data = imageData.data
      const totalPixels = width * height

      // Dynamic processing based on image size
      if (totalPixels > MASK_PROCESSING_THRESHOLDS.MAX_PIXELS_FOR_FULL_PROCESSING) {
        console.warn(`Ultra-large image (${(totalPixels / 1e6).toFixed(1)}MP). Deferring to main component processing.`)

        // For ultra-large images (>50MP), return null to let main component handle processing
        // This prevents conflicts between the hook and main component processing
        return null
      }

      // Fast processing for large images (20-50MP)
      if (totalPixels > MASK_PROCESSING_THRESHOLDS.MAX_PIXELS_FOR_FAST_PROCESSING) {
        console.log(`Large image (${(totalPixels / 1e6).toFixed(1)}MP). Using fast processing.`)

        // Simple pixel processing without expensive operations
        const invertMultiplier = mask.invert ? 1 : -1
        const invertOffset = mask.invert ? 0 : 255

        for (let i = 0; i < data.length; i += 4) {
          const gray = calculateGrayScale(data, i)
          const alpha = invertOffset + gray * invertMultiplier

          data[i] = 255 // R
          data[i + 1] = 255 // G
          data[i + 2] = 255 // B
          data[i + 3] = Math.max(0, Math.min(255, alpha)) // A
        }

        maskCtx.putImageData(imageData, 0, 0)
        return maskCanvas
      }

      // Optimized pixel processing with batch operations
      const batchSize = Math.min(4096, Math.max(256, Math.floor(totalPixels / 100)))
      const invertMultiplier = mask.invert ? 1 : -1
      const invertOffset = mask.invert ? 0 : 255

      // Process pixels in batches to prevent blocking
      for (let start = 0; start < data.length; start += batchSize * 4) {
        const end = Math.min(start + batchSize * 4, data.length)

        for (let i = start; i < end; i += 4) {
          // Convert to grayscale using ITU-R BT.709 standard coefficients
          const gray = calculateGrayScale(data, i)

          // Calculate alpha with smooth transitions
          const alpha = invertOffset + gray * invertMultiplier

          // Apply smoothstep function (optimized)
          const normalizedAlpha = alpha * 0.003921569 // / 255
          const smoothedAlpha = normalizedAlpha * normalizedAlpha * (3 - 2 * normalizedAlpha)

          // Set channels
          data[i] = 255 // R
          data[i + 1] = 255 // G
          data[i + 2] = 255 // B
          data[i + 3] = Math.round(smoothedAlpha * 255) // A
        }
      }

      // Apply processed data
      maskCtx.imageSmoothingEnabled = true
      if (supportsFeature('imageSmoothingQuality')) {
        maskCtx.imageSmoothingQuality = 'high'
      }
      maskCtx.putImageData(imageData, 0, 0)

      // Apply optimized smoothing
      if (smoothEdges && totalPixels < MASK_PROCESSING_THRESHOLDS.MAX_PIXELS_FOR_FAST_PROCESSING) {
        applyOptimizedBlur(maskCtx, maskCanvas, smoothingStrength)
      }

      return maskCanvas
    } catch (error) {
      console.error('Error processing mask:', error)
      return null
    }
  }, [
    maskImg,
    mask,
    width,
    height,
    smoothEdges,
    smoothingStrength,
    getOrCreateCanvas,
    supportsFeature,
    applyOptimizedBlur,
  ])

  // Cleanup canvas on unmount
  useEffect(() => {
    const canvas = maskCanvasRef.current
    return () => {
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
      }
    }
  }, [])

  return {
    processedMask,
    applyOptimizedBlur,
  }
}
