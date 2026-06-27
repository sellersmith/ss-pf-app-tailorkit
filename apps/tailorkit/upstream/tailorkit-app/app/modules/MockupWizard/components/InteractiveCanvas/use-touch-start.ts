import { useCallback } from 'react'
import {
  isPointInRotationHandle,
  calculateRotationFromDrag,
  getHandleAtPointRotated,
  isPointInRotatedShape,
} from '../../utils/shapeUtils'
import { getCanvasCoords } from './touch-handler-types'
import type { TouchHandlerParams } from './touch-handler-types'

export function useTouchStart(p: TouchHandlerParams) {
  const {
    isMobileView,
    image,
    canvasRef,
    mobileMode,
    isWithinImageBounds,
    transformCanvasToImage,
    isOverInteractiveElement,
    interaction,
    zoom,
    shapeSelections,
    vectorTool,
    nodeEditingRef,
    magicWand,
    shapeTool,
    setHasInteracted,
  } = p

  return useCallback(
    (event: TouchEvent) => {
      if (!isMobileView || !image) return
      if (event.touches.length !== 1) return
      const canvas = canvasRef.current
      if (!canvas) return
      const { x: canvasX, y: canvasY } = getCanvasCoords(event.touches[0], canvas)
      const imageCoords = transformCanvasToImage(canvasX, canvasY)
      if (!isWithinImageBounds(imageCoords.x, imageCoords.y)) return

      // Pan mode now also handles manipulation: if the user touches a selected
      // shape's handle or body, set an intent so move/resize/rotate kicks in
      // once the move threshold is exceeded. Touching empty area falls through
      // to onPan (registered via useTouchGestures) so the canvas still pans.
      if (mobileMode === 'pan') {
        if (interaction.selectedShapeIndex !== null) {
          const selectedShape = shapeSelections[interaction.selectedShapeIndex]
          if (selectedShape) {
            const mobileScale = zoom.viewport.scale
            if (isPointInRotationHandle(imageCoords.x, imageCoords.y, selectedShape, mobileScale, true)) {
              event.preventDefault()
              setHasInteracted(true)
              interaction.manipulationIntentRef.current = {
                type: 'rotate',
                startPos: imageCoords,
                shapeIndex: interaction.selectedShapeIndex,
                shape: selectedShape,
                rotationStartAngle: calculateRotationFromDrag(imageCoords.x, imageCoords.y, selectedShape),
              }
              return
            }
            const handleType = getHandleAtPointRotated(imageCoords.x, imageCoords.y, selectedShape, mobileScale, true)
            if (handleType && handleType !== 'rotation') {
              event.preventDefault()
              setHasInteracted(true)
              interaction.manipulationIntentRef.current = {
                type: 'resize',
                startPos: imageCoords,
                handle: handleType,
                shapeIndex: interaction.selectedShapeIndex,
                shape: selectedShape,
              }
              return
            }
            if (isPointInRotatedShape(imageCoords.x, imageCoords.y, selectedShape)) {
              event.preventDefault()
              setHasInteracted(true)
              interaction.manipulationIntentRef.current = {
                type: 'move',
                startPos: imageCoords,
                shapeIndex: interaction.selectedShapeIndex,
                shape: selectedShape,
              }
              return
            }
          }
        }
        // No shape under finger — let onPan gesture handle canvas panning.
        return
      }
      event.preventDefault()
      setHasInteracted(true)

      if (mobileMode === 'paint') {
        p.paintTool.handlePointerDown(canvasX, canvasY)
        interaction.setIsTouchDrawing(true)
        return
      }

      if (mobileMode === 'magicwand') {
        if (magicWand.cvReady) {
          magicWand.handleTap(canvasX, canvasY)
        }
        return
      }

      if (mobileMode === 'vector') {
        if (nodeEditingRef.current.isActive) {
          nodeEditingRef.current.handleMouseDown(imageCoords.x, imageCoords.y, false, true)
          return
        }
        vectorTool.handleMouseDown(canvasX, canvasY)
        return
      }

      if (mobileMode === 'rectangle' || mobileMode === 'ellipse') {
        if (!isOverInteractiveElement(canvasX, canvasY)) {
          interaction.setIsTouchDrawing(true)
          shapeTool.handleMouseDown(canvasX, canvasY, false)
        }
        return
      }

      if (mobileMode === 'manipulate' && interaction.selectedShapeIndex !== null) {
        const selectedShape = shapeSelections[interaction.selectedShapeIndex]
        if (!selectedShape) return
        const mobileScale = zoom.viewport.scale

        if (isPointInRotationHandle(imageCoords.x, imageCoords.y, selectedShape, mobileScale, true)) {
          interaction.manipulationIntentRef.current = {
            type: 'rotate',
            startPos: imageCoords,
            shapeIndex: interaction.selectedShapeIndex,
            shape: selectedShape,
            rotationStartAngle: calculateRotationFromDrag(imageCoords.x, imageCoords.y, selectedShape),
          }
          return
        }

        const handleType = getHandleAtPointRotated(imageCoords.x, imageCoords.y, selectedShape, mobileScale, true)
        if (handleType && handleType !== 'rotation') {
          interaction.manipulationIntentRef.current = {
            type: 'resize',
            startPos: imageCoords,
            handle: handleType,
            shapeIndex: interaction.selectedShapeIndex,
            shape: selectedShape,
          }
        } else if (isPointInRotatedShape(imageCoords.x, imageCoords.y, selectedShape)) {
          interaction.manipulationIntentRef.current = {
            type: 'move',
            startPos: imageCoords,
            shapeIndex: interaction.selectedShapeIndex,
            shape: selectedShape,
          }
        }
      }
    },
    [
      isMobileView,
      image,
      canvasRef,
      mobileMode,
      isWithinImageBounds,
      transformCanvasToImage,
      isOverInteractiveElement,
      interaction,
      zoom.viewport.scale,
      shapeSelections,
      vectorTool,
      nodeEditingRef,
      magicWand,
      shapeTool,
      setHasInteracted,
      p.paintTool,
    ]
  )
}
