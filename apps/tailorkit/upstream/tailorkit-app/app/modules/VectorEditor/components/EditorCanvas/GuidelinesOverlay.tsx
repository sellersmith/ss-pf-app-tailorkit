/**
 * GuidelinesOverlay - Renders guidelines and handles interaction
 *
 * Guidelines are user-created alignment aids that:
 * - Appear as dashed lines across the canvas
 * - Can be dragged to reposition
 * - Are deleted when dragged off the canvas
 * - Provide snap points for moving/resizing elements
 */

import type { Point, Guideline } from '../../types'
import { EDIT_MODE_COLORS, GUIDELINE_HIT_TOLERANCE } from '../../constants'

export interface GuidelinesOverlayProps {
  /** Canvas 2D rendering context */
  ctx: CanvasRenderingContext2D
  /** Array of guidelines */
  guidelines: Guideline[]
  /** Current viewport scale */
  scale: number
  /** Current viewport offset */
  offset: Point
  /** Canvas dimensions */
  canvasSize: { width: number; height: number }
  /** ID of guideline being dragged (for highlighting) */
  draggingGuidelineId: string | null
  /** ID of guideline being hovered (for highlighting) */
  hoveredGuidelineId?: string | null
}

/**
 * Render guidelines on the canvas
 *
 * Draws each guideline as a dashed line across the visible canvas area.
 * Highlights the dragging/hovered guideline in a different color.
 */
export function renderGuidelines({
  ctx,
  guidelines,
  scale,
  offset,
  canvasSize,
  draggingGuidelineId,
  hoveredGuidelineId,
}: GuidelinesOverlayProps): void {
  if (guidelines.length === 0) return

  const { width: canvasWidth, height: canvasHeight } = canvasSize

  ctx.save()

  // Set default line style
  ctx.lineWidth = 1
  ctx.setLineDash([6, 4])

  for (const guideline of guidelines) {
    const isDragging = guideline.id === draggingGuidelineId
    const isHovered = guideline.id === hoveredGuidelineId

    // Set color based on state
    if (isDragging) {
      ctx.strokeStyle = EDIT_MODE_COLORS.guidelineDrag
      ctx.lineWidth = 2
    } else if (isHovered) {
      ctx.strokeStyle = EDIT_MODE_COLORS.guidelineHover
      ctx.lineWidth = 1.5
    } else {
      ctx.strokeStyle = EDIT_MODE_COLORS.guideline
      ctx.lineWidth = 1
    }

    ctx.beginPath()

    if (guideline.axis === 'x') {
      // Vertical guideline - x position is fixed
      const screenX = guideline.position * scale + offset.x
      ctx.moveTo(screenX, 0)
      ctx.lineTo(screenX, canvasHeight)
    } else {
      // Horizontal guideline - y position is fixed
      const screenY = guideline.position * scale + offset.y
      ctx.moveTo(0, screenY)
      ctx.lineTo(canvasWidth, screenY)
    }

    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Find the guideline at a given screen position
 *
 * @param screenPos - Position to check (in screen coordinates)
 * @param guidelines - Array of guidelines
 * @param scale - Current viewport scale
 * @param offset - Current viewport offset
 * @param tolerance - Hit tolerance in screen pixels
 * @returns The guideline at position, or null if none
 */
export function findGuidelineAtPosition(
  screenPos: Point,
  guidelines: Guideline[],
  scale: number,
  offset: Point,
  tolerance: number = GUIDELINE_HIT_TOLERANCE
): Guideline | null {
  for (const guideline of guidelines) {
    if (guideline.axis === 'x') {
      // Vertical guideline
      const screenX = guideline.position * scale + offset.x
      if (Math.abs(screenPos.x - screenX) <= tolerance) {
        return guideline
      }
    } else {
      // Horizontal guideline
      const screenY = guideline.position * scale + offset.y
      if (Math.abs(screenPos.y - screenY) <= tolerance) {
        return guideline
      }
    }
  }

  return null
}

/**
 * Get the cursor style for guideline interaction
 *
 * @param guideline - The guideline being interacted with
 * @returns CSS cursor value
 */
export function getGuidelineCursor(guideline: Guideline | null): string {
  if (!guideline) return 'default'

  // Vertical guideline (x axis) - horizontal resize cursor
  if (guideline.axis === 'x') return 'col-resize'

  // Horizontal guideline (y axis) - vertical resize cursor
  return 'row-resize'
}

/**
 * Check if a guideline should be deleted (dragged outside canvas/ruler area)
 *
 * @param screenPos - Current mouse position in screen coordinates
 * @param guideline - The guideline being dragged
 * @param canvasSize - Canvas dimensions
 * @param rulerSize - Size of ruler area (guideline is deleted if dragged into ruler)
 * @returns true if guideline should be deleted
 */
export function shouldDeleteGuideline(
  screenPos: Point,
  guideline: Guideline,
  canvasSize: { width: number; height: number },
  rulerSize: number
): boolean {
  if (guideline.axis === 'x') {
    // Vertical guideline - delete if dragged into left ruler area
    return screenPos.x < rulerSize
  }
  // Horizontal guideline - delete if dragged into top ruler area
  return screenPos.y < rulerSize
}

/**
 * Convert screen position to SVG position for guideline placement
 *
 * @param screenPos - Position in screen coordinates
 * @param scale - Current viewport scale
 * @param offset - Current viewport offset
 * @returns Position in SVG coordinates
 */
export function screenToGuidelinePosition(screenPos: Point, scale: number, offset: Point): Point {
  return {
    x: (screenPos.x - offset.x) / scale,
    y: (screenPos.y - offset.y) / scale,
  }
}
