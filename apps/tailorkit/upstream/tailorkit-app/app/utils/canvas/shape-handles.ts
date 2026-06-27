/**
 * Shape Handle Utilities
 *
 * Functions for calculating handle positions, hit-testing handles,
 * and manipulating shapes via handles.
 */

import type { BaseShape } from '~/types/geometry'
import type { HandleType, HandlePosition, HandlePositions, HandleOptions } from '~/types/shape-handles'
import { CANVAS_INTERACTION } from '~/constants/canvas-interaction'

const {
  HANDLE_SIZE,
  HANDLE_HOVER_SIZE,
  HANDLE_DETECTION_MULTIPLIER,
  MIN_SHAPE_SIZE,
  MOBILE_HANDLE_SIZE,
  MOBILE_HANDLE_HOVER_SIZE,
  MOBILE_HANDLE_DETECTION_MULTIPLIER,
} = CANVAS_INTERACTION

/**
 * Calculate handle positions for a shape
 *
 * @param shape - Shape to calculate handles for
 * @param scale - Zoom scale factor (default: 1)
 * @param isMobile - Whether device is mobile (default: false)
 * @returns Handle positions for all 8 handles
 */
export function getShapeHandles(shape: BaseShape, scale: number = 1, isMobile: boolean = false): HandlePositions {
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
 * Check if a point is within a handle's hit area
 *
 * @param x - Point X coordinate
 * @param y - Point Y coordinate
 * @param handle - Handle position to check
 * @param isHovered - Whether handle is currently hovered (uses larger size)
 * @param scale - Zoom scale factor
 * @param isMobile - Whether device is mobile
 * @returns True if point is within handle area
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
      ? MOBILE_HANDLE_HOVER_SIZE
      : MOBILE_HANDLE_SIZE
    : isHovered
      ? HANDLE_HOVER_SIZE
      : HANDLE_SIZE

  const multiplier = isMobile ? MOBILE_HANDLE_DETECTION_MULTIPLIER : HANDLE_DETECTION_MULTIPLIER
  const size = (baseSize * multiplier) / scale
  const halfSize = size / 2

  return x >= handle.x - halfSize && x <= handle.x + halfSize && y >= handle.y - halfSize && y <= handle.y + halfSize
}

/**
 * Get the handle at a specific point, if any
 *
 * @param x - Point X coordinate
 * @param y - Point Y coordinate
 * @param shape - Shape to check handles for
 * @param scale - Zoom scale factor
 * @param isMobile - Whether device is mobile
 * @returns Handle type if point is within a handle, null otherwise
 */
export function getHandleAtPoint(
  x: number,
  y: number,
  shape: BaseShape,
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
 * Update shape dimensions based on handle drag
 *
 * @param shape - Original shape
 * @param handle - Handle being dragged
 * @param deltaX - Change in X position
 * @param deltaY - Change in Y position
 * @returns Updated shape
 */
export function updateShapeWithHandle<T extends BaseShape>(
  shape: T,
  handle: HandleType,
  deltaX: number,
  deltaY: number
): T {
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
 *
 * @param shape - Shape to move
 * @param deltaX - Change in X position
 * @param deltaY - Change in Y position
 * @returns Moved shape
 */
export function moveShape<T extends BaseShape>(shape: T, deltaX: number, deltaY: number): T {
  return {
    ...shape,
    x: shape.x + deltaX,
    y: shape.y + deltaY,
  }
}

/**
 * Get cursor style for a handle type
 *
 * @param handle - Handle type
 * @returns CSS cursor value
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
 * Validate shape dimensions and position against bounds
 *
 * @param shape - Shape to validate
 * @param bounds - Container bounds
 * @param minSize - Minimum allowed size (default: MIN_SHAPE_SIZE)
 * @returns True if shape is valid
 */
export function isValidShape(
  shape: BaseShape,
  bounds: { width: number; height: number },
  minSize = MIN_SHAPE_SIZE
): boolean {
  return (
    shape.width >= minSize
    && shape.height >= minSize
    && shape.x >= 0
    && shape.y >= 0
    && shape.x + shape.width <= bounds.width
    && shape.y + shape.height <= bounds.height
  )
}

// Re-export types for convenience
export type { HandleType, HandlePosition, HandlePositions, HandleOptions }
