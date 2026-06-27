import type { VectorConversionParameters, VectorResult, ShapeSelection } from './types'
import { convertRasterToVector } from './fns.server'
import { detectContentBoundary } from './shapeDetection.server'

/**
 * Default vector conversion parameters optimized for AI-generated vector-style images
 * Uses monochrome mode with 'high' quality preset for cleanest vector output
 *
 * Potrace parameters explained:
 * - threshold: 180 (higher value captures more detail in lighter areas)
 * - turdSize: 10 (suppress speckles up to this size, higher = cleaner output with less noise)
 * - turnPolicy: 'minority' (resolve ambiguities in path decomposition, 'minority' is best for smooth curves)
 * - alphaMax: 1.0 (corner threshold, 1.0 = smoothest curves, 0 = all corners)
 * - optCurve: true (enable curve optimization)
 * - optTolerance: 0.5 (higher tolerance = smoother curves with fewer control points)
 */
export const DEFAULT_VECTOR_PARAMS: VectorConversionParameters = {
  colorMode: 'monochrome',
  colorCount: 2,
  threshold: 180,
  turdSize: 10,
  turnPolicy: 'minority',
  alphaMax: 1.0,
  optCurve: true,
  optTolerance: 0.5,
  removeSolidBackground: true,
  bgRemovalTolerance: 30,
  removeWhiteBackground: true,
}

interface GenerateVectorOptions {
  /** Auto-detect content boundary before vectorization */
  autoDetectBoundary?: boolean
  /** Vector conversion parameters */
  conversionParams?: Partial<VectorConversionParameters>
  /** Upload result to Shopify CDN */
  uploadToShopify?: boolean
  /** File name prefix for uploaded SVG */
  fileName?: string
  /** Shopify client for uploading */
  shopifyClient?: { api: any; shopDomain: string }
}

/**
 * Generate vector SVG from raster image buffer
 *
 * This function combines:
 * 1. Content boundary auto-detection (optional)
 * 2. Raster to vector conversion using Potrace
 * 3. SVG optimization
 * 4. Optional upload to Shopify CDN
 *
 * @param imageBuffer - Input raster image buffer (PNG, JPG, etc.)
 * @param options - Generation options
 * @returns Vector result with SVG data URI and optional CDN URL
 */
export async function generateVectorFromImage(
  imageBuffer: Buffer,
  options: GenerateVectorOptions = {}
): Promise<VectorResult> {
  const {
    autoDetectBoundary = true,
    conversionParams = {},
    uploadToShopify = false,
    fileName = 'ai-vector',
    shopifyClient,
  } = options

  // Merge default params with provided params
  const params: VectorConversionParameters = {
    ...DEFAULT_VECTOR_PARAMS,
    ...conversionParams,
  }

  try {
    let shapeSelection: ShapeSelection

    if (autoDetectBoundary) {
      // Auto-detect content boundary
      const { bounds } = await detectContentBoundary(imageBuffer)
      shapeSelection = bounds
    } else {
      // Use full image as shape selection
      const sharp = (await import('sharp')).default
      const metadata = await sharp(imageBuffer).metadata()
      shapeSelection = {
        type: 'rectangle' as const,
        x: 0,
        y: 0,
        width: metadata.width || 100,
        height: metadata.height || 100,
      }
    }

    // Convert raster to vector
    const results = await convertRasterToVector(
      imageBuffer,
      [shapeSelection],
      params,
      uploadToShopify,
      fileName,
      shopifyClient
    )

    if (results.length === 0) {
      return {
        shapeId: 'error',
        bounds: shapeSelection,
        error: 'No vector result generated',
      }
    }

    return results[0]
  } catch (error) {
    console.error('Error generating vector from image:', error)
    return {
      shapeId: 'error',
      bounds: {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Generate vector SVG from image URL
 *
 * Downloads the image and processes it through the vector generation pipeline.
 *
 * @param imageUrl - URL of the raster image
 * @param options - Generation options
 * @returns Vector result with SVG data URI and optional CDN URL
 */
export async function generateVectorFromUrl(
  imageUrl: string,
  options: GenerateVectorOptions = {}
): Promise<VectorResult> {
  try {
    // Download image from URL
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const imageBuffer = Buffer.from(arrayBuffer)

    return generateVectorFromImage(imageBuffer, options)
  } catch (error) {
    console.error('Error generating vector from URL:', error)
    return {
      shapeId: 'error',
      bounds: {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
