import { useCallback } from 'react'
import type { TouchHandlerParams } from './touch-handler-types'

export function useTouchEnd(p: TouchHandlerParams) {
  const { isMobileView, mobileMode, interaction, shapeTool, vectorToolRef, nodeEditingRef } = p

  return useCallback(() => {
    if (!isMobileView) return

    if (mobileMode === 'paint' && interaction.isTouchDrawing) {
      p.paintTool.handlePointerUp()
      interaction.setIsTouchDrawing(false)
      return
    }

    if (mobileMode === 'vector') {
      if (nodeEditingRef.current.isActive && nodeEditingRef.current.isMarqueeSelecting) {
        nodeEditingRef.current.handleMouseUp()
        return
      }
      vectorToolRef.current.handleMouseUp()
      return
    }

    if (interaction.isTouchDrawing) {
      interaction.setIsTouchDrawing(false)
      shapeTool.handleMouseUp()
    }
    if (interaction.isTouchMoving) {
      interaction.setIsTouchMoving(false)
      interaction.setMovingShapeIndex(null)
      interaction.setInitialMousePos(null)
      interaction.setDragOffset(null)
    }
    if (interaction.isTouchResizing) {
      interaction.setIsTouchResizing(false)
      interaction.setResizingShapeIndex(null)
      interaction.setTouchResizeHandle(null)
      interaction.setResizeStartPos(null)
      interaction.setOriginalShape(null)
    }
    if (interaction.isTouchRotating) {
      interaction.setIsTouchRotating(false)
      interaction.setRotatingShapeIndex(null)
      interaction.setTouchRotationStartAngle(null)
      interaction.setTouchOriginalRotation(0)
      interaction.setOriginalShape(null)
    }
    interaction.manipulationIntentRef.current = null
  }, [isMobileView, mobileMode, interaction, shapeTool, vectorToolRef, nodeEditingRef, p.paintTool])
}
