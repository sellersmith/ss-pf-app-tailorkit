import type React from 'react'
import { useCallback } from 'react'
import type { PathCommand } from '~/modules/VectorEditor/utils/svg'
import type { ShapeSelection } from '../../types'
import {
  constrainShape,
  updateShapeWithHandle,
  calculateRotationFromDrag,
  rotateShape,
  getCursorForHandle,
} from '../../utils/shapeUtils'
import { computeCursorStyle } from './canvas-cursor'
import type { MouseHandlerParams } from './mouse-handler-types'
import { scaleVectorPathCommands } from './vector-path-scale'

export function useMouseMove(p: MouseHandlerParams) {
  const {
    image,
    canvasRef,
    getCanvasCoordinates,
    shapeSelections,
    onShapeSelectionsChange,
    interaction,
    zoom,
    isVectorMode,
    isMagicWandMode,
    findShapeAtPoint,
    isWithinImageBounds,
    transformCanvasToImage,
    isMobileView,
    magicWand,
    nodeEditing,
    vectorTool,
    shapeTool,
    serializePathCommandsToD,
  } = p

  return useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!image || !canvasRef.current) return
      const coords = getCanvasCoordinates(event)
      if (!coords) return
      const { x, y } = transformCanvasToImage(coords.x, coords.y)
      const canvas = canvasRef.current

      if (nodeEditing.isActive && !interaction.isMoving && !interaction.isResizing && !interaction.isRotating) {
        if (nodeEditing.handleMouseMove(x, y, event.shiftKey)) {
          canvas.style.cursor = nodeEditing.isMarqueeSelecting ? 'crosshair' : 'grabbing'
          return
        }
      }

      if (
        interaction.isRotating
        && interaction.rotatingShapeIndex !== null
        && interaction.rotationStartAngle !== null
      ) {
        const shape = shapeSelections[interaction.rotatingShapeIndex]
        if (shape) {
          const angleDelta = calculateRotationFromDrag(x, y, shape) - interaction.rotationStartAngle
          let r = interaction.originalRotation + angleDelta
          if (r < 0) r += 360
          if (r >= 360) r -= 360
          const updated = [...shapeSelections]
          updated[interaction.rotatingShapeIndex] = rotateShape(shape, r)
          onShapeSelectionsChange(updated)
          canvas.style.cursor = 'grabbing'
        }
        return
      }

      if (
        interaction.isResizing
        && interaction.resizingShapeIndex !== null
        && interaction.resizeHandle
        && interaction.resizeStartPos
        && interaction.originalShape
      ) {
        const dx = x - interaction.resizeStartPos.x
        const dy = y - interaction.resizeStartPos.y
        let updatedShape: ShapeSelection = updateShapeWithHandle(
          interaction.originalShape,
          interaction.resizeHandle,
          dx,
          dy
        )
        if (
          updatedShape.type === 'vector'
          && interaction.originalShape.type === 'vector'
          && interaction.originalShape.width > 0
          && interaction.originalShape.height > 0
        ) {
          const sx = updatedShape.width / interaction.originalShape.width
          const sy = updatedShape.height / interaction.originalShape.height
          const { x: ox, y: oy } = interaction.originalShape
          const { x: nx, y: ny } = updatedShape
          const scaledCmds = scaleVectorPathCommands(
            interaction.originalShape.pathCommands as PathCommand[],
            ox,
            oy,
            nx,
            ny,
            sx,
            sy
          )
          updatedShape = {
            ...updatedShape,
            pathCommands: scaledCmds,
            pathD: serializePathCommandsToD(scaledCmds),
            rotation: interaction.originalShape.rotation,
          }
        }
        const constrained = image
          ? constrainShape(updatedShape, { width: image.width, height: image.height })
          : updatedShape
        const updated = [...shapeSelections]
        updated[interaction.resizingShapeIndex] = constrained
        onShapeSelectionsChange(updated)
        canvas.style.cursor = interaction.resizeHandle ? getCursorForHandle(interaction.resizeHandle) : 'nwse-resize'
        return
      }

      if (
        interaction.isMoving
        && interaction.movingShapeIndex !== null
        && interaction.initialMousePos
        && interaction.dragOffset
      ) {
        const orig = shapeSelections[interaction.movingShapeIndex]
        const ns = {
          ...orig,
          x: interaction.initialMousePos.x + (x - interaction.initialMousePos.x) - interaction.dragOffset.x,
          y: interaction.initialMousePos.y + (y - interaction.initialMousePos.y) - interaction.dragOffset.y,
        }
        const constrained = image ? constrainShape(ns, { width: image.width, height: image.height }) : ns
        const updated = [...shapeSelections]
        updated[interaction.movingShapeIndex] = constrained
        onShapeSelectionsChange(updated)
        canvas.style.cursor = 'move'
        return
      }

      if (p.isPaintMode) {
        if (p.paintTool.isPainting) {
          p.paintTool.handlePointerMove(coords.x, coords.y)
        }
        // Show a circle cursor matching the brush size (scaled to viewport)
        const brushPx = Math.max(4, Math.round(p.paintTool.brushSize * zoom.viewport.scale))
        const size = brushPx + 2 // +2 for stroke width
        const half = size / 2
        const svg
          = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>`
          + `<circle cx='${half}' cy='${half}' r='${half - 1}' fill='none' stroke='%23000' stroke-width='1' opacity='0.6'/></svg>`
        canvas.style.cursor = `url("data:image/svg+xml,${svg}") ${half} ${half}, crosshair`
        return
      }
      if (isMagicWandMode) {
        canvas.style.cursor = magicWand.isProcessing ? 'wait' : 'crosshair'
        return
      }
      if (isVectorMode && vectorTool.isDrawing) {
        vectorTool.handleMouseMove(coords.x, coords.y)
        canvas.style.cursor = 'crosshair'
        return
      }
      if (isVectorMode && !vectorTool.isDrawing) {
        vectorTool.handleMouseMove(coords.x, coords.y)
        if (nodeEditing.isActive) nodeEditing.handleMouseMove(x, y)
        if (nodeEditing.isActive && (nodeEditing.hoveredNodeIndex !== null || nodeEditing.hoveredCp !== null)) {
          canvas.style.cursor = nodeEditing.selectedNodeIndices.has(nodeEditing.hoveredNodeIndex ?? -1)
            ? 'move'
            : 'pointer'
        } else {
          const hovered = findShapeAtPoint(x, y, shapeSelections)
          canvas.style.cursor
            = hovered !== null ? (interaction.selectedShapeIndex === hovered ? 'move' : 'pointer') : 'crosshair'
        }
        return
      }
      if (shapeTool.isDrawing) {
        shapeTool.handleMouseMove(coords.x, coords.y)
        canvas.style.cursor = 'crosshair'
        return
      }
      if (!isWithinImageBounds(x, y)) {
        canvas.style.cursor = 'default'
        return
      }
      canvas.style.cursor = computeCursorStyle({
        x,
        y,
        shapeSelections,
        selectedShapeIndex: interaction.selectedShapeIndex,
        isMoving: interaction.isMoving,
        viewportScale: zoom.viewport.scale,
        isMobileView,
        nodeEditing,
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      image,
      canvasRef,
      getCanvasCoordinates,
      shapeSelections,
      onShapeSelectionsChange,
      interaction,
      zoom.viewport.scale,
      isVectorMode,
      isMagicWandMode,
      magicWand,
      nodeEditing,
      vectorTool,
      shapeTool,
      findShapeAtPoint,
      transformCanvasToImage,
      isMobileView,
      p.isPaintMode,
      p.paintTool.brushSize,
    ]
  )
}
