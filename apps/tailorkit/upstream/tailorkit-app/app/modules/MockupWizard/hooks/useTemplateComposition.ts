import type { TemplateImageState, TemplatePosition } from '../types'
import { useState, useEffect, useCallback, useRef } from 'react'
import { drawCompositeImage } from '../utils/templatePositioning'
import { IMAGE_DIMENSIONS } from '../constants'

/**
 * Hook for managing template composition
 */
export function useTemplateComposition(templateImages: string[]) {
  const compositCanvasRef = useRef<HTMLCanvasElement>(null)

  const [templateImageStates, setTemplateImageStates] = useState<TemplateImageState[]>([])
  const [loadedTemplateImages, setLoadedTemplateImages] = useState<HTMLImageElement[]>([])
  const [templatePositions, setTemplatePositions] = useState<TemplatePosition[]>([])
  const [processedImageLoaded, setProcessedImageLoaded] = useState(false)

  /**
   * Load template images when templateImages prop changes
   */
  useEffect(() => {
    if (!templateImages.length) {
      setLoadedTemplateImages([])
      setTemplateImageStates([])
      return
    }

    // Initialize template image states
    const initialStates = templateImages.map(() => ({ loaded: false, error: null }))
    setTemplateImageStates(initialStates)

    const loadedImages: HTMLImageElement[] = []

    const imagePromises = templateImages.map((templateUrl, index) => {
      return new Promise<HTMLImageElement | null>(resolve => {
        const img = new Image()
        img.crossOrigin = 'anonymous'

        img.onload = () => {
          setTemplateImageStates(prev => prev.map((state, i) => (i === index ? { ...state, loaded: true } : state)))
          loadedImages.push(img)
          resolve(img)
        }

        img.onerror = () => {
          setTemplateImageStates(prev =>
            prev.map((state, i) => (i === index ? { ...state, error: 'Failed to load template image' } : state))
          )
          resolve(null)
        }

        img.src = templateUrl
      })
    })

    Promise.all(imagePromises).then(images => {
      const validImages = images.filter(Boolean) as HTMLImageElement[]
      setLoadedTemplateImages(validImages)
    })

    // Cleanup: Free template image memory when unmounting or templateImages changes
    return () => {
      loadedImages.forEach(img => {
        img.src = ''
        img.onload = null
        img.onerror = null
      })
    }
  }, [templateImages])

  /**
   * Draw composite image with templates
   *
   * @param processedDimensions - Optional dimensions from processing result.
   *   When provided, the original image is scaled to match these dimensions
   *   (used when the result was downscaled during processing and not upscaled back).
   */
  const drawComposite = useCallback(
    (
      originalImage: HTMLImageElement,
      transparentAreas: any[],
      maskImageUrl: string | null | undefined,
      templatePositioningMode: 'fit' | 'fill',
      onTemplatePositionsCalculated?: (positions: TemplatePosition[]) => void,
      isMobileView: boolean = false,
      processedDimensions?: { width: number; height: number },
      /** Override calculated positions (from manipulator drag or initial seed) */
      positionOverrides?: TemplatePosition[],
      /** When true, apply fit/fill to positionOverrides (initial area bounds).
       *  When false, use overrides directly (user-manipulated exact positions). */
      fitOverrides: boolean = false,
      /** When true, skip mask layer — template composites on top of full product image */
      noMask: boolean = false
    ) => {
      const canvas = compositCanvasRef.current
      if (!canvas || !originalImage || (!maskImageUrl && !noMask)) return

      // Calculate scale factor:
      // 1. If processedDimensions provided, scale original to match processed result
      // 2. Otherwise, calculate based on device downscale thresholds
      let scaleFactor = 1.0

      if (processedDimensions && processedDimensions.width > 0) {
        // Scale original image to match processed result dimensions
        scaleFactor = processedDimensions.width / originalImage.width
      } else {
        // Fallback: calculate based on device type thresholds
        const maxDim = Math.max(originalImage.width, originalImage.height)
        const downscaleThreshold = isMobileView
          ? IMAGE_DIMENSIONS.MOBILE_DOWNSCALE_THRESHOLD
          : IMAGE_DIMENSIONS.DESKTOP_DOWNSCALE_THRESHOLD

        if (maxDim > downscaleThreshold) {
          scaleFactor = downscaleThreshold / maxDim
        }
      }

      drawCompositeImage(
        canvas,
        originalImage,
        loadedTemplateImages,
        transparentAreas,
        maskImageUrl,
        templatePositioningMode,
        positions => {
          setTemplatePositions(positions)
          onTemplatePositionsCalculated?.(positions)
        },
        scaleFactor,
        positionOverrides,
        fitOverrides,
        noMask
      )
    },
    [loadedTemplateImages]
  )

  /**
   * Set processed image loaded state
   */
  const setProcessedImageLoadedState = useCallback((loaded: boolean) => {
    setProcessedImageLoaded(loaded)
  }, [])

  return {
    // Refs
    compositCanvasRef,

    // State
    templateImageStates,
    loadedTemplateImages,
    templatePositions,
    processedImageLoaded,

    // Actions
    drawComposite,
    setProcessedImageLoaded: setProcessedImageLoadedState,
  }
}
