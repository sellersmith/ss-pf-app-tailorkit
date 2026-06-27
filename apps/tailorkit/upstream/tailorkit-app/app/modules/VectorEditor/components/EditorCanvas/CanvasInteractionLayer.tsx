/**
 * CanvasInteractionLayer - Canvas 2D for node editing and hit detection
 * This layer renders interactive elements (nodes, control points, selection rect)
 * with a transparent background to show the SVG preview layer beneath
 */

import React, { useRef, useEffect, useCallback } from 'react'
import { serializePathCommands } from '../../utils/svg'
import type { Point, ParsedSvg } from '../../utils/svg'
import type { EditorMode, HoveredSegment, SelectionRect, PathCommand } from '../../types'
import { NODE_RADIUS, CONTROL_POINT_RADIUS, CHECKER_SIZE, COLORS } from '../../constants'
import styles from './styles.module.css'

export interface CanvasInteractionLayerProps {
  parsedSvg: ParsedSvg
  selectedPathIndex: number | null
  selectedNodeIndex: number | null
  selectedNodeIndices: Set<number>
  hoveredPathIndex: number | null
  hoveredSegment: HoveredSegment | null
  selectionRect: SelectionRect | null
  drawingPath: PathCommand[] | null
  drawPreviewPos: Point | null
  hoveredDrawingNodeIndex: number | null
  editorMode: EditorMode
  scaleRef: React.MutableRefObject<number>
  offsetRef: React.MutableRefObject<Point>
  width: number
  height: number
  svgToScreen: (svgX: number, svgY: number) => Point
  onRequestRender?: () => void
}

export default function CanvasInteractionLayer({
  parsedSvg,
  selectedPathIndex,
  selectedNodeIndex,
  selectedNodeIndices,
  hoveredPathIndex,
  hoveredSegment,
  selectionRect,
  drawingPath,
  drawPreviewPos,
  hoveredDrawingNodeIndex,
  editorMode,
  scaleRef,
  offsetRef,
  width,
  height,
  svgToScreen,
}: CanvasInteractionLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // RAF batching for smooth rendering
  const rafIdRef = useRef<number | null>(null)
  const needsRenderRef = useRef(false)

  // Cached checkerboard canvas (avoid redrawing every frame)
  const checkerboardRef = useRef<HTMLCanvasElement | null>(null)

  // Create/update cached checkerboard when canvas size changes
  useEffect(() => {
    if (width === 0 || height === 0) return

    const checker = document.createElement('canvas')
    checker.width = width
    checker.height = height
    const ctx = checker.getContext('2d')
    if (!ctx) return

    for (let x = 0; x < width; x += CHECKER_SIZE) {
      for (let y = 0; y < height; y += CHECKER_SIZE) {
        ctx.fillStyle = (x / CHECKER_SIZE + y / CHECKER_SIZE) % 2 === 0 ? COLORS.checkerLight : COLORS.checkerDark
        ctx.fillRect(x, y, CHECKER_SIZE, CHECKER_SIZE)
      }
    }
    checkerboardRef.current = checker
  }, [width, height])

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [])

  // Render canvas function (called via RAF)
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !parsedSvg) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Use refs for real-time viewport values
    const currentScale = scaleRef.current
    const currentOffset = offsetRef.current

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw cached checkerboard background (single drawImage call)
    if (checkerboardRef.current) {
      ctx.drawImage(checkerboardRef.current, 0, 0)
    }

    // Save context and apply transform
    ctx.save()
    ctx.translate(currentOffset.x, currentOffset.y)
    ctx.scale(currentScale, currentScale)

    // Draw each path (just outlines for visual feedback)
    parsedSvg.paths.forEach((path, pathIndex) => {
      const pathD = serializePathCommands(path.commands)
      const path2D = new Path2D(pathD)

      // Fill path if it has a fill color (not 'none')
      if (path.fill && path.fill !== 'none') {
        ctx.fillStyle = path.fill
        ctx.fill(path2D, path.fillRule || 'nonzero')
      }

      // Stroke path if it has a stroke color (for open paths)
      if (path.stroke && path.stroke !== 'none') {
        ctx.strokeStyle = path.stroke
        ctx.lineWidth = (path.strokeWidth || 1) / currentScale
        ctx.stroke(path2D)
      }

      // Additional stroke for selected/hovered paths (visual feedback)
      if (pathIndex === selectedPathIndex) {
        ctx.strokeStyle = COLORS.selectedPath
        ctx.lineWidth = 2 / currentScale
        ctx.stroke(path2D)
      } else if (pathIndex === hoveredPathIndex) {
        ctx.strokeStyle = COLORS.hoveredPath
        ctx.lineWidth = 1.5 / currentScale
        ctx.setLineDash([4 / currentScale, 4 / currentScale])
        ctx.stroke(path2D)
        ctx.setLineDash([])
      }
    })

    ctx.restore()

    // Draw nodes for selected path
    if (selectedPathIndex !== null) {
      const path = parsedSvg.paths[selectedPathIndex]

      path.commands.forEach((command, nodeIndex) => {
        const { x: screenX, y: screenY } = svgToScreen(command.x, command.y)
        const nodeRadius = NODE_RADIUS
        const isMultiSelected = selectedNodeIndices.has(nodeIndex)

        // Draw control point lines and circles for bezier curves (only for selected node)
        if (nodeIndex === selectedNodeIndex && (command.cp1 || command.cp2 || command.cp)) {
          ctx.strokeStyle = COLORS.controlPointLine
          ctx.lineWidth = 1
          ctx.setLineDash([3, 3])

          if (command.cp1) {
            const cp1Screen = svgToScreen(command.cp1.x, command.cp1.y)
            ctx.beginPath()
            ctx.moveTo(screenX, screenY)
            ctx.lineTo(cp1Screen.x, cp1Screen.y)
            ctx.stroke()

            ctx.beginPath()
            ctx.arc(cp1Screen.x, cp1Screen.y, CONTROL_POINT_RADIUS, 0, Math.PI * 2)
            ctx.fillStyle = nodeIndex === selectedNodeIndex ? COLORS.controlPoint : '#ffffff'
            ctx.fill()
            ctx.strokeStyle = COLORS.controlPointBorder
            ctx.setLineDash([])
            ctx.stroke()
          }

          if (command.cp2) {
            const cp2Screen = svgToScreen(command.cp2.x, command.cp2.y)
            ctx.setLineDash([3, 3])
            ctx.strokeStyle = COLORS.controlPointLine
            ctx.beginPath()
            ctx.moveTo(screenX, screenY)
            ctx.lineTo(cp2Screen.x, cp2Screen.y)
            ctx.stroke()

            ctx.beginPath()
            ctx.arc(cp2Screen.x, cp2Screen.y, CONTROL_POINT_RADIUS, 0, Math.PI * 2)
            ctx.fillStyle = nodeIndex === selectedNodeIndex ? COLORS.controlPoint : '#ffffff'
            ctx.fill()
            ctx.strokeStyle = COLORS.controlPointBorder
            ctx.setLineDash([])
            ctx.stroke()
          }

          if (command.cp) {
            const cpScreen = svgToScreen(command.cp.x, command.cp.y)
            ctx.setLineDash([3, 3])
            ctx.strokeStyle = COLORS.controlPointLine
            ctx.beginPath()
            ctx.moveTo(screenX, screenY)
            ctx.lineTo(cpScreen.x, cpScreen.y)
            ctx.stroke()

            ctx.beginPath()
            ctx.arc(cpScreen.x, cpScreen.y, CONTROL_POINT_RADIUS, 0, Math.PI * 2)
            ctx.fillStyle = nodeIndex === selectedNodeIndex ? COLORS.controlPoint : '#ffffff'
            ctx.fill()
            ctx.strokeStyle = COLORS.controlPointBorder
            ctx.setLineDash([])
            ctx.stroke()
          }

          ctx.setLineDash([])
        }

        // Skip Z commands for node drawing
        if (command.type.toUpperCase() === 'Z') return

        // Draw node circle
        ctx.beginPath()
        ctx.arc(screenX, screenY, nodeRadius, 0, Math.PI * 2)
        if (nodeIndex === selectedNodeIndex) {
          ctx.fillStyle = COLORS.selectedNode
          ctx.strokeStyle = COLORS.selectedNodeBorder
        } else if (isMultiSelected) {
          ctx.fillStyle = COLORS.multiSelectedNode
          ctx.strokeStyle = COLORS.multiSelectedNodeBorder
        } else {
          ctx.fillStyle = COLORS.unselectedNode
          ctx.strokeStyle = COLORS.unselectedNodeBorder
        }
        ctx.fill()
        ctx.lineWidth = 2
        ctx.stroke()
      })
    }

    // Draw hovered segment highlight (for node insertion)
    if (hoveredSegment) {
      const path = parsedSvg.paths[hoveredSegment.pathIndex]
      const segmentIndex = hoveredSegment.segmentIndex
      const prevCmd = path.commands[segmentIndex - 1]
      const cmd = path.commands[segmentIndex]

      if (prevCmd && cmd) {
        const start = svgToScreen(prevCmd.x, prevCmd.y)
        const end = svgToScreen(cmd.x, cmd.y)
        const insertPoint = svgToScreen(hoveredSegment.position.x, hoveredSegment.position.y)

        ctx.strokeStyle = COLORS.segmentHighlight
        ctx.lineWidth = 3
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(start.x, start.y)

        if (cmd.type === 'C' || cmd.type === 'c') {
          const cp1 = svgToScreen(cmd.cp1!.x, cmd.cp1!.y)
          const cp2 = svgToScreen(cmd.cp2!.x, cmd.cp2!.y)
          ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y)
        } else if (cmd.type === 'Q' || cmd.type === 'q') {
          const cp = svgToScreen(cmd.cp!.x, cmd.cp!.y)
          ctx.quadraticCurveTo(cp.x, cp.y, end.x, end.y)
        } else {
          ctx.lineTo(end.x, end.y)
        }
        ctx.stroke()

        // Draw insertion point indicator
        ctx.beginPath()
        ctx.arc(insertPoint.x, insertPoint.y, NODE_RADIUS + 2, 0, Math.PI * 2)
        ctx.fillStyle = COLORS.insertionPoint
        ctx.fill()
        ctx.strokeStyle = COLORS.insertionPointBorder
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(insertPoint.x, insertPoint.y, 2, 0, Math.PI * 2)
        ctx.fillStyle = COLORS.insertionPointInner
        ctx.fill()
      }
    }

    // Draw selection rectangle
    if (selectionRect) {
      ctx.strokeStyle = COLORS.selectionRect
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height)
      ctx.fillStyle = COLORS.selectionRectFill
      ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height)
      ctx.setLineDash([])
    }

    // Draw in-progress path (draw mode)
    if (drawingPath && drawingPath.length > 0) {
      ctx.strokeStyle = COLORS.drawingPath
      ctx.lineWidth = 2 / currentScale
      ctx.setLineDash([5 / currentScale, 5 / currentScale])
      ctx.beginPath()

      drawingPath.forEach((cmd, idx) => {
        const { x: sx, y: sy } = svgToScreen(cmd.x, cmd.y)
        if (idx === 0 || cmd.type === 'M' || cmd.type === 'm') {
          ctx.moveTo(sx, sy)
        } else {
          ctx.lineTo(sx, sy)
        }
      })
      ctx.stroke()
      ctx.setLineDash([])

      // Draw nodes for drawing path
      drawingPath.forEach((cmd, index) => {
        const { x: sx, y: sy } = svgToScreen(cmd.x, cmd.y)
        ctx.beginPath()
        ctx.arc(sx, sy, NODE_RADIUS, 0, Math.PI * 2)

        // Highlight if this is the hovered closeable node (not the last node)
        if (index === hoveredDrawingNodeIndex && index < drawingPath.length - 1) {
          ctx.fillStyle = COLORS.closeableNode
          ctx.fill()
          ctx.strokeStyle = COLORS.closeableNodeBorder
          ctx.lineWidth = 2
          ctx.stroke()
        } else {
          ctx.fillStyle = COLORS.drawingPath
          ctx.fill()
          ctx.strokeStyle = COLORS.drawingPathBorder
          ctx.lineWidth = 2
          ctx.stroke()
        }
      })

      // Draw preview line from last point to cursor
      if (drawPreviewPos && drawingPath.length > 0) {
        const lastCmd = drawingPath[drawingPath.length - 1]
        const lastPoint = svgToScreen(lastCmd.x, lastCmd.y)
        const previewPoint = svgToScreen(drawPreviewPos.x, drawPreviewPos.y)

        ctx.strokeStyle = COLORS.drawingPreview
        ctx.lineWidth = 1 / currentScale
        ctx.setLineDash([3 / currentScale, 3 / currentScale])
        ctx.beginPath()
        ctx.moveTo(lastPoint.x, lastPoint.y)
        ctx.lineTo(previewPoint.x, previewPoint.y)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }, [
    parsedSvg,
    selectedPathIndex,
    selectedNodeIndex,
    hoveredPathIndex,
    hoveredSegment,
    width,
    height,
    svgToScreen,
    selectedNodeIndices,
    selectionRect,
    drawingPath,
    drawPreviewPos,
    hoveredDrawingNodeIndex,
    scaleRef,
    offsetRef,
  ])

  // Request a render (batched via RAF)
  const requestRender = useCallback(() => {
    if (needsRenderRef.current) return
    needsRenderRef.current = true

    rafIdRef.current = requestAnimationFrame(() => {
      needsRenderRef.current = false
      renderCanvas()
    })
  }, [renderCanvas])

  // Trigger render when dependencies change
  useEffect(() => {
    requestRender()
  }, [
    parsedSvg,
    selectedPathIndex,
    selectedNodeIndex,
    hoveredPathIndex,
    hoveredSegment,
    width,
    height,
    selectedNodeIndices,
    selectionRect,
    drawingPath,
    drawPreviewPos,
    hoveredDrawingNodeIndex,
    requestRender,
  ])

  return <canvas ref={canvasRef} width={width} height={height} className={styles.canvasInteractionLayer} />
}
