/**
 * Coordinate scaling utilities
 *
 * Functions for scaling coordinates and shapes when working with
 * downscaled images. Used to transform user input coordinates to
 * match the working image dimensions.
 */

import type { Point, BaseShape } from '~/types/geometry'

/**
 * Scale an array of points by a factor
 *
 * @param points - Array of points to scale
 * @param scale - Scale factor (e.g., 0.5 for half size)
 * @returns New array with scaled coordinates
 */
export function scaleCoordinates<T extends Point>(points: T[], scale: number): T[] {
  if (scale === 1) {
    return points
  }

  return points.map(p => ({
    ...p,
    x: Math.round(p.x * scale),
    y: Math.round(p.y * scale),
  }))
}

/**
 * Scale an array of shapes by a factor
 *
 * @param shapes - Array of shapes to scale
 * @param scale - Scale factor (e.g., 0.5 for half size)
 * @returns New array with scaled dimensions
 */
export function scaleShapes<T extends BaseShape>(shapes: T[], scale: number): T[] {
  if (scale === 1) {
    return shapes
  }

  return shapes.map(shape => ({
    ...shape,
    x: Math.round(shape.x * scale),
    y: Math.round(shape.y * scale),
    width: Math.round(shape.width * scale),
    height: Math.round(shape.height * scale),
  }))
}

/**
 * Scale a single point by a factor
 */
export function scalePoint<T extends Point>(point: T, scale: number): T {
  if (scale === 1) {
    return point
  }

  return {
    ...point,
    x: Math.round(point.x * scale),
    y: Math.round(point.y * scale),
  }
}

/**
 * Scale a single shape by a factor
 */
export function scaleShape<T extends BaseShape>(shape: T, scale: number): T {
  if (scale === 1) {
    return shape
  }

  return {
    ...shape,
    x: Math.round(shape.x * scale),
    y: Math.round(shape.y * scale),
    width: Math.round(shape.width * scale),
    height: Math.round(shape.height * scale),
  }
}

/**
 * Calculate scale factor from original to target dimensions
 */
export function calculateScaleFactor(
  originalWidth: number,
  originalHeight: number,
  targetWidth: number,
  targetHeight: number
): number {
  const scaleX = targetWidth / originalWidth
  const scaleY = targetHeight / originalHeight
  return Math.min(scaleX, scaleY)
}

/**
 * Calculate the maximum dimension of an image
 */
export function getMaxDimension(width: number, height: number): number {
  return Math.max(width, height)
}

/**
 * Calculate downscale factor to fit within a maximum dimension
 */
export function calculateDownscaleFactor(width: number, height: number, maxDimension: number): number {
  const maxDim = getMaxDimension(width, height)
  if (maxDim <= maxDimension) {
    return 1
  }
  return maxDimension / maxDim
}
