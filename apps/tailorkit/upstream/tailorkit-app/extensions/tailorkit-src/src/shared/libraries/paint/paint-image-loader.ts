/**
 * Paint Image Loader
 *
 * Utilities for loading and processing images for Paint-based fills and strokes.
 * Handles CORS-safe data URL conversion for SVG embedding.
 *
 * @module shared/libraries/paint
 */

import type { Paint } from './paint-types'
import { isImagePaint } from './paint-types'
import type { StrokeConfig } from './stroke-types'
import type { LoadedImage } from './paint-renderer'

/**
 * Load an image from URL
 *
 * @param src - Image source URL
 * @returns Promise resolving to loaded HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

/**
 * Convert an HTMLImageElement to a data URL
 *
 * Uses canvas to draw the image and export as PNG data URL.
 * This is necessary for CORS-safe SVG embedding.
 *
 * @param img - HTMLImageElement to convert
 * @returns PNG data URL string
 */
export function imageToDataUrl(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/png')
}

/**
 * Load all images referenced in Paint fills and strokes
 *
 * Pre-loads all images referenced in paint fills and strokes array.
 * Converts images to data URLs for CORS-safe SVG embedding.
 *
 * @param paintFill - Optional paint fill (may contain imageRef)
 * @param strokes - Optional strokes array (each stroke may have image paint)
 * @returns Map of imageRef to loaded image data
 */
export async function loadPaintImages(
  paintFill: Paint | undefined,
  strokes: StrokeConfig[] | undefined
): Promise<Map<string, LoadedImage>> {
  const loadedImages = new Map<string, LoadedImage>()
  const imageRefs = new Set<string>()

  // Collect image refs from paint fill
  if (paintFill && isImagePaint(paintFill) && paintFill.imageRef) {
    imageRefs.add(paintFill.imageRef)
  }

  // Collect image refs from strokes
  if (strokes) {
    for (const stroke of strokes) {
      if (stroke.visible && isImagePaint(stroke.paint) && stroke.paint.imageRef) {
        imageRefs.add(stroke.paint.imageRef)
      }
    }
  }

  // No images to load
  if (imageRefs.size === 0) {
    return loadedImages
  }

  // Load all images in parallel and convert to data URLs
  await Promise.all(
    Array.from(imageRefs).map(async ref => {
      try {
        const img = await loadImage(ref)
        const dataUrl = imageToDataUrl(img)
        loadedImages.set(ref, {
          imageRef: ref,
          dataUrl,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        })
      } catch (error) {
        console.warn('Failed to load image for paint:', ref, error)
      }
    })
  )

  return loadedImages
}
