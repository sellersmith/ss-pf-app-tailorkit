/**
 * React hook for applying VectorEditor overlay to raster images
 * Composites the base image with SVG overlay (clip paths, filters, drawn paths)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { hasVisualOverlay, createCachedCompositor, type OverlayMetadata } from '~/shared/utils/overlay-compositor'
import { isSvgImage } from '~/utils/file-types'

export interface OverlayData {
  /** SVG string for rendering (combinedSvg from VectorEditor) */
  overlaySvg: string
  /** Metadata about the overlay */
  overlayMetadata?: OverlayMetadata
}

export interface ClipGroupData {
  /** X position of the image within the clip container */
  absoluteX?: number
  /** Y position of the image within the clip container */
  absoluteY?: number
  /** Width of the image within the clip container */
  absoluteWidth?: number
  /** Height of the image within the clip container */
  absoluteHeight?: number
  /** Rotation of the image within the clip container */
  rotation?: number
}

export interface UseImageWithOverlayOptions {
  /** The base image URL */
  imageUrl: string | undefined
  /** The overlay data from layer settings */
  overlay: OverlayData | null | undefined
  /** Whether to enable overlay compositing (default: true) */
  enabled?: boolean
  /**
   * Clip group data for positioning the image within a container.
   * When provided with container dimensions, the overlay will be applied
   * AFTER extracting the visible clipped portion of the image.
   */
  clipGroup?: ClipGroupData | null
  /** Container width (required when clipGroup is provided) */
  containerWidth?: number
  /** Container height (required when clipGroup is provided) */
  containerHeight?: number
}

export interface UseImageWithOverlayResult {
  /** The final image URL (composited or original) */
  imageUrl: string | undefined
  /** Whether the overlay is being applied */
  isCompositing: boolean
  /** Any error that occurred during compositing */
  error: Error | null
  /** Force recomposite the image */
  recomposite: () => void
  /**
   * When true, the composited image already has clipGroup positioning baked in.
   * The caller should NOT apply clipGroup positioning again - render the image
   * at (0,0) within the container instead.
   */
  clipGroupBakedIn: boolean
}

// Create a shared cached compositor instance
const cachedCompositor = createCachedCompositor()

/**
 * Extract the visible portion of an image based on clipGroup data.
 * This creates a canvas at container dimensions and draws the image
 * positioned/scaled according to clipGroup settings.
 */
async function extractClippedImage(
  imageUrl: string,
  clipGroup: ClipGroupData,
  containerWidth: number,
  containerHeight: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        // Create a canvas at the container dimensions
        const canvas = document.createElement('canvas')
        canvas.width = containerWidth
        canvas.height = containerHeight
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        // Get clipGroup positioning, with aspect-ratio-preserving fallback for SVG images
        let imgX = clipGroup.absoluteX ?? 0
        let imgY = clipGroup.absoluteY ?? 0
        let imgW = clipGroup.absoluteWidth ?? 0
        let imgH = clipGroup.absoluteHeight ?? 0
        const rotation = clipGroup.rotation ?? 0

        // If dimensions are not set, apply aspect ratio preservation for SVG images only
        // to maintain backward compatibility with raster images
        if (!imgW || !imgH) {
          const isSvg = isSvgImage(imageUrl)
          if (isSvg) {
            const naturalWidth = img.naturalWidth > 0 ? img.naturalWidth : containerWidth
            const naturalHeight = img.naturalHeight > 0 ? img.naturalHeight : containerHeight
            const imgAspect = naturalWidth / naturalHeight
            const containerAspect = containerWidth / containerHeight

            if (imgAspect > containerAspect) {
              // Image is wider than container - fit to width
              imgW = containerWidth
              imgH = containerWidth / imgAspect
            } else {
              // Image is taller than container - fit to height
              imgH = containerHeight
              imgW = containerHeight * imgAspect
            }

            // Center the image if position was not explicitly set
            const hasExplicitPosition = clipGroup.absoluteX !== undefined || clipGroup.absoluteY !== undefined
            if (!hasExplicitPosition) {
              imgX = (containerWidth - imgW) / 2
              imgY = (containerHeight - imgH) / 2
            }
          } else {
            // For raster images, use container dimensions (backward compatible behavior)
            imgW = containerWidth
            imgH = containerHeight
          }
        }

        // Draw the image at its clipGroup position/scale
        ctx.save()
        if (rotation) {
          // Rotate around the image center
          const centerX = imgX + imgW / 2
          const centerY = imgY + imgH / 2
          ctx.translate(centerX, centerY)
          ctx.rotate((rotation * Math.PI) / 180)
          ctx.translate(-centerX, -centerY)
        }
        ctx.drawImage(img, imgX, imgY, imgW, imgH)
        ctx.restore()

        // Return the extracted image as data URL
        resolve(canvas.toDataURL('image/png'))
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => reject(new Error(`Failed to load image: ${imageUrl}`))
    img.src = imageUrl
  })
}

/**
 * Hook that applies VectorEditor overlay to a raster image
 * Returns the composited image URL if overlay exists, otherwise returns original
 *
 * When clipGroup is provided with container dimensions, the overlay is applied
 * AFTER extracting the visible clipped portion of the image. This ensures the
 * overlay (which is designed for container dimensions) aligns correctly with
 * the visible portion of the image.
 */
export function useImageWithOverlay(options: UseImageWithOverlayOptions): UseImageWithOverlayResult {
  const { imageUrl, overlay, enabled = true, clipGroup, containerWidth, containerHeight } = options

  const [compositedUrl, setCompositedUrl] = useState<string | undefined>(undefined)
  const [isCompositing, setIsCompositing] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Track current compositing operation to cancel stale ones
  const compositeIdRef = useRef(0)

  // Check if overlay should be applied
  const shouldApplyOverlay
    = enabled
    && imageUrl
    && overlay?.overlaySvg
    && hasVisualOverlay({
      metadata: overlay.overlayMetadata || {
        imageWidth: 0,
        imageHeight: 0,
        hasClipPaths: true, // Assume true if we have overlaySvg but no metadata
        hasFilters: true,
        hasDrawnPaths: true,
      },
    })

  // Determine if we need to extract clipped portion first
  const hasClipGroup = Boolean(clipGroup && containerWidth && containerHeight)

  const recomposite = useCallback(async () => {
    if (!shouldApplyOverlay || !imageUrl || !overlay?.overlaySvg) return

    // Invalidate cache for this image
    cachedCompositor.invalidate(imageUrl)

    // Increment composite ID to trigger new compositing
    compositeIdRef.current += 1
    const currentId = compositeIdRef.current

    setIsCompositing(true)
    setError(null)

    try {
      let sourceImageUrl = imageUrl
      let targetWidth: number | undefined
      let targetHeight: number | undefined

      // When clipGroup exists with container dimensions, extract the visible
      // clipped portion first, then composite the overlay with that
      if (hasClipGroup && clipGroup && containerWidth && containerHeight) {
        sourceImageUrl = await extractClippedImage(imageUrl, clipGroup, containerWidth, containerHeight)
        targetWidth = containerWidth
        targetHeight = containerHeight
      }

      const result = await cachedCompositor.composite({
        imageUrl: sourceImageUrl,
        overlay: {
          combinedSvg: overlay.overlaySvg,
          metadata: overlay.overlayMetadata || {
            imageWidth: targetWidth || 0,
            imageHeight: targetHeight || 0,
            hasClipPaths: false,
            hasFilters: false,
            hasDrawnPaths: false,
          },
        },
        targetWidth,
        targetHeight,
      })

      // Only update if this is still the current composite operation
      if (currentId === compositeIdRef.current) {
        setCompositedUrl(result.dataUrl)
        setIsCompositing(false)
      }
    } catch (err) {
      if (currentId === compositeIdRef.current) {
        console.error('Failed to composite image with overlay:', err)
        setError(err instanceof Error ? err : new Error(String(err)))
        setIsCompositing(false)
        // Fall back to original image
        setCompositedUrl(undefined)
      }
    }
  }, [
    shouldApplyOverlay,
    imageUrl,
    overlay?.overlaySvg,
    overlay?.overlayMetadata,
    hasClipGroup,
    clipGroup,
    containerWidth,
    containerHeight,
  ])

  useEffect(() => {
    if (!shouldApplyOverlay) {
      // No overlay to apply, use original image
      setCompositedUrl(undefined)
      setIsCompositing(false)
      setError(null)
      return
    }

    if (!imageUrl || !overlay?.overlaySvg) {
      return
    }

    // Increment composite ID to track this operation
    compositeIdRef.current += 1
    const currentId = compositeIdRef.current

    setIsCompositing(true)
    setError(null)

    const performCompositing = async () => {
      try {
        let sourceImageUrl = imageUrl
        let targetWidth: number | undefined
        let targetHeight: number | undefined

        // When clipGroup exists with container dimensions, extract the visible
        // clipped portion first, then composite the overlay with that
        if (hasClipGroup && clipGroup && containerWidth && containerHeight) {
          sourceImageUrl = await extractClippedImage(imageUrl, clipGroup, containerWidth, containerHeight)
          targetWidth = containerWidth
          targetHeight = containerHeight
        }

        // Composite the overlay with the (possibly extracted) image
        const result = await cachedCompositor.composite({
          imageUrl: sourceImageUrl,
          overlay: {
            combinedSvg: overlay.overlaySvg,
            metadata: overlay.overlayMetadata || {
              imageWidth: targetWidth || 0,
              imageHeight: targetHeight || 0,
              hasClipPaths: false,
              hasFilters: false,
              hasDrawnPaths: false,
            },
          },
          targetWidth,
          targetHeight,
        })

        // Only update if this is still the current composite operation
        if (currentId === compositeIdRef.current) {
          setCompositedUrl(result.dataUrl)
          setIsCompositing(false)
        }
      } catch (err) {
        if (currentId === compositeIdRef.current) {
          console.error('Failed to composite image with overlay:', err)
          setError(err instanceof Error ? err : new Error(String(err)))
          setIsCompositing(false)
          // Fall back to original image
          setCompositedUrl(undefined)
        }
      }
    }

    performCompositing()
  }, [
    shouldApplyOverlay,
    imageUrl,
    overlay?.overlaySvg,
    overlay?.overlayMetadata,
    hasClipGroup,
    clipGroup,
    containerWidth,
    containerHeight,
  ])

  // When we have composited with clipGroup handling, the positioning is baked in
  const clipGroupBakedIn = Boolean(compositedUrl && hasClipGroup)

  return {
    // Return composited URL if available, otherwise fall back to original
    imageUrl: compositedUrl || imageUrl,
    isCompositing,
    error,
    recomposite,
    clipGroupBakedIn,
  }
}

export default useImageWithOverlay
