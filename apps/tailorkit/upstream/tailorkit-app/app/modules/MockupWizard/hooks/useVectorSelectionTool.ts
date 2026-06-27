/**
 * MockupWizard adapter hook for vector path drawing.
 *
 * Wraps the shared useVectorPathDrawing hook with MockupWizard-specific behavior:
 * - Coordinate transformation (canvas pixels → image coordinates via viewport)
 * - Path completion → VectorShape creation with bounding box and pathD cache
 * - Canvas 2D rendering for drawing state feedback
 * - Keyboard shortcut handling (Enter to finish, Escape to cancel)
 */

import { useCallback, useEffect } from 'react'
import type { Point } from '~/modules/VectorEditor/utils/svg'
import { useVectorPathDrawing } from '~/hooks/useVectorPathDrawing'
import type { VectorShape } from '../types'
import { computePathBoundingBox, serializePathCommandsToD } from '../utils/vectorPathUtils'
import { CANVAS_STYLES } from '../constants'

interface UseVectorSelectionToolOptions {
  /** Whether vector mode is currently active */
  isActive: boolean
  /** Current viewport scale for threshold scaling */
  viewportScale: number
  /** Transform canvas pixel coords to image coords */
  transformCanvasToImage: (x: number, y: number) => Point
  /** Transform image coords to canvas pixel coords */
  transformImageToCanvas: (x: number, y: number) => Point
  /** Callback when a complete vector shape is created */
  onVectorShapeComplete: (shape: VectorShape) => void
}

export function useVectorSelectionTool({
  isActive,
  viewportScale,
  transformCanvasToImage,
  transformImageToCanvas,
  onVectorShapeComplete,
}: UseVectorSelectionToolOptions) {
  const drawing = useVectorPathDrawing({
    curveType: 'quadratic',
    autoClose: true, // Always produce closed paths for selection areas
  })

  // Destructure stable callbacks to satisfy exhaustive-deps without referencing the full object
  const {
    onMouseDown: drawingMouseDown,
    onMouseMove: drawingMouseMove,
    onMouseUp: drawingMouseUp,
    handleFinishDrawing,
    handleCancelDrawing,
    handleUndo: drawingUndo,
    handleRedo: drawingRedo,
    isDrawing,
  } = drawing

  // ── Event handlers with coordinate transformation ──

  const handleMouseDown = useCallback(
    (canvasX: number, canvasY: number) => {
      if (!isActive) return
      const imagePos = transformCanvasToImage(canvasX, canvasY)
      drawingMouseDown(imagePos, viewportScale)
    },
    [isActive, transformCanvasToImage, viewportScale, drawingMouseDown]
  )

  const handleMouseMove = useCallback(
    (canvasX: number, canvasY: number) => {
      if (!isActive) return
      const imagePos = transformCanvasToImage(canvasX, canvasY)
      drawingMouseMove(imagePos, viewportScale)
    },
    [isActive, transformCanvasToImage, viewportScale, drawingMouseMove]
  )

  const handleMouseUp = useCallback(() => {
    if (!isActive) return
    drawingMouseUp()
  }, [isActive, drawingMouseUp])

  // ── Path completion ──

  const finishDrawing = useCallback(() => {
    const commands = handleFinishDrawing()
    if (!commands || commands.length < 3) return // Need at least M + L/Q/C + Z

    const bbox = computePathBoundingBox(commands)
    const pathD = serializePathCommandsToD(commands)

    const vectorShape: VectorShape = {
      type: 'vector',
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      pathCommands: commands,
      pathD,
      source: 'manual',
    }

    onVectorShapeComplete(vectorShape)
  }, [handleFinishDrawing, onVectorShapeComplete])

  const cancelDrawing = useCallback(() => {
    handleCancelDrawing()
  }, [handleCancelDrawing])

  // ── Keyboard shortcuts ──

  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && isDrawing) {
        e.preventDefault()
        finishDrawing()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelDrawing()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && isDrawing) {
        e.preventDefault()
        drawingUndo()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey && isDrawing) {
        e.preventDefault()
        drawingRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, isDrawing, drawingUndo, drawingRedo, finishDrawing, cancelDrawing])

  // ── Canvas 2D rendering ──

  const renderDrawingState = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const { drawingPath, drawPreviewPos, drawDragStart, drawDragCurrent, isDrawDragging, hoveredDrawingNodeIndex }
        = drawing

      // Styles matching VectorEditor (constants.ts COLORS + EditorCanvas rendering)
      const V = CANVAS_STYLES.VECTOR_DRAWING
      const nodeR = V.NODE_RADIUS // 6px — matches VectorEditor NODE_RADIUS

      // NOTE: Renders with identity transform — all sizes in fixed screen pixels.

      // First-point drag preview (no path yet)
      if ((!drawingPath || drawingPath.length === 0) && isDrawDragging && drawDragStart && drawDragCurrent) {
        const startCanvas = transformImageToCanvas(drawDragStart.x, drawDragStart.y)
        const currentCanvas = transformImageToCanvas(drawDragCurrent.x, drawDragCurrent.y)

        // Control handle line (dashed grey — matches VectorEditor)
        ctx.beginPath()
        ctx.strokeStyle = V.CONTROL_HANDLE_COLOR
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.moveTo(startCanvas.x, startCanvas.y)
        ctx.lineTo(currentCanvas.x, currentCanvas.y)
        ctx.stroke()
        ctx.setLineDash([])

        // Control point dot (orange — matches VectorEditor)
        ctx.beginPath()
        ctx.arc(currentCanvas.x, currentCanvas.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = V.CONTROL_POINT_FILL
        ctx.strokeStyle = V.CONTROL_POINT_STROKE
        ctx.lineWidth = 1
        ctx.fill()
        ctx.stroke()

        // Start node (green — matches VectorEditor closeable node)
        ctx.beginPath()
        ctx.arc(startCanvas.x, startCanvas.y, nodeR, 0, Math.PI * 2)
        ctx.fillStyle = V.NODE_FILL
        ctx.strokeStyle = V.FIRST_NODE_STROKE
        ctx.lineWidth = 2
        ctx.fill()
        ctx.stroke()
        return
      }

      if (!drawingPath || drawingPath.length === 0) return

      // Draw completed path segments (solid blue — matches VectorEditor draw mode)
      ctx.beginPath()
      ctx.strokeStyle = V.PATH_STROKE
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])

      for (const cmd of drawingPath) {
        const canvasPos = transformImageToCanvas(cmd.x, cmd.y)
        switch (cmd.type) {
          case 'M':
            ctx.moveTo(canvasPos.x, canvasPos.y)
            break
          case 'L':
            ctx.lineTo(canvasPos.x, canvasPos.y)
            break
          case 'Q': {
            const cp = cmd.cp ? transformImageToCanvas(cmd.cp.x, cmd.cp.y) : canvasPos
            ctx.quadraticCurveTo(cp.x, cp.y, canvasPos.x, canvasPos.y)
            break
          }
          case 'C': {
            const cp1 = cmd.cp1 ? transformImageToCanvas(cmd.cp1.x, cmd.cp1.y) : canvasPos
            const cp2 = cmd.cp2 ? transformImageToCanvas(cmd.cp2.x, cmd.cp2.y) : canvasPos
            ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, canvasPos.x, canvasPos.y)
            break
          }
          case 'Z':
            ctx.closePath()
            break
        }
      }
      ctx.stroke()
      ctx.setLineDash([])

      // Preview line from last point to cursor (dashed light blue — matches VectorEditor)
      if (drawPreviewPos && !isDrawDragging) {
        const lastCmd = drawingPath[drawingPath.length - 1]
        if (lastCmd.type !== 'Z') {
          const lastCanvas = transformImageToCanvas(lastCmd.x, lastCmd.y)
          const previewCanvas = transformImageToCanvas(drawPreviewPos.x, drawPreviewPos.y)

          ctx.beginPath()
          ctx.strokeStyle = V.PREVIEW_LINE_COLOR
          ctx.lineWidth = 1
          ctx.setLineDash(V.PREVIEW_LINE_DASH)
          ctx.moveTo(lastCanvas.x, lastCanvas.y)
          ctx.lineTo(previewCanvas.x, previewCanvas.y)
          ctx.stroke()
          ctx.setLineDash([])
        }
      }

      // Curve preview while dragging (control handle + curve)
      if (isDrawDragging && drawDragStart && drawDragCurrent) {
        const lastCmd = drawingPath[drawingPath.length - 1]
        if (lastCmd && lastCmd.type !== 'Z') {
          const lastCanvas = transformImageToCanvas(lastCmd.x, lastCmd.y)
          const dragStartCanvas = transformImageToCanvas(drawDragStart.x, drawDragStart.y)
          const dragCurrentCanvas = transformImageToCanvas(drawDragCurrent.x, drawDragCurrent.y)

          // Control handle line (dashed grey — matches VectorEditor)
          ctx.beginPath()
          ctx.strokeStyle = V.CONTROL_HANDLE_COLOR
          ctx.lineWidth = 1
          ctx.setLineDash([3, 3])
          ctx.moveTo(dragStartCanvas.x, dragStartCanvas.y)
          ctx.lineTo(dragCurrentCanvas.x, dragCurrentCanvas.y)
          ctx.stroke()
          ctx.setLineDash([])

          // Control point dot (orange — matches VectorEditor)
          ctx.beginPath()
          ctx.arc(dragCurrentCanvas.x, dragCurrentCanvas.y, 4, 0, Math.PI * 2)
          ctx.fillStyle = V.CONTROL_POINT_FILL
          ctx.strokeStyle = V.CONTROL_POINT_STROKE
          ctx.lineWidth = 1
          ctx.fill()
          ctx.stroke()

          // Curve preview
          const dx = drawDragCurrent.x - drawDragStart.x
          const dy = drawDragCurrent.y - drawDragStart.y
          const cpX = lastCmd.x + dx / 2
          const cpY = lastCmd.y + dy / 2
          const cpCanvas = transformImageToCanvas(cpX, cpY)

          ctx.beginPath()
          ctx.strokeStyle = V.CURVE_PREVIEW_STROKE
          ctx.lineWidth = 2
          ctx.moveTo(lastCanvas.x, lastCanvas.y)
          ctx.quadraticCurveTo(cpCanvas.x, cpCanvas.y, dragStartCanvas.x, dragStartCanvas.y)
          ctx.stroke()
        }
      }

      // Find open subpath start for close-target detection
      let currentOpenSubpathStart = -1
      let lastMIndex = -1
      for (let j = 0; j < drawingPath.length; j++) {
        if (drawingPath[j].type === 'M') lastMIndex = j
        if (drawingPath[j].type === 'Z') lastMIndex = -1
      }
      currentOpenSubpathStart = lastMIndex

      // Draw nodes (matching VectorEditor style)
      for (let i = 0; i < drawingPath.length; i++) {
        const cmd = drawingPath[i]
        if (cmd.type === 'Z') continue

        const nodeCanvas = transformImageToCanvas(cmd.x, cmd.y)
        const isHovered = hoveredDrawingNodeIndex === i
        const isCloseTarget = i === currentOpenSubpathStart && drawingPath.length >= 3

        ctx.beginPath()

        if (isCloseTarget && isHovered) {
          // Enlarged highlight ring (green filled — matches VectorEditor)
          ctx.arc(nodeCanvas.x, nodeCanvas.y, nodeR * 2, 0, Math.PI * 2)
          ctx.fillStyle = V.FIRST_NODE_FILL_HOVERED
          ctx.strokeStyle = '#009933'
          ctx.lineWidth = 2
        } else if (isCloseTarget) {
          ctx.arc(nodeCanvas.x, nodeCanvas.y, nodeR, 0, Math.PI * 2)
          ctx.fillStyle = V.NODE_FILL
          ctx.strokeStyle = V.FIRST_NODE_STROKE
          ctx.lineWidth = 2
        } else {
          // Normal node: hollow circle with blue stroke (matches VectorEditor unselected node)
          ctx.arc(nodeCanvas.x, nodeCanvas.y, isHovered ? nodeR * 1.5 : nodeR, 0, Math.PI * 2)
          ctx.fillStyle = isHovered ? V.NODE_SELECTED_FILL : V.NODE_FILL
          ctx.strokeStyle = isHovered ? V.NODE_SELECTED_STROKE : V.NODE_STROKE
          ctx.lineWidth = 2
        }

        ctx.fill()
        ctx.stroke()
      }
    },
    [drawing, transformImageToCanvas]
  )

  return {
    /** Whether vector drawing is currently in progress */
    isDrawing,
    /** The current drawing path commands */
    drawingPath: drawing.drawingPath,
    /** Whether user is actively dragging (for render dependency) */
    isDrawDragging: drawing.isDrawDragging,
    /** Current drag position (for render dependency) */
    drawDragCurrent: drawing.drawDragCurrent,
    /** Hovered node index (for render dependency — triggers node highlight redraw) */
    hoveredDrawingNodeIndex: drawing.hoveredDrawingNodeIndex,
    /** Preview cursor position (for render dependency — triggers preview line redraw) */
    drawPreviewPos: drawing.drawPreviewPos,

    // Event handlers (accept canvas pixel coordinates)
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,

    // Actions
    finishDrawing,
    cancelDrawing,
    undo: drawingUndo,
    redo: drawingRedo,
    canUndo: drawing.canUndo,
    canRedo: drawing.canRedo,

    // Rendering
    renderDrawingState,
  }
}
