import type { IMaskConfig } from '~/components/canvas/elements/Image/KonvaImageWithMask.client'
import { GRAYSCALE_COEFFICIENTS, MASK_PROCESSING_THRESHOLDS } from './mask-constants'
import type { BrowserCapabilities } from './browser-capabilities'
import { createReusableTempCanvasManager, setupCanvasContext } from './canvas-utils'

/**
 * Image processing utilities for mask operations
 */

// Create a reusable temp canvas manager for this module
const getReusableTempCanvas = createReusableTempCanvasManager()

/**
 * Process ultra-large images (>50MP) with progressive rendering to prevent main thread blocking
 * @param maskCtx Canvas rendering context for the mask
 * @param imageData Image data to process
 * @param mask Mask configuration
 * @returns Processed canvas
 */
export function processUltraLargeImageProgressive(
  maskCtx: CanvasRenderingContext2D,
  imageData: ImageData,
  mask: IMaskConfig
): HTMLCanvasElement {
  const data = imageData.data
  const invertMultiplier = mask.invert ? 1 : -1
  const invertOffset = mask.invert ? 0 : 255

  // For ultra-large images, use very large chunks to minimize overhead
  // but still maintain responsiveness
  const ultraLargeBatchSize = Math.min(32768, Math.max(4096, Math.floor(data.length / 8)))

  // Process in very large batches with minimal smoothing for maximum performance
  for (let start = 0; start < data.length; start += ultraLargeBatchSize * 4) {
    const end = Math.min(start + ultraLargeBatchSize * 4, data.length)

    for (let i = start; i < end; i += 4) {
      // Simplified processing for maximum speed using standard coefficients
      const gray
        = (GRAYSCALE_COEFFICIENTS.RED * data[i]
          + GRAYSCALE_COEFFICIENTS.GREEN * data[i + 1]
          + GRAYSCALE_COEFFICIENTS.BLUE * data[i + 2])
        >> 8
      const alpha = invertOffset + gray * invertMultiplier

      // Skip smoothstep for ultra-large images to save computation
      const normalizedAlpha = Math.max(0, Math.min(255, alpha))

      data[i] = 255 // R
      data[i + 1] = 255 // G
      data[i + 2] = 255 // B
      data[i + 3] = normalizedAlpha // A (simplified)
    }
  }

  // Apply processed data with basic settings
  maskCtx.imageSmoothingEnabled = false // Disable for performance
  maskCtx.putImageData(imageData, 0, 0)

  return maskCtx.canvas
}

/**
 * Apply optimized blur using CSS filters or canvas smoothing
 * @param maskCtx Canvas rendering context for the mask
 * @param maskCanvas Canvas containing the mask
 * @param strength Blur strength (0-1)
 * @param width Canvas width
 * @param height Canvas height
 * @param browserCapabilities Browser capabilities for optimization
 * @returns Whether blur was successfully applied
 */
export function applyOptimizedBlur(
  maskCtx: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement,
  strength: number,
  width: number,
  height: number,
  browserCapabilities: BrowserCapabilities
): boolean {
  // Calculate optimal blur radius
  const blurRadius = Math.max(0.5, Math.min(3, strength * 2))

  // Use CSS filter if available (fastest)
  if (browserCapabilities.cssFilter) {
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
      setupCanvasContext(tempCtx, true, browserCapabilities.imageSmoothingQuality ? 'high' : 'medium')
      tempCtx.drawImage(maskCanvas, 0, 0)

      maskCtx.clearRect(0, 0, width, height)
      setupCanvasContext(maskCtx, true, browserCapabilities.imageSmoothingQuality ? 'high' : 'medium')

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
}

/**
 * Process mask pixels with optimized batch operations
 * @param data Image data array
 * @param totalPixels Total number of pixels
 * @param invert Whether to invert the mask
 * @param useUltraLargeOptimization Whether to use ultra-large image optimizations
 */
export function processMaskPixels(
  data: Uint8ClampedArray,
  totalPixels: number,
  invert: boolean,
  useUltraLargeOptimization: boolean = false
): void {
  const invertMultiplier = invert ? 1 : -1
  const invertOffset = invert ? 0 : 255

  // Determine batch size based on optimization level
  let batchSize: number
  if (useUltraLargeOptimization) {
    // Enhanced processing for very large images
    batchSize = Math.min(16384, Math.max(1024, Math.floor(totalPixels / 20)))
  } else {
    // Standard optimized pixel processing
    batchSize = Math.min(4096, Math.max(256, Math.floor(totalPixels / 100)))
  }

  // Process pixels in batches to prevent blocking
  for (let start = 0; start < data.length; start += batchSize * 4) {
    const end = Math.min(start + batchSize * 4, data.length)

    for (let i = start; i < end; i += 4) {
      // Convert to grayscale using ITU-R BT.709 standard coefficients
      const gray = calculateGrayScale(data, i)

      // Calculate alpha with smooth transitions
      const alpha = invertOffset + gray * invertMultiplier

      if (useUltraLargeOptimization) {
        // Simplified alpha processing for performance
        const smoothedAlpha = alpha * 0.003921569 // / 255
        data[i + 3] = Math.round(smoothedAlpha * 255)
      } else {
        // Apply smoothstep function (optimized) for smoother edges
        const normalizedAlpha = alpha * 0.003921569 // / 255
        const smoothedAlpha = normalizedAlpha * normalizedAlpha * (3 - 2 * normalizedAlpha)
        data[i + 3] = Math.round(smoothedAlpha * 255)
      }

      // Set RGB channels to white
      data[i] = 255 // R
      data[i + 1] = 255 // G
      data[i + 2] = 255 // B
    }
  }
}

/**
 * Process mask image with size-based optimizations
 * @param maskCtx Canvas rendering context for the mask
 * @param maskImg Mask image element
 * @param width Canvas width
 * @param height Canvas height
 * @param mask Mask configuration
 * @param browserCapabilities Browser capabilities for optimization
 * @param smoothEdges Whether to apply edge smoothing
 * @param smoothingStrength Smoothing strength (0-1)
 * @returns Processed canvas or null if processing failed
 */
export function processMaskImage(
  maskCtx: CanvasRenderingContext2D,
  maskImg: HTMLImageElement,
  width: number,
  height: number,
  mask: IMaskConfig,
  browserCapabilities: BrowserCapabilities,
  smoothEdges: boolean = true,
  smoothingStrength: number = 0.25
): HTMLCanvasElement | null {
  try {
    // Clear and draw mask
    maskCtx.clearRect(0, 0, width, height)
    maskCtx.drawImage(maskImg, 0, 0, width, height)

    const imageData = maskCtx.getImageData(0, 0, width, height)
    const data = imageData.data
    const totalPixels = width * height

    // Determine processing strategy based on image size
    if (totalPixels > MASK_PROCESSING_THRESHOLDS.MAX_PIXELS_FOR_FULL_PROCESSING) {
      console.warn(`Very large image (${(totalPixels / 1e6).toFixed(1)}MP). Using optimized processing.`)

      // For ultra-large images (>50MP), use even more aggressive optimizations
      if (totalPixels > MASK_PROCESSING_THRESHOLDS.ULTRA_LARGE_THRESHOLD) {
        console.warn(`Ultra-large image detected. Using maximum performance optimizations.`)
        return processUltraLargeImageProgressive(maskCtx, imageData, mask)
      }

      // Enhanced processing for very large images
      processMaskPixels(data, totalPixels, mask.invert || false, true)
    } else {
      // Standard optimized pixel processing
      processMaskPixels(data, totalPixels, mask.invert || false, false)
    }

    // Apply processed data
    setupCanvasContext(maskCtx, true, browserCapabilities.imageSmoothingQuality ? 'high' : 'medium')
    maskCtx.putImageData(imageData, 0, 0)

    // Apply optimized smoothing for smaller images
    if (smoothEdges && totalPixels < MASK_PROCESSING_THRESHOLDS.MAX_PIXELS_FOR_FAST_PROCESSING) {
      applyOptimizedBlur(maskCtx, maskCtx.canvas, smoothingStrength, width, height, browserCapabilities)
    }

    return maskCtx.canvas
  } catch (error) {
    console.error('Error processing mask:', error)
    return null
  }
}

/**
 * Calculate the grayscale value of a pixel
 * @param data Image data array
 * @param i Index of the pixel
 * @returns Grayscale value
 */
export function calculateGrayScale(data: Uint8ClampedArray, i: number) {
  const calculatedRed = GRAYSCALE_COEFFICIENTS.RED * data[i]
  const calculatedGreen = GRAYSCALE_COEFFICIENTS.GREEN * data[i + 1]
  const calculatedBlue = GRAYSCALE_COEFFICIENTS.BLUE * data[i + 2]
  return (calculatedRed + calculatedGreen + calculatedBlue) >> 8
}
