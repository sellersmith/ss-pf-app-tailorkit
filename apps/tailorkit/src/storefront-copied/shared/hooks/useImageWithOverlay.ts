/**
 * Preact hook for applying VectorEditor overlay to raster images
 * Composites the base image with SVG overlay (clip paths, filters, drawn paths)
 *
 * This is the Preact version for use in Shopify theme extensions.
 * @see app/hooks/useImageWithOverlay.ts for the React version
 */

import { useState, useEffect, useRef, useCallback } from 'preact/hooks'
import { hasVisualOverlay, createCachedCompositor, type OverlayMetadata } from '../utils/overlay-compositor'

export interface OverlayData {
  /** SVG string for rendering (combinedSvg from VectorEditor) */
  overlaySvg: string
  /** Metadata about the overlay */
  overlayMetadata?: OverlayMetadata
}

export interface UseImageWithOverlayOptions {
  /** The base image URL */
  imageUrl: string | undefined
  /** The overlay data from layer settings */
  overlay: OverlayData | null | undefined
  /** Whether to enable overlay compositing (default: true) */
  enabled?: boolean
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
}

// Create a shared cached compositor instance
const cachedCompositor = createCachedCompositor()

/**
 * Hook that applies VectorEditor overlay to a raster image
 * Returns the composited image URL if overlay exists, otherwise returns original
 */
export function useImageWithOverlay(options: UseImageWithOverlayOptions): UseImageWithOverlayResult {
  const { imageUrl, overlay, enabled = true } = options

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

  const recomposite = useCallback(() => {
    if (!shouldApplyOverlay || !imageUrl || !overlay?.overlaySvg) return

    // Invalidate cache for this image
    cachedCompositor.invalidate(imageUrl)

    // Increment composite ID to trigger new compositing
    compositeIdRef.current += 1
    const currentId = compositeIdRef.current

    setIsCompositing(true)
    setError(null)

    cachedCompositor
      .composite({
        imageUrl,
        overlay: {
          combinedSvg: overlay.overlaySvg,
          metadata: overlay.overlayMetadata || {
            imageWidth: 0,
            imageHeight: 0,
            hasClipPaths: false,
            hasFilters: false,
            hasDrawnPaths: false,
          },
        },
      })
      .then(result => {
        // Only update if this is still the current composite operation
        if (currentId === compositeIdRef.current) {
          setCompositedUrl(result.dataUrl)
          setIsCompositing(false)
        }
      })
      .catch(err => {
        if (currentId === compositeIdRef.current) {
          console.error('Failed to composite image with overlay:', err)
          setError(err instanceof Error ? err : new Error(String(err)))
          setIsCompositing(false)
          // Fall back to original image
          setCompositedUrl(undefined)
        }
      })
  }, [shouldApplyOverlay, imageUrl, overlay?.overlaySvg, overlay?.overlayMetadata])

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

    cachedCompositor
      .composite({
        imageUrl,
        overlay: {
          combinedSvg: overlay.overlaySvg,
          metadata: overlay.overlayMetadata || {
            imageWidth: 0,
            imageHeight: 0,
            hasClipPaths: false,
            hasFilters: false,
            hasDrawnPaths: false,
          },
        },
      })
      .then(result => {
        // Only update if this is still the current composite operation
        if (currentId === compositeIdRef.current) {
          setCompositedUrl(result.dataUrl)
          setIsCompositing(false)
        }
      })
      .catch(err => {
        if (currentId === compositeIdRef.current) {
          console.error('Failed to composite image with overlay:', err)
          setError(err instanceof Error ? err : new Error(String(err)))
          setIsCompositing(false)
          // Fall back to original image
          setCompositedUrl(undefined)
        }
      })
  }, [shouldApplyOverlay, imageUrl, overlay?.overlaySvg, overlay?.overlayMetadata])

  return {
    // Return composited URL if available, otherwise fall back to original
    imageUrl: compositedUrl || imageUrl,
    isCompositing,
    error,
    recomposite,
  }
}

export default useImageWithOverlay
