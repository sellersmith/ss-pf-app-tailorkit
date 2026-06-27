import type Konva from 'konva'
import { useCallback, useMemo } from 'react'
import throttle from 'lodash/throttle'
import { RULER_CONSTANTS } from '../constants'
import { isPointNearGuide } from '../fns'
import type { GuidesState } from '../types'

interface UseMouseInteractionProps {
  guides: GuidesState
  setCursorStyle: (style: string) => void
}

/**
 * Custom hook to manage mouse interactions with guides in the ruler component.
 *
 * This hook handles mouse movement and mouse enter events to change the cursor style
 * based on the proximity of the mouse pointer to the guides. If the mouse is near a guide,
 * it sets the cursor style to indicate that the guide can be dragged.
 *
 * @param {UseMouseInteractionProps} props - The properties for the hook.
 * @param {GuidesState} props.guides - The current state of the guides.
 * @param {function} props.setCursorStyle - Function to set the cursor style based on mouse position.
 *
 * @returns {Object} - An object containing the handleMouseMove and handleMouseEnter functions.
 */
export const useMouseInteraction = (props: UseMouseInteractionProps) => {
  const { guides, setCursorStyle } = props

  // Memoize the combined guides array
  const combinedGuides = useMemo(
    () => [
      ...guides.horizontal.map(guide => ({ ...guide, isHorizontal: true })),
      ...guides.vertical.map(guide => ({ ...guide, isHorizontal: false })),
    ],
    [guides.horizontal, guides.vertical]
  )

  // Helper function to check guide proximity
  const checkGuideProximity = useCallback(
    (pos: { x: number; y: number }) => {
      for (const guide of combinedGuides) {
        const isNear = isPointNearGuide(pos, guide.position, guide.isHorizontal, RULER_CONSTANTS.SNAP_THRESHOLD)

        if (isNear) {
          return {
            isNear: true,
            isHorizontal: guide.isHorizontal,
          }
        }
      }
      return { isNear: false }
    },
    [combinedGuides]
  )

  const handleMouseMoveBase = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>): void => {
      if (combinedGuides.length === 0) return

      const pos = {
        x: e.evt.layerX,
        y: e.evt.layerY,
      }

      const { isNear, isHorizontal } = checkGuideProximity(pos)
      setCursorStyle(isNear ? (isHorizontal ? 'ns-resize' : 'ew-resize') : 'default')
    },
    [combinedGuides, checkGuideProximity, setCursorStyle]
  )

  const handleMouseMove = useMemo(
    () => throttle(handleMouseMoveBase, RULER_CONSTANTS.MOUSE_MOVE_THROTTLE),
    [handleMouseMoveBase]
  )

  // Memoized mouse enter handler
  const handleMouseEnter = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (combinedGuides.length === 0) return

      const pos = {
        x: e.evt.layerX,
        y: e.evt.layerY,
      }

      const { isNear, isHorizontal } = checkGuideProximity(pos)
      setCursorStyle(isNear ? (isHorizontal ? 'ns-resize' : 'ew-resize') : 'default')
    },
    [combinedGuides, checkGuideProximity, setCursorStyle]
  )

  return { handleMouseMove, handleMouseEnter }
}
