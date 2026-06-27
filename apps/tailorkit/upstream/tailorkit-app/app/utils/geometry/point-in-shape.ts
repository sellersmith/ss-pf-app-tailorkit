/**
 * Point-in-shape detection utilities
 *
 * Pure geometry functions for hit-testing points against shapes.
 * Used by MockupWizard, TemplateEditor, and other canvas-based modules.
 */

import type { BoundingBox, BaseShape, Shape, Point } from '~/types/geometry'

/**
 * Check if a point is inside a rectangle
 */
export function isPointInRect(x: number, y: number, rect: BoundingBox): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
}

/**
 * Check if a point is inside an ellipse
 */
export function isPointInEllipse(x: number, y: number, shape: BaseShape): boolean {
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

  const distance = normalizedX * normalizedX + normalizedY * normalizedY
  return distance <= 1
}

/**
 * Check if a point is inside a shape (rectangle or ellipse)
 */
export function isPointInShape(x: number, y: number, shape: Shape): boolean {
  if (shape.type === 'ellipse') {
    return isPointInEllipse(x, y, shape)
  }
  return isPointInRect(x, y, shape)
}

/**
 * Check if a point is inside a rotated shape
 * Transforms the point to the shape's local space before testing
 */
export function isPointInRotatedShape(x: number, y: number, shape: Shape): boolean {
  const rotation = shape.rotation || 0

  if (rotation === 0) {
    return isPointInShape(x, y, shape)
  }

  // Transform point to unrotated shape space
  const center = getShapeCenter(shape)
  const radians = -rotation * (Math.PI / 180) // Negative for inverse transformation

  const dx = x - center.x
  const dy = y - center.y

  const rotatedX = dx * Math.cos(radians) - dy * Math.sin(radians) + center.x
  const rotatedY = dx * Math.sin(radians) + dy * Math.cos(radians) + center.y

  if (shape.type === 'ellipse') {
    return isPointInEllipse(rotatedX, rotatedY, shape)
  }
  return isPointInRect(rotatedX, rotatedY, shape)
}

/**
 * Get the center point of a shape
 */
export function getShapeCenter(shape: BaseShape): Point {
  return {
    x: shape.x + shape.width / 2,
    y: shape.y + shape.height / 2,
  }
}
