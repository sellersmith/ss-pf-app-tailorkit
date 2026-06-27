/**
 * Rotation transformation utilities
 *
 * Pure geometry functions for transforming points between coordinate spaces,
 * handling rotation calculations, and managing rotated shapes.
 */

import type { BaseShape, Point } from '~/types/geometry'
import { getShapeCenter } from './point-in-shape'

/**
 * Transform a point from world space to shape's local space (accounting for rotation)
 * Used for hit-testing on rotated shapes
 */
export function transformPointToShapeSpace(x: number, y: number, shape: BaseShape): Point {
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
export function transformPointFromShapeSpace(x: number, y: number, shape: BaseShape): Point {
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
 * Normalize rotation angle to 0-360 range
 */
export function normalizeRotation(rotation: number): number {
  let normalized = rotation % 360
  if (normalized < 0) normalized += 360
  return normalized
}

/**
 * Convert degrees to radians
 */
export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Convert radians to degrees
 */
export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI)
}

/**
 * Calculate rotation angle from a drag position relative to shape center
 * Returns angle in degrees (0-360)
 */
export function calculateRotationFromDrag(dragX: number, dragY: number, shape: BaseShape): number {
  const center = getShapeCenter(shape)

  // Calculate angle from center to drag position
  const dx = dragX - center.x
  const dy = dragY - center.y

  // atan2 gives angle in radians, convert to degrees
  // Subtract 90 degrees because handle starts at top (not right)
  const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90

  // Normalize to 0-360 range
  return normalizeRotation(angle)
}

/**
 * Rotate a point around an origin by a given angle (in degrees)
 */
export function rotatePointAroundOrigin(point: Point, origin: Point, angleDegrees: number): Point {
  const radians = degreesToRadians(angleDegrees)

  const dx = point.x - origin.x
  const dy = point.y - origin.y

  return {
    x: origin.x + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: origin.y + dx * Math.sin(radians) + dy * Math.cos(radians),
  }
}

// Re-export getShapeCenter for convenience
export { getShapeCenter } from './point-in-shape'
