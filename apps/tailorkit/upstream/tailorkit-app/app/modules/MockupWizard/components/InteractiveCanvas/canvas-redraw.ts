import type { ShapeSelection } from '../../types'
import type { ViewPort } from '~/types/template'
import { redrawCanvas } from '../../utils/canvasDrawing'
import { drawMovingShapeFeedback, drawResizingShapeFeedback } from './canvas-shape-feedback'

interface RedrawDeps {
  canvasRef: React.RefObject<HTMLCanvasElement>
  image: HTMLImageElement | null
  getCanvasContext: () => CanvasRenderingContext2D | null
  shapeSelectionsRef: React.MutableRefObject<ShapeSelection[]>
  selectedShapeIndexRef: React.MutableRefObject<number | null>
  viewportRef: React.MutableRefObject<ViewPort>
  isMovingRef: React.MutableRefObject<boolean>
  isResizingRef: React.MutableRefObject<boolean>
  isRotatingRef: React.MutableRefObject<boolean>
  movingShapeIndexRef: React.MutableRefObject<number | null>
  resizingShapeIndexRef: React.MutableRefObject<number | null>
  isMobileView: boolean
  nodeEditingRef: React.MutableRefObject<{
    isActive: boolean
    renderNodes: (ctx: CanvasRenderingContext2D) => void
    isDragging: boolean
  }>
  shapeToolRef: React.MutableRefObject<{
    isDrawing: boolean
    currentSelection: ShapeSelection | null
    renderDrawingState: (ctx: CanvasRenderingContext2D) => void
  }>
  isVectorModeRef: React.MutableRefObject<boolean>
  vectorToolRef: React.MutableRefObject<{
    isDrawing: boolean
    renderDrawingState: (ctx: CanvasRenderingContext2D) => void
  }>
  isMagicWandModeRef: React.MutableRefObject<boolean>
  magicWandRef: React.MutableRefObject<{
    hasOverlay: boolean
    renderOverlay: (
      ctx: CanvasRenderingContext2D,
      transformFn: (ix: number, iy: number) => { x: number; y: number }
    ) => void
  }>
  isAutoDetectModeRef: React.MutableRefObject<boolean>
  // Read-only ref view: MutableRefObject<T> is invariant, so we use { readonly current } for covariance
  autoDetectRef: { readonly current: { hasOverlay: boolean; renderOverlay: (ctx: CanvasRenderingContext2D) => void } }
  isPaintModeRef: React.MutableRefObject<boolean>
  paintToolRef: {
    readonly current: {
      hasOverlay: boolean
      renderOverlay: (ctx: CanvasRenderingContext2D, viewport: { scale: number; left: number; top: number }) => void
    }
  }
}

export function performRedraw(deps: RedrawDeps): void {
  const {
    canvasRef,
    image,
    getCanvasContext,
    shapeSelectionsRef,
    selectedShapeIndexRef,
    viewportRef,
    isMovingRef,
    isResizingRef,
    isRotatingRef,
    movingShapeIndexRef,
    resizingShapeIndexRef,
    isMobileView,
    nodeEditingRef,
    shapeToolRef,
    isVectorModeRef,
    vectorToolRef,
    isMagicWandModeRef,
    magicWandRef,
    isAutoDetectModeRef,
    autoDetectRef,
    isPaintModeRef,
    paintToolRef,
  } = deps

  if (!canvasRef.current || !image) return
  const ctx = getCanvasContext()
  if (!ctx) return

  const showHandlesShape
    = isMovingRef.current || isResizingRef.current || nodeEditingRef.current.isActive
      ? null
      : selectedShapeIndexRef.current !== null
        ? { type: 'shape' as const, index: selectedShapeIndexRef.current }
        : null

  redrawCanvas(ctx, image, shapeSelectionsRef.current, showHandlesShape, viewportRef.current, isMobileView)

  if (nodeEditingRef.current.isActive && !isMovingRef.current && !isResizingRef.current && !isRotatingRef.current) {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    nodeEditingRef.current.renderNodes(ctx)
    ctx.restore()
  }

  if (shapeToolRef.current.isDrawing && shapeToolRef.current.currentSelection) {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    shapeToolRef.current.renderDrawingState(ctx)
    ctx.restore()
  }

  if (isVectorModeRef.current) {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    vectorToolRef.current.renderDrawingState(ctx)
    ctx.restore()
  }

  if (isMagicWandModeRef.current && magicWandRef.current.hasOverlay) {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    magicWandRef.current.renderOverlay(ctx, (ix: number, iy: number) => {
      const vp = viewportRef.current
      return { x: ix * vp.scale + vp.left, y: iy * vp.scale + vp.top }
    })
    ctx.restore()
  }

  if (isAutoDetectModeRef.current && autoDetectRef.current.hasOverlay) {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    autoDetectRef.current.renderOverlay(ctx)
    ctx.restore()
  }

  if (isPaintModeRef.current && paintToolRef.current.hasOverlay) {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    paintToolRef.current.renderOverlay(ctx, viewportRef.current)
    ctx.restore()
  }

  if (isMovingRef.current && movingShapeIndexRef.current !== null) {
    drawMovingShapeFeedback(ctx, shapeSelectionsRef.current[movingShapeIndexRef.current], viewportRef.current)
  }

  if (isResizingRef.current && resizingShapeIndexRef.current !== null) {
    drawResizingShapeFeedback(ctx, shapeSelectionsRef.current[resizingShapeIndexRef.current], viewportRef.current)
  }
}
