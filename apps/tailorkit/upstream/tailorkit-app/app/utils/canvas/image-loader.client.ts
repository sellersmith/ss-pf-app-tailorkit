/**
 * Client-side image loading utilities for Canvas operations
 *
 * Provides functions to load images into canvas elements with optional
 * downscaling for memory optimization on large images.
 */

/**
 * Result of loading an image into a canvas
 */
export interface LoadImageResult {
  /** The canvas element containing the loaded image */
  canvas: HTMLCanvasElement
  /** The 2D rendering context */
  ctx: CanvasRenderingContext2D
  /** Working width (may be downscaled) */
  width: number
  /** Working height (may be downscaled) */
  height: number
  /** Original image width before any downscaling */
  originalWidth: number
  /** Original image height before any downscaling */
  originalHeight: number
}

/**
 * Load an image URL into a Canvas element with optional max dimension for optimization
 *
 * @param imageUrl - URL of the image to load
 * @param maxDimension - Maximum dimension (width or height) before downscaling
 * @returns Promise resolving to the canvas and dimension information
 */
export async function loadImageToCanvas(imageUrl: string, maxDimension?: number): Promise<LoadImageResult> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        // Cleanup image on error
        img.src = ''
        reject(new Error('Could not get Canvas 2D context'))
        return
      }

      const originalWidth = img.width
      const originalHeight = img.height

      // Downscale during load if maxDimension is specified
      if (maxDimension) {
        const maxDim = Math.max(originalWidth, originalHeight)
        if (maxDim > maxDimension) {
          const scale = maxDimension / maxDim
          canvas.width = Math.round(originalWidth * scale)
          canvas.height = Math.round(originalHeight * scale)

          // Use high-quality downscaling
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

          // Cleanup image object to free memory
          img.src = ''

          resolve({
            canvas,
            ctx,
            width: canvas.width,
            height: canvas.height,
            originalWidth,
            originalHeight,
          })
          return
        }
      }

      // No downscaling needed or not specified
      canvas.width = originalWidth
      canvas.height = originalHeight
      ctx.drawImage(img, 0, 0)

      // Cleanup image object to free memory
      img.src = ''

      resolve({
        canvas,
        ctx,
        width: originalWidth,
        height: originalHeight,
        originalWidth,
        originalHeight,
      })
    }

    img.onerror = () => {
      // Cleanup image on error
      img.src = ''
      reject(new Error(`Failed to load image: ${imageUrl}`))
    }

    img.src = imageUrl
  })
}

/**
 * Get ImageData from a Canvas
 */
export function getImageDataFromCanvas(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Could not get Canvas 2D context')
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/**
 * Put ImageData back to Canvas
 */
export function putImageDataToCanvas(canvas: HTMLCanvasElement, imageData: ImageData): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Could not get Canvas 2D context')
  }
  ctx.putImageData(imageData, 0, 0)
}

/**
 * Convert Canvas to Blob
 */
export async function canvasToBlob(canvas: HTMLCanvasElement, type: string = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Failed to convert canvas to blob'))
      }
    }, type)
  })
}

/**
 * Convert Canvas to base64 data URL
 */
export function canvasToDataUrl(canvas: HTMLCanvasElement, type: string = 'image/png'): string {
  return canvas.toDataURL(type)
}

/**
 * Create ImageData from raw pixel data
 */
export function createImageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  return new ImageData(data, width, height)
}

/**
 * Create a new canvas with specified dimensions
 */
export function createCanvas(
  width: number,
  height: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not get Canvas 2D context')
  }

  return { canvas, ctx }
}
