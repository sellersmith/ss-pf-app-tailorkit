import type { Dimension, Position } from '~/types/template'

export function convertDegreesToRadians(degrees: number) {
  return degrees * (Math.PI / 180)
}

export function convertRadiansToDegrees(radians: number) {
  // Store the value of pi.
  const pi = Math.PI
  // Multiply radians by 180 divided by pi to convert to degrees.
  return radians * (180 / pi)
}

/**
 * @param degree Degree
 * @returns
 */
export function normalizeAngleToPositiveValue(degree: number) {
  let normalized = degree % 360

  if (normalized < 0) {
    normalized += 360
  }

  return +normalized.toFixed(2)
}

/**
 * This function is served for evaluating the center point of a layer
 * Whenever we rotate the object, it will not change the position of center point of this
 * By implementing this function we can have insight about the original point before rotating an angle
 * See more at Stack Overflow discussion: https://stackoverflow.com/questions/19393282/rotating-canvas-around-a-point-and-getting-new-x-y-offest
 * Rotation matrix: http://en.wikipedia.org/wiki/Rotation_matrix
 * @param position Position
 * @param dimension Dimension
 * @param angle Degree number
 * @returns
 */

export function getCenterPivotPoint(position: Position, dimension: Dimension, angle: number) {
  const { width, height } = dimension

  // Convert angle to radians
  const radians = angle * (Math.PI / 180)

  // Original center of the rectangle
  const originalCenter = {
    x: width / 2,
    y: height / 2,
  }

  // Rotated center
  const rotatedCenter = {
    x: originalCenter.x * Math.cos(radians) - originalCenter.y * Math.sin(radians),
    y: originalCenter.x * Math.sin(radians) + originalCenter.y * Math.cos(radians),
  }

  // Final center position based on the new top-left corner
  const finalCenter = {
    x: position.x + rotatedCenter.x,
    y: position.y + rotatedCenter.y,
  }

  return finalCenter
}

export function getOriginalPoint(pivot: Position, dimension: Dimension) {
  return {
    x: pivot.x - dimension.width / 2,
    y: pivot.y - dimension.height / 2,
  }
}

/**
 * Get position of 4 corners
 * @param pivot Position
 * @param corner Position
 * @param angle radian angle
 * @returns
 */

export function getCorner(pivot: Position, corner: Position, angle: number) {
  const { x: pivotX, y: pivotY } = pivot

  const { x: cornerX, y: cornerY } = corner

  const diffX = cornerX - pivotX
  const diffY = cornerY - pivotY
  const distance = Math.sqrt(diffX * diffX + diffY * diffY)

  angle += Math.atan2(diffY, diffX)

  const x = pivotX + distance * Math.cos(angle)
  const y = pivotY + distance * Math.sin(angle)

  return { x: x, y: y }
}
