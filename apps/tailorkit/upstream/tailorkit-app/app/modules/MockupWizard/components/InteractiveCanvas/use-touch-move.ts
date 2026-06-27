import { useCallback } from 'react'
import { constrainShape, updateShapeWithHandle, calculateRotationFromDrag, rotateShape } from '../../utils/shapeUtils'
import { getCanvasCoords } from './touch-handler-types'
import type { TouchHandlerParams } from './touch-handler-types'

export function useTouchMove(p: TouchHandlerParams) {
  const {
    isMobileView,
    image,
    canvasRef,
    mobileMode,
    transformCanvasToImage,
    interaction,
    shapeSelections,
    onShapeSelectionsChange,
    vectorToolRef,
    nodeEditingRef,
    shapeTool,
  } = p

  return useCallback(
    (event: TouchEvent) => {
      if (!isMobileView || !image) return

      // Activate pending manipulation intent once movement threshold is exceeded
      if (
        interaction.manipulationIntentRef.current
        && !interaction.isTouchMoving
        && !interaction.isTouchResizing
        && !interaction.isTouchRotating
      ) {
        const canvas = canvasRef.current
        if (!canvas || event.touches.length !== 1) return
        const { x: canvasX, y: canvasY } = getCanvasCoords(event.touches[0], canvas)
        const imageCoords = transformCanvasToImage(canvasX, canvasY)
        const intent = interaction.manipulationIntentRef.current
        const dx = imageCoords.x - intent.startPos.x
        const dy = imageCoords.y - intent.startPos.y

        if (Math.sqrt(dx * dx + dy * dy) > 5) {
          if (intent.type === 'rotate') {
            interaction.setIsTouchRotating(true)
            interaction.setRotatingShapeIndex(intent.shapeIndex)
            interaction.setTouchRotationStartAngle(intent.rotationStartAngle ?? null)
            interaction.setTouchOriginalRotation(intent.shape.rotation || 0)
            interaction.setOriginalShape(intent.shape)
          } else if (intent.type === 'resize') {
            interaction.setIsTouchResizing(true)
            interaction.setResizingShapeIndex(intent.shapeIndex)
            interaction.setTouchResizeHandle(intent.handle || null)
            interaction.setResizeStartPos(intent.startPos)
            interaction.setOriginalShape(intent.shape)
          } else {
            interaction.setIsTouchMoving(true)
            interaction.setMovingShapeIndex(intent.shapeIndex)
            interaction.setInitialMousePos(intent.startPos)
            interaction.setDragOffset({ x: intent.startPos.x - intent.shape.x, y: intent.startPos.y - intent.shape.y })
          }
          interaction.manipulationIntentRef.current = null
        }
        return
      }

      if (mobileMode === 'paint' && interaction.isTouchDrawing) {
        event.preventDefault()
        if (event.touches.length === 1) {
          const canvas = canvasRef.current
          if (!canvas) return
          const { x, y } = getCanvasCoords(event.touches[0], canvas)
          p.paintTool.handlePointerMove(x, y)
        }
        return
      }

      if (mobileMode === 'vector') {
        if (nodeEditingRef.current.isActive && nodeEditingRef.current.isMarqueeSelecting) {
          event.preventDefault()
          if (event.touches.length === 1) {
            const canvas = canvasRef.current
            if (!canvas) return
            const { x, y } = getCanvasCoords(event.touches[0], canvas)
            nodeEditingRef.current.handleMouseMove(...(Object.values(transformCanvasToImage(x, y)) as [number, number]))
          }
          return
        }
        if (vectorToolRef.current.isDrawing && event.touches.length === 1) {
          event.preventDefault()
          const canvas = canvasRef.current
          if (!canvas) return
          const { x, y } = getCanvasCoords(event.touches[0], canvas)
          vectorToolRef.current.handleMouseMove(x, y)
        }
        return
      }

      if (
        !interaction.isTouchDrawing
        && !interaction.isTouchMoving
        && !interaction.isTouchResizing
        && !interaction.isTouchRotating
      ) {
        return
      }
      event.preventDefault()
      if (event.touches.length !== 1) return
      const canvas = canvasRef.current
      if (!canvas) return
      const { x: canvasX, y: canvasY } = getCanvasCoords(event.touches[0], canvas)
      const imageCoords = transformCanvasToImage(canvasX, canvasY)

      if (
        interaction.isTouchRotating
        && interaction.rotatingShapeIndex !== null
        && interaction.touchRotationStartAngle !== null
        && interaction.originalShape
      ) {
        const angleDelta
          = calculateRotationFromDrag(imageCoords.x, imageCoords.y, interaction.originalShape)
          - interaction.touchRotationStartAngle
        let newRotation = interaction.touchOriginalRotation + angleDelta
        if (newRotation < 0) newRotation += 360
        if (newRotation >= 360) newRotation -= 360
        const updated = [...shapeSelections]
        updated[interaction.rotatingShapeIndex] = rotateShape(
          shapeSelections[interaction.rotatingShapeIndex],
          newRotation
        )
        onShapeSelectionsChange(updated)
      } else if (interaction.isTouchDrawing) {
        shapeTool.handleMouseMove(canvasX, canvasY)
      } else if (
        interaction.isTouchMoving
        && interaction.movingShapeIndex !== null
        && interaction.initialMousePos
        && interaction.dragOffset
      ) {
        const origShape = shapeSelections[interaction.movingShapeIndex]
        const newShape = {
          ...origShape,
          x: interaction.initialMousePos.x + (imageCoords.x - interaction.initialMousePos.x) - interaction.dragOffset.x,
          y: interaction.initialMousePos.y + (imageCoords.y - interaction.initialMousePos.y) - interaction.dragOffset.y,
        }
        const updated = [...shapeSelections]
        updated[interaction.movingShapeIndex] = constrainShape(newShape, { width: image.width, height: image.height })
        onShapeSelectionsChange(updated)
      } else if (
        interaction.isTouchResizing
        && interaction.resizingShapeIndex !== null
        && interaction.touchResizeHandle
        && interaction.resizeStartPos
        && interaction.originalShape
      ) {
        const updatedShape = updateShapeWithHandle(
          interaction.originalShape,
          interaction.touchResizeHandle,
          imageCoords.x - interaction.resizeStartPos.x,
          imageCoords.y - interaction.resizeStartPos.y
        )
        const updated = [...shapeSelections]
        updated[interaction.resizingShapeIndex] = constrainShape(updatedShape, {
          width: image.width,
          height: image.height,
        })
        onShapeSelectionsChange(updated)
      }
    },
    [
      isMobileView,
      image,
      canvasRef,
      mobileMode,
      transformCanvasToImage,
      interaction,
      shapeSelections,
      onShapeSelectionsChange,
      vectorToolRef,
      nodeEditingRef,
      shapeTool,
      p.paintTool,
    ]
  )
}
