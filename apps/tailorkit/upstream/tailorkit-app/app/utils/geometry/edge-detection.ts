/**
 * Edge Detection Utilities
 *
 * Functions for detecting if points are near shape edges.
 * Used for cursor changes and interaction hints in canvas editors.
 */

import type { BaseShape, Shape } from '~/types/geometry'
import { CANVAS_INTERACTION } from '~/constants/canvas-interaction'

const { EDGE_THRESHOLD } = CANVAS_INTERACTION

/**
 * Check if a point is near any edge of a shape
 *
 * @param x - Point X coordinate
 * @param y - Point Y coordinate
 * @param shape - Shape to check (rectangle or ellipse)
 * @param threshold - Distance threshold in pixels (default: 5)
 * @param scale - Zoom scale factor (default: 1)
 * @returns True if point is near any edge
 */
export function isPointNearShapeEdge(
  x: number,
  y: number,
  shape: Shape,
  threshold: number = EDGE_THRESHOLD,
  scale: number = 1
): boolean {
  const scaledThreshold = threshold / scale
  if (shape.type === 'ellipse') {
    return isPointNearEllipseEdge(x, y, shape, scaledThreshold)
  }
  return isPointNearRectangleEdge(x, y, shape, scaledThreshold)
}

/**
 * Check if a point is near any edge of a rectangle
 *
 * @param x - Point X coordinate
 * @param y - Point Y coordinate
 * @param shape - Rectangle shape
 * @param threshold - Distance threshold in pixels
 * @returns True if point is near any edge
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
 *
 * @param x - Point X coordinate
 * @param y - Point Y coordinate
 * @param shape - Ellipse shape
 * @param threshold - Distance threshold in pixels
 * @returns True if point is near the ellipse edge
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
 *
 * @param x - Point X coordinate
 * @param y - Point Y coordinate
 * @param shapes - Array of shapes to check
 * @param edgeThreshold - Distance threshold in pixels
 * @param scale - Zoom scale factor
 * @returns Shape index if found, null otherwise
 */
export function findShapeAtEdge(
  x: number,
  y: number,
  shapes: Shape[],
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
 *
 * @param x - Point X coordinate
 * @param y - Point Y coordinate
 * @param shapes - Array of shapes to check
 * @param isPointInShapeFn - Function to check if point is in shape
 * @returns Shape index if found, null otherwise
 */
export function findShapeAtPoint(
  x: number,
  y: number,
  shapes: Shape[],
  isPointInShapeFn: (x: number, y: number, shape: Shape) => boolean
): number | null {
  // Check shapes in reverse order (top-most first)
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (isPointInShapeFn(x, y, shapes[i])) {
      return i
    }
  }
  return null
}
