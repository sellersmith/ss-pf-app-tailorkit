import type { BaseShape, ShapeSelection, RectangularShape, EllipseShape } from '../types'
import { CANVAS_CONSTANTS } from '../constants'

// Import from shared geometry utilities
import {
  isPointInRect as sharedIsPointInRect,
  isPointInEllipse as sharedIsPointInEllipse,
} from '~/utils/geometry/point-in-shape'

// Import HandleType for local use
import type { HandleType } from '~/types/shape-handles'

// Re-export shared types for backward compatibility
export type { HandleType, HandlePosition, HandlePositions, ShapeManipulationState } from '~/types/shape-handles'

/**
 * Enhanced shape manipulation utilities supporting both rectangles and ellipses
 *
 * Uses shared geometry utilities from ~/utils/geometry/ for core calculations.
 * @see ~/utils/geometry/point-in-shape.ts
 * @see ~/types/shape-handles.ts
 */

// Using constants from centralized constants file
const { HANDLE_SIZE, HANDLE_HOVER_SIZE, HANDLE_DETECTION_MULTIPLIER, MIN_SHAPE_SIZE, EDGE_THRESHOLD } = CANVAS_CONSTANTS

/**
 * Local interface for handle positions specific to VectorWizard
 */
interface HandlePositions {
  nw: { x: number; y: number; type: HandleType }
  ne: { x: number; y: number; type: HandleType }
  sw: { x: number; y: number; type: HandleType }
  se: { x: number; y: number; type: HandleType }
  n: { x: number; y: number; type: HandleType }
  s: { x: number; y: number; type: HandleType }
  e: { x: number; y: number; type: HandleType }
  w: { x: number; y: number; type: HandleType }
}

/**
 * Create a rectangular shape
 */
export function createRectangularShape(
  x: number,
  y: number,
  width: number,
  height: number,
  source: 'manual' | 'auto-detected' | 'deleted-auto-detected' = 'manual'
): RectangularShape {
  return {
    type: 'rectangle',
    x,
    y,
    width,
    height,
    source,
  }
}

/**
 * Create an ellipse shape
 */
export function createEllipseShape(
  x: number,
  y: number,
  width: number,
  height: number,
  source: 'manual' | 'auto-detected' | 'deleted-auto-detected' = 'manual'
): EllipseShape {
  return {
    type: 'ellipse',
    x,
    y,
    width,
    height,
    source,
  }
}

/**
 * Convert a base shape to a specific shape type
 */
export function convertToShapeType(shape: BaseShape, type: 'rectangle' | 'ellipse'): ShapeSelection {
  if (type === 'ellipse') {
    return { ...shape, type: 'ellipse' } as EllipseShape
  }
  return { ...shape, type: 'rectangle' } as RectangularShape
}

/**
 * Check if a point is inside a shape
 */
export function isPointInShape(x: number, y: number, shape: ShapeSelection): boolean {
  if (shape.type === 'ellipse') {
    return isPointInEllipse(x, y, shape)
  }
  return sharedIsPointInRect(x, y, shape)
}

/**
 * Check if a point is inside an ellipse
 * Uses shared implementation with VectorWizard-specific rounding
 */
export function isPointInEllipse(x: number, y: number, shape: BaseShape): boolean {
  return sharedIsPointInEllipse(x, y, shape)
}

/**
 * Calculate handle positions for any shape
 */
export function getShapeHandles(shape: ShapeSelection, scale: number = 1, isMobile: boolean = false): HandlePositions {
  // Return handle center positions - the drawing function will handle the offset
  return {
    nw: { x: shape.x, y: shape.y, type: 'nw' },
    ne: { x: shape.x + shape.width, y: shape.y, type: 'ne' },
    sw: { x: shape.x, y: shape.y + shape.height, type: 'sw' },
    se: { x: shape.x + shape.width, y: shape.y + shape.height, type: 'se' },
    n: { x: shape.x + shape.width / 2, y: shape.y, type: 'n' },
    s: { x: shape.x + shape.width / 2, y: shape.y + shape.height, type: 's' },
    e: { x: shape.x + shape.width, y: shape.y + shape.height / 2, type: 'e' },
    w: { x: shape.x, y: shape.y + shape.height / 2, type: 'w' },
  }
}

/**
 * Check if a point is within a handle
 */
export function isPointInHandle(
  x: number,
  y: number,
  handle: { x: number; y: number; type: HandleType },
  isHovered = false,
  scale = 1,
  isMobile = false
): boolean {
  const baseSize = isMobile
    ? isHovered
      ? CANVAS_CONSTANTS.MOBILE_HANDLE_HOVER_SIZE
      : CANVAS_CONSTANTS.MOBILE_HANDLE_SIZE
    : isHovered
      ? HANDLE_HOVER_SIZE
      : HANDLE_SIZE
  // Increase detection area to ensure handles take priority over edge detection
  const multiplier = isMobile ? CANVAS_CONSTANTS.MOBILE_HANDLE_DETECTION_MULTIPLIER : HANDLE_DETECTION_MULTIPLIER
  const size = (baseSize * multiplier) / scale // Scale handle size to remain consistent at all zoom levels
  const halfSize = size / 2

  // Handle positions are now center points, so check around the center
  return x >= handle.x - halfSize && x <= handle.x + halfSize && y >= handle.y - halfSize && y <= handle.y + halfSize
}

/**
 * Get the handle at a specific point, if any
 */
export function getHandleAtPoint(
  x: number,
  y: number,
  shape: ShapeSelection,
  scale = 1,
  isMobile = false
): HandleType | null {
  const handles = getShapeHandles(shape, scale, isMobile)

  // Check handles in order of priority (corners first, then edges)
  const handleOrder: HandleType[] = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w']

  for (const handleType of handleOrder) {
    if (isPointInHandle(x, y, handles[handleType], false, scale, isMobile)) {
      return handleType
    }
  }

  return null
}

/**
 * Update shape based on handle drag
 */
export function updateShapeWithHandle(
  shape: ShapeSelection,
  handle: HandleType,
  deltaX: number,
  deltaY: number
): ShapeSelection {
  const updated = { ...shape }

  switch (handle) {
    case 'nw':
      updated.x += deltaX
      updated.y += deltaY
      updated.width -= deltaX
      updated.height -= deltaY
      break
    case 'ne':
      updated.y += deltaY
      updated.width += deltaX
      updated.height -= deltaY
      break
    case 'sw':
      updated.x += deltaX
      updated.width -= deltaX
      updated.height += deltaY
      break
    case 'se':
      updated.width += deltaX
      updated.height += deltaY
      break
    case 'n':
      updated.y += deltaY
      updated.height -= deltaY
      break
    case 's':
      updated.height += deltaY
      break
    case 'e':
      updated.width += deltaX
      break
    case 'w':
      updated.x += deltaX
      updated.width -= deltaX
      break
  }

  return updated
}

/**
 * Move shape by delta
 */
export function moveShape(shape: ShapeSelection, deltaX: number, deltaY: number): ShapeSelection {
  return {
    ...shape,
    x: shape.x + deltaX,
    y: shape.y + deltaY,
  }
}

/**
 * Validate shape dimensions and position
 */
export function isValidShape(
  shape: ShapeSelection,
  imageWidth: number,
  imageHeight: number,
  minSize = MIN_SHAPE_SIZE
): boolean {
  return (
    shape.width >= minSize
    && shape.height >= minSize
    && shape.x >= 0
    && shape.y >= 0
    && shape.x + shape.width <= imageWidth
    && shape.y + shape.height <= imageHeight
  )
}

/**
 * Constrain shape to stay within bounds and maintain minimum size
 */
export function constrainShape(
  shape: ShapeSelection,
  bounds: { width: number; height: number },
  minSize = MIN_SHAPE_SIZE
): ShapeSelection {
  const constrained = { ...shape }

  // Ensure minimum size
  if (constrained.width < minSize) {
    constrained.width = minSize
  }
  if (constrained.height < minSize) {
    constrained.height = minSize
  }

  // Ensure shape stays within bounds
  if (constrained.x < 0) {
    constrained.x = 0
  }
  if (constrained.y < 0) {
    constrained.y = 0
  }
  if (constrained.x + constrained.width > bounds.width) {
    if (constrained.width <= bounds.width) {
      constrained.x = bounds.width - constrained.width
    } else {
      constrained.x = 0
      constrained.width = bounds.width
    }
  }
  if (constrained.y + constrained.height > bounds.height) {
    if (constrained.height <= bounds.height) {
      constrained.y = bounds.height - constrained.height
    } else {
      constrained.y = 0
      constrained.height = bounds.height
    }
  }

  return constrained
}

/**
 * Get cursor style for handle type
 */
export function getCursorForHandle(handle: HandleType): string {
  switch (handle) {
    case 'nw':
    case 'se':
      return 'nwse-resize'
    case 'ne':
    case 'sw':
      return 'nesw-resize'
    case 'n':
    case 's':
      return 'ns-resize'
    case 'e':
    case 'w':
      return 'ew-resize'
    default:
      return 'default'
  }
}

/**
 * Check if a point is near any edge of a shape
 */
export function isPointNearShapeEdge(
  x: number,
  y: number,
  shape: ShapeSelection,
  threshold: number = EDGE_THRESHOLD,
  scale: number = 1
): boolean {
  const scaledThreshold = threshold / scale // Scale threshold to remain consistent at all zoom levels
  if (shape.type === 'ellipse') {
    return isPointNearEllipseEdge(x, y, shape, scaledThreshold)
  }
  return isPointNearRectangleEdge(x, y, shape, scaledThreshold)
}

/**
 * Check if a point is near any edge of a rectangle
 */
export function isPointNearRectangleEdge(
  x: number,
  y: number,
  shape: BaseShape,
  threshold: number = EDGE_THRESHOLD
): boolean {
  // Check if point is inside the rectangle first
  if (x < shape.x || x > shape.x + shape.width || y < shape.y || y > shape.y + shape.height) {
    return false
  }

  // Check distance to each edge
  const distanceToLeft = x - shape.x
  const distanceToRight = shape.x + shape.width - x
  const distanceToTop = y - shape.y
  const distanceToBottom = shape.y + shape.height - y

  // Return true if close to any edge
  return (
    distanceToLeft <= threshold
    || distanceToRight <= threshold
    || distanceToTop <= threshold
    || distanceToBottom <= threshold
  )
}

/**
 * Check if a point is near the edge of an ellipse
 */
export function isPointNearEllipseEdge(
  x: number,
  y: number,
  shape: BaseShape,
  threshold: number = EDGE_THRESHOLD
): boolean {
  // Round shape coordinates to prevent floating-point precision issues
  const centerX = Math.round(shape.x + shape.width / 2)
  const centerY = Math.round(shape.y + shape.height / 2)
  const radiusX = Math.round(shape.width / 2)
  const radiusY = Math.round(shape.height / 2)

  if (radiusX === 0 || radiusY === 0) return false

  // Round input coordinates as well
  const roundedX = Math.round(x)
  const roundedY = Math.round(y)

  const normalizedX = (roundedX - centerX) / radiusX
  const normalizedY = (roundedY - centerY) / radiusY
  const distanceFromCenter = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY)

  // Calculate threshold as a percentage of the radius
  const thresholdRatio = threshold / Math.min(radiusX, radiusY)

  // Point is near edge if it's close to the ellipse boundary
  return Math.abs(distanceFromCenter - 1) <= thresholdRatio && distanceFromCenter <= 1
}

/**
 * Find the index of a shape that contains a point and is near an edge
 */
export function findShapeAtEdge(
  x: number,
  y: number,
  shapes: ShapeSelection[],
  edgeThreshold = EDGE_THRESHOLD,
  scale = 1
): number | null {
  // Check shapes in reverse order (top-most first)
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (isPointNearShapeEdge(x, y, shapes[i], edgeThreshold, scale)) {
      return i
    }
  }
  return null
}

/**
 * Find the index of a shape that contains a point anywhere within it
 */
export function findShapeAtPoint(x: number, y: number, shapes: ShapeSelection[]): number | null {
  // Check shapes in reverse order (top-most first)
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (isPointInShape(x, y, shapes[i])) {
      return i
    }
  }
  return null
}

/**
 * Check if a point is within a shape OR within any of its resize handles
 * This provides extended boundary detection for ellipses to make corner handles reachable
 */
export function isPointInShapeWithHandles(x: number, y: number, shape: ShapeSelection, scale = 1): boolean {
  // First check if point is inside the shape itself
  if (isPointInShape(x, y, shape)) {
    return true
  }

  // For ellipses, also check if point is within any resize handle area
  if (shape.type === 'ellipse') {
    const handles = getShapeHandles(shape, scale)
    // Check all 8 handles
    for (const handleType of Object.keys(handles) as HandleType[]) {
      if (isPointInHandle(x, y, handles[handleType], false, scale)) {
        return true
      }
    }
  }

  return false
}
