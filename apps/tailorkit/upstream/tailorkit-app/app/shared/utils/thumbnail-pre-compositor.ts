/**
 * Thumbnail Pre-Compositor Utility
 * Generates pre-composited thumbnail URLs for image options with SVG overlays.
 * Used to prepare thumbnails for web components that cannot perform runtime compositing.
 */

import { compositeImageWithOverlay, hasVisualOverlay, type OverlayMetadata } from './overlay-compositor'

export interface ThumbnailOverlayData {
  /** Combined SVG string for rendering */
  overlaySvg?: string
  /** Metadata about the overlay */
  overlayMetadata?: OverlayMetadata
}

export interface PreCompositeThumbnailOptions {
  /** The base image URL */
  imageUrl: string
  /** The overlay data from VectorEditor */
  overlay: ThumbnailOverlayData
  /** Target thumbnail width (defaults to 120 for 2x retina of 60px thumbnail) */
  thumbnailWidth?: number
}

export interface PreCompositeThumbnailResult {
  /** The composited thumbnail as a data URL */
  dataUrl: string
  /** The width of the thumbnail */
  width: number
  /** The height of the thumbnail */
  height: number
}

/**
 * Generate a pre-composited thumbnail for an image with overlay.
 * Returns a data URL that can be used directly or uploaded to storage.
 */
export async function preCompositeThumbnail(
  options: PreCompositeThumbnailOptions
): Promise<PreCompositeThumbnailResult | null> {
  const { imageUrl, overlay, thumbnailWidth = 120 } = options

  // Skip if no overlay or no visual effects
  if (!overlay?.overlaySvg) {
    return null
  }

  // Check if overlay has any visual effects
  const hasEffects = hasVisualOverlay({
    metadata: overlay.overlayMetadata,
  })

  if (!hasEffects) {
    return null
  }

  try {
    // Get original image dimensions to calculate aspect ratio
    const img = await loadImageDimensions(imageUrl)
    const aspectRatio = img.height / img.width
    const thumbnailHeight = Math.round(thumbnailWidth * aspectRatio)

    // Composite the image with overlay at thumbnail size
    const result = await compositeImageWithOverlay({
      imageUrl,
      overlay: {
        combinedSvg: overlay.overlaySvg,
        metadata: overlay.overlayMetadata || {
          imageWidth: img.width,
          imageHeight: img.height,
          hasClipPaths: false,
          hasFilters: false,
          hasDrawnPaths: false,
        },
      },
      targetWidth: thumbnailWidth,
      targetHeight: thumbnailHeight,
      devicePixelRatio: 1, // Use 1x for smaller file size
    })

    return {
      dataUrl: result.dataUrl,
      width: result.width,
      height: result.height,
    }
  } catch (error) {
    console.error('Failed to pre-composite thumbnail:', error)
    return null
  }
}

/**
 * Upload function type for uploading the composited thumbnail to storage.
 */
export type UploadThumbnailFn = (blob: Blob, filename: string) => Promise<string>

/**
 * Generate a pre-composited thumbnail and upload it to storage.
 * Returns the uploaded URL that can be stored in the image option data.
 */
export async function preCompositeThumbnailAndUpload(
  options: PreCompositeThumbnailOptions,
  uploadFn: UploadThumbnailFn,
  filename: string
): Promise<string | null> {
  const result = await preCompositeThumbnail(options)

  if (!result) {
    return null
  }

  try {
    // Convert data URL to Blob
    const blob = dataUrlToBlob(result.dataUrl)

    // Upload to storage
    const uploadedUrl = await uploadFn(blob, filename)

    return uploadedUrl
  } catch (error) {
    console.error('Failed to upload pre-composited thumbnail:', error)
    return null
  }
}

/**
 * Load image dimensions without fully loading the image data.
 */
function loadImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () =>
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      })
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    img.src = url
  })
}

/**
 * Convert a data URL to a Blob.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png'
  const bstr = atob(parts[1])
  const n = bstr.length
  const u8arr = new Uint8Array(n)

  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i)
  }

  return new Blob([u8arr], { type: mime })
}

export default preCompositeThumbnail
