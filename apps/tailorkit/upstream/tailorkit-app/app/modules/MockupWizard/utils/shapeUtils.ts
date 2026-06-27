import type { BaseShape, ShapeSelection, RectangularShape, EllipseShape, VectorShape } from '../types'
import { CANVAS_CONSTANTS } from '../constants'

// Import from shared geometry utilities
import {
  isPointInRect as sharedIsPointInRect,
  isPointInEllipse as sharedIsPointInEllipse,
} from '~/utils/geometry/point-in-shape'
import { rectanglesOverlap } from '~/utils/geometry/bounding-box'
import { serializePathCommandsToD, translatePathCommands, computePathBoundingBox } from './vectorPathUtils'

// Re-export shared utilities for backward compatibility
export { rectanglesOverlap }

// Local wrapper for isPointInRect to maintain backward compatibility with ShapeSelection type
export function isPointInRect(x: number, y: number, rect: ShapeSelection | BaseShape): boolean {
  return sharedIsPointInRect(x, y, rect)
}

/**
 * Enhanced shape manipulation utilities supporting both rectangles and ellipses
 */

export interface HandlePosition {
  x: number
  y: number
  type: HandleType
}

// Resize handles only (excludes rotation)
export type ResizeHandleType = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'

// All handle types including rotation
export type HandleType = ResizeHandleType | 'rotation'

export interface HandlePositions {
  nw: HandlePosition
  ne: HandlePosition
  sw: HandlePosition
  se: HandlePosition
  n: HandlePosition
  s: HandlePosition
  e: HandlePosition
  w: HandlePosition
}

export interface ShapeManipulationState {
  selectedShapeIndex: number | null
  manipulationMode: 'none' | 'move' | 'resize' | 'rotate'
  manipulationHandle: HandleType | null
  dragStartPos: { x: number; y: number } | null
  originalShape: ShapeSelection | null
}

// Using constants from centralized constants file
const { HANDLE_SIZE, HANDLE_HOVER_SIZE, HANDLE_DETECTION_MULTIPLIER, MIN_SHAPE_SIZE, EDGE_THRESHOLD } = CANVAS_CONSTANTS

/**
 * Create a rectangular shape
 */
export function createRectangularShape(
  x: number,
  y: number,
  width: number,
  height: number,
  source: 'manual' = 'manual'
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
  source: 'manual' = 'manual'
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
  if (shape.type === 'vector') {
    return isPointInVectorShape(x, y, shape)
  }
  if (shape.type === 'ellipse') {
    return isPointInEllipse(x, y, shape)
  }
  return isPointInRect(x, y, shape)
}

/**
 * Check if a point is inside a vector shape using Path2D + isPointInPath
 */
let _hitTestCanvas: OffscreenCanvas | null = null
let _hitTestCtx: OffscreenCanvasRenderingContext2D | null = null

function getHitTestContext(): OffscreenCanvasRenderingContext2D {
  if (!_hitTestCtx) {
    _hitTestCanvas = new OffscreenCanvas(1, 1)
    _hitTestCtx = _hitTestCanvas.getContext('2d')!
  }
  return _hitTestCtx
}

export function isPointInVectorShape(x: number, y: number, shape: VectorShape): boolean {
  const pathD = shape.pathD || serializePathCommandsToD(shape.pathCommands)
  const path2D = new Path2D(pathD)
  const ctx = getHitTestContext()
  return ctx.isPointInPath(path2D, x, y, 'evenodd')
}

/**
 * Move a vector shape by translating all path commands
 */
export function moveVectorShape(shape: VectorShape, deltaX: number, deltaY: number): VectorShape {
  const movedCommands = translatePathCommands(shape.pathCommands, deltaX, deltaY)
  const bbox = computePathBoundingBox(movedCommands)
  return {
    ...shape,
    pathCommands: movedCommands,
    pathD: serializePathCommandsToD(movedCommands),
    x: bbox.x,
    y: bbox.y,
    width: bbox.width,
    height: bbox.height,
  }
}

/**
 * Check if a point is inside an ellipse
 * Uses shared implementation
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
  handle: HandlePosition,
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

  // Check resize handles in order of priority (corners first, then edges)
  const handleOrder: ResizeHandleType[] = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w']

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
    case 'rotation':
      return 'grab'
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
    // Check all 8 resize handles
    const resizeHandles: ResizeHandleType[] = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w']
    for (const handleType of resizeHandles) {
      if (isPointInHandle(x, y, handles[handleType], false, scale)) {
        return true
      }
    }
  }

  return false
}

// ============================================
// Rotation Utilities
// ============================================

/**
 * Get the center point of a shape
 */
export function getShapeCenter(shape: ShapeSelection): { x: number; y: number } {
  return {
    x: shape.x + shape.width / 2,
    y: shape.y + shape.height / 2,
  }
}

/**
 * Transform a point from world space to shape's local space (accounting for rotation)
 * Used for hit-testing on rotated shapes
 */
export function transformPointToShapeSpace(x: number, y: number, shape: ShapeSelection): { x: number; y: number } {
  const rotation = shape.rotation || 0
  if (rotation === 0) {
    return { x, y }
  }

  const center = getShapeCenter(shape)
  const radians = -rotation * (Math.PI / 180) // Negative for inverse transformation

  // Translate to center, rotate, translate back
  const dx = x - center.x
  const dy = y - center.y

  const rotatedX = dx * Math.cos(radians) - dy * Math.sin(radians)
  const rotatedY = dx * Math.sin(radians) + dy * Math.cos(radians)

  return {
    x: rotatedX + center.x,
    y: rotatedY + center.y,
  }
}

/**
 * Transform a point from shape's local space to world space
 */
export function transformPointFromShapeSpace(x: number, y: number, shape: ShapeSelection): { x: number; y: number } {
  const rotation = shape.rotation || 0
  if (rotation === 0) {
    return { x, y }
  }

  const center = getShapeCenter(shape)
  const radians = rotation * (Math.PI / 180)

  // Translate to center, rotate, translate back
  const dx = x - center.x
  const dy = y - center.y

  const rotatedX = dx * Math.cos(radians) - dy * Math.sin(radians)
  const rotatedY = dx * Math.sin(radians) + dy * Math.cos(radians)

  return {
    x: rotatedX + center.x,
    y: rotatedY + center.y,
  }
}

/**
 * Get the rotation handle position for a shape
 * Position is above the top-center of the shape, accounting for shape rotation
 */
export function getRotationHandlePosition(
  shape: ShapeSelection,
  scale: number = 1,
  isMobile: boolean = false
): { x: number; y: number } {
  const center = getShapeCenter(shape)
  const rotation = shape.rotation || 0
  const radians = rotation * (Math.PI / 180)

  const offset = isMobile ? CANVAS_CONSTANTS.MOBILE_ROTATION_HANDLE_SIZE + 10 : CANVAS_CONSTANTS.ROTATION_HANDLE_OFFSET
  const scaledOffset = offset / scale

  // Handle is at top-center, offset upward
  // In unrotated space, handle is at (centerX, shape.y - offset)
  const handleLocalX = 0
  const handleLocalY = -(shape.height / 2) - scaledOffset

  // Apply rotation transformation around center
  const handleX = center.x + handleLocalX * Math.cos(radians) - handleLocalY * Math.sin(radians)
  const handleY = center.y + handleLocalX * Math.sin(radians) + handleLocalY * Math.cos(radians)

  return { x: handleX, y: handleY }
}

/**
 * Check if a point is within the rotation handle
 */
export function isPointInRotationHandle(
  x: number,
  y: number,
  shape: ShapeSelection,
  scale: number = 1,
  isMobile: boolean = false
): boolean {
  const handlePos = getRotationHandlePosition(shape, scale, isMobile)
  const handleSize = isMobile ? CANVAS_CONSTANTS.MOBILE_ROTATION_HANDLE_SIZE : CANVAS_CONSTANTS.ROTATION_HANDLE_SIZE
  const radius = handleSize / 2 / scale
  const multiplier = isMobile ? CANVAS_CONSTANTS.MOBILE_HANDLE_DETECTION_MULTIPLIER : HANDLE_DETECTION_MULTIPLIER

  const dx = x - handlePos.x
  const dy = y - handlePos.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  return distance <= radius * multiplier
}

/**
 * Calculate rotation angle from drag position relative to shape center
 * Returns angle in degrees (0-360)
 */
export function calculateRotationFromDrag(dragX: number, dragY: number, shape: ShapeSelection): number {
  const center = getShapeCenter(shape)

  // Calculate angle from center to drag position
  const dx = dragX - center.x
  const dy = dragY - center.y

  // atan2 gives angle in radians, convert to degrees
  // Subtract 90 degrees because handle starts at top (not right)
  let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90

  // Normalize to 0-360 range
  if (angle < 0) angle += 360
  if (angle >= 360) angle -= 360

  return Math.round(angle * 100) / 100 // Round to 2 decimal places
}

/**
 * Rotate a shape by updating its rotation property
 */
export function rotateShape(shape: ShapeSelection, newRotation: number): ShapeSelection {
  // Normalize rotation to 0-360
  let normalizedRotation = newRotation % 360
  if (normalizedRotation < 0) normalizedRotation += 360

  return {
    ...shape,
    rotation: normalizedRotation,
  }
}

/**
 * Check if a point is inside a rotated shape
 */
export function isPointInRotatedShape(x: number, y: number, shape: ShapeSelection): boolean {
  // Vector shapes use Path2D hit testing directly (no rotation transform needed for MVP)
  if (shape.type === 'vector') {
    return isPointInVectorShape(x, y, shape)
  }

  // Transform point to unrotated shape space
  const transformedPoint = transformPointToShapeSpace(x, y, shape)

  if (shape.type === 'ellipse') {
    return isPointInEllipse(transformedPoint.x, transformedPoint.y, shape)
  }
  return isPointInRect(transformedPoint.x, transformedPoint.y, shape)
}

/**
 * Check if a point is near the edge of a rotated shape
 */
export function isPointNearRotatedShapeEdge(
  x: number,
  y: number,
  shape: ShapeSelection,
  threshold: number = EDGE_THRESHOLD,
  scale: number = 1
): boolean {
  // Vector shapes: use bounding box edge detection for move interaction
  if (shape.type === 'vector') {
    const scaledThreshold = threshold / scale
    return isPointNearRectangleEdge(x, y, shape, scaledThreshold)
  }

  // Transform point to unrotated shape space
  const transformedPoint = transformPointToShapeSpace(x, y, shape)
  const scaledThreshold = threshold / scale

  if (shape.type === 'ellipse') {
    return isPointNearEllipseEdge(transformedPoint.x, transformedPoint.y, shape, scaledThreshold)
  }
  return isPointNearRectangleEdge(transformedPoint.x, transformedPoint.y, shape, scaledThreshold)
}

/**
 * Get handle at point for a rotated shape
 * Checks rotation handle first, then resize handles in transformed space
 */
export function getHandleAtPointRotated(
  x: number,
  y: number,
  shape: ShapeSelection,
  scale = 1,
  isMobile = false
): HandleType | null {
  // Check rotation handle first (highest priority, in world space)
  if (isPointInRotationHandle(x, y, shape, scale, isMobile)) {
    return 'rotation'
  }

  // For resize handles, we need to transform the handle positions to world space
  // and check against the original point
  const rotation = shape.rotation || 0

  if (rotation === 0) {
    // No rotation, use standard handle detection
    return getHandleAtPoint(x, y, shape, scale, isMobile)
  }

  // Get handles in local space
  const handles = getShapeHandles(shape, scale, isMobile)
  const handleOrder: Exclude<HandleType, 'rotation'>[] = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w']

  for (const handleType of handleOrder) {
    const localHandle = handles[handleType]
    // Transform handle position to world space
    const worldHandle = transformPointFromShapeSpace(localHandle.x, localHandle.y, shape)
    const tempHandle: HandlePosition = { x: worldHandle.x, y: worldHandle.y, type: handleType }

    if (isPointInHandle(x, y, tempHandle, false, scale, isMobile)) {
      return handleType
    }
  }

  return null
}
