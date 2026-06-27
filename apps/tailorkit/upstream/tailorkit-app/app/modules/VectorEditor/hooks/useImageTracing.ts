/**
 * useImageTracing - Hook for tracing raster images to vector paths
 * Uses VectorWizard API with automatic color detection:
 * - Single color (on white background) → monochrome mode
 * - Multiple colors → color mode
 */

import { useState, useCallback } from 'react'
import { authenticatedFetch } from '~/shopify/fns.client'
import type { ParsedPath, ParsedSvg } from '../utils/svg'
import { parseSvgString } from '../utils/svg'

// High-monochrome quality preset from VectorWizard (for single-color images)
const HIGH_MONOCHROME_PARAMS = {
  colorMode: 'monochrome' as const,
  colorCount: 16,
  threshold: 180,
  turdSize: 10,
  turnPolicy: 'minority' as const,
  alphaMax: 1.0,
  optCurve: true,
  optTolerance: 0.5,
  removeSolidBackground: false,
  bgRemovalTolerance: 30,
  removeWhiteBackground: false,
}

// Color mode preset for multi-color images
const COLOR_MODE_PARAMS = {
  colorMode: 'color' as const,
  colorCount: 16,
  threshold: 180,
  turdSize: 10,
  turnPolicy: 'minority' as const,
  alphaMax: 1.0,
  optCurve: true,
  optTolerance: 0.5,
  removeSolidBackground: false,
  bgRemovalTolerance: 30,
  removeWhiteBackground: false,
}

// Number of random sample areas to check for color detection
const COLOR_SAMPLE_COUNT = 10
// Tolerance for considering a color as "white" (RGB values must all be >= this)
const WHITE_THRESHOLD = 240
// Minimum color difference to consider two colors as distinct
const COLOR_DIFFERENCE_THRESHOLD = 30

interface TracingResult {
  success: boolean
  paths: ParsedPath[]
  error?: string
}

interface VectorConversionResponse {
  success: boolean
  results: Array<{
    shapeId: string
    svgDataUri?: string
    error?: string
  }>
  error?: string
}

interface UseImageTracingOptions {
  apiEndpoint?: string
}

interface UseImageTracingReturn {
  isTracing: boolean
  trace: (imageUrl: string) => Promise<TracingResult>
}

/**
 * Hook for tracing raster images to vector paths
 */
export function useImageTracing(options: UseImageTracingOptions = {}): UseImageTracingReturn {
  const { apiEndpoint = '/api/vector-wizard' } = options
  const [isTracing, setIsTracing] = useState(false)

  /**
   * Trace a raster image to vector paths using VectorWizard API
   * Automatically detects if image is single-color or multi-color
   * @param imageUrl URL of the raster image to trace
   * @returns TracingResult with parsed paths
   */
  const trace = useCallback(
    async (imageUrl: string): Promise<TracingResult> => {
      setIsTracing(true)

      try {
        // Fetch the image as blob
        const imageResponse = await fetch(imageUrl)
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status}`)
        }
        const imageBlob = await imageResponse.blob()

        // Get image dimensions
        const imageDimensions = await getImageDimensions(imageUrl)

        // Detect if image is multi-color by sampling random areas
        const isMultiColor = await detectMultiColorImage(imageUrl, imageDimensions)

        // Choose conversion params based on color detection
        const conversionParams = isMultiColor ? COLOR_MODE_PARAMS : HIGH_MONOCHROME_PARAMS

        // Create a full-image shape selection
        const shapeSelections = [
          {
            type: 'rectangle',
            x: 0,
            y: 0,
            width: imageDimensions.width,
            height: imageDimensions.height,
            source: 'manual',
            shapeId: 'full-image',
          },
        ]

        // Create form data for the API
        const formData = new FormData()
        formData.append('image', imageBlob)
        formData.append('shapeSelections', JSON.stringify(shapeSelections))
        formData.append('conversionParams', JSON.stringify(conversionParams))
        formData.append('uploadToShopify', 'false')
        formData.append('fileName', 'image-trace')

        // Call the VectorWizard API
        const result: VectorConversionResponse = await authenticatedFetch(apiEndpoint, {
          method: 'POST',
          body: formData,
        })

        if (!result.success) {
          throw new Error(result.error || 'Failed to trace image')
        }

        // Extract paths from the SVG result
        const paths: ParsedPath[] = []

        for (const vectorResult of result.results) {
          if (vectorResult.error || !vectorResult.svgDataUri) {
            continue
          }

          // Parse the SVG to extract paths
          const parsedSvg = parseSvgFromDataUri(vectorResult.svgDataUri)
          if (parsedSvg && parsedSvg.paths) {
            // Add paths with no fill and no stroke (invisible outline paths for clipping/holes)
            paths.push(
              ...parsedSvg.paths.map(path => ({
                ...path,
                fill: 'none',
                stroke: 'none',
                strokeWidth: 0,
              }))
            )
          }
        }

        setIsTracing(false)
        return { success: true, paths }
      } catch (error) {
        setIsTracing(false)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        return { success: false, paths: [], error: errorMessage }
      }
    },
    [apiEndpoint]
  )

  return {
    isTracing,
    trace,
  }
}

/**
 * Get image dimensions from URL
 */
async function getImageDimensions(imageUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      reject(new Error('Failed to load image for dimensions'))
    }
    img.src = imageUrl
  })
}

/**
 * Parse SVG from data URI and extract paths
 */
function parseSvgFromDataUri(dataUri: string): ParsedSvg | null {
  try {
    // Decode the data URI
    let svgString: string

    if (dataUri.startsWith('data:image/svg+xml;base64,')) {
      // Base64 encoded
      const base64 = dataUri.replace('data:image/svg+xml;base64,', '')
      svgString = atob(base64)
    } else if (dataUri.startsWith('data:image/svg+xml,')) {
      // URL encoded
      const encoded = dataUri.replace('data:image/svg+xml,', '')
      svgString = decodeURIComponent(encoded)
    } else {
      return null
    }

    // Parse the SVG string to extract paths
    return parseSvgString(svgString)
  } catch (error) {
    console.error('Error parsing SVG data URI:', error)
    return null
  }
}

/**
 * Detect if an image has multiple colors by sampling random areas
 * Returns true if the image has more than 1 distinct non-white color
 */
async function detectMultiColorImage(
  imageUrl: string,
  dimensions: { width: number; height: number }
): Promise<boolean> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        // Create a canvas to sample pixel colors
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(false) // Default to monochrome if canvas not available
          return
        }

        canvas.width = dimensions.width
        canvas.height = dimensions.height
        ctx.drawImage(img, 0, 0)

        // Collect distinct non-white colors from random sample areas
        const distinctColors: Array<{ r: number; g: number; b: number }> = []
        const sampleSize = 5 // Sample a 5x5 pixel area at each random location

        for (let i = 0; i < COLOR_SAMPLE_COUNT; i++) {
          // Generate random position (with margin to avoid edges)
          const margin = sampleSize * 2
          const x = margin + Math.floor(Math.random() * (dimensions.width - margin * 2))
          const y = margin + Math.floor(Math.random() * (dimensions.height - margin * 2))

          // Get pixel data from the sample area
          const imageData = ctx.getImageData(x, y, sampleSize, sampleSize)
          const pixels = imageData.data

          // Sample multiple pixels in the area and find the most common non-white color
          for (let p = 0; p < pixels.length; p += 4) {
            const r = pixels[p]
            const g = pixels[p + 1]
            const b = pixels[p + 2]
            const a = pixels[p + 3]

            // Skip transparent pixels
            if (a < 128) continue

            // Skip white/near-white pixels
            if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) continue

            // Check if this color is distinct from already found colors
            const isDistinct = !distinctColors.some(color => {
              const diff = Math.abs(color.r - r) + Math.abs(color.g - g) + Math.abs(color.b - b)
              return diff < COLOR_DIFFERENCE_THRESHOLD
            })

            if (isDistinct) {
              distinctColors.push({ r, g, b })

              // If we found more than 1 distinct color, it's multi-color
              if (distinctColors.length > 1) {
                resolve(true)
                return
              }
            }
          }
        }

        // Only found 0 or 1 distinct color - use monochrome mode
        resolve(false)
      } catch {
        // On error, default to monochrome mode
        resolve(false)
      }
    }

    img.onerror = () => {
      // On error, default to monochrome mode
      resolve(false)
    }

    img.src = imageUrl
  })
}

export default useImageTracing
