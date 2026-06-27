import type React from 'react'
import { useCallback } from 'react'
import {
  isPointInRotationHandle,
  calculateRotationFromDrag,
  getHandleAtPointRotated,
  isPointInRotatedShape,
} from '../../utils/shapeUtils'
import type { MouseHandlerParams } from './mouse-handler-types'

export function useMouseDown(p: MouseHandlerParams) {
  const {
    image,
    getCanvasCoordinates,
    shapeSelections,
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
    vectorDrawingStartedRef,
    setHasInteracted,
    setMobileMode,
    setIsVectorMode,
  } = p

  return useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!image) return
      setHasInteracted(true)
      const coords = getCanvasCoordinates(event)
      if (!coords) return
      const { x, y } = transformCanvasToImage(coords.x, coords.y)
      if (!isWithinImageBounds(x, y)) return

      // Node editing intercepts clicks ONLY when the merchant is in vector mode.
      // Otherwise a selected vector shape (e.g. auto-detect output) would
      // capture every click — kicking paint/magic-wand/rectangle/ellipse out
      // of their intended interaction.
      if (nodeEditing.isActive && isVectorMode) {
        nodeEditing.handleMouseDown(x, y, event.shiftKey)
        return
      }

      const { selectedShapeIndex } = interaction
      if (selectedShapeIndex !== null) {
        const shape = shapeSelections[selectedShapeIndex]
        if (
          shape
          && shape.type !== 'vector'
          && isPointInRotationHandle(x, y, shape, zoom.viewport.scale, isMobileView)
        ) {
          interaction.setIsRotating(true)
          interaction.setRotatingShapeIndex(selectedShapeIndex)
          interaction.setRotationStartAngle(calculateRotationFromDrag(x, y, shape))
          interaction.setOriginalRotation(shape.rotation || 0)
          return
        }
        const handleType = shape && getHandleAtPointRotated(x, y, shape, zoom.viewport.scale, isMobileView)
        if (handleType && !(handleType === 'rotation' && shape?.type === 'vector')) {
          interaction.setIsResizing(true)
          interaction.setResizingShapeIndex(selectedShapeIndex)
          interaction.setResizeHandle(handleType)
          interaction.setResizeStartPos({ x, y })
          interaction.setOriginalShape(shape!)
          return
        }
        if (shape && isPointInRotatedShape(x, y, shape)) {
          interaction.setIsMoving(true)
          interaction.setMovingShapeIndex(selectedShapeIndex)
          interaction.setInitialMousePos({ x, y })
          interaction.setDragOffset({ x: x - shape.x, y: y - shape.y })
          return
        }
      }

      // Paint and Magic Wand are continuous-action tools — clicking on an
      // existing shape (e.g. the auto-detect overlay covering the product)
      // should paint / sample, NOT switch modes. Route those branches first
      // so the click-on-shape auto-switch below doesn't kick the user out.
      if (p.isPaintMode) {
        p.paintTool.handlePointerDown(coords.x, coords.y)
        return
      }
      if (isMagicWandMode && magicWand.cvReady) {
        magicWand.handleTap(coords.x, coords.y)
        return
      }

      const clicked = findShapeAtPoint(x, y, shapeSelections)
      if (clicked !== null) {
        interaction.setSelectedShapeIndex(clicked)
        vectorDrawingStartedRef.current = false
        // Auto-switch tool mode to match the clicked shape's type
        const clickedShape = shapeSelections[clicked]
        if (clickedShape?.type === 'vector') {
          setIsVectorMode(true)
          setMobileMode('vector')
        } else if (clickedShape?.type === 'ellipse') {
          setIsVectorMode(false)
          setMobileMode('ellipse')
        } else {
          setIsVectorMode(false)
          setMobileMode('rectangle')
        }
        return
      }
      if (isVectorMode && !nodeEditing.isActive) {
        vectorDrawingStartedRef.current = true
        vectorTool.handleMouseDown(coords.x, coords.y)
        return
      }
      shapeTool.handleMouseDown(coords.x, coords.y, event.shiftKey)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      image,
      getCanvasCoordinates,
      shapeSelections,
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
    ]
  )
}
