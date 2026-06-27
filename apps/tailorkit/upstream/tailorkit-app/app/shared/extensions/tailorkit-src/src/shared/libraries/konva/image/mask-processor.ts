import type { CacheManager } from '../core/cache-manager'
import type { IMaskConfig } from '../core/types'

/**
 * Options for creating a masked image
 */
export interface MaskedImageOptions {
  globalCompositeOperation: string
  smoothEdges: boolean
  smoothingStrength: number
}

/**
 * Build a processed mask canvas sized to the target dimensions.
 * The mask luminance is converted to alpha (respecting invert and smoothing),
 * which can be used as a static overlay via globalCompositeOperation.
 *
 * @param maskConfig - Mask configuration
 * @param width - Target width
 * @param height - Target height
 * @param loadImageFn - Function to load images
 * @param cache - Cache manager for storing processed masks
 * @returns Promise resolving to processed mask canvas or null on error
 */
export async function buildProcessedMaskCanvas(
  maskConfig: IMaskConfig,
  width: number,
  height: number,
  loadImageFn: (url: string) => Promise<HTMLImageElement>,
  cache: CacheManager
): Promise<HTMLCanvasElement | null> {
  try {
    const { src: maskSrc, invert = false, smoothEdges = true, smoothingStrength = 0.25 } = maskConfig

    // Create unique cache key
    const cacheKey = `${maskSrc}-${width}-${height}-${invert}-processed-${smoothEdges}-${smoothingStrength}`
    if (cache.hasMaskCanvas(cacheKey)) {
      return cache.getMaskCanvas(cacheKey)!
    }

    // Load mask image
    const maskImage = await loadImageFn(maskSrc)

    // Create and process mask canvas
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = width
    maskCanvas.height = height
    const maskCtx = maskCanvas.getContext('2d')
    if (!maskCtx) return null

    maskCtx.clearRect(0, 0, width, height)
    maskCtx.drawImage(maskImage, 0, 0, width, height)

    // Convert luminance to alpha
    const imageData = maskCtx.getImageData(0, 0, width, height)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
      const alpha = invert ? gray : 255 - gray
      data[i] = 255
      data[i + 1] = 255
      data[i + 2] = 255
      data[i + 3] = alpha
    }
    maskCtx.putImageData(imageData, 0, 0)

    if (smoothEdges) {
      applyCanvasSmoothing(maskCtx, maskCanvas, smoothingStrength)
    }

    // Cache and return
    cache.setMaskCanvas(cacheKey, maskCanvas)
    return maskCanvas
  } catch (error) {
    console.error('Error building processed mask canvas:', error)
    return null
  }
}

/**
 * Apply smoothing to a mask canvas using scaling technique.
 *
 * @param maskCtx - The 2D rendering context
 * @param maskCanvas - The canvas element
 * @param strength - Smoothing strength (0-1)
 */
export function applyCanvasSmoothing(
  maskCtx: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement,
  strength: number
): void {
  try {
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = maskCanvas.width
    tempCanvas.height = maskCanvas.height
    const tempCtx = tempCanvas.getContext('2d')

    if (tempCtx) {
      // Copy current state to temp canvas
      tempCtx.drawImage(maskCanvas, 0, 0)

      // Apply smoothing
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
      maskCtx.imageSmoothingEnabled = true
      maskCtx.imageSmoothingQuality = 'high'

      // Draw with slight scaling for smoothing effect
      const scale = 1 + strength * 0.02
      const offsetX = ((scale - 1) / 2) * maskCanvas.width
      const offsetY = ((scale - 1) / 2) * maskCanvas.height

      maskCtx.drawImage(tempCanvas, -offsetX, -offsetY, maskCanvas.width * scale, maskCanvas.height * scale)
    }
  } catch (error) {
    console.warn('Canvas smoothing failed:', error)
  }
}

/**
 * Create final masked image by combining original image with processed mask.
 *
 * @param originalImage - The source image
 * @param maskCanvas - The processed mask canvas
 * @param width - Target width
 * @param height - Target height
 * @param options - Masking options
 * @returns Promise resolving to the masked HTMLImageElement
 */
export function createMaskedImage(
  originalImage: HTMLImageElement,
  maskCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  options: MaskedImageOptions
): Promise<HTMLImageElement> {
  const { globalCompositeOperation, smoothEdges, smoothingStrength } = options

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('Could not get canvas context'))
      return
    }

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw original image
    ctx.save()
    ctx.imageSmoothingEnabled = smoothEdges
    if (smoothEdges) {
      ctx.imageSmoothingQuality = smoothingStrength > 0.5 ? 'high' : 'medium'
    }
    ctx.drawImage(originalImage, 0, 0, width, height)
    ctx.restore()

    // Apply mask
    ctx.save()
    ctx.globalCompositeOperation = globalCompositeOperation as GlobalCompositeOperation
    ctx.imageSmoothingEnabled = smoothEdges
    if (smoothEdges) {
      ctx.imageSmoothingQuality = smoothingStrength > 0.5 ? 'high' : 'medium'
    }
    ctx.drawImage(maskCanvas, 0, 0)
    ctx.restore()

    // Convert to HTMLImageElement
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Failed to create blob'))
        return
      }

      const url = URL.createObjectURL(blob)
      const maskedImg = new Image()
      maskedImg.crossOrigin = 'anonymous'
      maskedImg.onload = () => {
        URL.revokeObjectURL(url)
        resolve(maskedImg)
      }
      maskedImg.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load masked image'))
      }
      maskedImg.src = url
    }, 'image/png')
  })
}
