/* eslint-disable max-lines */
import type { ShapeSelection, ProcessingParameters, TransparentArea, VectorShape } from './types'
import type { PathCommand } from '~/modules/VectorEditor/utils/svg'
import type { ShopifyApiClient } from '~/shopify/graphql/api.server'
import sharp from 'sharp'
import { uuid } from '~/utils/uuid'
import { applyAntiAliasing } from '~/utils/image-processing/core/anti-aliasing.server'
import { IMAGE_DIMENSIONS, IMAGE_QUALITY } from './constants'
import {
  scalePathCommands,
  serializePathCommandsToD,
  pathCommandsToPolygon,
  isPointInPolygon,
} from './utils/vectorPathUtils'
import { findLargestInscribedRectangle } from '~/utils/geometry/inscribed-rectangle'

export interface ProcessingResult {
  processedImageBuffer: Buffer
  transparentCount: number
  transparentAreas?: TransparentArea[]
  scale?: number // Downscaling factor (1 = no scaling)
  originalWidth?: number // Original image width before downscaling
  originalHeight?: number // Original image height before downscaling
  processedWidth?: number // Actual result width (after downscaling)
  processedHeight?: number // Actual result height (after downscaling)
}

/**
 * Downscale image if dimensions exceed maximum to improve processing performance
 *
 * @param imageBuffer - Original image buffer
 * @param maxDimension - Maximum width or height (default: SERVER_DOWNSCALE_THRESHOLD)
 * @returns Downscaled buffer and scale factor
 */
async function downscaleIfNeeded(
  imageBuffer: Buffer,
  maxDimension: number = IMAGE_DIMENSIONS.SERVER_DOWNSCALE_THRESHOLD
): Promise<{ buffer: Buffer; scale: number; width: number; height: number }> {
  const image = sharp(imageBuffer)
  const metadata = await image.metadata()

  if (!metadata.width || !metadata.height) {
    throw new Error('Invalid image metadata')
  }

  const maxDim = Math.max(metadata.width, metadata.height)

  // If image is within limits, return original
  if (maxDim <= maxDimension) {
    return {
      buffer: imageBuffer,
      scale: 1,
      width: metadata.width,
      height: metadata.height,
    }
  }

  // Calculate scale factor
  const scale = maxDimension / maxDim

  console.log(
    `[MockupWizard Server] Downscaling image from ${metadata.width}x${metadata.height} to fit ${maxDimension}px (scale: ${scale.toFixed(3)})`
  )

  // Resize image using high-quality lanczos3 kernel
  const resized = await image
    .resize(Math.round(metadata.width * scale), Math.round(metadata.height * scale), {
      kernel: 'lanczos3',
      fit: 'inside',
    })
    .png()
    .toBuffer()

  return {
    buffer: resized,
    scale,
    width: Math.round(metadata.width * scale),
    height: Math.round(metadata.height * scale),
  }
}

/**
 * Scale coordinates and shapes by a factor
 */
function scaleProcessingInputs(
  shapeSelections: ShapeSelection[],
  scale: number
): {
  scaledShapeSelections: ShapeSelection[]
} {
  if (scale === 1) {
    return { scaledShapeSelections: shapeSelections }
  }

  const scaledShapeSelections = shapeSelections.map(shape => {
    if (shape.type === 'vector') {
      const vectorShape = shape as VectorShape
      const scaledCommands = scalePathCommands(vectorShape.pathCommands, scale)
      return {
        ...shape,
        x: Math.round(shape.x * scale),
        y: Math.round(shape.y * scale),
        width: Math.round(shape.width * scale),
        height: Math.round(shape.height * scale),
        pathCommands: scaledCommands,
        pathD: serializePathCommandsToD(scaledCommands),
      }
    }
    return {
      ...shape,
      x: Math.round(shape.x * scale),
      y: Math.round(shape.y * scale),
      width: Math.round(shape.width * scale),
      height: Math.round(shape.height * scale),
    }
  })

  return { scaledShapeSelections }
}

/**
 * Enhanced main processing function adapted from preflight mockup-wizard
 * Creates transparent areas in an image based on seed points and shape selections
 *
 * @param maxDimension - Maximum dimension for downscaling (default: SERVER_DOWNSCALE_THRESHOLD)
 */
export async function makeInnerTransparent(
  inputBuffer: Buffer,
  shapeSelections: ShapeSelection[],
  parameters: ProcessingParameters,
  featherRadius: number = 2,
  maxDimension: number = IMAGE_DIMENSIONS.SERVER_DOWNSCALE_THRESHOLD
): Promise<ProcessingResult> {
  try {
    // Downscale if needed to improve performance
    const downscaled = await downscaleIfNeeded(inputBuffer, maxDimension)
    const processBuffer = downscaled.buffer
    const scale = downscaled.scale
    const originalWidth = Math.round(downscaled.width / scale)
    const originalHeight = Math.round(downscaled.height / scale)

    // Scale shapes if image was downscaled
    const { scaledShapeSelections } = scaleProcessingInputs(shapeSelections, scale)

    // Load image for processing
    const originalImage = sharp(processBuffer)

    const { data: originalData, info: originalInfo } = await originalImage
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    let originalPixels = new Uint8Array(originalData)
    const channels = originalInfo.channels
    const width = originalInfo.width
    const height = originalInfo.height

    // Store all areas to make transparent
    const allTransparentAreas = new Set<string>()

    // Per-area tracking for shadow/highlight preservation
    // Each area gets its own pixel set for independent brightness calculation
    const areaPixelSets: Set<string>[] = []
    // Maps pixel key to area index
    const pixelToAreaMap = new Map<string, number>()

    // Process shape selections
    if (scaledShapeSelections && scaledShapeSelections.length > 0) {
      const vectorShapes: VectorShape[] = []

      for (let i = 0; i < scaledShapeSelections.length; i++) {
        const shape = scaledShapeSelections[i]

        if (shape.type === 'vector') {
          vectorShapes.push(shape as VectorShape)
        } else {
          const shapeArea = processShapeSelection(originalPixels, width, height, channels, shape, parameters)

          // Store this shape's area as a separate set for per-area brightness calculation
          const areaIndex = areaPixelSets.length
          areaPixelSets.push(shapeArea)

          // Add to combined set and map pixels to area
          shapeArea.forEach(key => {
            allTransparentAreas.add(key)
            pixelToAreaMap.set(key, areaIndex)
          })
        }
      }

      // Process all vector shapes together with even-odd fill rule
      if (vectorShapes.length > 0) {
        const vectorArea = processVectorShapesWithEvenOddServer(
          originalPixels,
          width,
          height,
          channels,
          vectorShapes,
          parameters
        )

        const areaIndex = areaPixelSets.length
        areaPixelSets.push(vectorArea)

        vectorArea.forEach(key => {
          allTransparentAreas.add(key)
          pixelToAreaMap.set(key, areaIndex)
        })
      }
    }

    // Apply transparency with anti-aliasing - with optional shadow/highlight preservation
    let count = 0

    // Create background mask for anti-aliasing
    const backgroundMask = new Uint8Array(width * height)
    allTransparentAreas.forEach(key => {
      const [x, y] = key.split(',').map(Number)
      const pixelIndex = y * width + x
      backgroundMask[pixelIndex] = 1
    })

    if (parameters.keepShadowHighlight) {
      // Calculate per-area average brightness to establish area-specific baselines
      // This ensures each transparent area preserves its own shadows/highlights correctly
      const areaAvgBrightness: number[] = areaPixelSets.map(areaSet => {
        let totalBrightness = 0
        let pixelCount = 0

        areaSet.forEach(key => {
          const [x, y] = key.split(',').map(Number)
          const idx = (y * width + x) * channels
          const r = originalPixels[idx]
          const g = originalPixels[idx + 1]
          const b = originalPixels[idx + 2]
          totalBrightness += (r + g + b) / 3
          pixelCount++
        })

        return pixelCount > 0 ? totalBrightness / pixelCount : 128 // Default to mid-gray if empty
      })

      // Apply shadow/highlight preservation using per-area baselines
      allTransparentAreas.forEach(key => {
        const areaIndex = pixelToAreaMap.get(key)
        if (areaIndex === undefined) return // Safety check

        const avgBrightness = areaAvgBrightness[areaIndex]
        const [x, y] = key.split(',').map(Number)
        const idx = (y * width + x) * channels

        const r = originalPixels[idx]
        const g = originalPixels[idx + 1]
        const b = originalPixels[idx + 2]
        const currentBrightness = (r + g + b) / 3

        // Calculate how much darker or brighter this pixel is compared to THIS AREA's average
        const brightnessDelta = currentBrightness - avgBrightness

        // Preserve shadows and highlights by adjusting transparency based on brightness
        let alpha

        if (brightnessDelta < parameters.shadowDetectionThreshold) {
          // Shadow area (darker than average)
          // Map darkness to partial opacity: darker = more visible
          // Protect against division by zero for very dark areas
          const shadowIntensity = avgBrightness > 0 ? Math.min(Math.abs(brightnessDelta) / avgBrightness, 1) : 0
          alpha = Math.floor(shadowIntensity * parameters.shadowOpacity)

          // Keep the shadow color (dark gray/black tint)
          const shadowFactor = parameters.shadowColorDarkeningFactor
          originalPixels[idx] = Math.floor(r * shadowFactor)
          originalPixels[idx + 1] = Math.floor(g * shadowFactor)
          originalPixels[idx + 2] = Math.floor(b * shadowFactor)
        } else if (brightnessDelta > parameters.highlightDetectionThreshold) {
          // Highlight area (brighter than average)
          // Map brightness to partial opacity: brighter = more visible
          // Protect against division by zero for very bright areas
          const denominator = 255 - avgBrightness
          const highlightIntensity = denominator > 0 ? Math.min(brightnessDelta / denominator, 1) : 0
          alpha = Math.floor(highlightIntensity * parameters.highlightOpacity)

          // Keep the highlight color (bright/white tint)
          const highlightFactor
            = parameters.highlightColorBaseFactor + highlightIntensity * (1 - parameters.highlightColorBaseFactor)
          originalPixels[idx] = Math.floor(255 * highlightFactor)
          originalPixels[idx + 1] = Math.floor(255 * highlightFactor)
          originalPixels[idx + 2] = Math.floor(255 * highlightFactor)
        } else {
          // Neutral area (close to average brightness)
          // Make mostly transparent
          alpha = 0
        }

        originalPixels[idx + 3] = alpha
        count++
      })
    } else {
      // Full transparency mode with universal anti-aliasing
      // @ts-ignore
      originalPixels = applyAntiAliasing(originalPixels, backgroundMask, width, height, {
        smoothnessLevel: 'moderate', // Use moderate smoothness for mockup processing
        featherRadius,
        blendingCurve: 'cosine',
        edgePreservation: 0.7, // Fixed value for mockup processing
      }) as Uint8Array

      // Count transparent pixels for statistics
      backgroundMask.forEach(mask => {
        if (mask === 1) count++
      })
    }

    // Convert back to image buffer with optimized PNG compression
    // No upscaling - keep result at processed dimensions
    // The composite canvas will scale the original image to match instead
    const processedImageBuffer = await sharp(originalPixels, {
      raw: {
        width,
        height,
        channels,
      },
    })
      .png({
        compressionLevel: IMAGE_QUALITY.PNG_COMPRESSION_LEVEL,
        adaptiveFiltering: IMAGE_QUALITY.PNG_ADAPTIVE_FILTERING,
        palette: IMAGE_QUALITY.PNG_PALETTE,
      })
      .toBuffer()

    return {
      processedImageBuffer,
      transparentCount: count,
      scale,
      originalWidth,
      originalHeight,
      // Include processed dimensions for composite canvas scaling
      processedWidth: width,
      processedHeight: height,
    }
  } catch (error) {
    console.error('Error in makeInnerTransparent:', error)
    throw error
  }
}

/**
 * Enhanced main processing function that supports both rectangles and ellipses
 * Creates transparent areas in an image based on shape selections
 */
export async function makeInnerTransparentWithShapes(
  inputBuffer: Buffer,
  shapeSelections: ShapeSelection[],
  parameters: ProcessingParameters,
  featherRadius: number = 2,
  maxDimension: number = IMAGE_DIMENSIONS.SERVER_DOWNSCALE_THRESHOLD
): Promise<ProcessingResult> {
  try {
    // Downscale if needed to improve performance
    const downscaled = await downscaleIfNeeded(inputBuffer, maxDimension)
    const processBuffer = downscaled.buffer
    const scale = downscaled.scale
    const originalWidth = Math.round(downscaled.width / scale)
    const originalHeight = Math.round(downscaled.height / scale)

    // Scale shapes if image was downscaled
    const { scaledShapeSelections } = scaleProcessingInputs(shapeSelections, scale)

    // Load original image
    const originalImage = sharp(processBuffer)

    const { data: originalData, info: originalInfo } = await originalImage
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const originalPixels = new Uint8Array(originalData)
    const channels = originalInfo.channels
    const width = originalInfo.width
    const height = originalInfo.height

    // Store all areas to make transparent
    const allTransparentAreas = new Set<string>()

    // Process shape selections
    if (scaledShapeSelections && scaledShapeSelections.length > 0) {
      const vectorShapes: VectorShape[] = []

      for (let i = 0; i < scaledShapeSelections.length; i++) {
        const shape = scaledShapeSelections[i]
        if (shape.type === 'vector') {
          vectorShapes.push(shape as VectorShape)
        } else {
          const shapeArea = processShapeSelection(originalPixels, width, height, channels, shape, parameters)
          shapeArea.forEach(key => allTransparentAreas.add(key))
        }
      }

      // Process all vector shapes together with even-odd fill rule
      if (vectorShapes.length > 0) {
        const vectorArea = processVectorShapesWithEvenOddServer(
          originalPixels,
          width,
          height,
          channels,
          vectorShapes,
          parameters
        )
        vectorArea.forEach(key => allTransparentAreas.add(key))
      }
    }

    // Apply transparency to all collected areas
    const modifiedPixels = new Uint8Array(originalPixels)
    allTransparentAreas.forEach(key => {
      const [x, y] = key.split(',').map(Number)
      const pixelIndex = (y * width + x) * channels
      if (pixelIndex + 3 < modifiedPixels.length) {
        modifiedPixels[pixelIndex + 3] = 0 // Set alpha to 0 (fully transparent)
      }
    })

    // Create output image with optimized PNG compression
    // No upscaling - keep result at processed dimensions
    // The composite canvas will scale the original image to match instead
    const processedImageBuffer = await sharp(modifiedPixels, { raw: { width, height, channels } })
      .png({
        compressionLevel: IMAGE_QUALITY.PNG_COMPRESSION_LEVEL,
        adaptiveFiltering: IMAGE_QUALITY.PNG_ADAPTIVE_FILTERING,
        palette: IMAGE_QUALITY.PNG_PALETTE,
      })
      .toBuffer()

    // Detect transparent areas for response, passing shapes to inherit rotation
    let transparentAreas: TransparentArea[] = []
    try {
      transparentAreas = await detectTransparentAreas(
        processedImageBuffer,
        parameters.minAreaSize,
        parameters.keepOnlyLargestArea,
        scaledShapeSelections
      )
    } catch (detectionError) {
      console.warn('Failed to detect transparent areas:', detectionError)
    }

    return {
      processedImageBuffer,
      transparentCount: allTransparentAreas.size,
      transparentAreas,
      // Include dimension info for composite canvas scaling
      scale,
      originalWidth,
      originalHeight,
      processedWidth: width,
      processedHeight: height,
    }
  } catch (error) {
    console.error('Error in makeInnerTransparentWithShapes:', error)
    throw error
  }
}

function processRectangularSelection(
  originalPixels: Uint8Array,
  width: number,
  height: number,
  channels: number,
  shape: ShapeSelection,
  parameters: ProcessingParameters
): Set<string> {
  if (shape.type !== 'rectangle') {
    throw new Error('Expected rectangle shape')
  }

  const { x: rectX, y: rectY, width: rectW, height: rectH } = shape
  const transparentArea = new Set<string>()

  // Very small safe margin
  const safeMargin = Math.min(
    Math.floor(rectW * parameters.safeMarginRatio),
    Math.floor(rectH * parameters.safeMarginRatio),
    3
  )

  const innerStartX = rectX + safeMargin
  const innerStartY = rectY + safeMargin
  const innerEndX = rectX + rectW - safeMargin
  const innerEndY = rectY + rectH - safeMargin

  // Step 1: Sample the CENTER
  const centerX = Math.floor(rectX + rectW / 2)
  const centerY = Math.floor(rectY + rectH / 2)
  const centerIdx = (centerY * width + centerX) * channels
  const centerR = originalPixels[centerIdx]
  const centerG = originalPixels[centerIdx + 1]
  const centerB = originalPixels[centerIdx + 2]

  // Step 2: Sample ALL edge pixels
  const edgePixels: { r: number; g: number; b: number }[] = []

  // Top and bottom edges
  for (let x = rectX; x < rectX + rectW; x++) {
    if (rectY >= 0 && rectY < height) {
      const idx = (rectY * width + x) * channels
      edgePixels.push({
        r: originalPixels[idx],
        g: originalPixels[idx + 1],
        b: originalPixels[idx + 2],
      })
    }
    const bottomY = rectY + rectH - 1
    if (bottomY >= 0 && bottomY < height) {
      const idx = (bottomY * width + x) * channels
      edgePixels.push({
        r: originalPixels[idx],
        g: originalPixels[idx + 1],
        b: originalPixels[idx + 2],
      })
    }
  }

  // Left and right edges
  for (let y = rectY; y < rectY + rectH; y++) {
    if (rectX >= 0 && rectX < width) {
      const idx = (y * width + rectX) * channels
      edgePixels.push({
        r: originalPixels[idx],
        g: originalPixels[idx + 1],
        b: originalPixels[idx + 2],
      })
    }
    const rightX = rectX + rectW - 1
    if (rightX >= 0 && rightX < width) {
      const idx = (y * width + rightX) * channels
      edgePixels.push({
        r: originalPixels[idx],
        g: originalPixels[idx + 1],
        b: originalPixels[idx + 2],
      })
    }
  }

  // Step 3: Identify background pixels
  const backgroundPixels: { r: number; g: number; b: number }[] = []

  for (const edge of edgePixels) {
    const distanceFromCenter = Math.sqrt(
      Math.pow(edge.r - centerR, 2) + Math.pow(edge.g - centerG, 2) + Math.pow(edge.b - centerB, 2)
    )

    if (distanceFromCenter > parameters.centerBackgroundThreshold) {
      backgroundPixels.push(edge)
    }
  }

  // Helper: Check if pixel is background
  function isBackground(r: number, g: number, b: number): boolean {
    for (const bg of backgroundPixels) {
      const distance = Math.sqrt(Math.pow(r - bg.r, 2) + Math.pow(g - bg.g, 2) + Math.pow(b - bg.b, 2))
      if (distance < parameters.backgroundMatchThreshold) {
        return true
      }
    }
    return false
  }

  // Helper: Check if directly adjacent to background (immediate neighbors only)
  function isDirectlyAdjacentToBackground(
    x: number,
    y: number,
    pixels: Uint8Array,
    width: number,
    height: number,
    channels: number
  ): boolean {
    const neighbors: [number, number][] = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue

      const nIdx = (ny * width + nx) * channels
      const nr = pixels[nIdx]
      const ng = pixels[nIdx + 1]
      const nb = pixels[nIdx + 2]

      if (isBackground(nr, ng, nb)) {
        return true
      }
    }
    return false
  }

  // Step 4: Process interior - BALANCED approach
  for (let y = innerStartY; y < innerEndY; y++) {
    for (let x = innerStartX; x < innerEndX; x++) {
      const idx = (y * width + x) * channels
      const r = originalPixels[idx]
      const g = originalPixels[idx + 1]
      const b = originalPixels[idx + 2]

      // Rule 1: If it's background, KEEP IT
      if (isBackground(r, g, b)) {
        continue
      }

      // Rule 2: If DIRECTLY adjacent to background (1 pixel away), KEEP IT
      // This preserves the frame outline
      if (isDirectlyAdjacentToBackground(x, y, originalPixels, width, height, channels)) {
        continue
      }

      // Rule 3: Check similarity to center
      const distanceFromCenter = Math.sqrt(
        Math.pow(r - centerR, 2) + Math.pow(g - centerG, 2) + Math.pow(b - centerB, 2)
      )

      // Make transparent if similar to center (lenient threshold)
      if (distanceFromCenter < parameters.centerSimilarityThreshold) {
        transparentArea.add(`${x},${y}`)
      }
    }
  }

  // Step 5: Fill interior gaps
  if (parameters.interiorGapFilling) {
    for (let y = innerStartY; y < innerEndY; y++) {
      let leftmost = innerEndX
      let rightmost = innerStartX

      for (let x = innerStartX; x < innerEndX; x++) {
        const key = `${x},${y}`
        if (transparentArea.has(key)) {
          leftmost = Math.min(leftmost, x)
          rightmost = Math.max(rightmost, x)
        }
      }

      if (rightmost >= leftmost) {
        for (let x = leftmost; x <= rightmost; x++) {
          const key = `${x},${y}`
          if (!transparentArea.has(key)) {
            const idx = (y * width + x) * channels
            const r = originalPixels[idx]
            const g = originalPixels[idx + 1]
            const b = originalPixels[idx + 2]

            // Fill if not background and not directly adjacent to background
            if (
              !isBackground(r, g, b)
              && !isDirectlyAdjacentToBackground(x, y, originalPixels, width, height, channels)
            ) {
              transparentArea.add(key)
            }
          }
        }
      }
    }
  }

  // When fallback is enabled, make entire shape transparent (use original bounds, not margin-inset)
  if (parameters.fallbackToFullTransparency) {
    transparentArea.clear()
    for (let y = rectY; y < rectY + rectH; y++) {
      for (let x = rectX; x < rectX + rectW; x++) {
        transparentArea.add(`${x},${y}`)
      }
    }
  }

  return transparentArea
}

// Helper: Check if pixel is colored
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isColoredPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const diff = max - min
  return diff > 25
}

// Helper: Fill the convex interior of detected area
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function includeBrightPixelsWithinArea(
  pixels: Uint8Array,
  width: number,
  height: number,
  channels: number,
  detectedArea: Set<string>,
  parameters: ProcessingParameters,
  boundingShape?: ShapeSelection | null
): Set<string> {
  const expandedArea = new Set<string>(detectedArea)

  // Get bounding box (constrained by bounding shape if provided)
  let minX = boundingShape ? boundingShape.x : width
  let maxX = boundingShape ? boundingShape.x + boundingShape.width - 1 : 0
  let minY = boundingShape ? boundingShape.y : height
  let maxY = boundingShape ? boundingShape.y + boundingShape.height - 1 : 0

  if (!boundingShape) {
    minX = width
    maxX = 0
    minY = height
    maxY = 0
  }

  detectedArea.forEach(key => {
    const [x, y] = key.split(',').map(Number)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  })

  // Ensure bounds stay within bounding shape
  if (boundingShape) {
    minX = Math.max(minX, boundingShape.x)
    maxX = Math.min(maxX, boundingShape.x + boundingShape.width - 1)
    minY = Math.max(minY, boundingShape.y)
    maxY = Math.min(maxY, boundingShape.y + boundingShape.height - 1)
  }

  // For each row, find the leftmost and rightmost detected pixels
  // Then fill everything in between
  for (let y = minY; y <= maxY; y++) {
    let leftmost = width
    let rightmost = -1

    // Find horizontal span of detected pixels in this row
    for (let x = minX; x <= maxX; x++) {
      const key = `${x},${y}`
      if (detectedArea.has(key)) {
        leftmost = Math.min(leftmost, x)
        rightmost = Math.max(rightmost, x)
      }
    }

    // Fill everything between leftmost and rightmost
    if (rightmost >= leftmost) {
      for (let x = leftmost; x <= rightmost; x++) {
        // Check if pixel is within shape boundary
        if (boundingShape && boundingShape.type === 'ellipse') {
          const centerX = boundingShape.x + boundingShape.width / 2
          const centerY = boundingShape.y + boundingShape.height / 2
          const radiusX = boundingShape.width / 2
          const radiusY = boundingShape.height / 2
          const normalizedX = (x - centerX) / radiusX
          const normalizedY = (y - centerY) / radiusY
          if (normalizedX * normalizedX + normalizedY * normalizedY > 1) {
            continue
          }
        }

        const key = `${x},${y}`
        if (!expandedArea.has(key)) {
          const idx = (y * width + x) * channels
          const r = pixels[idx]
          const g = pixels[idx + 1]
          const b = pixels[idx + 2]
          const brightness = (r + g + b) / 3

          // Exclude only PURE black pixels (the frame edge)
          // This allows dark gray text/arrows through
          if (
            brightness >= parameters.minimumBrightness
            || r > parameters.minimumColorChannels
            || g > parameters.minimumColorChannels
            || b > parameters.minimumColorChannels
          ) {
            expandedArea.add(key)
          }
        }
      }
    }
  }

  // Do the same vertically to catch any gaps
  for (let x = minX; x <= maxX; x++) {
    let topmost = height
    let bottommost = -1

    // Find vertical span of detected pixels in this column
    for (let y = minY; y <= maxY; y++) {
      const key = `${x},${y}`
      if (expandedArea.has(key)) {
        topmost = Math.min(topmost, y)
        bottommost = Math.max(bottommost, y)
      }
    }

    // Fill everything between topmost and bottommost
    if (bottommost >= topmost) {
      for (let y = topmost; y <= bottommost; y++) {
        // Check if pixel is within shape boundary
        if (boundingShape && boundingShape.type === 'ellipse') {
          const centerX = boundingShape.x + boundingShape.width / 2
          const centerY = boundingShape.y + boundingShape.height / 2
          const radiusX = boundingShape.width / 2
          const radiusY = boundingShape.height / 2
          const normalizedX = (x - centerX) / radiusX
          const normalizedY = (y - centerY) / radiusY
          if (normalizedX * normalizedX + normalizedY * normalizedY > 1) {
            continue
          }
        }

        const key = `${x},${y}`
        if (!expandedArea.has(key)) {
          const idx = (y * width + x) * channels
          const r = pixels[idx]
          const g = pixels[idx + 1]
          const b = pixels[idx + 2]
          const brightness = (r + g + b) / 3

          // Exclude only PURE black pixels
          if (
            brightness >= parameters.minimumBrightness
            || r > parameters.minimumColorChannels
            || g > parameters.minimumColorChannels
            || b > parameters.minimumColorChannels
          ) {
            expandedArea.add(key)
          }
        }
      }
    }
  }

  return expandedArea
}

/**
 * Process a single seed point without shape boundaries
 */
/**
 * Expand boundary of detected area
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function expandBoundary(
  originalPixels: Uint8Array,
  width: number,
  height: number,
  channels: number,
  transparentAreas: Set<string>,
  parameters: ProcessingParameters
): Set<string> {
  const expandedArea = new Set<string>(transparentAreas)

  if (parameters.interiorGapFilling) {
    // Get bounding box
    let minX = width,
      maxX = 0,
      minY = height,
      maxY = 0

    transparentAreas.forEach(key => {
      const [x, y] = key.split(',').map(Number)
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    })

    // Fill gaps horizontally
    for (let y = minY; y <= maxY; y++) {
      let leftmost = width,
        rightmost = -1

      for (let x = minX; x <= maxX; x++) {
        const key = `${x},${y}`
        if (transparentAreas.has(key)) {
          leftmost = Math.min(leftmost, x)
          rightmost = Math.max(rightmost, x)
        }
      }

      if (rightmost >= leftmost) {
        for (let x = leftmost; x <= rightmost; x++) {
          const key = `${x},${y}`
          if (!expandedArea.has(key)) {
            const idx = (y * width + x) * channels
            const r = originalPixels[idx]
            const g = originalPixels[idx + 1]
            const b = originalPixels[idx + 2]
            const brightness = (r + g + b) / 3

            if (brightness >= parameters.minimumBrightness) {
              expandedArea.add(key)
            }
          }
        }
      }
    }
  }

  return expandedArea
}

/**
 * Process ellipse selection to create transparent area
 */
function processEllipseSelection(
  originalPixels: Uint8Array,
  width: number,
  height: number,
  channels: number,
  ellipse: ShapeSelection,
  parameters: ProcessingParameters
): Set<string> {
  if (ellipse.type !== 'ellipse') {
    throw new Error('Expected ellipse shape')
  }

  const transparentPixels = new Set<string>()

  const centerX = ellipse.x + ellipse.width / 2
  const centerY = ellipse.y + ellipse.height / 2
  const radiusX = ellipse.width / 2
  const radiusY = ellipse.height / 2

  // Apply safe margin
  const safeMarginX = radiusX * parameters.safeMarginRatio
  const safeMarginY = radiusY * parameters.safeMarginRatio
  const effectiveRadiusX = Math.max(1, radiusX - safeMarginX)
  const effectiveRadiusY = Math.max(1, radiusY - safeMarginY)

  // Get center pixel for comparison
  const centerPixelX = Math.round(centerX)
  const centerPixelY = Math.round(centerY)

  if (centerPixelX < 0 || centerPixelX >= width || centerPixelY < 0 || centerPixelY >= height) {
    return transparentPixels
  }

  const centerIndex = (centerPixelY * width + centerPixelX) * channels
  const centerR = originalPixels[centerIndex]
  const centerG = originalPixels[centerIndex + 1]
  const centerB = originalPixels[centerIndex + 2]

  // Calculate center brightness for background detection
  const centerBrightness = (centerR + centerG + centerB) / 3

  // Process pixels within ellipse bounds
  for (let y = Math.max(0, Math.floor(ellipse.y)); y < Math.min(height, Math.ceil(ellipse.y + ellipse.height)); y++) {
    for (let x = Math.max(0, Math.floor(ellipse.x)); x < Math.min(width, Math.ceil(ellipse.x + ellipse.width)); x++) {
      // Check if point is inside ellipse
      const normalizedX = (x - centerX) / effectiveRadiusX
      const normalizedY = (y - centerY) / effectiveRadiusY

      if (normalizedX * normalizedX + normalizedY * normalizedY <= 1) {
        const pixelIndex = (y * width + x) * channels
        const r = originalPixels[pixelIndex]
        const g = originalPixels[pixelIndex + 1]
        const b = originalPixels[pixelIndex + 2]

        // Calculate color similarity to center
        const colorDiff = Math.abs(r - centerR) + Math.abs(g - centerG) + Math.abs(b - centerB)
        const colorSimilarity = Math.max(0, 100 - colorDiff / 7.65) // Normalize to 0-100%

        if (colorSimilarity >= parameters.centerSimilarityThreshold) {
          // Check if this pixel is different enough from background
          const pixelBrightness = (r + g + b) / 3
          const brightnessDiff = Math.abs(pixelBrightness - centerBrightness)

          if (brightnessDiff >= parameters.centerBackgroundThreshold) {
            const key = `${x},${y}`
            transparentPixels.add(key)
          }
        }
      }
    }
  }

  // When fallback is enabled, make entire ellipse transparent (use original radius, not margin-reduced)
  if (parameters.fallbackToFullTransparency) {
    transparentPixels.clear()
    for (let y = Math.max(0, Math.floor(ellipse.y)); y < Math.min(height, Math.ceil(ellipse.y + ellipse.height)); y++) {
      for (let x = Math.max(0, Math.floor(ellipse.x)); x < Math.min(width, Math.ceil(ellipse.x + ellipse.width)); x++) {
        const normalizedX = (x - centerX) / radiusX
        const normalizedY = (y - centerY) / radiusY
        if (normalizedX * normalizedX + normalizedY * normalizedY <= 1) {
          transparentPixels.add(`${x},${y}`)
        }
      }
    }
  }

  return transparentPixels
}

/**
 * Process a vector shape selection using polygon containment (server-side, no Canvas API)
 */
function processVectorSelectionServer(
  originalPixels: Uint8Array,
  width: number,
  height: number,
  channels: number,
  shape: VectorShape,
  parameters: ProcessingParameters
): Set<string> {
  const transparentArea = new Set<string>()
  const polygon = pathCommandsToPolygon(shape.pathCommands)

  // Use bounding box to limit iteration
  const minX = Math.max(0, Math.floor(shape.x))
  const minY = Math.max(0, Math.floor(shape.y))
  const maxX = Math.min(width - 1, Math.ceil(shape.x + shape.width))
  const maxY = Math.min(height - 1, Math.ceil(shape.y + shape.height))

  // Get center pixel color for similarity comparison
  const centerX = Math.floor(shape.x + shape.width / 2)
  const centerY = Math.floor(shape.y + shape.height / 2)
  const centerIdx = (centerY * width + centerX) * channels
  const centerR = originalPixels[centerIdx]
  const centerG = originalPixels[centerIdx + 1]
  const centerB = originalPixels[centerIdx + 2]

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!isPointInPolygon(x, y, polygon)) continue

      if (parameters.fallbackToFullTransparency) {
        transparentArea.add(`${x},${y}`)
      } else {
        const idx = (y * width + x) * channels
        const r = originalPixels[idx]
        const g = originalPixels[idx + 1]
        const b = originalPixels[idx + 2]
        const dist = Math.sqrt((r - centerR) ** 2 + (g - centerG) ** 2 + (b - centerB) ** 2)
        if (dist < parameters.centerSimilarityThreshold) {
          transparentArea.add(`${x},${y}`)
        }
      }
    }
  }

  return transparentArea
}

/**
 * Process multiple vector shapes together using even-odd fill rule (server-side).
 * Uses polygon containment counting: a pixel inside an odd number of shapes is transparent,
 * a pixel inside an even number is opaque (creating donut/ring effects for nested paths).
 */
function processVectorShapesWithEvenOddServer(
  originalPixels: Uint8Array,
  width: number,
  height: number,
  channels: number,
  shapes: VectorShape[],
  parameters: ProcessingParameters
): Set<string> {
  const transparentArea = new Set<string>()
  if (shapes.length === 0) return transparentArea

  // Pre-compute polygons for all shapes
  const polygons = shapes.map(shape => pathCommandsToPolygon(shape.pathCommands))

  // Calculate combined bounding box
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const shape of shapes) {
    minX = Math.min(minX, shape.x)
    minY = Math.min(minY, shape.y)
    maxX = Math.max(maxX, shape.x + shape.width)
    maxY = Math.max(maxY, shape.y + shape.height)
  }
  minX = Math.max(0, Math.floor(minX))
  minY = Math.max(0, Math.floor(minY))
  maxX = Math.min(width - 1, Math.ceil(maxX))
  maxY = Math.min(height - 1, Math.ceil(maxY))

  // Get center pixel color for similarity comparison
  const centerX = Math.floor((minX + maxX) / 2)
  const centerY = Math.floor((minY + maxY) / 2)
  const centerIdx = (centerY * width + centerX) * channels
  const centerR = originalPixels[centerIdx]
  const centerG = originalPixels[centerIdx + 1]
  const centerB = originalPixels[centerIdx + 2]

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Count how many polygons contain this point (even-odd rule)
      let containCount = 0
      for (const polygon of polygons) {
        if (isPointInPolygon(x, y, polygon)) containCount++
      }
      // Even-odd: only transparent if inside an odd number of shapes
      if (containCount === 0 || containCount % 2 === 0) continue

      if (parameters.fallbackToFullTransparency) {
        transparentArea.add(`${x},${y}`)
      } else {
        const idx = (y * width + x) * channels
        const r = originalPixels[idx]
        const g = originalPixels[idx + 1]
        const b = originalPixels[idx + 2]
        const dist = Math.sqrt((r - centerR) ** 2 + (g - centerG) ** 2 + (b - centerB) ** 2)
        if (dist < parameters.centerSimilarityThreshold) {
          transparentArea.add(`${x},${y}`)
        }
      }
    }
  }

  return transparentArea
}

/**
 * Process any shape selection (rectangle, ellipse, or vector)
 * Supports rotation by processing the rotated bounding box and checking each pixel
 */
function processShapeSelection(
  originalPixels: Uint8Array,
  width: number,
  height: number,
  channels: number,
  shape: ShapeSelection,
  parameters: ProcessingParameters
): Set<string> {
  // Vector shapes: use polygon-based containment (no Canvas API server-side)
  if (shape.type === 'vector') {
    return processVectorSelectionServer(originalPixels, width, height, channels, shape as VectorShape, parameters)
  }

  const rotation = shape.rotation || 0

  // Fast path: no rotation, use original functions
  if (rotation === 0) {
    if (shape.type === 'ellipse') {
      return processEllipseSelection(originalPixels, width, height, channels, shape, parameters)
    }
    return processRectangularSelection(originalPixels, width, height, channels, shape, parameters)
  }

  // Rotated shape: process using rotation-aware logic
  return processRotatedShapeSelection(originalPixels, width, height, channels, shape, parameters)
}

/**
 * Process a rotated shape selection by iterating over its rotated bounding box
 * and checking if each pixel falls within the rotated shape
 */
function processRotatedShapeSelection(
  originalPixels: Uint8Array,
  width: number,
  height: number,
  channels: number,
  shape: ShapeSelection,
  parameters: ProcessingParameters
): Set<string> {
  const transparentArea = new Set<string>()
  const rotation = shape.rotation || 0
  const radians = -rotation * (Math.PI / 180) // Negative for inverse transform

  // Calculate shape center
  const centerX = shape.x + shape.width / 2
  const centerY = shape.y + shape.height / 2

  // Calculate rotated bounding box (expanded to contain the rotated shape)
  const diagonal = Math.sqrt(shape.width * shape.width + shape.height * shape.height)
  const expandedBounds = {
    minX: Math.max(0, Math.floor(centerX - diagonal / 2)),
    maxX: Math.min(width - 1, Math.ceil(centerX + diagonal / 2)),
    minY: Math.max(0, Math.floor(centerY - diagonal / 2)),
    maxY: Math.min(height - 1, Math.ceil(centerY + diagonal / 2)),
  }

  // Get center pixel color for similarity comparison
  const centerIdx = (Math.floor(centerY) * width + Math.floor(centerX)) * channels
  const centerR = originalPixels[centerIdx]
  const centerG = originalPixels[centerIdx + 1]
  const centerB = originalPixels[centerIdx + 2]

  // Precompute cos/sin for performance
  const cosR = Math.cos(radians)
  const sinR = Math.sin(radians)

  // Safe margin for frame preservation
  const safeMargin = Math.min(
    Math.floor(shape.width * parameters.safeMarginRatio),
    Math.floor(shape.height * parameters.safeMarginRatio),
    3
  )

  // Iterate over expanded bounding box
  for (let y = expandedBounds.minY; y <= expandedBounds.maxY; y++) {
    for (let x = expandedBounds.minX; x <= expandedBounds.maxX; x++) {
      // Transform pixel to shape's local (unrotated) space
      const dx = x - centerX
      const dy = y - centerY
      const localX = dx * cosR - dy * sinR + centerX
      const localY = dx * sinR + dy * cosR + centerY

      // Check if transformed point is within unrotated shape bounds (with safe margin)
      let isInsideShape = false
      if (shape.type === 'vector') {
        // Vector shapes use polygon containment directly (no rotation transform)
        const polygon = pathCommandsToPolygon((shape as VectorShape).pathCommands)
        isInsideShape = isPointInPolygon(x, y, polygon)
      } else if (shape.type === 'ellipse') {
        // Ellipse check with safe margin
        const radiusX = shape.width / 2 - safeMargin
        const radiusY = shape.height / 2 - safeMargin
        if (radiusX > 0 && radiusY > 0) {
          const normalizedX = (localX - centerX) / radiusX
          const normalizedY = (localY - centerY) / radiusY
          isInsideShape = normalizedX * normalizedX + normalizedY * normalizedY <= 1
        }
      } else {
        // Rectangle check with safe margin
        const innerStartX = shape.x + safeMargin
        const innerStartY = shape.y + safeMargin
        const innerEndX = shape.x + shape.width - safeMargin
        const innerEndY = shape.y + shape.height - safeMargin
        isInsideShape = localX >= innerStartX && localX < innerEndX && localY >= innerStartY && localY < innerEndY
      }

      if (isInsideShape) {
        // When fallback is enabled, make all pixels inside the shape transparent
        if (parameters.fallbackToFullTransparency) {
          transparentArea.add(`${x},${y}`)
        } else {
          // Check pixel color similarity to center
          const idx = (y * width + x) * channels
          const r = originalPixels[idx]
          const g = originalPixels[idx + 1]
          const b = originalPixels[idx + 2]

          const distanceFromCenter = Math.sqrt(
            Math.pow(r - centerR, 2) + Math.pow(g - centerG, 2) + Math.pow(b - centerB, 2)
          )

          // Make transparent if similar to center
          if (distanceFromCenter < parameters.centerSimilarityThreshold) {
            transparentArea.add(`${x},${y}`)
          }
        }
      }
    }
  }

  return transparentArea
}

/**
 * Find which shape contains a given point (centroid) and return its rotation and dimensions
 * Uses axis-aligned bounding box check for simplicity
 */
function findShapeInfoForPoint(
  x: number,
  y: number,
  shapes: ShapeSelection[]
): { rotation?: number; width: number; height: number; type?: string; pathCommands?: PathCommand[] } | undefined {
  for (const shape of shapes) {
    // Simple bounding box containment check
    if (x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height) {
      return {
        rotation: shape.rotation,
        width: shape.width,
        height: shape.height,
        type: shape.type,
        pathCommands: shape.type === 'vector' ? (shape as VectorShape).pathCommands : undefined,
      }
    }
  }
  return undefined
}

/**
 * Detect transparent areas in processed image and return bounding boxes
 * @param shapes - Optional shapes to inherit rotation from
 */
export async function detectTransparentAreas(
  processedImageBuffer: Buffer,
  minAreaSize: number = 100,
  keepOnlyLargestArea: boolean = false,
  shapes?: ShapeSelection[]
): Promise<TransparentArea[]> {
  try {
    // Load the processed image and get raw RGBA data
    const image = sharp(processedImageBuffer)
    const { width, height } = await image.metadata()
    const { data: pixels } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })

    if (!width || !height) {
      return []
    }

    const visited = new Set<string>()
    const transparentAreas: TransparentArea[] = []

    // Scan for transparent and semi-transparent pixels (alpha < 128)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x},${y}`
        if (visited.has(key)) continue

        const pixelIndex = (y * width + x) * 4
        const alpha = pixels[pixelIndex + 3]

        // Found a transparent or semi-transparent pixel, flood fill to find the entire area
        if (alpha < 128) {
          const area = floodFillTransparentArea(pixels, width, height, x, y, visited)

          if (area.area >= minAreaSize) {
            // If shapes are provided, find which shape contains this area and inherit its rotation and dimensions
            if (shapes && shapes.length > 0) {
              const shapeInfo = findShapeInfoForPoint(area.centroid.x, area.centroid.y, shapes)
              if (shapeInfo) {
                if (shapeInfo.rotation !== undefined && shapeInfo.rotation !== 0) {
                  area.rotation = shapeInfo.rotation
                  // Store source shape dimensions for proper template sizing when rotated
                  area.sourceShapeDimensions = {
                    width: shapeInfo.width,
                    height: shapeInfo.height,
                  }
                }

                // For vector shapes: compute inscribed rectangle for template placement
                if (shapeInfo.type === 'vector' && shapeInfo.pathCommands) {
                  const inscribed = findLargestInscribedRectangle(shapeInfo.pathCommands)
                  if (inscribed) {
                    area.inscribedRect = inscribed
                    area.rotation = inscribed.rotation
                    area.sourceShapeDimensions = {
                      width: inscribed.width,
                      height: inscribed.height,
                    }
                  }
                }
              }
            }
            transparentAreas.push(area)
          }
        }
      }
    }

    // Apply filtering based on parameters
    if (keepOnlyLargestArea && transparentAreas.length > 1) {
      // Sort by area size in descending order and keep only the largest
      transparentAreas.sort((a, b) => b.area - a.area)
      return [transparentAreas[0]]
    }

    return transparentAreas
  } catch (error) {
    console.error('Error detecting transparent areas:', error)
    return []
  }
}

/**
 * Flood fill algorithm to find connected transparent pixels
 */
function floodFillTransparentArea(
  pixels: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  visited: Set<string>
): TransparentArea {
  const stack = [{ x: startX, y: startY }]
  const areaPixels: { x: number; y: number }[] = []
  let minX = startX,
    maxX = startX,
    minY = startY,
    maxY = startY

  while (stack.length > 0) {
    const { x, y } = stack.pop()!
    const key = `${x},${y}`

    if (x < 0 || x >= width || y < 0 || y >= height || visited.has(key)) {
      continue
    }

    const pixelIndex = (y * width + x) * 4
    const alpha = pixels[pixelIndex + 3]

    // Include transparent and semi-transparent pixels
    if (alpha < 128) {
      visited.add(key)
      areaPixels.push({ x, y })

      // Update bounding box
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)

      // Add adjacent pixels (4-connectivity)
      stack.push({ x: x + 1, y: y }, { x: x - 1, y: y }, { x: x, y: y + 1 }, { x: x, y: y - 1 })
    }
  }

  // Calculate centroid
  const centroidX = areaPixels.reduce((sum, p) => sum + p.x, 0) / areaPixels.length
  const centroidY = areaPixels.reduce((sum, p) => sum + p.y, 0) / areaPixels.length

  return {
    boundingBox: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
    area: areaPixels.length,
    centroid: {
      x: Math.round(centroidX),
      y: Math.round(centroidY),
    },
  }
}

/**
 * Convert processed image buffer to base64 data URL
 */
export function convertImageToDataUrl(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString('base64')}`
}

/**
 * Upload processed image buffer to Shopify and return the CDN URL
 */
export async function uploadProcessedImageToShopify(
  imageBuffer: Buffer,
  fileName: string,
  api: ShopifyApiClient,
  shopDomain: string
): Promise<{ url: string; id: string } | null> {
  const { uploadFiles } = await import('~/shopify/graphql/files/fns.server')

  try {
    // Create a File-like object from the buffer
    // @ts-ignore
    const blob = new Blob([imageBuffer], { type: 'image/png' })
    const file = new File([blob], fileName, { type: 'image/png' })

    // Upload using the existing uploadFiles function
    const { uploadedFiles, errorFiles, errors } = await uploadFiles({
      api,
      files: [file],
      shopDomain,
      privateUpload: false,
    })

    if (errors || errorFiles.length > 0) {
      console.error('Error uploading processed image:', errors, errorFiles)
      throw new Error(`Failed to upload processed image: ${errors}`)
    }

    if (uploadedFiles.length > 0) {
      const uploadedFile = uploadedFiles[0]
      return {
        url: uploadedFile.image?.originalSrc || uploadedFile.url,
        id: uploadedFile.id || `processed-${uuid()}`,
      }
    }

    throw new Error('No files were uploaded')
  } catch (error) {
    console.error('Error in uploadProcessedImageToShopify:', error)
    throw error
  }
}

/**
 * Validate input parameters for image processing
 */
export function validateProcessingInput(shapeSelections: ShapeSelection[]): { isValid: boolean; error?: string } {
  if (shapeSelections.length === 0) {
    return {
      isValid: false,
      error: 'No shape selections provided',
    }
  }

  // Validate shape selections
  for (const shape of shapeSelections) {
    if (
      typeof shape.x !== 'number'
      || typeof shape.y !== 'number'
      || typeof shape.width !== 'number'
      || typeof shape.height !== 'number'
    ) {
      return {
        isValid: false,
        error: 'Invalid shape selection coordinates',
      }
    }
    if (shape.x < 0 || shape.y < 0 || shape.width <= 0 || shape.height <= 0) {
      return {
        isValid: false,
        error: 'Shape selection coordinates and dimensions must be positive',
      }
    }
  }

  return { isValid: true }
}

/**
 * Process image and optionally upload to Shopify
 */
export async function processMockupMask(
  inputBuffer: Buffer,
  shapeSelections: ShapeSelection[],
  parameters: ProcessingParameters,
  options: {
    uploadToShopify?: boolean
    fileName?: string
    api?: ShopifyApiClient
    shopDomain?: string
    featherRadius?: number
    maxDimension?: number
  } = {}
): Promise<{
  processedImageBuffer: Buffer
  processedImageUrl?: string
  transparentCount: number
  transparentAreas?: TransparentArea[]
  processedWidth?: number
  processedHeight?: number
  originalWidth?: number
  originalHeight?: number
  scale?: number
}> {
  // Process the image with optional downscaling
  const {
    processedImageBuffer,
    transparentCount,
    processedWidth,
    processedHeight,
    originalWidth,
    originalHeight,
    scale,
  } = await makeInnerTransparent(
    inputBuffer,
    shapeSelections,
    parameters,
    options.featherRadius || 2,
    options.maxDimension
  )

  // Scale shape selections to match processed dimensions for rotation inheritance
  const scaledShapes
    = scale !== undefined && scale !== 1
      ? shapeSelections.map(shape => ({
          ...shape,
          x: Math.round(shape.x * scale),
          y: Math.round(shape.y * scale),
          width: Math.round(shape.width * scale),
          height: Math.round(shape.height * scale),
        }))
      : shapeSelections

  // Detect transparent areas, passing shapes to inherit rotation
  const transparentAreas = await detectTransparentAreas(
    processedImageBuffer,
    parameters.minAreaSize,
    parameters.keepOnlyLargestArea,
    scaledShapes
  )

  const result: {
    processedImageBuffer: Buffer
    processedImageUrl?: string
    transparentCount: number
    transparentAreas?: TransparentArea[]
    processedWidth?: number
    processedHeight?: number
    originalWidth?: number
    originalHeight?: number
    scale?: number
  } = {
    processedImageBuffer,
    transparentCount,
    transparentAreas,
    processedWidth,
    processedHeight,
    originalWidth,
    originalHeight,
    scale,
  }

  if (options.uploadToShopify && options.api && options.shopDomain && options.fileName) {
    // Upload to Shopify
    const uploadResult = await uploadProcessedImageToShopify(
      processedImageBuffer,
      options.fileName,
      options.api,
      options.shopDomain
    )

    if (uploadResult) {
      result.processedImageUrl = uploadResult.url
    }
  } else {
    // Return as Base64 data URL
    result.processedImageUrl = convertImageToDataUrl(processedImageBuffer)
  }

  return result
}

/**
 * Get default processing parameters
 */
export function getDefaultProcessingParameters(): ProcessingParameters {
  return {
    // Core Detection Parameters
    colorSimilarityThreshold: 70,
    maxAreaRatio: 0.3,
    featherRadius: 2,
    interiorGapFilling: true,
    keepShadowHighlight: true,

    // Seed Point Parameters
    sampleRadius: 30,
    frameDetectionThreshold: 60,
    frameMatchThreshold: 30,
    brightnessThreshold: 50,
    minBrightnessFilter: 60,

    // Shadow Parameters
    shadowDetectionThreshold: -20,
    shadowOpacity: 180,
    shadowColorDarkeningFactor: 0.3,

    // Highlight Parameters
    highlightDetectionThreshold: 20,
    highlightOpacity: 150,
    highlightColorBaseFactor: 0.7,

    // Shape Selection Parameters
    safeMarginRatio: 0.04,
    centerBackgroundThreshold: 50,
    backgroundMatchThreshold: 40,
    centerSimilarityThreshold: 70,

    // Boundary Expansion Parameters
    minimumBrightness: 15,
    minimumColorChannels: 10,

    // Transparent Area Filtering Parameters
    keepOnlyLargestArea: false,
    minAreaSize: 100,

    // Transparency Fallback Parameters
    fallbackToFullTransparency: false,
  }
}
