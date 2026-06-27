/**
 * GridOverlay - Renders grid lines on the canvas
 *
 * A pure render function that draws grid lines at regular intervals.
 * Does not manage any state - receives all data via props.
 *
 * Grid features:
 * - Major grid lines at gridSettings.size intervals
 * - Only renders visible lines (optimized for performance)
 * - Scales correctly with viewport zoom/pan
 */

import type { Point, GridSettings, ViewBox } from '../../types'
import { EDIT_MODE_COLORS } from '../../constants'

export interface GridOverlayProps {
  /** Canvas 2D rendering context */
  ctx: CanvasRenderingContext2D
  /** Current viewBox of the SVG */
  viewBox: ViewBox
  /** Current viewport scale */
  scale: number
  /** Current viewport offset */
  offset: Point
  /** Grid settings (size, snapEnabled) */
  gridSettings: GridSettings
  /** Canvas dimensions */
  canvasSize: { width: number; height: number }
}

/**
 * Render grid lines on the canvas
 *
 * This function draws grid lines within the viewBox bounds only.
 * IMPORTANT: The context is expected to already have viewport transforms applied
 * (translate by offset, then scale). This function draws in SVG coordinates.
 */
export function renderGrid({ ctx, viewBox, scale, offset, gridSettings, canvasSize }: GridOverlayProps): void {
  const { size } = gridSettings

  // Calculate visible SVG coordinate range
  const visibleMinX = -offset.x / scale
  const visibleMinY = -offset.y / scale
  const visibleMaxX = (canvasSize.width - offset.x) / scale
  const visibleMaxY = (canvasSize.height - offset.y) / scale

  // Grid is constrained to viewBox bounds, intersected with visible area
  const gridMinX = Math.max(viewBox.x, visibleMinX)
  const gridMinY = Math.max(viewBox.y, visibleMinY)
  const gridMaxX = Math.min(viewBox.x + viewBox.width, visibleMaxX)
  const gridMaxY = Math.min(viewBox.y + viewBox.height, visibleMaxY)

  // Skip if viewBox is not visible
  if (gridMinX >= gridMaxX || gridMinY >= gridMaxY) {
    return
  }

  // Align grid lines to gridSize intervals
  const startX = Math.ceil(gridMinX / size) * size
  const endX = Math.floor(gridMaxX / size) * size
  const startY = Math.ceil(gridMinY / size) * size
  const endY = Math.floor(gridMaxY / size) * size

  // Limit the number of grid lines to prevent performance issues at extreme zoom levels
  const maxLines = 500
  const numVerticalLines = (endX - startX) / size
  const numHorizontalLines = (endY - startY) / size

  if (numVerticalLines > maxLines || numHorizontalLines > maxLines) {
    // Too many lines would be drawn - skip rendering
    return
  }

  ctx.save()

  // Context already has viewport transforms applied, so we draw in SVG coordinates directly
  // Set line style for major grid lines
  ctx.strokeStyle = EDIT_MODE_COLORS.gridMajor
  ctx.lineWidth = 1 / scale // Keep line width consistent regardless of zoom

  // Lines should span the full viewBox dimension, but only draw ones in visible area
  const lineMinY = Math.max(viewBox.y, visibleMinY)
  const lineMaxY = Math.min(viewBox.y + viewBox.height, visibleMaxY)
  const lineMinX = Math.max(viewBox.x, visibleMinX)
  const lineMaxX = Math.min(viewBox.x + viewBox.width, visibleMaxX)

  ctx.beginPath()

  // Draw vertical lines (spanning viewBox height, clipped to visible)
  for (let x = startX; x <= endX; x += size) {
    ctx.moveTo(x, lineMinY)
    ctx.lineTo(x, lineMaxY)
  }

  // Draw horizontal lines (spanning viewBox width, clipped to visible)
  for (let y = startY; y <= endY; y += size) {
    ctx.moveTo(lineMinX, y)
    ctx.lineTo(lineMaxX, y)
  }

  ctx.stroke()

  // Optionally draw minor grid lines (subdivisions) if zoomed in enough
  const minorGridSize = size / 4
  const shouldDrawMinor = scale > 1 && minorGridSize * scale > 8 // Only if minor lines are at least 8px apart

  if (shouldDrawMinor) {
    ctx.strokeStyle = EDIT_MODE_COLORS.gridMinor
    ctx.beginPath()

    // Draw minor vertical lines
    for (let x = startX; x <= endX; x += minorGridSize) {
      // Skip major grid lines
      if (Math.abs(x % size) < 0.001) continue
      ctx.moveTo(x, lineMinY)
      ctx.lineTo(x, lineMaxY)
    }

    // Draw minor horizontal lines
    for (let y = startY; y <= endY; y += minorGridSize) {
      // Skip major grid lines
      if (Math.abs(y % size) < 0.001) continue
      ctx.moveTo(lineMinX, y)
      ctx.lineTo(lineMaxX, y)
    }

    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Calculate the optimal grid size label interval based on zoom level
 *
 * @param gridSize - Base grid size
 * @param scale - Current viewport scale
 * @returns The interval at which to show grid size labels
 */
export function getGridLabelInterval(gridSize: number, scale: number): number {
  const minPixelsBetweenLabels = 50
  const gridPixelSize = gridSize * scale

  if (gridPixelSize >= minPixelsBetweenLabels) {
    return gridSize
  }

  // Calculate multiplier needed
  const multiplier = Math.ceil(minPixelsBetweenLabels / gridPixelSize)
  return gridSize * multiplier
}
