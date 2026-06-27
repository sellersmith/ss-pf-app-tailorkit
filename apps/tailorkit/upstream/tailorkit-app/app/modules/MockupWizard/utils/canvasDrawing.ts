import type { ShapeSelection, VectorShape } from '../types'
import type { ViewPort } from '~/types/template'
import { getShapeHandles, getRotationHandlePosition, getShapeCenter, transformPointFromShapeSpace } from './shapeUtils'
import { CANVAS_CONSTANTS, CANVAS_STYLES } from '../constants'
import { serializePathCommandsToD } from './vectorPathUtils'

type HoveredShape = { type: 'shape'; index: number } | null

/**
 * Canvas drawing utilities for MockupWizard
 */

/**
 * Redraw canvas with image and shape selections
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

  // Step 2: Draw resize handles for hovered shape (skip for vector shapes)
  if (hoveredShape !== null && hoveredShape.type === 'shape') {
    const hoveredRect = shapeSelections[hoveredShape.index]

    // TypeScript ensures hoveredRect has required properties
    if (!hoveredRect) {
      return
    }

    // Vector shapes: resize handles (no rotation); other shapes: full handles
    if (hoveredRect.type === 'vector') {
      drawVectorShapeHandles(ctx, hoveredRect, viewport.scale, isMobile)
    } else {
      drawShapeHandles(ctx, hoveredRect, viewport.scale, isMobile)
    }
  }

  // Restore main viewport transformation context
  ctx.restore()
}

/**
 * Draw rectangular selections
 */
export function drawShapeSelections(
  ctx: CanvasRenderingContext2D,
  shapeSelections: ShapeSelection[],
  viewport: ViewPort = { scale: 1, left: 0, top: 0 }
) {
  shapeSelections.forEach((shape, index) => {
    // Check shape type
    const isEllipse = shape.type === 'ellipse'
    const rotation = shape.rotation || 0

    ctx.save()

    // Apply rotation around shape center if rotated
    if (rotation !== 0) {
      const center = getShapeCenter(shape)
      ctx.translate(center.x, center.y)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.translate(-center.x, -center.y)
    }

    ctx.strokeStyle = CANVAS_STYLES.SELECTION.STROKE
    ctx.lineWidth = CANVAS_STYLES.SELECTION.LINE_WIDTH / viewport.scale // Scale line width for zoom consistency
    ctx.fillStyle = CANVAS_STYLES.SELECTION.FILL

    if (shape.type === 'vector') {
      // Draw vector path using Path2D
      drawVectorShapePath(ctx, shape)
    } else if (isEllipse) {
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

    ctx.restore()
  })
}

/**
 * Check if a point is within a delete button
 */
export function isPointInDeleteButton(
  x: number,
  y: number,
  rect: ShapeSelection,
  buttonSize: number = CANVAS_CONSTANTS.DELETE_BUTTON_SIZE,
  buttonOffset: number = CANVAS_CONSTANTS.DELETE_BUTTON_OFFSET
): boolean {
  // TypeScript ensures rect has required properties
  if (!rect) {
    return false
  }

  const buttonX = rect.x + rect.width - buttonOffset
  const buttonY = rect.y + buttonOffset
  const radius = buttonSize / 2

  const distance = Math.sqrt((x - buttonX) ** 2 + (y - buttonY) ** 2)
  return distance <= radius
}

/**
 * Draw a shape (rectangle or ellipse)
 */
export function drawShape(
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

  if (shape.type === 'vector') {
    drawVectorShapePath(ctx, shape as VectorShape, false)
    if (style.fillStyle) {
      ctx.fillStyle = style.fillStyle
      drawVectorShapePath(ctx, shape as VectorShape, true)
    }
  } else if (shape.type === 'ellipse') {
    drawEllipseShape(ctx, shape)
    if (style.fillStyle) {
      ctx.fillStyle = style.fillStyle
      fillEllipseShape(ctx, shape)
    }
  } else {
    drawRectangleShape(ctx, shape)
    if (style.fillStyle) {
      ctx.fillStyle = style.fillStyle
      ctx.fillRect(shape.x, shape.y, shape.width, shape.height)
    }
  }

  ctx.restore()
}

/**
 * Draw rectangle shape outline
 */
export function drawRectangleShape(ctx: CanvasRenderingContext2D, shape: ShapeSelection) {
  ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
}

/**
 * Draw ellipse shape outline
 */
export function drawEllipseShape(ctx: CanvasRenderingContext2D, shape: ShapeSelection) {
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
export function fillEllipseShape(ctx: CanvasRenderingContext2D, shape: ShapeSelection) {
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
 * Draw resize handles for a vector shape (no rotation handle).
 * Draws a dashed bounding rect + 8 corner/edge handles.
 */
export function drawVectorShapeHandles(
  ctx: CanvasRenderingContext2D,
  shape: ShapeSelection,
  scale: number = 1,
  isMobile: boolean = false
) {
  const handles = getShapeHandles(shape, scale, isMobile)
  const baseHandleSize = isMobile ? CANVAS_CONSTANTS.MOBILE_HANDLE_SIZE : CANVAS_CONSTANTS.HANDLE_SIZE
  const handleSize = baseHandleSize / scale
  const lineWidth = (isMobile ? 2 : CANVAS_STYLES.HANDLE.LINE_WIDTH) / scale

  ctx.save()

  // Draw dashed bounding rectangle
  ctx.strokeStyle = CANVAS_STYLES.HANDLE.STROKE
  ctx.lineWidth = lineWidth
  ctx.setLineDash([4 / scale, 4 / scale])
  ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
  ctx.setLineDash([])

  // Draw 8 resize handles (no rotation handle)
  Object.values(handles).forEach(handle => {
    const halfSize = handleSize / 2
    ctx.shadowColor = CANVAS_STYLES.HANDLE.SHADOW_COLOR
    ctx.shadowBlur = CANVAS_STYLES.HANDLE.SHADOW_BLUR / scale
    ctx.fillStyle = CANVAS_STYLES.HANDLE.FILL
    ctx.fillRect(handle.x - halfSize, handle.y - halfSize, handleSize, handleSize)
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.strokeStyle = CANVAS_STYLES.HANDLE.STROKE
    ctx.lineWidth = lineWidth
    ctx.strokeRect(handle.x - halfSize, handle.y - halfSize, handleSize, handleSize)
  })

  ctx.restore()
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
  const rotation = shape.rotation || 0

  ctx.save()

  // Scale line width appropriately
  const lineWidth = (isMobile ? 2 : CANVAS_STYLES.HANDLE.LINE_WIDTH) / scale

  // Draw rotation handle first (in world space, already accounts for rotation)
  drawRotationHandle(ctx, shape, scale, isMobile)

  // For resize handles, transform each handle position to world space
  Object.values(handles).forEach(handle => {
    const halfSize = handleSize / 2

    // Transform handle position to world space if shape is rotated
    let handleX = handle.x
    let handleY = handle.y
    if (rotation !== 0) {
      const worldPos = transformPointFromShapeSpace(handle.x, handle.y, shape)
      handleX = worldPos.x
      handleY = worldPos.y
    }

    // Add shadow for better visibility
    ctx.shadowColor = CANVAS_STYLES.HANDLE.SHADOW_COLOR
    ctx.shadowBlur = CANVAS_STYLES.HANDLE.SHADOW_BLUR / scale
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    // Draw white fill - handle positions are now center points
    ctx.fillStyle = CANVAS_STYLES.HANDLE.FILL
    ctx.fillRect(handleX - halfSize, handleY - halfSize, handleSize, handleSize)

    // Reset shadow for stroke
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0

    // Draw border with proper line width
    ctx.strokeStyle = CANVAS_STYLES.HANDLE.STROKE
    ctx.lineWidth = lineWidth
    ctx.strokeRect(handleX - halfSize, handleY - halfSize, handleSize, handleSize)
  })

  ctx.restore()
}

/**
 * Draw rotation handle for a shape
 */
export function drawRotationHandle(
  ctx: CanvasRenderingContext2D,
  shape: ShapeSelection,
  scale: number = 1,
  isMobile: boolean = false
) {
  const handlePos = getRotationHandlePosition(shape, scale, isMobile)
  const handleSize = isMobile ? CANVAS_CONSTANTS.MOBILE_ROTATION_HANDLE_SIZE : CANVAS_CONSTANTS.ROTATION_HANDLE_SIZE
  const radius = handleSize / (2 * scale)
  const lineWidth = CANVAS_STYLES.ROTATION_HANDLE.LINE_WIDTH / scale

  // Calculate top-center of shape in world space (for stem start)
  const center = getShapeCenter(shape)
  const rotation = shape.rotation || 0

  // Top center in local space
  const topCenterLocalX = center.x
  const topCenterLocalY = shape.y

  // Transform to world space
  let stemStartX = topCenterLocalX
  let stemStartY = topCenterLocalY
  if (rotation !== 0) {
    const worldPos = transformPointFromShapeSpace(topCenterLocalX, topCenterLocalY, shape)
    stemStartX = worldPos.x
    stemStartY = worldPos.y
  }

  ctx.save()

  // Draw stem line from top-center of shape to rotation handle
  ctx.strokeStyle = CANVAS_STYLES.ROTATION_HANDLE.STEM_COLOR
  ctx.lineWidth = 1.5 / scale
  ctx.beginPath()
  ctx.moveTo(stemStartX, stemStartY)
  ctx.lineTo(handlePos.x, handlePos.y)
  ctx.stroke()

  // Draw rotation handle circle
  ctx.shadowColor = CANVAS_STYLES.ROTATION_HANDLE.SHADOW_COLOR
  ctx.shadowBlur = CANVAS_STYLES.ROTATION_HANDLE.SHADOW_BLUR / scale

  ctx.fillStyle = CANVAS_STYLES.ROTATION_HANDLE.FILL
  ctx.beginPath()
  ctx.arc(handlePos.x, handlePos.y, radius, 0, 2 * Math.PI)
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0

  ctx.strokeStyle = CANVAS_STYLES.ROTATION_HANDLE.STROKE
  ctx.lineWidth = lineWidth
  ctx.stroke()

  // Draw inner filled circle (creates holed/donut effect like VectorEditor)
  const innerRadius = radius * 0.4
  ctx.beginPath()
  ctx.arc(handlePos.x, handlePos.y, innerRadius, 0, 2 * Math.PI)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  ctx.restore()
}

/**
 * Draw a vector shape using Path2D API.
 * When fillOnly is true, only fills the path (for separate stroke/fill rendering).
 */
function drawVectorShapePath(ctx: CanvasRenderingContext2D, shape: VectorShape, fillOnly = false) {
  const pathD = shape.pathD || serializePathCommandsToD(shape.pathCommands)
  const path2D = new Path2D(pathD)

  if (fillOnly) {
    ctx.fill(path2D, 'evenodd')
  } else {
    ctx.stroke(path2D)
    ctx.fill(path2D, 'evenodd')
  }
}
