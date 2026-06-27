/**
 * Bounding box utilities
 *
 * Pure geometry functions for working with bounding boxes,
 * including overlap detection, combining boxes, and constraining to bounds.
 */

import type { BoundingBox, BaseShape } from '~/types/geometry'

/**
 * Check if two rectangles overlap
 */
export function rectanglesOverlap(rect1: BoundingBox, rect2: BoundingBox): boolean {
  return !(
    rect1.x >= rect2.x + rect2.width
    || rect2.x >= rect1.x + rect1.width
    || rect1.y >= rect2.y + rect2.height
    || rect2.y >= rect1.y + rect1.height
  )
}

/**
 * Check if one rectangle fully contains another
 */
export function rectangleContains(outer: BoundingBox, inner: BoundingBox): boolean {
  return (
    outer.x <= inner.x
    && outer.y <= inner.y
    && outer.x + outer.width >= inner.x + inner.width
    && outer.y + outer.height >= inner.y + inner.height
  )
}

/**
 * Calculate the union bounding box of multiple boxes
 */
export function combineBoundingBoxes(boxes: BoundingBox[]): BoundingBox {
  if (boxes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  let minX = boxes[0].x
  let minY = boxes[0].y
  let maxX = boxes[0].x + boxes[0].width
  let maxY = boxes[0].y + boxes[0].height

  for (let i = 1; i < boxes.length; i++) {
    const box = boxes[i]
    minX = Math.min(minX, box.x)
    minY = Math.min(minY, box.y)
    maxX = Math.max(maxX, box.x + box.width)
    maxY = Math.max(maxY, box.y + box.height)
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Calculate the intersection of two bounding boxes
 * Returns null if boxes don't overlap
 */
export function intersectBoundingBoxes(box1: BoundingBox, box2: BoundingBox): BoundingBox | null {
  if (!rectanglesOverlap(box1, box2)) {
    return null
  }

  const x = Math.max(box1.x, box2.x)
  const y = Math.max(box1.y, box2.y)
  const right = Math.min(box1.x + box1.width, box2.x + box2.width)
  const bottom = Math.min(box1.y + box1.height, box2.y + box2.height)

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  }
}

/**
 * Constrain a shape to stay within bounds and maintain minimum size
 */
export function constrainToBounds<T extends BaseShape>(
  shape: T,
  bounds: { width: number; height: number },
  minSize: number = 20
): T {
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
 * Calculate the area of a bounding box
 */
export function calculateArea(box: BoundingBox): number {
  return box.width * box.height
}

/**
 * Get the center point of a bounding box
 */
export function getBoundingBoxCenter(box: BoundingBox): { x: number; y: number } {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  }
}

/**
 * Expand a bounding box by a margin on all sides
 */
export function expandBoundingBox(box: BoundingBox, margin: number): BoundingBox {
  return {
    x: box.x - margin,
    y: box.y - margin,
    width: box.width + margin * 2,
    height: box.height + margin * 2,
  }
}

/**
 * Scale a bounding box by a factor around its center
 */
export function scaleBoundingBox(box: BoundingBox, scale: number): BoundingBox {
  const center = getBoundingBoxCenter(box)
  const newWidth = box.width * scale
  const newHeight = box.height * scale

  return {
    x: center.x - newWidth / 2,
    y: center.y - newHeight / 2,
    width: newWidth,
    height: newHeight,
  }
}
