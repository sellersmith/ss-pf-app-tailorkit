import type { DetectedShape, ShapeSelection, ShapeDetectionStats } from '../types'

// Import from shared geometry utilities
import { rectanglesOverlap as sharedRectanglesOverlap } from '~/utils/geometry/bounding-box'
import { isPointInRect as sharedIsPointInRect } from '~/utils/geometry/point-in-shape'

/**
 * Shape detection utilities - Solid color area detection approach
 */

// Detection parameters
const MIN_SHAPE_AREA = 8000 // Minimum area for detected shapes
const MAX_SHAPES = 6 // Maximum number of shapes to return
const COLOR_TOLERANCE = 25 // Color similarity tolerance
const MIN_CONFIDENCE = 0.2 // Minimum confidence threshold

// Edge filtering parameters
const ENABLE_EDGE_FILTERING = true // Enable removal of edge-connected areas
const EDGE_CONNECTION_TOLERANCE = COLOR_TOLERANCE // Tolerance for edge connection detection

/**
 * Detect solid color areas using flood fill algorithm
 */
function detectSolidColorAreas(imageData: ImageData): ShapeSelection[] {
  const { data, width, height } = imageData
  const visited = new Array(width * height).fill(false)
  const areas: Array<ShapeSelection & { pixelCount: number; avgColor: [number, number, number] }> = []

  // Helper function to check if two colors are similar
  const colorsAreSimilar = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): boolean => {
    const diff = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
    return diff <= COLOR_TOLERANCE
  }

  // Flood fill to find connected areas of similar color
  const floodFill = (
    startX: number,
    startY: number
  ): (ShapeSelection & { pixelCount: number; avgColor: [number, number, number] }) | null => {
    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return null

    const startIdx = startY * width + startX
    if (visited[startIdx]) return null

    // Get starting color
    const pixelDataIdx = startIdx * 4
    const startR = data[pixelDataIdx]
    const startG = data[pixelDataIdx + 1]
    const startB = data[pixelDataIdx + 2]

    const stack: Array<{ x: number; y: number }> = [{ x: startX, y: startY }]
    let minX = startX,
      maxX = startX,
      minY = startY,
      maxY = startY
    let pixelCount = 0
    let totalR = 0,
      totalG = 0,
      totalB = 0

    while (stack.length > 0) {
      const { x, y } = stack.pop()!
      const idx = y * width + x

      if (x < 0 || x >= width || y < 0 || y >= height || visited[idx]) {
        continue
      }

      const dataIdx = idx * 4
      const r = data[dataIdx]
      const g = data[dataIdx + 1]
      const b = data[dataIdx + 2]

      // Check if this pixel's color is similar to the starting color
      if (!colorsAreSimilar(startR, startG, startB, r, g, b)) {
        continue
      }

      visited[idx] = true
      pixelCount++
      totalR += r
      totalG += g
      totalB += b

      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)

      // Add neighbors
      stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 })
    }

    const area = (maxX - minX + 1) * (maxY - minY + 1)
    const fillRatio = pixelCount / area

    // Only return areas that are substantial and well-filled
    if (area >= MIN_SHAPE_AREA && fillRatio > 0.3 && pixelCount > 1000) {
      const avgColor: [number, number, number] = [
        Math.round(totalR / pixelCount),
        Math.round(totalG / pixelCount),
        Math.round(totalB / pixelCount),
      ]

      return {
        type: 'rectangle' as const,
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        pixelCount,
        avgColor,
      }
    }
    return null
  }

  // Scan for solid color areas with sampling for performance
  for (let y = 0; y < height; y += 8) {
    for (let x = 0; x < width; x += 8) {
      const area = floodFill(x, y)
      if (area) {
        areas.push(area)
      }
    }
  }

  // Sort by area size
  const sortedAreas = areas.sort((a, b) => b.pixelCount - a.pixelCount)

  // Remove areas that fully contain other areas (keep the smaller, more specific ones)
  const filteredAreas = sortedAreas.filter((area, index) => {
    // Check if this area fully contains any other area
    const containsOthers = sortedAreas.some((otherArea, otherIndex) => {
      if (index === otherIndex) return false // Don't compare with itself

      // Check if this area fully contains the other area
      return (
        area.x <= otherArea.x
        && area.y <= otherArea.y
        && area.x + area.width >= otherArea.x + otherArea.width
        && area.y + area.height >= otherArea.y + otherArea.height
      )
    })

    return !containsOthers
  })

  // Filter out edge-connected areas (final step)
  const edgeFilteredAreas = ENABLE_EDGE_FILTERING
    ? filteredAreas.filter(area => {
        const rect = {
          type: 'rectangle' as const,
          x: area.x,
          y: area.y,
          width: area.width,
          height: area.height,
        }

        const isEdgeConnected = isConnectedToEdge(rect, imageData, EDGE_CONNECTION_TOLERANCE)

        return !isEdgeConnected
      })
    : filteredAreas

  // Return top candidates after all filtering
  return edgeFilteredAreas.slice(0, MAX_SHAPES).map(area => ({
    type: 'rectangle' as const,
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
  }))
}

/**
 * Get average color within a rectangular area
 */
function getAverageColorInRect(
  data: Uint8Array,
  width: number,
  height: number,
  rect: ShapeSelection
): [number, number, number] {
  let totalR = 0,
    totalG = 0,
    totalB = 0,
    count = 0

  for (let y = rect.y; y < rect.y + rect.height && y < height; y++) {
    for (let x = rect.x; x < rect.x + rect.width && x < width; x++) {
      const idx = (y * width + x) * 4
      totalR += data[idx]
      totalG += data[idx + 1]
      totalB += data[idx + 2]
      count++
    }
  }

  return count > 0 ? [Math.round(totalR / count), Math.round(totalG / count), Math.round(totalB / count)] : [0, 0, 0]
}

/**
 * Trace if there's a color-similar path between two points
 */
function traceColorConnection(
  data: Uint8Array,
  width: number,
  height: number,
  start: { x: number; y: number },
  end: { x: number; y: number },
  targetColor: [number, number, number],
  tolerance: number
): boolean {
  // Quick distance check - if too far apart, skip detailed tracing
  const distance = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2)
  if (distance > 500) return false // Don't trace very long distances

  const visited = new Set<string>()
  const queue = [start]

  // Use more permissive settings for edge detection
  let iterations = 0
  const maxIterations = Math.min(distance * 3, 2000)

  while (queue.length > 0 && iterations < maxIterations) {
    const { x, y } = queue.shift()!
    const key = `${x},${y}`
    iterations++

    if (visited.has(key) || x < 0 || x >= width || y < 0 || y >= height) continue

    // Check if we're close to the end point
    if (Math.abs(x - end.x) <= 5 && Math.abs(y - end.y) <= 5) {
      return true
    }

    visited.add(key)

    // Get current pixel color
    const idx = (y * width + x) * 4
    const r = data[idx],
      g = data[idx + 1],
      b = data[idx + 2]

    // Use a more flexible color matching approach
    const colorDist = Math.sqrt((r - targetColor[0]) ** 2 + (g - targetColor[1]) ** 2 + (b - targetColor[2]) ** 2)

    // Also check brightness similarity as backup
    const targetBrightness = (targetColor[0] + targetColor[1] + targetColor[2]) / 3
    const currentBrightness = (r + g + b) / 3
    const brightnessDiff = Math.abs(currentBrightness - targetBrightness)

    // Accept pixel if either color is similar OR brightness is similar
    if (colorDist <= tolerance || brightnessDiff <= tolerance * 0.7) {
      // Add neighbors to queue (4-directional)
      queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 })
    }
  }

  return false
}

/**
 * Check if a rectangular area is connected to any edge of the image
 */
function isConnectedToEdge(
  rect: ShapeSelection,
  imageData: ImageData,
  tolerance: number = EDGE_CONNECTION_TOLERANCE
): boolean {
  const { data, width, height } = imageData

  // Get the average color of the rectangle area
  // @ts-ignore
  const avgColor = getAverageColorInRect(data, width, height, rect)

  // Check if rectangle touches or is very close to any edge
  const edgeMargin = 10 // pixels
  const touchesTop = rect.y <= edgeMargin
  const touchesBottom = rect.y + rect.height >= height - edgeMargin
  const touchesLeft = rect.x <= edgeMargin
  const touchesRight = rect.x + rect.width >= width - edgeMargin

  // If rectangle directly touches an edge, it's definitely connected
  if (touchesTop || touchesBottom || touchesLeft || touchesRight) {
    return true
  }

  // For rectangles not directly touching edges, use color tracing
  const edges = [
    // Top edge - sample multiple points along the edge
    {
      name: 'top',
      start: { x: Math.round(rect.x + rect.width / 2), y: 0 },
      end: { x: Math.round(rect.x + rect.width / 2), y: rect.y },
    },
    // Bottom edge
    {
      name: 'bottom',
      start: { x: Math.round(rect.x + rect.width / 2), y: height - 1 },
      end: { x: Math.round(rect.x + rect.width / 2), y: rect.y + rect.height - 1 },
    },
    // Left edge
    {
      name: 'left',
      start: { x: 0, y: Math.round(rect.y + rect.height / 2) },
      end: { x: rect.x, y: Math.round(rect.y + rect.height / 2) },
    },
    // Right edge
    {
      name: 'right',
      start: { x: width - 1, y: Math.round(rect.y + rect.height / 2) },
      end: { x: rect.x + rect.width - 1, y: Math.round(rect.y + rect.height / 2) },
    },
  ]

  // Check each edge for color connection with increased tolerance
  const increasedTolerance = tolerance * 1.5 // Make it more permissive
  for (const edge of edges) {
    // @ts-ignore
    if (traceColorConnection(data, width, height, edge.start, edge.end, avgColor, increasedTolerance)) {
      return true
    }
  }

  return false
}

/**
 * Calculate confidence score for a detected shape
 */
function calculateConfidence(rect: ShapeSelection): number {
  const area = rect.width * rect.height
  const aspectRatio = rect.width / rect.height

  // Higher confidence for larger, more square-like shapes
  const areaScore = Math.min(1, area / 50000)
  const aspectScore = 1 - Math.abs(1 - aspectRatio) * 0.5 // Prefer square-ish shapes

  return Math.min(1, areaScore * 0.7 + aspectScore * 0.3)
}

/**
 * Check if two rectangles overlap
 * Re-exports from shared geometry utilities for backward compatibility
 */
export function rectanglesOverlap(rect1: ShapeSelection, rect2: ShapeSelection): boolean {
  return sharedRectanglesOverlap(rect1, rect2)
}

/**
 * Check if a point is inside a rectangle
 * Re-exports from shared geometry utilities for backward compatibility
 */
export function isPointInRect(x: number, y: number, rect: ShapeSelection): boolean {
  return sharedIsPointInRect(x, y, rect)
}

/**
 * Main shape detection function using solid color area detection
 */
const cachedResults: { [key: string]: { shapes: DetectedShape[]; stats: ShapeDetectionStats } } = {}

export function detectShapes(image: HTMLImageElement): { shapes: DetectedShape[]; stats: ShapeDetectionStats } {
  const startTime = performance.now()

  try {
    if (image.src && cachedResults[image.src]) {
      return cachedResults[image.src]
    }

    // Create canvas to extract image data
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      return { shapes: [], stats: createEmptyStats(performance.now() - startTime) }
    }

    canvas.width = image.width
    canvas.height = image.height
    ctx.drawImage(image, 0, 0)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Detect solid color areas
    const rectangles = detectSolidColorAreas(imageData)

    // Create detected shapes with confidence scores
    const detectedShapes: DetectedShape[] = rectangles.map((rect, index) => ({
      id: `shape-${rect.x}-${rect.y}-${rect.width}-${rect.height}`,
      boundingBox: rect,
      confidence: calculateConfidence(rect),
    }))

    const finalShapes = detectedShapes.filter(shape => shape.confidence > MIN_CONFIDENCE)

    const processingTime = performance.now() - startTime

    const stats: ShapeDetectionStats = {
      edgesFound: 0, // Not applicable for this method
      componentsFound: rectangles.length,
      shapesBeforeFiltering: detectedShapes.length,
      shapesAfterFiltering: finalShapes.length,
      processingTime,
    }

    if (image.src) {
      cachedResults[image.src] = { shapes: finalShapes, stats }
    }

    return { shapes: finalShapes, stats }
  } catch (error) {
    return { shapes: [], stats: createEmptyStats(performance.now() - startTime) }
  }
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
 * Find the largest detected shape by area
 */
export function findLargestShape(detectedShapes: DetectedShape[]): DetectedShape | null {
  if (detectedShapes.length === 0) {
    return null
  }

  return detectedShapes.reduce((largest, current) => {
    const currentArea = current.boundingBox.width * current.boundingBox.height
    const largestArea = largest.boundingBox.width * largest.boundingBox.height
    return currentArea > largestArea ? current : largest
  })
}
