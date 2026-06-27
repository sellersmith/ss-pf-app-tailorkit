/**
 * canvas-shape-feedback.ts
 * Draws dashed-outline feedback overlays for shapes being moved or resized.
 */
import type { ShapeSelection } from '../../types'
import type { ViewPort } from '~/types/template'
import { getShapeCenter } from '../../utils/shapeUtils'

export function applyViewportAndRotation(
  ctx: CanvasRenderingContext2D,
  viewport: ViewPort,
  shape: ShapeSelection
): void {
  ctx.translate(viewport.left, viewport.top)
  ctx.scale(viewport.scale, viewport.scale)

  const rotation = shape.rotation || 0
  if (rotation !== 0) {
    const center = getShapeCenter(shape)
    ctx.translate(center.x, center.y)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.translate(-center.x, -center.y)
  }
}

function drawShapeOutline(ctx: CanvasRenderingContext2D, shape: ShapeSelection, viewport: ViewPort): void {
  if (shape.type === 'ellipse') {
    ctx.beginPath()
    ctx.ellipse(
      shape.x + shape.width / 2,
      shape.y + shape.height / 2,
      shape.width / 2,
      shape.height / 2,
      0,
      0,
      2 * Math.PI
    )
    ctx.stroke()
  } else {
    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
  }
}

export function drawMovingShapeFeedback(
  ctx: CanvasRenderingContext2D,
  shape: ShapeSelection | undefined,
  viewport: ViewPort
): void {
  if (!shape) return

  ctx.save()
  applyViewportAndRotation(ctx, viewport, shape)
  ctx.strokeStyle = '#00ff00'
  ctx.lineWidth = 2 / viewport.scale
  ctx.setLineDash([5 / viewport.scale, 5 / viewport.scale])
  drawShapeOutline(ctx, shape, viewport)
  ctx.restore()
}

export function drawResizingShapeFeedback(
  ctx: CanvasRenderingContext2D,
  shape: ShapeSelection | undefined,
  viewport: ViewPort
): void {
  if (!shape) return

  ctx.save()

  if (shape.type === 'vector') {
    ctx.translate(viewport.left, viewport.top)
    ctx.scale(viewport.scale, viewport.scale)
    ctx.strokeStyle = '#ff6600'
    ctx.lineWidth = 2 / viewport.scale
    ctx.setLineDash([3 / viewport.scale, 3 / viewport.scale])
    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
  } else {
    applyViewportAndRotation(ctx, viewport, shape)
    ctx.strokeStyle = '#ff6600'
    ctx.lineWidth = 2 / viewport.scale
    ctx.setLineDash([3 / viewport.scale, 3 / viewport.scale])
    drawShapeOutline(ctx, shape, viewport)
  }

  ctx.restore()
}
