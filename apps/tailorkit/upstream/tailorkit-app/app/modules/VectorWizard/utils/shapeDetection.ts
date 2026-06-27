import type { DetectedShape, ShapeSelection, ShapeDetectionStats } from '../types'

// Import from shared color utilities
import type { RGB } from '~/types/color'
import { colorDistance, colorsAreSimilar } from '~/utils/color/distance'
import { getPixelColor, isPixelOpaque, DEFAULT_OPAQUE_ALPHA_THRESHOLD } from '~/utils/color/pixel'

// Import from shared geometry utilities
import { isPointInRect as sharedIsPointInRect } from '~/utils/geometry/point-in-shape'

/**
 * Shape detection utilities - Multi-strategy algorithm for detecting content boundary
 *
 * Uses a multi-strategy approach:
 * 1. Alpha-based detection: Scan for opaque pixels (works for images with transparency)
 * 2. Background color detection: Detect and exclude solid background colors
 * 3. Edge-based content detection: Find content by analyzing color contrast from edges
 *
 * @see ~/utils/color/distance.ts for color comparison
 * @see ~/utils/color/pixel.ts for pixel operations
 * @see ~/utils/geometry/point-in-shape.ts for point containment
 */

// Detection parameters
const BOUNDARY_PADDING = 2 // Padding to add around the detected boundary
const BG_COLOR_TOLERANCE = 30 // Color tolerance for background detection
const EDGE_SAMPLE_SIZE = 20 // Number of pixels to sample from each edge for background color

/**
 * Detect the dominant background color by sampling edge pixels
 */
function detectBackgroundColor(imageData: ImageData): RGB | null {
  const { data, width, height } = imageData
  const edgeColors: RGB[] = []

  // Sample pixels from all 4 edges
  const sampleStep = Math.max(1, Math.floor(width / EDGE_SAMPLE_SIZE))

  // Top edge
  for (let x = 0; x < width; x += sampleStep) {
    const idx = x * 4
    edgeColors.push(getPixelColor(data, idx))
  }

  // Bottom edge
  for (let x = 0; x < width; x += sampleStep) {
    const idx = ((height - 1) * width + x) * 4
    edgeColors.push(getPixelColor(data, idx))
  }

  // Left edge
  for (let y = 0; y < height; y += sampleStep) {
    const idx = y * width * 4
    edgeColors.push(getPixelColor(data, idx))
  }

  // Right edge
  for (let y = 0; y < height; y += sampleStep) {
    const idx = (y * width + (width - 1)) * 4
    edgeColors.push(getPixelColor(data, idx))
  }

  if (edgeColors.length === 0) return null

  // Find the most common color (cluster similar colors)
  const colorClusters: { color: RGB; count: number }[] = []

  for (const color of edgeColors) {
    let found = false
    for (const cluster of colorClusters) {
      if (colorsAreSimilar(color, cluster.color, BG_COLOR_TOLERANCE)) {
        cluster.count++
        // Update cluster center (moving average)
        cluster.color.r = Math.round((cluster.color.r * (cluster.count - 1) + color.r) / cluster.count)
        cluster.color.g = Math.round((cluster.color.g * (cluster.count - 1) + color.g) / cluster.count)
        cluster.color.b = Math.round((cluster.color.b * (cluster.count - 1) + color.b) / cluster.count)
        found = true
        break
      }
    }
    if (!found) {
      colorClusters.push({ color: { ...color }, count: 1 })
    }
  }

  // Return the most common color if it appears in at least 60% of edge samples
  colorClusters.sort((a, b) => b.count - a.count)
  const dominantCluster = colorClusters[0]

  if (dominantCluster && dominantCluster.count >= edgeColors.length * 0.6) {
    return dominantCluster.color
  }

  return null
}

/**
 * Check if a pixel is content (not background)
 */
function isContentPixel(data: Uint8ClampedArray, idx: number, bgColor: RGB | null): boolean {
  // First check alpha
  if (!isPixelOpaque(data, idx, DEFAULT_OPAQUE_ALPHA_THRESHOLD)) {
    return false // Transparent pixel is not content
  }

  // If no background color detected, all opaque pixels are content
  if (!bgColor) {
    return true
  }

  // Check if pixel color differs from background
  const pixelColor = getPixelColor(data, idx)
  return colorDistance(pixelColor, bgColor) > BG_COLOR_TOLERANCE
}

/**
 * Scan from all 4 edges to find the boundary of content
 * Uses both alpha and color-based detection
 */
function scanEdgesForContentBoundary(
  imageData: ImageData,
  bgColor: RGB | null
): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} | null {
  const { data, width, height } = imageData

  let minY = -1
  let maxY = -1
  let minX = -1
  let maxX = -1

  // Scan from top to find first row with content pixels
  topScan: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      if (isContentPixel(data, idx, bgColor)) {
        minY = y
        break topScan
      }
    }
  }

  // If no content pixels found, return null
  if (minY === -1) {
    return null
  }

  // Scan from bottom to find last row with content pixels
  bottomScan: for (let y = height - 1; y >= minY; y--) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      if (isContentPixel(data, idx, bgColor)) {
        maxY = y
        break bottomScan
      }
    }
  }

  // Scan from left to find first column with content pixels
  leftScan: for (let x = 0; x < width; x++) {
    for (let y = minY; y <= maxY; y++) {
      const idx = (y * width + x) * 4
      if (isContentPixel(data, idx, bgColor)) {
        minX = x
        break leftScan
      }
    }
  }

  // Scan from right to find last column with content pixels
  rightScan: for (let x = width - 1; x >= minX; x--) {
    for (let y = minY; y <= maxY; y++) {
      const idx = (y * width + x) * 4
      if (isContentPixel(data, idx, bgColor)) {
        maxX = x
        break rightScan
      }
    }
  }

  return { minX, minY, maxX, maxY }
}

/**
 * Scan from all 4 edges to find the boundary of opaque content
 * Simple alpha-based detection (original algorithm)
 */
function scanEdgesForOpaqueBoundary(imageData: ImageData): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} | null {
  const { data, width, height } = imageData

  let minY = -1
  let maxY = -1
  let minX = -1
  let maxX = -1

  // Scan from top to find first row with opaque pixels
  topScan: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      if (isPixelOpaque(data, idx, DEFAULT_OPAQUE_ALPHA_THRESHOLD)) {
        minY = y
        break topScan
      }
    }
  }

  // If no opaque pixels found, return null
  if (minY === -1) {
    return null
  }

  // Scan from bottom to find last row with opaque pixels
  bottomScan: for (let y = height - 1; y >= minY; y--) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      if (isPixelOpaque(data, idx, DEFAULT_OPAQUE_ALPHA_THRESHOLD)) {
        maxY = y
        break bottomScan
      }
    }
  }

  // Scan from left to find first column with opaque pixels
  leftScan: for (let x = 0; x < width; x++) {
    for (let y = minY; y <= maxY; y++) {
      const idx = (y * width + x) * 4
      if (isPixelOpaque(data, idx, DEFAULT_OPAQUE_ALPHA_THRESHOLD)) {
        minX = x
        break leftScan
      }
    }
  }

  // Scan from right to find last column with opaque pixels
  rightScan: for (let x = width - 1; x >= minX; x--) {
    for (let y = minY; y <= maxY; y++) {
      const idx = (y * width + x) * 4
      if (isPixelOpaque(data, idx, DEFAULT_OPAQUE_ALPHA_THRESHOLD)) {
        maxX = x
        break rightScan
      }
    }
  }

  return { minX, minY, maxX, maxY }
}

/**
 * Calculate confidence score for a detected shape
 */
function calculateConfidence(rect: ShapeSelection, imageWidth: number, imageHeight: number): number {
  const area = rect.width * rect.height
  const imageArea = imageWidth * imageHeight
  const aspectRatio = rect.width / rect.height

  // Higher confidence for larger shapes (relative to image)
  const areaScore = Math.min(1, (area / imageArea) * 5)

  // Prefer shapes that aren't too extreme in aspect ratio
  const aspectScore = 1 - Math.abs(1 - aspectRatio) * 0.2

  return Math.min(1, areaScore * 0.7 + aspectScore * 0.3)
}

/**
 * Check if the detected boundary covers most of the image
 */
function isFullImageBoundary(
  boundary: { minX: number; minY: number; maxX: number; maxY: number },
  width: number,
  height: number
): boolean {
  const boundaryWidth = boundary.maxX - boundary.minX + 1
  const boundaryHeight = boundary.maxY - boundary.minY + 1

  // If boundary covers more than 95% of the image, it's likely not detecting content properly
  return boundaryWidth >= width * 0.95 && boundaryHeight >= height * 0.95
}

/**
 * Check if a point is inside a rectangle
 * Wrapper for shared utility to maintain backward compatibility
 */
export function isPointInRect(x: number, y: number, rect: ShapeSelection): boolean {
  return sharedIsPointInRect(x, y, rect)
}

/**
 * Helper function to create empty stats
 */
function createEmptyStats(processingTime: number): ShapeDetectionStats {
  return {
    edgesFound: 0,
    componentsFound: 0,
    shapesBeforeFiltering: 0,
    shapesAfterFiltering: 0,
    processingTime,
  }
}

/**
 * Main shape detection function using multi-strategy algorithm
 *
 * Uses multi-strategy approach:
 * 1. Try alpha-based detection first
 * 2. If alpha detection returns full image, try background color detection
 */
const cachedResults: { [key: string]: { shapes: DetectedShape[]; stats: ShapeDetectionStats } } = {}

export function detectShapes(image: HTMLImageElement): {
  shapes: DetectedShape[]
  stats: ShapeDetectionStats
} {
  const startTime = performance.now()

  try {
    if (image.src && cachedResults[image.src]) {
      return cachedResults[image.src]
    }

    // Create canvas to extract image data
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return { shapes: [], stats: createEmptyStats(performance.now() - startTime) }
    }

    canvas.width = image.width
    canvas.height = image.height
    ctx.drawImage(image, 0, 0)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Strategy 1: Try alpha-based detection
    let boundary = scanEdgesForOpaqueBoundary(imageData)

    // Check if alpha-based detection found meaningful content
    const needsColorBasedDetection = !boundary || isFullImageBoundary(boundary, image.width, image.height)

    // Strategy 2: If alpha detection didn't work well, use color-based detection
    if (needsColorBasedDetection) {
      // Detect background color from edges
      const bgColor = detectBackgroundColor(imageData)

      if (bgColor) {
        // Try content detection excluding the background color
        const colorBoundary = scanEdgesForContentBoundary(imageData, bgColor)

        if (colorBoundary && !isFullImageBoundary(colorBoundary, image.width, image.height)) {
          boundary = colorBoundary
        }
      }
    }

    let finalShapes: DetectedShape[]

    if (!boundary) {
      // No content found - return entire image as fallback
      finalShapes = [
        {
          id: 'shape-fallback-fullimage',
          boundingBox: {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height,
          },
          confidence: 0.5,
        },
      ]
    } else {
      // Apply padding and ensure bounds stay within image
      const bounds: ShapeSelection = {
        type: 'rectangle',
        x: Math.max(0, boundary.minX - BOUNDARY_PADDING),
        y: Math.max(0, boundary.minY - BOUNDARY_PADDING),
        width:
          Math.min(image.width, boundary.maxX + BOUNDARY_PADDING + 1) - Math.max(0, boundary.minX - BOUNDARY_PADDING),
        height:
          Math.min(image.height, boundary.maxY + BOUNDARY_PADDING + 1) - Math.max(0, boundary.minY - BOUNDARY_PADDING),
      }

      finalShapes = [
        {
          id: `shape-${bounds.x}-${bounds.y}-${bounds.width}-${bounds.height}`,
          boundingBox: bounds,
          confidence: calculateConfidence(bounds, image.width, image.height),
        },
      ]
    }

    const processingTime = performance.now() - startTime

    const stats: ShapeDetectionStats = {
      edgesFound: 0,
      componentsFound: 1,
      shapesBeforeFiltering: 1,
      shapesAfterFiltering: finalShapes.length,
      processingTime,
    }

    if (image.src) {
      cachedResults[image.src] = { shapes: finalShapes, stats }
    }

    return { shapes: finalShapes, stats }
  } catch (error) {
    console.error('❌ Shape detection error - creating fallback rectangular shape for entire image:', error)
    const processingTime = performance.now() - startTime

    // Fallback: Create a rectangular shape covering the entire image on error
    const fallbackShape: DetectedShape = {
      id: 'shape-fallback-error',
      boundingBox: {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      },
      confidence: 0.5,
    }

    const stats: ShapeDetectionStats = {
      edgesFound: 0,
      componentsFound: 0,
      shapesBeforeFiltering: 0,
      shapesAfterFiltering: 1,
      processingTime,
    }

    return { shapes: [fallbackShape], stats }
  }
}

/**
 * Clear the shape detection cache for a specific image or all images
 */
export function clearShapeDetectionCache(imageUrl?: string): void {
  if (imageUrl) {
    delete cachedResults[imageUrl]
  } else {
    // Clear all cached results
    Object.keys(cachedResults).forEach(key => delete cachedResults[key])
  }
}
