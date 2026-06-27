import type Konva from 'konva'
import { useCallback } from 'react'
import { RULER_LINE_HORIZONTAL_PREFIX, RULER_LINE_VERTICAL_PREFIX } from '../../constants'
import type { GuidesState } from '../types'

interface UseGuideInteractionProps {
  guides: GuidesState
  rulerSize: number
  scale: number
  setGuides: (guides: GuidesState) => void
  draggingGuideRef: React.RefObject<{ id: string; isHorizontal: boolean; position: number } | null>
  draggingGuideLineRef: React.RefObject<Konva.Line>
  coordinateTextRef: React.RefObject<Konva.Group>
  setDraggingGuide: (guide: { id: string; isHorizontal: boolean; position: number } | null) => void
  setCursorStyle: (style: string) => void
}

/**
 * Custom hook to manage interactions with guides in the ruler component.
 *
 * This hook handles the logic for creating, updating, and removing guides
 * based on user interactions with the ruler. It checks if the guides are
 * within the ruler area and updates the state accordingly.
 *
 * @param {UseGuideInteractionProps} props - The properties for the hook.
 * @param {GuidesState} props.guides - The current state of the guides.
 * @param {number} props.rulerSize - The size of the ruler.
 * @param {number} props.scale - The current scale of the canvas.
 * @param {function} props.setGuides - Function to update the guides state.
 * @param {React.RefObject} props.draggingGuideRef - Ref for the currently dragging guide.
 * @param {React.RefObject} props.draggingGuideLineRef - Ref for the currently dragging guide line.
 * @param {React.RefObject} props.coordinateTextRef - Ref for the coordinate text display.
 * @param {function} props.setDraggingGuide - Function to set the currently dragging guide.
 * @param {function} props.setCursorStyle - Function to set the cursor style.
 *
 * @returns {Object} - An object containing the handleRulerDragEnd function.
 */
export const useGuideInteraction = (props: UseGuideInteractionProps) => {
  const {
    guides,
    rulerSize,
    scale,
    setGuides,
    draggingGuideRef,
    draggingGuideLineRef,
    coordinateTextRef,
    setDraggingGuide,
    setCursorStyle,
  } = props

  const handleRulerDragEnd = useCallback(
    (mutationGuide?: { id: string }): void => {
      if (draggingGuideLineRef.current) {
        draggingGuideLineRef.current.visible(false)
      }

      // Hide coordinate text
      if (coordinateTextRef.current) {
        coordinateTextRef.current.visible(false)
      }

      if (!draggingGuideRef.current) return

      const draggingGuide = draggingGuideRef.current
      const isHorizontal = draggingGuide.isHorizontal
      const position = draggingGuide.position

      // Get stage position to check if guide is in ruler area
      const stage = draggingGuideLineRef.current?.getStage()
      if (!stage) return

      const point = stage.getPointerPosition()
      if (!point) return

      // Check if guide is in ruler area
      const isInRulerArea = isHorizontal ? point.y <= rulerSize / scale : point.x <= rulerSize / scale

      // If guide is in ruler area, don't create/update it (effectively deleting it)
      if (!isInRulerArea) {
        const newGuides = { ...guides }
        const isMutationGuide = !!mutationGuide
        const guideId = isMutationGuide
          ? mutationGuide?.id
          : isHorizontal
            ? `${RULER_LINE_HORIZONTAL_PREFIX}-${Date.now()}`
            : `${RULER_LINE_VERTICAL_PREFIX}-${Date.now()}`

        if (isHorizontal) {
          if (isMutationGuide) {
            newGuides.horizontal = newGuides.horizontal.map(guide =>
              guide.id === mutationGuide?.id ? { ...guide, position } : guide
            )
          } else {
            newGuides.horizontal.push({
              id: guideId,
              position,
            })
          }
        } else {
          if (isMutationGuide) {
            newGuides.vertical = newGuides.vertical.map(guide =>
              guide.id === mutationGuide?.id ? { ...guide, position } : guide
            )
          } else {
            newGuides.vertical.push({
              id: guideId,
              position,
            })
          }
        }

        setGuides(newGuides)
      } else if (mutationGuide) {
        // If it's an existing guide being dragged to ruler area, remove it
        const newGuides = { ...guides }
        if (isHorizontal) {
          newGuides.horizontal = newGuides.horizontal.filter(g => g.id !== mutationGuide.id)
        } else {
          newGuides.vertical = newGuides.vertical.filter(g => g.id !== mutationGuide.id)
        }
        setGuides(newGuides)
      }

      setTimeout(() => {
        setDraggingGuide(null)
        setCursorStyle('default')
      }, 50)
    },
    [
      guides,
      rulerSize,
      scale,
      setGuides,
      draggingGuideRef,
      draggingGuideLineRef,
      coordinateTextRef,
      setDraggingGuide,
      setCursorStyle,
    ]
  )

  return { handleRulerDragEnd }
}
