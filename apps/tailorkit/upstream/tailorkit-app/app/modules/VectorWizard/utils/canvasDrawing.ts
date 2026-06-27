import type { ShapeSelection } from '../types'
import type { ViewPort } from '~/types/template'
import { getShapeHandles } from './shapeUtils'
import { CANVAS_CONSTANTS, CANVAS_STYLES } from '../constants'

type HoveredShape = { type: 'shape'; index: number } | null

/**
 * Canvas drawing utilities for VectorWizard
 */

/**
 * Redraw canvas with image, seed points, and shape selections
 */
export function redrawCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  shapeSelections: ShapeSelection[],
  hoveredShape: HoveredShape = null,
  viewport: ViewPort = { scale: 1, left: 0, top: 0 },
  isMobile: boolean = false
) {
  // Save context state before any operations
  ctx.save()

  // Reset to identity transformation for clearing
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  // Clear canvas in native coordinates
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  // Apply viewport transformation
  ctx.translate(viewport.left, viewport.top)
  ctx.scale(viewport.scale, viewport.scale)

  // Draw image with viewport applied
  ctx.drawImage(img, 0, 0)

  // Step 1: Draw all shape selections
  drawShapeSelections(ctx, shapeSelections, viewport)

  // Step 2: Draw resize handles for hovered shape
  if (hoveredShape !== null && hoveredShape.type === 'shape') {
    const hoveredRect = shapeSelections[hoveredShape.index]

    // TypeScript ensures hoveredRect has required properties
    if (!hoveredRect) {
      return
    }

    // Use the drawShapeHandles function with isMobile parameter
    drawShapeHandles(ctx, hoveredRect, viewport.scale, isMobile)
  }

  // Restore main viewport transformation context
  ctx.restore()
}

/**
 * Draw rectangular selections
 */
function drawShapeSelections(
  ctx: CanvasRenderingContext2D,
  shapeSelections: ShapeSelection[],
  viewport: ViewPort = { scale: 1, left: 0, top: 0 }
) {
  shapeSelections.forEach((shape, index) => {
    // Skip drawing deleted markers (they're invisible markers used for tracking)
    if (shape.source === 'deleted-auto-detected') {
      return
    }

    // Check shape type
    const isEllipse = shape.type === 'ellipse'

    ctx.strokeStyle = CANVAS_STYLES.SELECTION.STROKE
    ctx.lineWidth = CANVAS_STYLES.SELECTION.LINE_WIDTH / viewport.scale // Scale line width for zoom consistency
    ctx.fillStyle = CANVAS_STYLES.SELECTION.FILL

    if (isEllipse) {
      // Draw ellipse
      const centerX = shape.x + shape.width / 2
      const centerY = shape.y + shape.height / 2
      const radiusX = shape.width / 2
      const radiusY = shape.height / 2

      ctx.beginPath()
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.fill()
    } else {
      // Draw rectangle
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
      ctx.fillRect(shape.x, shape.y, shape.width, shape.height)
    }
  })
}

/**
 * Draw a shape (rectangle or ellipse)
 */
function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: ShapeSelection,
  style: {
    strokeStyle: string
    fillStyle?: string
    lineWidth: number
    globalAlpha?: number
    lineDash?: number[]
  }
) {
  ctx.save()

  ctx.strokeStyle = style.strokeStyle
  ctx.lineWidth = style.lineWidth
  if (style.globalAlpha !== undefined) {
    ctx.globalAlpha = style.globalAlpha
  }
  if (style.lineDash) {
    ctx.setLineDash(style.lineDash)
  }

  if (shape.type === 'ellipse') {
    drawEllipseShape(ctx, shape)
  } else {
    drawRectangleShape(ctx, shape)
  }

  if (style.fillStyle) {
    ctx.fillStyle = style.fillStyle
    if (shape.type === 'ellipse') {
      fillEllipseShape(ctx, shape)
    } else {
      ctx.fillRect(shape.x, shape.y, shape.width, shape.height)
    }
  }

  ctx.restore()
}

/**
 * Draw rectangle shape outline
 */
function drawRectangleShape(ctx: CanvasRenderingContext2D, shape: ShapeSelection) {
  ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
}

/**
 * Draw ellipse shape outline
 */
function drawEllipseShape(ctx: CanvasRenderingContext2D, shape: ShapeSelection) {
  const centerX = shape.x + shape.width / 2
  const centerY = shape.y + shape.height / 2
  const radiusX = shape.width / 2
  const radiusY = shape.height / 2

  ctx.beginPath()
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI)
  ctx.stroke()
}

/**
 * Fill ellipse shape
 */
function fillEllipseShape(ctx: CanvasRenderingContext2D, shape: ShapeSelection) {
  const centerX = shape.x + shape.width / 2
  const centerY = shape.y + shape.height / 2
  const radiusX = shape.width / 2
  const radiusY = shape.height / 2

  ctx.beginPath()
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI)
  ctx.fill()
}

/**
 * Draw current selection being drawn (works for both rectangle and ellipse)
 */
export function drawCurrentSelection(ctx: CanvasRenderingContext2D, selection: ShapeSelection) {
  const style = {
    strokeStyle: CANVAS_STYLES.CURRENT_DRAWING.STROKE,
    fillStyle: CANVAS_STYLES.CURRENT_DRAWING.FILL,
    lineWidth: CANVAS_STYLES.CURRENT_DRAWING.LINE_WIDTH,
    lineDash: [...CANVAS_STYLES.CURRENT_DRAWING.LINE_DASH],
  }

  drawShape(ctx, selection, style)
}

/**
 * Draw shape handles for manipulation
 */
export function drawShapeHandles(
  ctx: CanvasRenderingContext2D,
  shape: ShapeSelection,
  scale: number = 1,
  isMobile: boolean = false
) {
  const handles = getShapeHandles(shape, scale, isMobile)
  const baseHandleSize = isMobile ? CANVAS_CONSTANTS.MOBILE_HANDLE_SIZE : CANVAS_CONSTANTS.HANDLE_SIZE
  const handleSize = baseHandleSize / scale

  ctx.save()

  // Scale line width appropriately
  const lineWidth = (isMobile ? 2 : CANVAS_STYLES.HANDLE.LINE_WIDTH) / scale

  Object.values(handles).forEach(handle => {
    const halfSize = handleSize / 2

    // Add shadow for better visibility
    ctx.shadowColor = CANVAS_STYLES.HANDLE.SHADOW_COLOR
    ctx.shadowBlur = CANVAS_STYLES.HANDLE.SHADOW_BLUR / scale
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    // Draw white fill - handle positions are now center points
    ctx.fillStyle = CANVAS_STYLES.HANDLE.FILL
    ctx.fillRect(handle.x - halfSize, handle.y - halfSize, handleSize, handleSize)

    // Reset shadow for stroke
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0

    // Draw border with proper line width
    ctx.strokeStyle = CANVAS_STYLES.HANDLE.STROKE
    ctx.lineWidth = lineWidth
    ctx.strokeRect(handle.x - halfSize, handle.y - halfSize, handleSize, handleSize)
  })

  ctx.restore()
}
