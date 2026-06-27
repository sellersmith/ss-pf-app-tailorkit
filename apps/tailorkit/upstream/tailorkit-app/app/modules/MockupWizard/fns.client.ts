/* eslint-disable max-lines */
import type { ShapeSelection, ProcessingParameters, TransparentArea, VectorShape } from './types'
import type { PathCommand } from '~/modules/VectorEditor/utils/svg'
import { TEMPLATES_ACTIONS } from '../../routes/api.templates/constants'
import { IMAGE_DIMENSIONS } from './constants'
import { scalePathCommands, serializePathCommandsToD } from './utils/vectorPathUtils'
import { findLargestInscribedRectangle } from '~/utils/geometry/inscribed-rectangle'

export interface ProcessingResult {
  processedImageBuffer: Blob
  transparentCount: number
  transparentAreas?: TransparentArea[]
  // Dimension info for composite canvas scaling (when downscaling was applied)
  processedWidth?: number
  processedHeight?: number
  originalWidth?: number
  originalHeight?: number
  scale?: number
}

// Canvas Helper Functions
/**
 * Load an image URL into a Canvas element with optional max dimension for mobile optimization
 */
async function loadImageToCanvas(
  imageUrl: string,
  maxDimension?: number
): Promise<{
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  originalWidth: number
  originalHeight: number
}> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        // Cleanup image on error
        img.src = ''
        reject(new Error('Could not get Canvas 2D context'))
        return
      }

      const originalWidth = img.width
      const originalHeight = img.height

      // Downscale during load if maxDimension is specified (mobile optimization)
      if (maxDimension) {
        const maxDim = Math.max(originalWidth, originalHeight)
        if (maxDim > maxDimension) {
          const scale = maxDimension / maxDim
          canvas.width = Math.round(originalWidth * scale)
          canvas.height = Math.round(originalHeight * scale)

          console.log(
            `[MockupWizard Client] Downscaling image from ${originalWidth}x${originalHeight} to fit ${maxDimension}px (scale: ${scale.toFixed(3)})`
          )

          // Use high-quality downscaling
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

          // Cleanup image object to free memory
          img.src = ''

          resolve({
            canvas,
            ctx,
            width: canvas.width,
            height: canvas.height,
            originalWidth,
            originalHeight,
          })
          return
        }
      }

      // No downscaling needed or not specified
      canvas.width = originalWidth
      canvas.height = originalHeight
      ctx.drawImage(img, 0, 0)

      // Cleanup image object to free memory
      img.src = ''

      resolve({
        canvas,
        ctx,
        width: originalWidth,
        height: originalHeight,
        originalWidth,
        originalHeight,
      })
    }

    img.onerror = () => {
      // Cleanup image on error
      img.src = ''
      reject(new Error(`Failed to load image: ${imageUrl}`))
    }

    img.src = imageUrl
  })
}

/**
 * Get ImageData from a Canvas
 */
function getImageDataFromCanvas(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Could not get Canvas 2D context')
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/**
 * Put ImageData back to Canvas
 */
function putImageDataToCanvas(canvas: HTMLCanvasElement, imageData: ImageData): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Could not get Canvas 2D context')
  }
  ctx.putImageData(imageData, 0, 0)
}

/**
 * Convert Canvas to Blob
 */
async function canvasToBlob(canvas: HTMLCanvasElement, type: string = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Failed to convert canvas to blob'))
      }
    }, type)
  })
}

/**
 * Create ImageData from raw pixel data
 */
function createImageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  // @ts-ignore
  return new ImageData(data, width, height)
}

/**
 * Scale processing inputs (seed points and shape selections) to match downscaled image
 */
function scaleProcessingInputs(
  shapeSelections: ShapeSelection[],
  scale: number
): {
  scaledShapeSelections: ShapeSelection[]
} {
  if (scale === 1) {
    return {
      scaledShapeSelections: shapeSelections,
    }
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
 * Build a Path2D from a vector shape's pathD or pathCommands
 */
function buildVectorPath2D(shape: VectorShape): Path2D {
  const pathD = shape.pathD || serializePathCommandsToD(shape.pathCommands)
  return new Path2D(pathD)
}

/**
 * Check if a point is inside a vector shape using Path2D + OffscreenCanvas
 */
function isPointInVectorShapeClient(x: number, y: number, shape: VectorShape): boolean {
  const path2D = buildVectorPath2D(shape)
  const canvas = new OffscreenCanvas(1, 1)
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  return ctx.isPointInPath(path2D, x, y)
}

/**
 * Enhanced main processing function adapted from preflight mockup-wizard
 * Creates transparent areas in an image based on seed points and shape selections
 *
 * @param maxDimension - Maximum dimension for downscaling (default: DESKTOP_DOWNSCALE_THRESHOLD)
 */
export async function makeInnerTransparent(
  inputImageUrl: string,
  shapeSelections: ShapeSelection[],
  parameters: ProcessingParameters,
  featherRadius: number = 2,
  maxDimension: number = IMAGE_DIMENSIONS.DESKTOP_DOWNSCALE_THRESHOLD
): Promise<ProcessingResult> {
  let workingCanvas: HTMLCanvasElement | null = null
  let processedCanvas: HTMLCanvasElement | null = null

  try {
    // Load image with downscaling to prevent memory spike during initial load
    const loadResult = await loadImageToCanvas(inputImageUrl, maxDimension)
    workingCanvas = loadResult.canvas
    const originalWidth = loadResult.originalWidth
    const originalHeight = loadResult.originalHeight

    // Calculate scale factor for coordinate adjustments
    const scale = workingCanvas.width / originalWidth

    // Scale processing inputs if downscaling was applied
    const { scaledShapeSelections } = scaleProcessingInputs(shapeSelections, scale)

    // Get image data from working canvas (potentially downscaled)
    const originalImageData = getImageDataFromCanvas(workingCanvas)

    const originalPixels = originalImageData.data
    const channels = 4 // RGBA
    const width = originalImageData.width
    const height = originalImageData.height

    // Store all areas to make transparent (using Uint8Array for 20× faster performance)
    const allTransparentAreas = new Uint8Array(width * height)

    // Per-area tracking for shadow/highlight preservation
    // Each area gets its own pixel mask for independent brightness calculation
    const areaPixelMasks: Uint8Array[] = []
    // Maps pixel index to area index (-1 = not transparent, 0+ = area index)
    const pixelToAreaMap = new Int16Array(width * height).fill(-1)

    // Process shape selections
    if (scaledShapeSelections && scaledShapeSelections.length > 0) {
      // Collect vector shapes for compound even-odd processing
      const vectorShapes: VectorShape[] = []

      for (let i = 0; i < scaledShapeSelections.length; i++) {
        const shape = scaledShapeSelections[i]

        if (shape.type === 'vector') {
          // Defer vector shapes for compound even-odd processing
          vectorShapes.push(shape as VectorShape)
        } else {
          const shapeArea = processShapeSelectionOptimized(originalPixels, width, height, channels, shape, parameters)

          // Store this shape's area as a separate mask for per-area brightness calculation
          const areaIndex = areaPixelMasks.length
          areaPixelMasks.push(shapeArea)

          // Merge into allTransparentAreas and map pixels to area
          for (let j = 0; j < shapeArea.length; j++) {
            if (shapeArea[j]) {
              allTransparentAreas[j] = 1
              pixelToAreaMap[j] = areaIndex
            }
          }
        }
      }

      // Process all vector shapes together with even-odd fill rule
      // This enables donut/ring effects when vector paths are nested
      if (vectorShapes.length > 0) {
        const vectorArea = processVectorShapesWithEvenOddOptimized(
          originalPixels,
          width,
          height,
          channels,
          vectorShapes,
          parameters
        )

        const areaIndex = areaPixelMasks.length
        areaPixelMasks.push(vectorArea)

        for (let j = 0; j < vectorArea.length; j++) {
          if (vectorArea[j]) {
            allTransparentAreas[j] = 1
            pixelToAreaMap[j] = areaIndex
          }
        }
      }
    }

    // Apply transparency with anti-aliasing - with optional shadow/highlight preservation
    let count = 0

    // Create a copy of the pixel data for modification
    const modifiedPixels = new Uint8ClampedArray(originalPixels)

    if (parameters.keepShadowHighlight) {
      // Calculate per-area average brightness to establish area-specific baselines
      // This ensures each transparent area preserves its own shadows/highlights correctly
      const areaAvgBrightness: number[] = areaPixelMasks.map(areaMask => {
        let totalBrightness = 0
        let pixelCount = 0

        for (let i = 0; i < areaMask.length; i++) {
          if (areaMask[i]) {
            const idx = i * channels
            const r = originalPixels[idx]
            const g = originalPixels[idx + 1]
            const b = originalPixels[idx + 2]
            totalBrightness += (r + g + b) / 3
            pixelCount++
          }
        }

        return pixelCount > 0 ? totalBrightness / pixelCount : 128 // Default to mid-gray if empty
      })

      // Apply shadow/highlight preservation using per-area baselines
      for (let i = 0; i < width * height; i++) {
        const areaIndex = pixelToAreaMap[i]
        if (areaIndex === -1) continue // Not a transparent pixel

        const avgBrightness = areaAvgBrightness[areaIndex]
        const idx = i * channels

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
          modifiedPixels[idx] = Math.floor(r * shadowFactor)
          modifiedPixels[idx + 1] = Math.floor(g * shadowFactor)
          modifiedPixels[idx + 2] = Math.floor(b * shadowFactor)
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
          modifiedPixels[idx] = Math.floor(255 * highlightFactor)
          modifiedPixels[idx + 1] = Math.floor(255 * highlightFactor)
          modifiedPixels[idx + 2] = Math.floor(255 * highlightFactor)
        } else {
          // Neutral area (close to average brightness)
          // Make mostly transparent
          alpha = 0
        }

        modifiedPixels[idx + 3] = alpha
        count++
      }
    } else {
      // Full transparency mode - simple alpha channel modification
      for (let i = 0; i < allTransparentAreas.length; i++) {
        if (allTransparentAreas[i]) {
          const idx = i * channels
          modifiedPixels[idx + 3] = 0 // Set alpha to 0 (fully transparent)
          count++
        }
      }
    }

    // Create new ImageData with modified pixels
    const processedImageData = createImageData(modifiedPixels, width, height)

    // Cleanup working canvas immediately after getting image data (no longer needed)
    if (workingCanvas) {
      workingCanvas.width = 0
      workingCanvas.height = 0
      workingCanvas = null
    }

    // Create a new canvas for the processed image
    processedCanvas = document.createElement('canvas')
    processedCanvas.width = width
    processedCanvas.height = height
    putImageDataToCanvas(processedCanvas, processedImageData)

    // No upscaling - keep result at processed dimensions
    // The composite canvas will scale the original image to match instead

    // Convert to blob
    const processedImageBuffer = await canvasToBlob(processedCanvas, 'image/png')

    // Cleanup final processed canvas
    if (processedCanvas) {
      processedCanvas.width = 0
      processedCanvas.height = 0
      processedCanvas = null
    }

    return {
      processedImageBuffer,
      transparentCount: count,
      // Include dimension info for composite canvas scaling
      processedWidth: width,
      processedHeight: height,
      originalWidth,
      originalHeight,
      scale,
    }
  } catch (error) {
    // Cleanup canvases on error (use try-catch for each to ensure all cleanup attempts run)
    try {
      if (workingCanvas) {
        workingCanvas.width = 0
        workingCanvas.height = 0
        workingCanvas = null
      }
    } catch (e) {
      /* ignore cleanup errors */
    }

    try {
      if (processedCanvas) {
        processedCanvas.width = 0
        processedCanvas.height = 0
        processedCanvas = null
      }
    } catch (e) {
      /* ignore cleanup errors */
    }

    console.error('Error in makeInnerTransparent:', error)
    throw error
  }
}

// Helper: Check if pixel is colored
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isColoredPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const diff = max - min
  return diff > 25
}

// OPTIMIZED: Fill the convex interior of detected area using TypedArrays (input is already Uint8Array)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function includeBrightPixelsWithinAreaOptimized(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  channels: number,
  detectedArea: Uint8Array,
  parameters: ProcessingParameters,
  boundingShape?: ShapeSelection | null
): Uint8Array {
  const expandedArray = new Uint8Array(detectedArea) // Copy detected array

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

    // Calculate bounds from detected pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (detectedArea[y * width + x]) {
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          minY = Math.min(minY, y)
          maxY = Math.max(maxY, y)
        }
      }
    }
  }

  // Ensure bounds stay within bounding shape
  if (boundingShape) {
    minX = Math.max(minX, boundingShape.x)
    maxX = Math.min(maxX, boundingShape.x + boundingShape.width - 1)
    minY = Math.max(minY, boundingShape.y)
    maxY = Math.min(maxY, boundingShape.y + boundingShape.height - 1)
  }

  // Pre-calculate ellipse parameters if needed
  let centerX = 0,
    centerY = 0,
    radiusX = 0,
    radiusY = 0
  if (boundingShape && boundingShape.type === 'ellipse') {
    centerX = boundingShape.x + boundingShape.width / 2
    centerY = boundingShape.y + boundingShape.height / 2
    radiusX = boundingShape.width / 2
    radiusY = boundingShape.height / 2
  }

  // For each row, find the leftmost and rightmost detected pixels
  // Then fill everything in between
  for (let y = minY; y <= maxY; y++) {
    let leftmost = width
    let rightmost = -1

    // Find horizontal span of detected pixels in this row
    const rowStart = y * width
    for (let x = minX; x <= maxX; x++) {
      if (detectedArea[rowStart + x]) {
        leftmost = Math.min(leftmost, x)
        rightmost = Math.max(rightmost, x)
      }
    }

    // Fill everything between leftmost and rightmost
    if (rightmost >= leftmost) {
      for (let x = leftmost; x <= rightmost; x++) {
        // Check if pixel is within shape boundary (ellipse)
        if (boundingShape && boundingShape.type === 'ellipse') {
          const normalizedX = (x - centerX) / radiusX
          const normalizedY = (y - centerY) / radiusY
          if (normalizedX * normalizedX + normalizedY * normalizedY > 1) {
            continue
          }
        }

        const index = rowStart + x
        if (!expandedArray[index]) {
          const idx = index * channels
          const r = pixels[idx]
          const g = pixels[idx + 1]
          const b = pixels[idx + 2]
          const brightness = (r + g + b) / 3

          // Exclude only PURE black pixels (the frame edge)
          if (
            brightness >= parameters.minimumBrightness
            || r > parameters.minimumColorChannels
            || g > parameters.minimumColorChannels
            || b > parameters.minimumColorChannels
          ) {
            expandedArray[index] = 1
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
      const index = y * width + x
      if (expandedArray[index]) {
        topmost = Math.min(topmost, y)
        bottommost = Math.max(bottommost, y)
      }
    }

    // Fill everything between topmost and bottommost
    if (bottommost >= topmost) {
      for (let y = topmost; y <= bottommost; y++) {
        // Check if pixel is within shape boundary (ellipse)
        if (boundingShape && boundingShape.type === 'ellipse') {
          const normalizedX = (x - centerX) / radiusX
          const normalizedY = (y - centerY) / radiusY
          if (normalizedX * normalizedX + normalizedY * normalizedY > 1) {
            continue
          }
        }

        const index = y * width + x
        if (!expandedArray[index]) {
          const idx = index * channels
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
            expandedArray[index] = 1
          }
        }
      }
    }
  }

  return expandedArray
}

/**
 * Enhanced main processing function that supports both rectangles and ellipses
 * Creates transparent areas in an image based on seed points and shape selections
 *
 * @param maxDimension - Maximum dimension for downscaling (default: DESKTOP_DOWNSCALE_THRESHOLD)
 */
export async function makeInnerTransparentWithShapes(
  inputImageUrl: string,
  shapeSelections: ShapeSelection[],
  parameters: ProcessingParameters,
  featherRadius: number = 2,
  maxDimension: number = IMAGE_DIMENSIONS.DESKTOP_DOWNSCALE_THRESHOLD
): Promise<ProcessingResult> {
  let workingCanvas: HTMLCanvasElement | null = null
  let processedCanvas: HTMLCanvasElement | null = null

  try {
    // Load image with downscaling to prevent memory spike
    const loadResult = await loadImageToCanvas(inputImageUrl, maxDimension)
    workingCanvas = loadResult.canvas
    const originalWidth = loadResult.originalWidth
    const originalHeight = loadResult.originalHeight

    // Calculate scale factor for coordinate adjustments
    const scale = workingCanvas.width / originalWidth

    // Scale processing inputs if downscaling was applied
    const { scaledShapeSelections } = scaleProcessingInputs(shapeSelections, scale)

    // Get image data from working canvas (potentially downscaled)
    const originalImageData = getImageDataFromCanvas(workingCanvas)

    const originalPixels = originalImageData.data
    const channels = 4 // RGBA
    const width = originalImageData.width
    const height = originalImageData.height

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
        const vectorArea = processVectorShapesWithEvenOdd(
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
    const modifiedPixels = new Uint8ClampedArray(originalPixels)
    allTransparentAreas.forEach(key => {
      const [x, y] = key.split(',').map(Number)
      const pixelIndex = (y * width + x) * channels
      if (pixelIndex + 3 < modifiedPixels.length) {
        modifiedPixels[pixelIndex + 3] = 0 // Set alpha to 0 (fully transparent)
      }
    })

    // Create new ImageData with modified pixels
    const processedImageData = createImageData(modifiedPixels, width, height)

    // Cleanup working canvas immediately after getting image data (no longer needed)
    if (workingCanvas) {
      workingCanvas.width = 0
      workingCanvas.height = 0
      workingCanvas = null
    }

    // Create a new canvas for the processed image
    processedCanvas = document.createElement('canvas')
    processedCanvas.width = width
    processedCanvas.height = height
    putImageDataToCanvas(processedCanvas, processedImageData)

    // No upscaling - keep result at processed dimensions
    // The composite canvas will scale the original image to match instead

    // Convert to blob
    const processedImageBuffer = await canvasToBlob(processedCanvas, 'image/png')

    // Detect transparent areas for response, passing shapes to inherit rotation
    let transparentAreas: TransparentArea[] = []
    try {
      transparentAreas = await detectTransparentAreas(
        processedCanvas,
        parameters.minAreaSize,
        parameters.keepOnlyLargestArea,
        scaledShapeSelections
      )
    } catch (detectionError) {
      console.warn('Failed to detect transparent areas:', detectionError)
    }

    // Cleanup final processed canvas
    if (processedCanvas) {
      processedCanvas.width = 0
      processedCanvas.height = 0
      processedCanvas = null
    }

    return {
      processedImageBuffer,
      transparentCount: allTransparentAreas.size,
      transparentAreas,
      // Include dimension info for composite canvas scaling
      processedWidth: width,
      processedHeight: height,
      originalWidth,
      originalHeight,
      scale,
    }
  } catch (error) {
    // Cleanup canvases on error
    try {
      if (workingCanvas) {
        workingCanvas.width = 0
        workingCanvas.height = 0
        workingCanvas = null
      }
    } catch (e) {
      /* ignore cleanup errors */
    }

    try {
      if (processedCanvas) {
        processedCanvas.width = 0
        processedCanvas.height = 0
        processedCanvas = null
      }
    } catch (e) {
      /* ignore cleanup errors */
    }

    console.error('Error in makeInnerTransparentWithShapes:', error)
    throw error
  }
}

function processRectangularSelection(
  originalPixels: Uint8ClampedArray,
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
  const isBackground = (r: number, g: number, b: number): boolean => {
    for (const bg of backgroundPixels) {
      const distance = Math.sqrt(Math.pow(r - bg.r, 2) + Math.pow(g - bg.g, 2) + Math.pow(b - bg.b, 2))
      if (distance < parameters.backgroundMatchThreshold) {
        return true
      }
    }
    return false
  }

  // Helper: Check if directly adjacent to background (immediate neighbors only)
  const isDirectlyAdjacentToBackground = (
    x: number,
    y: number,
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    channels: number
  ): boolean => {
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

  // Make entire shape transparent when fallback is enabled (use original bounds, not margin-inset)
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

/**
 * Process a single seed point without shape boundaries
 */
/**
 * Expand boundary of detected area
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function expandBoundary(
  originalPixels: Uint8ClampedArray,
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
  originalPixels: Uint8ClampedArray,
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
 * Process a vector shape selection using Path2D containment
 */
function processVectorSelection(
  originalPixels: Uint8ClampedArray,
  width: number,
  height: number,
  channels: number,
  shape: VectorShape,
  parameters: ProcessingParameters
): Set<string> {
  const transparentArea = new Set<string>()
  const path2D = buildVectorPath2D(shape)
  const hitCanvas = new OffscreenCanvas(1, 1)
  const hitCtx = hitCanvas.getContext('2d')
  if (!hitCtx) return transparentArea

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
      if (!hitCtx.isPointInPath(path2D, x, y)) continue

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
 * OPTIMIZED: Process a vector shape selection - returns Uint8Array
 */
function processVectorSelectionOptimized(
  originalPixels: Uint8ClampedArray,
  width: number,
  height: number,
  channels: number,
  shape: VectorShape,
  parameters: ProcessingParameters
): Uint8Array {
  return processVectorShapesWithEvenOddOptimized(originalPixels, width, height, channels, [shape], parameters)
}

/**
 * Process multiple vector shapes together using even-odd fill rule (Uint8Array).
 * Nested paths create holes: outer path = transparent, inner path = opaque, etc.
 */
function processVectorShapesWithEvenOddOptimized(
  originalPixels: Uint8ClampedArray,
  width: number,
  height: number,
  channels: number,
  shapes: VectorShape[],
  parameters: ProcessingParameters
): Uint8Array {
  const transparentArea = new Uint8Array(width * height)
  if (shapes.length === 0) return transparentArea

  // Build compound Path2D from all vector shapes
  const compoundPath = new Path2D()
  for (const shape of shapes) {
    compoundPath.addPath(buildVectorPath2D(shape))
  }

  const hitCanvas = new OffscreenCanvas(1, 1)
  const hitCtx = hitCanvas.getContext('2d')
  if (!hitCtx) return transparentArea

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
      // Even-odd fill rule: nested paths create holes
      if (!hitCtx.isPointInPath(compoundPath, x, y, 'evenodd')) continue

      if (parameters.fallbackToFullTransparency) {
        transparentArea[y * width + x] = 1
      } else {
        const idx = (y * width + x) * channels
        const r = originalPixels[idx]
        const g = originalPixels[idx + 1]
        const b = originalPixels[idx + 2]
        const dist = Math.sqrt((r - centerR) ** 2 + (g - centerG) ** 2 + (b - centerB) ** 2)
        if (dist < parameters.centerSimilarityThreshold) {
          transparentArea[y * width + x] = 1
        }
      }
    }
  }

  return transparentArea
}

/**
 * Process multiple vector shapes together using even-odd fill rule (Set<string>).
 * Nested paths create holes: outer path = transparent, inner path = opaque, etc.
 */
function processVectorShapesWithEvenOdd(
  originalPixels: Uint8ClampedArray,
  width: number,
  height: number,
  channels: number,
  shapes: VectorShape[],
  parameters: ProcessingParameters
): Set<string> {
  const transparentArea = new Set<string>()
  if (shapes.length === 0) return transparentArea

  // Build compound Path2D from all vector shapes
  const compoundPath = new Path2D()
  for (const shape of shapes) {
    compoundPath.addPath(buildVectorPath2D(shape))
  }

  const hitCanvas = new OffscreenCanvas(1, 1)
  const hitCtx = hitCanvas.getContext('2d')
  if (!hitCtx) return transparentArea

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
      if (!hitCtx.isPointInPath(compoundPath, x, y, 'evenodd')) continue

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
 */
function processShapeSelection(
  originalPixels: Uint8ClampedArray,
  width: number,
  height: number,
  channels: number,
  shape: ShapeSelection,
  parameters: ProcessingParameters
): Set<string> {
  if (shape.type === 'ellipse') {
    return processEllipseSelection(originalPixels, width, height, channels, shape, parameters)
  }
  if (shape.type === 'vector') {
    return processVectorSelection(originalPixels, width, height, channels, shape as VectorShape, parameters)
  }
  return processRectangularSelection(originalPixels, width, height, channels, shape, parameters)
}

/**
 * OPTIMIZED: Process any shape selection (rectangle or ellipse) - returns Uint8Array for 20× faster performance
 * Supports rotation by processing the rotated bounding box and checking each pixel
 */
function processShapeSelectionOptimized(
  originalPixels: Uint8ClampedArray,
  width: number,
  height: number,
  channels: number,
  shape: ShapeSelection,
  parameters: ProcessingParameters
): Uint8Array {
  const rotation = shape.rotation || 0

  // Vector shapes: no rotation support, use dedicated function
  if (shape.type === 'vector') {
    return processVectorSelectionOptimized(originalPixels, width, height, channels, shape as VectorShape, parameters)
  }

  // Fast path: no rotation, use original optimized functions
  if (rotation === 0) {
    if (shape.type === 'ellipse') {
      return processEllipseSelectionOptimized(originalPixels, width, height, channels, shape, parameters)
    }
    return processRectangularSelectionOptimized(originalPixels, width, height, channels, shape, parameters)
  }

  // Rotated shape: process using rotation-aware logic
  return processRotatedShapeSelection(originalPixels, width, height, channels, shape, parameters)
}

/**
 * Process a rotated shape selection by iterating over its rotated bounding box
 * and checking if each pixel falls within the rotated shape
 */
function processRotatedShapeSelection(
  originalPixels: Uint8ClampedArray,
  width: number,
  height: number,
  channels: number,
  shape: ShapeSelection,
  parameters: ProcessingParameters
): Uint8Array {
  const transparentArea = new Uint8Array(width * height)
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
        // Vector shapes use Path2D containment (no rotation transform needed)
        isInsideShape = isPointInVectorShapeClient(x, y, shape as VectorShape)
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
          const pixelIndex = y * width + x
          transparentArea[pixelIndex] = 1
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
            const pixelIndex = y * width + x
            transparentArea[pixelIndex] = 1
          }
        }
      }
    }
  }

  return transparentArea
}

/**
 * OPTIMIZED: Process rectangular selection - returns Uint8Array for 20× faster performance
 */
function processRectangularSelectionOptimized(
  originalPixels: Uint8ClampedArray,
  width: number,
  height: number,
  channels: number,
  shape: ShapeSelection,
  parameters: ProcessingParameters
): Uint8Array {
  if (shape.type !== 'rectangle') {
    throw new Error('Expected rectangle shape')
  }

  const { x: rectX, y: rectY, width: rectW, height: rectH } = shape
  const transparentArea = new Uint8Array(width * height)

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
  const isBackground = (r: number, g: number, b: number): boolean => {
    for (const bg of backgroundPixels) {
      const distance = Math.sqrt(Math.pow(r - bg.r, 2) + Math.pow(g - bg.g, 2) + Math.pow(b - bg.b, 2))
      if (distance < parameters.backgroundMatchThreshold) {
        return true
      }
    }
    return false
  }

  // Helper: Check if directly adjacent to background (immediate neighbors only)
  const isDirectlyAdjacentToBackground = (x: number, y: number): boolean => {
    const neighbors: [number, number][] = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue

      const nIdx = (ny * width + nx) * channels
      const nr = originalPixels[nIdx]
      const ng = originalPixels[nIdx + 1]
      const nb = originalPixels[nIdx + 2]

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
      if (isDirectlyAdjacentToBackground(x, y)) {
        continue
      }

      // Rule 3: Check similarity to center
      const distanceFromCenter = Math.sqrt(
        Math.pow(r - centerR, 2) + Math.pow(g - centerG, 2) + Math.pow(b - centerB, 2)
      )

      // Make transparent if similar to center (lenient threshold)
      if (distanceFromCenter < parameters.centerSimilarityThreshold) {
        const pixelIndex = y * width + x
        transparentArea[pixelIndex] = 1
      }
    }
  }

  // Step 5: Fill interior gaps
  if (parameters.interiorGapFilling) {
    for (let y = innerStartY; y < innerEndY; y++) {
      let leftmost = innerEndX
      let rightmost = innerStartX

      const rowStart = y * width
      for (let x = innerStartX; x < innerEndX; x++) {
        if (transparentArea[rowStart + x]) {
          leftmost = Math.min(leftmost, x)
          rightmost = Math.max(rightmost, x)
        }
      }

      if (rightmost >= leftmost) {
        for (let x = leftmost; x <= rightmost; x++) {
          const pixelIndex = rowStart + x
          if (!transparentArea[pixelIndex]) {
            const idx = pixelIndex * channels
            const r = originalPixels[idx]
            const g = originalPixels[idx + 1]
            const b = originalPixels[idx + 2]

            // Fill if not background and not directly adjacent to background
            if (!isBackground(r, g, b) && !isDirectlyAdjacentToBackground(x, y)) {
              transparentArea[pixelIndex] = 1
            }
          }
        }
      }
    }
  }

  // When fallback is enabled, make entire shape transparent (use original bounds, not margin-inset)
  if (parameters.fallbackToFullTransparency) {
    for (let y = rectY; y < rectY + rectH; y++) {
      const rowStart = y * width
      for (let x = rectX; x < rectX + rectW; x++) {
        transparentArea[rowStart + x] = 1
      }
    }
  }

  return transparentArea
}

/**
 * OPTIMIZED: Process ellipse selection - returns Uint8Array for 20× faster performance
 */
function processEllipseSelectionOptimized(
  originalPixels: Uint8ClampedArray,
  width: number,
  height: number,
  channels: number,
  ellipse: ShapeSelection,
  parameters: ProcessingParameters
): Uint8Array {
  if (ellipse.type !== 'ellipse') {
    throw new Error('Expected ellipse shape')
  }

  const transparentArea = new Uint8Array(width * height)

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
    return transparentArea
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
        const pixelIndex = y * width + x
        const idx = pixelIndex * channels
        const r = originalPixels[idx]
        const g = originalPixels[idx + 1]
        const b = originalPixels[idx + 2]

        // Calculate color similarity to center
        const colorDiff = Math.abs(r - centerR) + Math.abs(g - centerG) + Math.abs(b - centerB)
        const colorSimilarity = Math.max(0, 100 - colorDiff / 7.65) // Normalize to 0-100%

        if (colorSimilarity >= parameters.centerSimilarityThreshold) {
          // Check if this pixel is different enough from background
          const pixelBrightness = (r + g + b) / 3
          const brightnessDiff = Math.abs(pixelBrightness - centerBrightness)

          if (brightnessDiff >= parameters.centerBackgroundThreshold) {
            transparentArea[pixelIndex] = 1
          }
        }
      }
    }
  }

  // When fallback is enabled, make entire ellipse transparent (use original radius, not margin-reduced)
  if (parameters.fallbackToFullTransparency) {
    for (let y = Math.max(0, Math.floor(ellipse.y)); y < Math.min(height, Math.ceil(ellipse.y + ellipse.height)); y++) {
      for (let x = Math.max(0, Math.floor(ellipse.x)); x < Math.min(width, Math.ceil(ellipse.x + ellipse.width)); x++) {
        const normalizedX = (x - centerX) / radiusX
        const normalizedY = (y - centerY) / radiusY
        if (normalizedX * normalizedX + normalizedY * normalizedY <= 1) {
          transparentArea[y * width + x] = 1
        }
      }
    }
  }

  return transparentArea
}

/**
 * Find which shape contains a given point (centroid) and return its rotation, dimensions,
 * type, and pathCommands (for vector shapes).
 * Uses axis-aligned bounding box check for simplicity.
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
 * Detect transparent areas in processed image Canvas and return bounding boxes
 * @param shapes - Optional shapes to inherit rotation from
 */
export async function detectTransparentAreas(
  processedCanvas: HTMLCanvasElement,
  minAreaSize: number = 100,
  keepOnlyLargestArea: boolean = false,
  shapes?: ShapeSelection[]
): Promise<TransparentArea[]> {
  try {
    // Get raw RGBA data from canvas
    const imageData = getImageDataFromCanvas(processedCanvas)
    const pixels = imageData.data
    const width = imageData.width
    const height = imageData.height

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
  pixels: Uint8ClampedArray,
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
 * Convert Canvas to base64 data URL
 */
export function convertImageToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png')
}

/**
 * Upload processed image blob via multipart form data to the API endpoint
 */
export async function uploadProcessedImageViaAPI(
  imageBlob: Blob,
  fileName: string
): Promise<{ url: string; id: string } | null> {
  try {
    // Create a File object from the blob
    // Preserve the blob's actual MIME type (e.g. image/svg+xml for SVG with embedded filters)
    const mimeType = imageBlob.type || 'image/png'
    const file = new File([imageBlob], fileName, { type: mimeType })

    // Create FormData for multipart upload
    const formData = new FormData()
    formData.append('files', file)
    formData.append('fileUploadType', 'image') // Match the expected parameter

    // Make the API call
    const response = await fetch(`/api/templates?action=${TEMPLATES_ACTIONS.UPLOAD_FILES}`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(`Upload failed: ${result.message || 'Unknown error'}`)
    }

    // Extract the upload result from the API response
    const { data } = result
    if (data && data.uploadedFiles && data.uploadedFiles.length > 0) {
      const uploadedFile = data.uploadedFiles[0]
      return {
        url: uploadedFile.image?.originalSrc || uploadedFile.url,
        id: uploadedFile.id || `processed-${Date.now()}`,
      }
    }

    throw new Error('No files were uploaded')
  } catch (error) {
    console.error('Error in uploadProcessedImageViaAPI:', error)
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
 * Process image and optionally upload via API
 */
export async function processMockupMask(
  inputImageUrl: string,
  shapeSelections: ShapeSelection[],
  parameters: ProcessingParameters,
  options: {
    uploadViaAPI?: boolean
    fileName?: string
    featherRadius?: number
    maxDimension?: number
  } = {}
): Promise<{
  processedImageBuffer: Blob
  processedImageUrl?: string
  transparentCount: number
  transparentAreas?: TransparentArea[]
  processedWidth?: number
  processedHeight?: number
  originalWidth?: number
  originalHeight?: number
  scale?: number
}> {
  // Process the image
  const {
    processedImageBuffer,
    transparentCount,
    processedWidth,
    processedHeight,
    originalWidth,
    originalHeight,
    scale,
  } = await makeInnerTransparent(
    inputImageUrl,
    shapeSelections,
    parameters,
    options.featherRadius || 2,
    options.maxDimension
  )

  // Create an image from the blob to draw on canvas
  const processedImageUrl = URL.createObjectURL(processedImageBuffer)
  let processedCanvas: HTMLCanvasElement | null = null

  try {
    // Don't downscale here - we need the full processed image for area detection
    const loadResult = await loadImageToCanvas(processedImageUrl, undefined)
    processedCanvas = loadResult.canvas

    // Scale shape selections to match processed dimensions for rotation inheritance
    const scaledShapes
      = scale !== undefined && scale !== 1
        ? shapeSelections.map(shape => {
            const scaled = {
              ...shape,
              x: Math.round(shape.x * scale),
              y: Math.round(shape.y * scale),
              width: Math.round(shape.width * scale),
              height: Math.round(shape.height * scale),
            }
            // Vector shapes: also scale pathCommands so inscribed rect is in correct space
            if (shape.type === 'vector') {
              const vectorShape = shape as VectorShape
              const scaledCommands = scalePathCommands(vectorShape.pathCommands, scale)
              return { ...scaled, pathCommands: scaledCommands, pathD: serializePathCommandsToD(scaledCommands) }
            }
            return scaled
          })
        : shapeSelections

    // Detect transparent areas, passing shapes to inherit rotation
    const transparentAreas = await detectTransparentAreas(
      processedCanvas,
      parameters.minAreaSize,
      parameters.keepOnlyLargestArea,
      scaledShapes
    )

    const result: {
      processedImageBuffer: Blob
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

    if (options.uploadViaAPI && options.fileName) {
      // Upload via API
      const uploadResult = await uploadProcessedImageViaAPI(processedImageBuffer, options.fileName)

      if (uploadResult) {
        result.processedImageUrl = uploadResult.url
      }
    } else {
      // Return as Base64 data URL
      result.processedImageUrl = convertImageToDataUrl(processedCanvas)
    }

    return result
  } finally {
    // Clean up resources
    URL.revokeObjectURL(processedImageUrl)

    if (processedCanvas) {
      processedCanvas.width = 0
      processedCanvas.height = 0
    }
  }
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
