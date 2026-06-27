/**
 * Geometry utilities for charm builder path calculations.
 * Used by admin canvas rendering and future storefront renderer.
 */

type Point = [number, number]

/**
 * Gets a point along a line segment at normalized position t (0.0 = start, 1.0 = end).
 */
export function getPositionOnLine(t: number, lineStart: Point, lineEnd: Point): Point {
  const clamped = clampToPath(t)
  return [lineStart[0] + (lineEnd[0] - lineStart[0]) * clamped, lineStart[1] + (lineEnd[1] - lineStart[1]) * clamped]
}

/**
 * Gets the normalized position (0-1) of a point projected onto a line segment.
 * Returns the closest t value on the segment.
 */
export function getNormalizedPosition(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd[0] - lineStart[0]
  const dy = lineEnd[1] - lineStart[1]
  const lengthSq = dx * dx + dy * dy

  if (lengthSq === 0) return 0

  const t = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / lengthSq
  return clampToPath(t)
}

/**
 * Projects a 2D point onto a line segment and returns the closest point on the segment.
 */
export function projectPointOntoLine(point: Point, lineStart: Point, lineEnd: Point): Point {
  const t = getNormalizedPosition(point, lineStart, lineEnd)
  return getPositionOnLine(t, lineStart, lineEnd)
}

/**
 * Clamps a normalized position value to the valid range [0, 1].
 */
export function clampToPath(position: number): number {
  return Math.max(0, Math.min(1, position))
}

/**
 * Distributes nodes evenly along a path.
 * Returns an array of normalized positions (0-1).
 *
 * @param count - Number of nodes to distribute
 * @returns Array of evenly spaced positions
 *
 * Examples:
 * - 1 node: [0.5]
 * - 2 nodes: [0.333, 0.667]
 * - 3 nodes: [0.25, 0.5, 0.75]
 */
export function distributeNodesEvenly(count: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [0.5]

  const positions: number[] = []
  for (let i = 0; i < count; i++) {
    positions.push((i + 1) / (count + 1))
  }
  return positions
}

/**
 * Calculates the length of a line segment.
 */
export function getLineLength(lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd[0] - lineStart[0]
  const dy = lineEnd[1] - lineStart[1]
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Finds the insertion position for a new node at a click point on the path.
 * Returns the index where the new node should be inserted in the sorted nodes array.
 */
export function findNodeInsertionIndex(clickPosition: number, existingPositions: number[]): number {
  const sorted = [...existingPositions].sort((a, b) => a - b)
  for (let i = 0; i < sorted.length; i++) {
    if (clickPosition < sorted[i]) return i
  }
  return sorted.length
}

/**
 * Normalize any degree value into [0, 360). Returns 0 for NaN/undefined.
 * Used by charm slot rotation: admin input clamping + render-path safety.
 */
export function clampDegrees(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 0
  return ((value % 360) + 360) % 360
}
