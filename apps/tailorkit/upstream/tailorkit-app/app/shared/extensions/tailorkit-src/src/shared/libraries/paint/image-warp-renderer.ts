/**
 * Image Warp Renderer
 *
 * Warps images along curved paths using column-by-column rendering.
 * Each column of the source image is drawn at its position along the path,
 * rotated to follow the path's tangent direction.
 *
 * @module shared/libraries/paint
 */

import { samplePath, calculatePathBounds } from '../svg/path-sampler'
import type { PatternSize } from './paint-types'

/**
 * Configuration for image warping
 */
export interface WarpConfig {
  /** SVG path data string */
  pathData: string
  /** Source image to warp */
  image: HTMLImageElement | HTMLCanvasElement
  /** Original image width */
  imageWidth: number
  /** Original image height */
  imageHeight: number
  /** Target width along the path */
  targetWidth: number
  /** Target height perpendicular to the path */
  targetHeight: number
  /** Pattern size mode */
  patternSize: PatternSize
  /** Opacity (0-1) */
  opacity?: number
}

/**
 * Result of image warping
 */
export interface WarpResult {
  /** Canvas containing the warped image */
  canvas: HTMLCanvasElement
  /** Bounding box of the warped image */
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  /** Original path bounds for positioning */
  pathBounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
}

/**
 * Calculate scaled image dimensions based on pattern size mode
 */
function calculateScaledDimensions(
  imageWidth: number,
  imageHeight: number,
  targetWidth: number,
  targetHeight: number,
  patternSize: PatternSize
): { width: number; height: number } {
  if (patternSize === 'stretch') {
    // Stretch to fill entire target
    return { width: targetWidth, height: targetHeight }
  }

  if (patternSize === 'stretch-x') {
    // Stretch width, scale height proportionally
    const scale = targetWidth / imageWidth
    return { width: targetWidth, height: imageHeight * scale }
  }

  if (patternSize === 'stretch-y') {
    // Stretch height, scale width proportionally
    const scale = targetHeight / imageHeight
    return { width: imageWidth * scale, height: targetHeight }
  }

  // Percentage mode (10-100): scale image proportionally
  const scale = (patternSize as number) / 100
  return { width: imageWidth * scale, height: imageHeight * scale }
}

/**
 * Warp an image to follow a curved path
 *
 * Uses column-by-column rendering with tangent rotation:
 * 1. Sample points along the path
 * 2. For each column of the image, draw it at the corresponding path point
 * 3. Rotate each column to follow the path's tangent direction
 *
 * @param config - Warp configuration
 * @returns Warped image canvas and bounds
 */
export function warpImageAlongPath(config: WarpConfig): WarpResult {
  const {
    pathData,
    image,
    imageWidth,
    imageHeight,
    targetWidth,
    targetHeight,
    patternSize,
    opacity = 1,
  } = config

  // Calculate scaled dimensions based on pattern size mode
  const scaled = calculateScaledDimensions(imageWidth, imageHeight, targetWidth, targetHeight, patternSize)

  // Number of samples = number of columns to draw
  // Use at least targetWidth samples for quality, but cap for performance
  const numSamples = Math.min(Math.max(targetWidth, 100), 1000)

  // Sample points along the path
  const pathPoints = samplePath(pathData, numSamples)

  if (pathPoints.length < 2) {
    // Fallback: return original image if path is invalid
    const canvas = document.createElement('canvas')
    canvas.width = imageWidth
    canvas.height = imageHeight
    const ctx = canvas.getContext('2d')!
    ctx.globalAlpha = opacity
    ctx.drawImage(image, 0, 0)
    return {
      canvas,
      bounds: { x: 0, y: 0, width: imageWidth, height: imageHeight },
      pathBounds: { minX: 0, minY: 0, maxX: imageWidth, maxY: imageHeight },
    }
  }

  // Calculate the bounding box of the warped image
  const pathBounds = calculatePathBounds(pathPoints, scaled.height)

  // Add padding for antialiasing and rotation
  const padding = Math.max(scaled.height, 20)
  const canvasWidth = Math.ceil(pathBounds.width + padding * 2)
  const canvasHeight = Math.ceil(pathBounds.height + padding * 2)

  // Create output canvas
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')!

  // Enable high-quality rendering
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Apply global opacity
  ctx.globalAlpha = opacity

  // Calculate offset to center the warped image in the canvas
  const offsetX = padding - pathBounds.minX
  const offsetY = padding - pathBounds.minY

  // Width of each source column to draw
  const columnWidth = Math.max(1.5, scaled.width / numSamples) // Slight overlap to avoid gaps

  // Draw column by column
  for (let i = 0; i < pathPoints.length; i++) {
    const point = pathPoints[i]

    // Source X position in the image
    const srcX = (i / (pathPoints.length - 1)) * imageWidth

    ctx.save()

    // Translate to the point on the path
    ctx.translate(point.x + offsetX, point.y + offsetY)

    // Rotate to follow the tangent direction
    ctx.rotate(point.angle)

    // Draw a vertical slice of the image centered on the path
    // Source: 1 column from the image
    // Destination: rotated slice centered on the path point
    ctx.drawImage(
      image,
      srcX,
      0,
      Math.max(1, imageWidth / numSamples) * 1.5, // Source column (with overlap)
      imageHeight, // Full source height
      0,
      -scaled.height / 2, // Center vertically on path
      columnWidth,
      scaled.height
    )

    ctx.restore()
  }

  const result = {
    canvas,
    bounds: {
      x: -padding + pathBounds.minX,
      y: -padding + pathBounds.minY,
      width: canvasWidth,
      height: canvasHeight,
    },
    pathBounds: {
      minX: pathBounds.minX,
      minY: pathBounds.minY,
      maxX: pathBounds.maxX,
      maxY: pathBounds.maxY,
    },
  }

  return result
}

/**
 * Warp an image along a path for use as an SVG pattern
 *
 * Returns the warped canvas and positioning information needed
 * to create an SVG pattern that aligns with the text path.
 *
 * @param config - Warp configuration
 * @returns Warped canvas as data URL and bounds
 */
export function warpImageForPattern(config: WarpConfig): {
  dataUrl: string
  bounds: WarpResult['bounds']
  pathBounds: WarpResult['pathBounds']
} {
  const result = warpImageAlongPath(config)

  return {
    dataUrl: result.canvas.toDataURL('image/png'),
    bounds: result.bounds,
    pathBounds: result.pathBounds,
  }
}

/**
 * Check if warping is needed for a given path
 *
 * Returns false for straight horizontal paths where warping would have no effect.
 */
export function shouldWarpImage(pathData: string): boolean {
  // Sample a few points to check if the path has curvature
  const points = samplePath(pathData, 10)

  if (points.length < 3) {
    return false
  }

  // Check if all angles are approximately the same (straight line)
  const firstAngle = points[0].angle
  const angleThreshold = 0.01 // ~0.5 degrees

  for (const point of points) {
    if (Math.abs(point.angle - firstAngle) > angleThreshold) {
      return true // Path has curvature
    }
  }

  return false // Path is essentially straight
}

/**
 * Preview quality warp for real-time editing
 *
 * Uses fewer samples for faster rendering during curve editing.
 */
export function warpImagePreview(config: WarpConfig): WarpResult {
  // Use fewer samples for preview
  const previewConfig: WarpConfig = {
    ...config,
    targetWidth: Math.min(config.targetWidth, 100), // Cap at 100 samples
  }

  return warpImageAlongPath(previewConfig)
}
