import type React from 'react'
import { useCallback } from 'react'
import type { MouseHandlerParams } from './mouse-handler-types'

export function useMouseUp(p: MouseHandlerParams) {
  const {
    image,
    isVectorMode,
    interaction,
    shapeTool,
    nodeEditing,
    vectorTool,
    getCanvasCoordinates,
    transformCanvasToImage,
    findShapeAtPoint,
    shapeSelections,
    vectorDrawingStartedRef,
  } = p

  return useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!image) return
      if (p.isPaintMode && p.paintTool.isPainting) {
        p.paintTool.handlePointerUp()
        return
      }
      if (nodeEditing.handleMouseUp()) return
      if (isVectorMode && vectorDrawingStartedRef.current) {
        vectorDrawingStartedRef.current = false
        vectorTool.handleMouseUp()
        return
      }
      if (interaction.isRotating) {
        interaction.setIsRotating(false)
        interaction.setRotatingShapeIndex(null)
        interaction.setRotationStartAngle(null)
        interaction.setOriginalRotation(0)
        return
      }
      if (interaction.isResizing) {
        interaction.setIsResizing(false)
        interaction.setResizingShapeIndex(null)
        interaction.setResizeHandle(null)
        interaction.setResizeStartPos(null)
        interaction.setOriginalShape(null)
        return
      }
      if (interaction.isMoving) {
        interaction.setIsMoving(false)
        interaction.setMovingShapeIndex(null)
        interaction.setInitialMousePos(null)
        interaction.setDragOffset(null)
        return
      }
      if (shapeTool.isDrawing) {
        shapeTool.handleMouseUp()
        return
      }
      const canvasCoords = getCanvasCoordinates(event)
      if (canvasCoords) {
        const { x, y } = transformCanvasToImage(canvasCoords.x, canvasCoords.y)
        const clicked = findShapeAtPoint(x, y, shapeSelections)
        if (clicked !== null) interaction.setSelectedShapeIndex(clicked)
        else interaction.setSelectedShapeIndex(null)
      }
    },
    [
      image,
      isVectorMode,
      interaction,
      shapeTool,
      nodeEditing,
      vectorTool,
      getCanvasCoordinates,
      transformCanvasToImage,
      findShapeAtPoint,
      shapeSelections,
      vectorDrawingStartedRef,
      p.isPaintMode,
      p.paintTool,
    ]
  )
}
