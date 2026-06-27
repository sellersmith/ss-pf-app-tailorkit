/**
 * useShapeDrawingTool — Rectangle/Ellipse drawing tool hook.
 *
 * Extracts all drawing logic from useCanvasState and InteractiveCanvas.
 * Handles mouse down/move/up, shape type switching, and canvas rendering.
 */

import { useState, useCallback, useRef } from 'react'
import type { RectangularShape, EllipseShape, ShapeSelection } from '../types'
import { createRectangularShape, createEllipseShape } from '../utils/shapeUtils'
import { CANVAS_STYLES } from '../constants'

interface UseShapeDrawingToolOptions {
  /** Whether the drawing tool is currently active */
  isActive: boolean
  /** The current shape type to draw */
  shapeType: 'rectangle' | 'ellipse'
  /** The loaded image element (for bounds checking) */
  image: HTMLImageElement | null
  /** Transform canvas pixel coords → image coords */
  transformCanvasToImage: (x: number, y: number) => { x: number; y: number }
  /** Transform image coords → canvas pixel coords */
  transformImageToCanvas: (x: number, y: number) => { x: number; y: number }
  /** Called when a shape is complete */
  onShapeComplete: (shape: ShapeSelection) => void
  /** Called when Shift+draw completes (expand existing selection) */
  onShiftExpand?: (shape: ShapeSelection) => void
}

/** Minimum size threshold in image coords to accept a drawn shape */
const MIN_SIZE_PX = 5

export function useShapeDrawingTool({
  isActive,
  shapeType,
  image,
  transformCanvasToImage,
  transformImageToCanvas,
  onShapeComplete,
  onShiftExpand,
}: UseShapeDrawingToolOptions) {
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentSelection, setCurrentSelection] = useState<ShapeSelection | null>(null)
  const [activeShapeType, setActiveShapeType] = useState<'rectangle' | 'ellipse'>(shapeType)

  // Image-space coordinates of the mousedown origin
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null)
  const hasMouseMovedRef = useRef(false)
  const shiftDrawingRef = useRef(false)

  // Ref for renderDrawingState to always read latest shape type without closure issues
  const activeShapeTypeRef = useRef(activeShapeType)
  activeShapeTypeRef.current = activeShapeType

  const currentSelectionRef = useRef(currentSelection)
  currentSelectionRef.current = currentSelection

  /** Constrain image coordinates to image bounds */
  const constrainToImage = useCallback(
    (imgX: number, imgY: number): { x: number; y: number } => {
      if (!image) return { x: imgX, y: imgY }
      return {
        x: Math.max(0, Math.min(imgX, image.width)),
        y: Math.max(0, Math.min(imgY, image.height)),
      }
    },
    [image]
  )

  /**
   * Handle mouse down — starts drawing.
   * @param canvasX  canvas pixel X
   * @param canvasY  canvas pixel Y
   * @param shiftKey whether Shift was held
   */
  const handleMouseDown = useCallback(
    (canvasX: number, canvasY: number, shiftKey = false) => {
      if (!isActive || !image) return

      // Convert to image coords and constrain
      const raw = transformCanvasToImage(canvasX, canvasY)
      const imgPos = constrainToImage(raw.x, raw.y)

      // Store image-space origin
      mouseDownPosRef.current = imgPos
      hasMouseMovedRef.current = false
      shiftDrawingRef.current = shiftKey

      // Determine active shape type (prop can change mid-session)
      const typeToUse = shapeType
      setActiveShapeType(typeToUse)
      activeShapeTypeRef.current = typeToUse

      // Convert constrained image coords back to canvas coords for initial shape
      const canvasPos = transformImageToCanvas(imgPos.x, imgPos.y)

      // Create a zero-size initial shape in canvas space
      const initial: ShapeSelection
        = typeToUse === 'ellipse'
          ? createEllipseShape(canvasPos.x, canvasPos.y, 0, 0)
          : createRectangularShape(canvasPos.x, canvasPos.y, 0, 0)

      setCurrentSelection(initial)
      setIsDrawing(true)
    },
    [isActive, image, shapeType, transformCanvasToImage, transformImageToCanvas, constrainToImage]
  )

  /**
   * Handle mouse move — updates the shape preview.
   * @param canvasX  canvas pixel X (current mouse position)
   * @param canvasY  canvas pixel Y
   */
  const handleMouseMove = useCallback(
    (canvasX: number, canvasY: number) => {
      if (!isDrawing || !mouseDownPosRef.current || !image) return

      hasMouseMovedRef.current = true

      // Constrain current position to image bounds (image coords)
      const rawImg = transformCanvasToImage(canvasX, canvasY)
      const curImg = constrainToImage(rawImg.x, rawImg.y)

      // Convert mousedown origin (image) → canvas coords
      const originCanvas = transformImageToCanvas(mouseDownPosRef.current.x, mouseDownPosRef.current.y)
      // Convert current pos (image) → canvas coords
      const curCanvas = transformImageToCanvas(curImg.x, curImg.y)

      // Compute canvas-space bounding box
      const x = Math.min(originCanvas.x, curCanvas.x)
      const y = Math.min(originCanvas.y, curCanvas.y)
      const width = Math.abs(curCanvas.x - originCanvas.x)
      const height = Math.abs(curCanvas.y - originCanvas.y)

      const updated: ShapeSelection
        = activeShapeTypeRef.current === 'ellipse'
          ? createEllipseShape(x, y, width, height)
          : createRectangularShape(x, y, width, height)

      setCurrentSelection(updated)
    },
    [isDrawing, image, transformCanvasToImage, transformImageToCanvas, constrainToImage]
  )

  /**
   * Handle mouse up — finalises the shape.
   */
  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !hasMouseMovedRef.current) {
      // Not a real draw — reset and bail
      setIsDrawing(false)
      setCurrentSelection(null)
      mouseDownPosRef.current = null
      hasMouseMovedRef.current = false
      shiftDrawingRef.current = false
      return
    }

    const sel = currentSelectionRef.current
    if (!sel) {
      setIsDrawing(false)
      setCurrentSelection(null)
      mouseDownPosRef.current = null
      hasMouseMovedRef.current = false
      shiftDrawingRef.current = false
      return
    }

    // Convert canvas-space selection back to image coords
    const imgTopLeft = transformCanvasToImage(sel.x, sel.y)
    const imgBottomRight = transformCanvasToImage(sel.x + sel.width, sel.y + sel.height)

    const imgW = imgBottomRight.x - imgTopLeft.x
    const imgH = imgBottomRight.y - imgTopLeft.y

    // Only emit if larger than min size threshold
    if (imgW > MIN_SIZE_PX || imgH > MIN_SIZE_PX) {
      const finalShape: ShapeSelection = {
        x: imgTopLeft.x,
        y: imgTopLeft.y,
        width: imgW,
        height: imgH,
        type: activeShapeTypeRef.current as 'rectangle' | 'ellipse',
        source: 'manual' as const,
        shapeId: activeShapeTypeRef.current === 'ellipse' ? `ellipse-${Date.now()}` : `rectangle-${Date.now()}`,
      }

      if (shiftDrawingRef.current && onShiftExpand) {
        onShiftExpand(finalShape)
      } else {
        onShapeComplete(finalShape)
      }
    }

    // Always reset
    setIsDrawing(false)
    setCurrentSelection(null)
    mouseDownPosRef.current = null
    hasMouseMovedRef.current = false
    shiftDrawingRef.current = false
  }, [isDrawing, transformCanvasToImage, onShapeComplete, onShiftExpand])

  /**
   * Cancel the current drawing operation without emitting a shape.
   */
  const cancelDrawing = useCallback(() => {
    setIsDrawing(false)
    setCurrentSelection(null)
    mouseDownPosRef.current = null
    hasMouseMovedRef.current = false
    shiftDrawingRef.current = false
  }, [])

  /**
   * Switch shape type mid-draw (e.g. on Shift key press).
   * Recreates currentSelection with same coords but new type.
   */
  const switchShapeType = useCallback(
    (type: 'rectangle' | 'ellipse') => {
      if (!isDrawing || !currentSelectionRef.current) return

      const sel = currentSelectionRef.current
      const newSel: ShapeSelection
        = type === 'ellipse'
          ? createEllipseShape(sel.x, sel.y, sel.width, sel.height)
          : createRectangularShape(sel.x, sel.y, sel.width, sel.height)

      setActiveShapeType(type)
      activeShapeTypeRef.current = type
      setCurrentSelection(newSel)
    },
    [isDrawing]
  )

  /**
   * Render the current drawing preview onto the canvas.
   * Call this from the redraw cycle (no React state reads inside).
   */
  const renderDrawingState = useCallback((ctx: CanvasRenderingContext2D) => {
    const sel = currentSelectionRef.current
    if (!sel) return

    const { STROKE, FILL, LINE_WIDTH, LINE_DASH } = CANVAS_STYLES.CURRENT_DRAWING

    ctx.save()
    ctx.strokeStyle = STROKE
    ctx.fillStyle = FILL
    ctx.lineWidth = LINE_WIDTH
    ctx.setLineDash([...LINE_DASH])

    if (activeShapeTypeRef.current === 'ellipse') {
      const cx = sel.x + sel.width / 2
      const cy = sel.y + sel.height / 2
      const rx = sel.width / 2
      const ry = sel.height / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, Math.max(rx, 0), Math.max(ry, 0), 0, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()
    } else {
      ctx.fillRect(sel.x, sel.y, sel.width, sel.height)
      ctx.strokeRect(sel.x, sel.y, sel.width, sel.height)
    }

    ctx.setLineDash([])
    ctx.restore()
  }, [])

  return {
    isDrawing,
    currentSelection,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    cancelDrawing,
    switchShapeType,
    renderDrawingState,
  }
}
