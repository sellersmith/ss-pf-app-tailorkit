import { useCallback } from 'react'
import type { TouchHandlerParams } from './touch-handler-types'

export function useTouchTap(p: TouchHandlerParams) {
  const {
    transformCanvasToImage,
    isWithinImageBounds,
    findShapeAtPoint,
    shapeSelections,
    interaction,
    mobileMode,
    deleteShape,
    setMobileMode,
    setIsVectorMode,
  } = p

  const handleTouchTap = useCallback(
    (x: number, y: number) => {
      const imageCoords = transformCanvasToImage(x, y)
      if (!isWithinImageBounds(imageCoords.x, imageCoords.y)) return
      const shapeIndex = findShapeAtPoint(imageCoords.x, imageCoords.y, shapeSelections)
      // Pan/Select mode: just select or deselect the shape, stay in pan mode
      if (mobileMode === 'pan') {
        interaction.setSelectedShapeIndex(shapeIndex)
        return
      }
      if (mobileMode === 'manipulate') {
        if (shapeIndex !== null && shapeIndex !== interaction.selectedShapeIndex) {
          interaction.setSelectedShapeIndex(shapeIndex)
          // Auto-switch tool mode to match the tapped shape's type
          const tappedShape = shapeSelections[shapeIndex]
          if (tappedShape?.type === 'vector') {
            setIsVectorMode(true)
            setMobileMode('vector')
          } else if (tappedShape?.type === 'ellipse') {
            setIsVectorMode(false)
            setMobileMode('ellipse')
          } else {
            setIsVectorMode(false)
            setMobileMode('rectangle')
          }
        }
        return
      }
      if (shapeIndex !== null) {
        interaction.setSelectedShapeIndex(shapeIndex)
        // Auto-switch tool mode to match the tapped shape's type
        const tappedShape = shapeSelections[shapeIndex]
        if (tappedShape?.type === 'vector') {
          setIsVectorMode(true)
          setMobileMode('vector')
        } else if (tappedShape?.type === 'ellipse') {
          setIsVectorMode(false)
          setMobileMode('ellipse')
        } else {
          setIsVectorMode(false)
          setMobileMode('rectangle')
        }
      } else {
        interaction.setSelectedShapeIndex(null)
      }
    },
    [
      transformCanvasToImage,
      isWithinImageBounds,
      findShapeAtPoint,
      shapeSelections,
      interaction,
      mobileMode,
      setMobileMode,
      setIsVectorMode,
    ]
  )

  const handleTouchTapAndHold = useCallback(
    (x: number, y: number) => {
      const imageCoords = transformCanvasToImage(x, y)
      if (!isWithinImageBounds(imageCoords.x, imageCoords.y)) return
      const shapeIndex = findShapeAtPoint(imageCoords.x, imageCoords.y, shapeSelections)
      if (shapeIndex !== null) {
        const isDeletingSelectedInManipulate
          = mobileMode === 'manipulate' && shapeIndex === interaction.selectedShapeIndex
        deleteShape(shapeIndex)
        if (isDeletingSelectedInManipulate) setMobileMode('pan')
        if ('vibrate' in navigator) navigator.vibrate(50)
      }
    },
    [
      transformCanvasToImage,
      isWithinImageBounds,
      findShapeAtPoint,
      shapeSelections,
      interaction,
      mobileMode,
      deleteShape,
      setMobileMode,
    ]
  )

  return { handleTouchTap, handleTouchTapAndHold }
}
