import sharp from 'sharp'
import type { ShapeSelection, DetectedShape } from './types'

/**
 * Server-side shape detection utilities using Sharp
 *
 * Uses a multi-strategy approach:
 * 1. Alpha-based detection: Scan for opaque pixels (works for images with transparency)
 * 2. Background color detection: Detect and exclude solid background colors (works for non-transparent images)
 * 3. Edge-based content detection: Find content by analyzing color contrast from edges
 */

// Detection parameters
const OPAQUE_ALPHA_THRESHOLD = 10 // Alpha value above which a pixel is considered opaque
const BOUNDARY_PADDING = 2 // Padding to add around the detected boundary
const BG_COLOR_TOLERANCE = 30 // Color tolerance for background detection
const EDGE_SAMPLE_SIZE = 20 // Number of pixels to sample from each edge for background color

interface ImageDataLike {
  data: Buffer
  width: number
  height: number
  channels: number
}

interface RGB {
  r: number
  g: number
  b: number
}

/**
 * Calculate Euclidean color distance between two RGB colors
 */
function colorDistance(c1: RGB, c2: RGB): number {
  return Math.sqrt(Math.pow(c1.r - c2.r, 2) + Math.pow(c1.g - c2.g, 2) + Math.pow(c1.b - c2.b, 2))
}

/**
 * Check if a pixel is opaque (has alpha above threshold)
 */
function isPixelOpaque(data: Buffer, idx: number, channels: number): boolean {
  if (channels === 4) {
    return data[idx + 3] > OPAQUE_ALPHA_THRESHOLD
  }
  // For RGB images without alpha, consider all pixels opaque
  return true
}

/**
 * Get RGB color at a pixel index
 */
function getPixelColor(data: Buffer, idx: number): RGB {
  return {
    r: data[idx],
    g: data[idx + 1],
    b: data[idx + 2],
  }
}

/**
 * Detect the dominant background color by sampling edge pixels
 */
function detectBackgroundColor(imageData: ImageDataLike): RGB | null {
  const { data, width, height, channels } = imageData
  const edgeColors: RGB[] = []

  // Sample pixels from all 4 edges
  const sampleStep = Math.max(1, Math.floor(width / EDGE_SAMPLE_SIZE))

  // Top edge
  for (let x = 0; x < width; x += sampleStep) {
    const idx = x * channels
    edgeColors.push(getPixelColor(data, idx))
  }

  // Bottom edge
  for (let x = 0; x < width; x += sampleStep) {
    const idx = ((height - 1) * width + x) * channels
    edgeColors.push(getPixelColor(data, idx))
  }

  // Left edge
  for (let y = 0; y < height; y += sampleStep) {
    const idx = y * width * channels
    edgeColors.push(getPixelColor(data, idx))
  }

  // Right edge
  for (let y = 0; y < height; y += sampleStep) {
    const idx = (y * width + (width - 1)) * channels
    edgeColors.push(getPixelColor(data, idx))
  }

  if (edgeColors.length === 0) return null

  // Find the most common color (cluster similar colors)
  const colorClusters: { color: RGB; count: number }[] = []

  for (const color of edgeColors) {
    let found = false
    for (const cluster of colorClusters) {
      if (colorDistance(color, cluster.color) < BG_COLOR_TOLERANCE) {
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
function isContentPixel(data: Buffer, idx: number, channels: number, bgColor: RGB | null): boolean {
  // First check alpha
  if (channels === 4 && data[idx + 3] <= OPAQUE_ALPHA_THRESHOLD) {
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
  imageData: ImageDataLike,
  bgColor: RGB | null
): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} | null {
  const { data, width, height, channels } = imageData

  let minY = -1
  let maxY = -1
  let minX = -1
  let maxX = -1

  // Scan from top to find first row with content pixels
  topScan: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels
      if (isContentPixel(data, idx, channels, bgColor)) {
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
      const idx = (y * width + x) * channels
      if (isContentPixel(data, idx, channels, bgColor)) {
        maxY = y
        break bottomScan
      }
    }
  }

  // Scan from left to find first column with content pixels
  leftScan: for (let x = 0; x < width; x++) {
    for (let y = minY; y <= maxY; y++) {
      const idx = (y * width + x) * channels
      if (isContentPixel(data, idx, channels, bgColor)) {
        minX = x
        break leftScan
      }
    }
  }

  // Scan from right to find last column with content pixels
  rightScan: for (let x = width - 1; x >= minX; x--) {
    for (let y = minY; y <= maxY; y++) {
      const idx = (y * width + x) * channels
      if (isContentPixel(data, idx, channels, bgColor)) {
        maxX = x
        break rightScan
      }
    }
  }

  return { minX, minY, maxX, maxY }
}

/**
 * Simple alpha-based boundary detection (original algorithm)
 */
function scanEdgesForOpaqueBoundary(imageData: ImageDataLike): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} | null {
  const { data, width, height, channels } = imageData

  let minY = -1
  let maxY = -1
  let minX = -1
  let maxX = -1

  // Scan from top to find first row with opaque pixels
  topScan: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels
      if (isPixelOpaque(data, idx, channels)) {
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
      const idx = (y * width + x) * channels
      if (isPixelOpaque(data, idx, channels)) {
        maxY = y
        break bottomScan
      }
    }
  }

  // Scan from left to find first column with opaque pixels
  leftScan: for (let x = 0; x < width; x++) {
    for (let y = minY; y <= maxY; y++) {
      const idx = (y * width + x) * channels
      if (isPixelOpaque(data, idx, channels)) {
        minX = x
        break leftScan
      }
    }
  }

  // Scan from right to find last column with opaque pixels
  rightScan: for (let x = width - 1; x >= minX; x--) {
    for (let y = minY; y <= maxY; y++) {
      const idx = (y * width + x) * channels
      if (isPixelOpaque(data, idx, channels)) {
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
 * Check if the detected boundary covers most of the image (indicating no real content detection)
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
 * Main function: Detect content boundary from image buffer
 * Returns a single unified bounding box for all content
 *
 * Uses multi-strategy approach:
 * 1. Try alpha-based detection first
 * 2. If alpha detection returns full image, try background color detection
 */
export async function detectContentBoundary(imageBuffer: Buffer): Promise<{
  bounds: ShapeSelection
  confidence: number
}> {
  // Get image metadata and raw pixel data
  const image = sharp(imageBuffer)
  const metadata = await image.metadata()
  const { width = 0, height = 0 } = metadata

  if (width === 0 || height === 0) {
    throw new Error('Invalid image dimensions')
  }

  // Ensure RGBA for consistent alpha channel handling
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  const imageData: ImageDataLike = {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
  }

  // Strategy 1: Try alpha-based detection
  let boundary = scanEdgesForOpaqueBoundary(imageData)

  // Check if alpha-based detection found meaningful content
  const needsColorBasedDetection = !boundary || isFullImageBoundary(boundary, info.width, info.height)

  // Strategy 2: If alpha detection didn't work well, use color-based detection
  if (needsColorBasedDetection) {
    // Detect background color from edges
    const bgColor = detectBackgroundColor(imageData)

    if (bgColor) {
      // Try content detection excluding the background color
      const colorBoundary = scanEdgesForContentBoundary(imageData, bgColor)

      if (colorBoundary && !isFullImageBoundary(colorBoundary, info.width, info.height)) {
        boundary = colorBoundary
      }
    }
  }

  if (!boundary) {
    // No content found - return entire image as bounds
    return {
      bounds: {
        type: 'rectangle',
        x: 0,
        y: 0,
        width: info.width,
        height: info.height,
      },
      confidence: 0.5,
    }
  }

  // Apply padding and ensure bounds stay within image
  const bounds: ShapeSelection = {
    type: 'rectangle',
    x: Math.max(0, boundary.minX - BOUNDARY_PADDING),
    y: Math.max(0, boundary.minY - BOUNDARY_PADDING),
    width: Math.min(info.width, boundary.maxX + BOUNDARY_PADDING + 1) - Math.max(0, boundary.minX - BOUNDARY_PADDING),
    height: Math.min(info.height, boundary.maxY + BOUNDARY_PADDING + 1) - Math.max(0, boundary.minY - BOUNDARY_PADDING),
  }

  const confidence = calculateConfidence(bounds, info.width, info.height)

  return {
    bounds,
    confidence,
  }
}

/**
 * Detect shapes from image buffer
 * Returns a single unified shape that encompasses all content
 */
export async function detectShapesFromBuffer(imageBuffer: Buffer): Promise<DetectedShape[]> {
  const { bounds, confidence } = await detectContentBoundary(imageBuffer)

  return [
    {
      id: `shape-${bounds.x}-${bounds.y}-${bounds.width}-${bounds.height}`,
      boundingBox: bounds,
      confidence,
    },
  ]
}
