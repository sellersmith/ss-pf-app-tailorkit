/* eslint-disable max-len */
import Konva from 'konva'

/**
 * Calculate the corner position of a rectangle after rotation.
 *
 * @param {number} pivotX - The x-coordinate of the pivot point.
 * @param {number} pivotY - The y-coordinate of the pivot point.
 * @param {number} diffX - The difference in the x-direction from the pivot.
 * @param {number} diffY - The difference in the y-direction from the pivot.
 * @param {number} angle - The angle of rotation in radians.
 * @returns {{x: number, y: number}} The new x and y coordinates of the corner.
 */
function getCorner(pivotX: number, pivotY: number, diffX: number, diffY: number, angle: number) {
  const distance = Math.sqrt(diffX * diffX + diffY * diffY)

  /// find angle from pivot to corner
  angle += Math.atan2(diffY, diffX)

  /// get new x and y and round it off to integer
  const x = pivotX + distance * Math.cos(angle)
  const y = pivotY + distance * Math.sin(angle)

  return { x: x, y: y }
}

/**
 * Get the bounding client rectangle of an element considering its rotation.
 *
 * @param {{ x: number, y: number, width: number, height: number, rotation: number }} element - The element to calculate the client rect for.
 * @returns {{ x: number, y: number, width: number, height: number, minX: number, minY: number, maxX: number, maxY: number }} The bounding client rectangle.
 */
export function getClientRect(element: { x: number; y: number; width: number; height: number; rotation: number }) {
  const { x, y, width, height } = element
  const rad = Konva.Util.degToRad(element.rotation)

  const p1 = getCorner(x, y, 0, 0, rad)
  const p2 = getCorner(x, y, width, 0, rad)
  const p3 = getCorner(x, y, width, height, rad)
  const p4 = getCorner(x, y, 0, height, rad)

  const minX = Math.min(p1.x, p2.x, p3.x, p4.x)
  const minY = Math.min(p1.y, p2.y, p3.y, p4.y)
  const maxX = Math.max(p1.x, p2.x, p3.x, p4.x)
  const maxY = Math.max(p1.y, p2.y, p3.y, p4.y)

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    minX,
    minY,
    maxX,
    maxY,
  }
}
