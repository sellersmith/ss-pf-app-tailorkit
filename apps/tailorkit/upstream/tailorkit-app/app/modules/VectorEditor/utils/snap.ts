/**
 * Snap utilities for grid and guidelines
 *
 * Provides functions to snap points to:
 * - Grid lines (at regular intervals)
 * - Guidelines (user-created alignment aids)
 *
 * Snap only occurs when the point is within a threshold distance.
 * Guidelines take priority over grid when both would snap.
 */

import type { Point, Guideline, GridSettings, SnapResult } from '../types'
import { GRID_SNAP_THRESHOLD } from '../constants'

/**
 * Snap a point to the nearest grid intersection
 *
 * @param point - Point to snap (in SVG coordinates)
 * @param gridSize - Grid cell size in SVG units
 * @param threshold - Snap threshold in screen pixels
 * @param scale - Current viewport scale (for converting threshold to SVG units)
 * @returns SnapResult with snapped coordinates and flags
 */
export function snapToGrid(point: Point, gridSize: number, threshold: number, scale: number): SnapResult {
  // Convert threshold from screen pixels to SVG units
  const thresholdSvg = threshold / scale

  // Find nearest grid lines
  const nearestX = Math.round(point.x / gridSize) * gridSize
  const nearestY = Math.round(point.y / gridSize) * gridSize

  // Check if within threshold
  const distX = Math.abs(point.x - nearestX)
  const distY = Math.abs(point.y - nearestY)

  const snappedX = distX < thresholdSvg
  const snappedY = distY < thresholdSvg

  return {
    x: snappedX ? nearestX : point.x,
    y: snappedY ? nearestY : point.y,
    snappedX,
    snappedY,
  }
}

/**
 * Snap a point to the nearest guideline
 *
 * @param point - Point to snap (in SVG coordinates)
 * @param guidelines - Array of guidelines
 * @param threshold - Snap threshold in screen pixels
 * @param scale - Current viewport scale (for converting threshold to SVG units)
 * @returns SnapResult with snapped coordinates and flags
 */
export function snapToGuidelines(point: Point, guidelines: Guideline[], threshold: number, scale: number): SnapResult {
  // Convert threshold from screen pixels to SVG units
  const thresholdSvg = threshold / scale

  let resultX = point.x
  let resultY = point.y
  let snappedX = false
  let snappedY = false
  let minDistX = Infinity
  let minDistY = Infinity

  for (const guideline of guidelines) {
    if (guideline.axis === 'x') {
      // Vertical guideline - snaps X coordinate
      const dist = Math.abs(point.x - guideline.position)
      if (dist < thresholdSvg && dist < minDistX) {
        minDistX = dist
        resultX = guideline.position
        snappedX = true
      }
    } else {
      // Horizontal guideline - snaps Y coordinate
      const dist = Math.abs(point.y - guideline.position)
      if (dist < thresholdSvg && dist < minDistY) {
        minDistY = dist
        resultY = guideline.position
        snappedY = true
      }
    }
  }

  return {
    x: resultX,
    y: resultY,
    snappedX,
    snappedY,
  }
}

/**
 * Snap a point to grid and/or guidelines
 *
 * Guidelines take priority over grid for the same axis.
 *
 * @param point - Point to snap (in SVG coordinates)
 * @param gridSettings - Grid settings (null to disable grid snap)
 * @param guidelines - Array of guidelines (empty to disable guideline snap)
 * @param scale - Current viewport scale
 * @param threshold - Optional custom threshold (defaults to GRID_SNAP_THRESHOLD)
 * @returns SnapResult with snapped coordinates and flags
 */
export function snapPoint(
  point: Point,
  gridSettings: GridSettings | null,
  guidelines: Guideline[],
  scale: number,
  threshold: number = GRID_SNAP_THRESHOLD
): SnapResult {
  const result: SnapResult = {
    x: point.x,
    y: point.y,
    snappedX: false,
    snappedY: false,
  }

  // First try guidelines (they take priority)
  if (guidelines.length > 0) {
    const guidelineSnap = snapToGuidelines(point, guidelines, threshold, scale)

    if (guidelineSnap.snappedX) {
      result.x = guidelineSnap.x
      result.snappedX = true
    }

    if (guidelineSnap.snappedY) {
      result.y = guidelineSnap.y
      result.snappedY = true
    }
  }

  // Then try grid for any axis not already snapped by guidelines
  if (gridSettings?.snapEnabled) {
    const gridSnap = snapToGrid(point, gridSettings.size, threshold, scale)

    if (!result.snappedX && gridSnap.snappedX) {
      result.x = gridSnap.x
      result.snappedX = true
    }

    if (!result.snappedY && gridSnap.snappedY) {
      result.y = gridSnap.y
      result.snappedY = true
    }
  }

  return result
}

/**
 * Check if a point is near a guideline (for hover/selection detection)
 *
 * @param point - Point to check (in SVG coordinates)
 * @param guidelines - Array of guidelines
 * @param tolerance - Hit tolerance in screen pixels
 * @param scale - Current viewport scale
 * @returns The nearest guideline within tolerance, or null
 */
export function findNearestGuideline(
  point: Point,
  guidelines: Guideline[],
  tolerance: number,
  scale: number
): Guideline | null {
  const toleranceSvg = tolerance / scale

  let nearest: Guideline | null = null
  let minDist = Infinity

  for (const guideline of guidelines) {
    const dist
      = guideline.axis === 'x' ? Math.abs(point.x - guideline.position) : Math.abs(point.y - guideline.position)

    if (dist < toleranceSvg && dist < minDist) {
      minDist = dist
      nearest = guideline
    }
  }

  return nearest
}

/**
 * Snap bounds edges and center to grid and/or guidelines
 *
 * This function checks all 4 edges plus the center point of a bounding box
 * and snaps based on which point is closest to a snap target.
 * This is used for snapping path selections by their visual bounds.
 *
 * For guidelines: checks edges (left, right, top, bottom) AND center point
 * For grid: checks edges only (center snapping to grid is less useful)
 *
 * @param bounds - The bounding box edges
 * @param gridSettings - Grid settings (null to disable grid snap)
 * @param guidelines - Array of guidelines
 * @param scale - Current viewport scale
 * @param threshold - Optional custom threshold
 * @returns Snap delta to apply to the bounds
 */
export function snapBounds(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  gridSettings: GridSettings | null,
  guidelines: Guideline[],
  scale: number,
  threshold: number = GRID_SNAP_THRESHOLD
): { deltaX: number; deltaY: number; snappedX: boolean; snappedY: boolean } {
  const thresholdSvg = threshold / scale

  let deltaX = 0
  let deltaY = 0
  let snappedX = false
  let snappedY = false
  let minDistX = Infinity
  let minDistY = Infinity

  // Calculate center point
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2

  // Check all X positions (left, center, right) against vertical guidelines
  const xPositions = [bounds.minX, centerX, bounds.maxX]
  // Check all Y positions (top, center, bottom) against horizontal guidelines
  const yPositions = [bounds.minY, centerY, bounds.maxY]

  // Check guidelines first (they take priority) - includes center point
  for (const guideline of guidelines) {
    if (guideline.axis === 'x') {
      // Vertical guideline - check X positions (edges + center)
      for (const pos of xPositions) {
        const dist = Math.abs(pos - guideline.position)
        if (dist < thresholdSvg && dist < minDistX) {
          minDistX = dist
          deltaX = guideline.position - pos
          snappedX = true
        }
      }
    } else {
      // Horizontal guideline - check Y positions (edges + center)
      for (const pos of yPositions) {
        const dist = Math.abs(pos - guideline.position)
        if (dist < thresholdSvg && dist < minDistY) {
          minDistY = dist
          deltaY = guideline.position - pos
          snappedY = true
        }
      }
    }
  }

  // Check grid if enabled and not already snapped by guidelines
  // Grid snapping only checks edges (not center) for more predictable behavior
  if (gridSettings?.snapEnabled) {
    const gridSize = gridSettings.size
    const xEdges = [bounds.minX, bounds.maxX]
    const yEdges = [bounds.minY, bounds.maxY]

    if (!snappedX) {
      for (const edge of xEdges) {
        const nearestGrid = Math.round(edge / gridSize) * gridSize
        const dist = Math.abs(edge - nearestGrid)
        if (dist < thresholdSvg && dist < minDistX) {
          minDistX = dist
          deltaX = nearestGrid - edge
          snappedX = true
        }
      }
    }

    if (!snappedY) {
      for (const edge of yEdges) {
        const nearestGrid = Math.round(edge / gridSize) * gridSize
        const dist = Math.abs(edge - nearestGrid)
        if (dist < thresholdSvg && dist < minDistY) {
          minDistY = dist
          deltaY = nearestGrid - edge
          snappedY = true
        }
      }
    }
  }

  return { deltaX, deltaY, snappedX, snappedY }
}

/**
 * Snap a single value (for guideline creation) to selection bounds edges/center and viewport center
 *
 * Used when dragging a guideline from the ruler - snaps to:
 * - Selection bounds edges and center (if selection exists)
 * - Viewport center point
 *
 * @param value - The value to snap (X for vertical guideline, Y for horizontal)
 * @param axis - The guideline axis ('x' for vertical guideline, 'y' for horizontal)
 * @param selectionBounds - Optional selection bounds to snap to
 * @param viewBox - Optional viewport bounds to snap to center
 * @param threshold - Snap threshold in screen pixels
 * @param scale - Current viewport scale
 * @returns Snapped value and whether snap occurred
 */
export function snapGuidelineToSelection(
  value: number,
  axis: 'x' | 'y',
  selectionBounds: { minX: number; minY: number; maxX: number; maxY: number } | null,
  threshold: number,
  scale: number,
  viewBox?: { x: number; y: number; width: number; height: number } | null
): { value: number; snapped: boolean } {
  const thresholdSvg = threshold / scale
  const positions: number[] = []

  // Add selection bounds positions if available
  if (selectionBounds) {
    if (axis === 'x') {
      positions.push(
        selectionBounds.minX, // left edge
        (selectionBounds.minX + selectionBounds.maxX) / 2, // center
        selectionBounds.maxX // right edge
      )
    } else {
      positions.push(
        selectionBounds.minY, // top edge
        (selectionBounds.minY + selectionBounds.maxY) / 2, // center
        selectionBounds.maxY // bottom edge
      )
    }
  }

  // Add viewport center position
  if (viewBox) {
    if (axis === 'x') {
      positions.push(viewBox.x + viewBox.width / 2) // viewport center X
    } else {
      positions.push(viewBox.y + viewBox.height / 2) // viewport center Y
    }
  }

  // If no snap targets, return unchanged
  if (positions.length === 0) {
    return { value, snapped: false }
  }

  let snappedValue = value
  let minDist = Infinity
  let snapped = false

  for (const pos of positions) {
    const dist = Math.abs(value - pos)
    if (dist < thresholdSvg && dist < minDist) {
      minDist = dist
      snappedValue = pos
      snapped = true
    }
  }

  return { value: snappedValue, snapped }
}

/**
 * Get snap indicator lines for visual feedback
 *
 * Returns the coordinates for drawing snap indicator lines
 * to show the user what they're snapping to.
 *
 * @param point - The snapped point
 * @param result - The snap result
 * @param viewBox - The viewBox for extending lines
 * @returns Array of line definitions for rendering
 */
export function getSnapIndicatorLines(
  point: Point,
  result: SnapResult,
  viewBox: { x: number; y: number; width: number; height: number }
): Array<{ x1: number; y1: number; x2: number; y2: number; axis: 'x' | 'y' }> {
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number; axis: 'x' | 'y' }> = []

  if (result.snappedX) {
    // Vertical line at snapped X
    lines.push({
      x1: result.x,
      y1: viewBox.y,
      x2: result.x,
      y2: viewBox.y + viewBox.height,
      axis: 'x',
    })
  }

  if (result.snappedY) {
    // Horizontal line at snapped Y
    lines.push({
      x1: viewBox.x,
      y1: result.y,
      x2: viewBox.x + viewBox.width,
      y2: result.y,
      axis: 'y',
    })
  }

  return lines
}
