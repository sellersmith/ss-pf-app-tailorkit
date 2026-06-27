/**
 * usePaintLoader - Load images for ImagePaint fills
 *
 * Handles async image loading, caching, and CORS conversion.
 * Images are converted to data URLs to avoid CORS issues in SVG.
 *
 * @module components/canvas/elements/Text/hooks
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Paint, ImagePaint } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { isImagePaint } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import type { LoadedImage } from 'extensions/tailorkit-src/src/shared/libraries/paint/paint-renderer'

export type { LoadedImage }

export interface UsePaintLoaderResult {
  /** Loaded images keyed by imageRef */
  loadedImages: Map<string, LoadedImage>
  /** Whether any images are still loading */
  isLoading: boolean
  /** Errors that occurred during loading */
  errors: Map<string, Error>
  /** Force reload a specific image */
  reloadImage: (imageRef: string) => void
}

// Global image cache to avoid reloading same images across components
const imageCache = new Map<string, LoadedImage>()

// Track loading promises to avoid duplicate requests
const loadingPromises = new Map<string, Promise<LoadedImage | null>>()

/**
 * Load an image and convert to data URL
 */
async function loadImage(imageRef: string): Promise<LoadedImage | null> {
  // Check cache first
  if (imageCache.has(imageRef)) {
    return imageCache.get(imageRef)!
  }

  // Check if already loading
  if (loadingPromises.has(imageRef)) {
    return loadingPromises.get(imageRef)!
  }

  // Create loading promise
  const loadPromise = new Promise<LoadedImage | null>(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        // Convert to data URL to avoid CORS issues in SVG
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          console.error('Failed to get canvas context for image:', imageRef)
          resolve(null)
          return
        }

        ctx.drawImage(img, 0, 0)

        const loadedImage: LoadedImage = {
          imageRef,
          dataUrl: canvas.toDataURL('image/png'),
          width: img.naturalWidth,
          height: img.naturalHeight,
        }

        // Update cache
        imageCache.set(imageRef, loadedImage)
        loadingPromises.delete(imageRef)

        resolve(loadedImage)
      } catch (err) {
        console.error('Failed to convert image to data URL:', imageRef, err)
        loadingPromises.delete(imageRef)
        resolve(null)
      }
    }

    img.onerror = () => {
      console.error('Failed to load image:', imageRef)
      loadingPromises.delete(imageRef)
      resolve(null)
    }

    img.src = imageRef
  })

  loadingPromises.set(imageRef, loadPromise)
  return loadPromise
}

/**
 * Hook to load images for multiple Paint fills
 *
 * @param fills - Array of Paint fills
 * @returns Loading state and loaded images map
 */
export function usePaintsLoader(fills: Paint[]): UsePaintLoaderResult {
  const [loadedImages, setLoadedImages] = useState<Map<string, LoadedImage>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Map<string, Error>>(new Map())
  const mountedRef = useRef(true)
  const loadingRef = useRef<Set<string>>(new Set())

  // Force reload an image
  const reloadImage = useCallback((imageRef: string) => {
    imageCache.delete(imageRef)
    loadingPromises.delete(imageRef)
    loadingRef.current.delete(imageRef)
    setLoadedImages(prev => {
      const next = new Map(prev)
      next.delete(imageRef)
      return next
    })
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    // Extract all ImagePaint references
    const imageRefs = fills
      .filter(isImagePaint)
      .map(p => (p as ImagePaint).imageRef)
      .filter(Boolean)

    if (imageRefs.length === 0) {
      setLoadedImages(new Map())
      setIsLoading(false)
      return
    }

    // Check what's already cached
    const cached = new Map<string, LoadedImage>()
    const toLoad: string[] = []

    for (const ref of imageRefs) {
      const cachedImage = imageCache.get(ref)
      if (cachedImage) {
        cached.set(ref, cachedImage)
      } else if (!loadingRef.current.has(ref)) {
        toLoad.push(ref)
      }
    }

    // Update with cached images immediately
    if (cached.size > 0) {
      setLoadedImages(prev => new Map([...prev, ...cached]))
    }

    // Nothing to load
    if (toLoad.length === 0) {
      setIsLoading(loadingRef.current.size > 0)
      return
    }

    // Start loading
    setIsLoading(true)
    toLoad.forEach(ref => loadingRef.current.add(ref))

    // Load all images in parallel
    Promise.all(toLoad.map(loadImage)).then(results => {
      if (!mountedRef.current) return

      const newLoaded = new Map<string, LoadedImage>()
      const newErrors = new Map<string, Error>()

      results.forEach((result, index) => {
        const ref = toLoad[index]
        loadingRef.current.delete(ref)

        if (result) {
          newLoaded.set(ref, result)
        } else {
          newErrors.set(ref, new Error(`Failed to load: ${ref}`))
        }
      })

      setLoadedImages(prev => new Map([...prev, ...newLoaded]))
      setErrors(prev => new Map([...prev, ...newErrors]))
      setIsLoading(loadingRef.current.size > 0)
    })
  }, [fills])

  // CRITICAL: Compute isLoading synchronously to prevent race condition
  // On the first render after fills change, the useEffect hasn't run yet,
  // so isLoading state would be false even though images need loading.
  // We check synchronously if any ImagePaint needs loading but isn't in loadedImages.
  const needsLoading = fills.some(fill => {
    if (!isImagePaint(fill)) return false
    const imageRef = (fill as ImagePaint).imageRef
    return imageRef && !imageCache.has(imageRef) && !loadedImages.has(imageRef)
  })
  const computedIsLoading = isLoading || needsLoading

  return { loadedImages, isLoading: computedIsLoading, errors, reloadImage }
}
