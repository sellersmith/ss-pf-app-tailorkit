import type Konva from 'konva'
import { useCallback } from 'react'
import { RULER_CONSTANTS } from '../constants'
import { getGuides, getLineGuideStops, getRelativeSnappingPoint } from '~/utils/canvas/snappingObject'
import { GRID_BACKGROUND_NAME } from '../../constants'
import type { DraggedGuideState } from '../types'
import { LAYER_NAME } from '~/constants/canvas'

interface UseGuideMovementProps {
  scale: number
  absoluteStagePos: { x: number; y: number }
  rulerSize: number
  draggingGuideLineRef: React.RefObject<Konva.Line>
  draggingGuideRef: React.RefObject<DraggedGuideState>
  setDraggingGuide: (guide: DraggedGuideState) => void
  updateCoordinateDisplay: (args: { position: number; point: { x: number; y: number }; isHorizontal: boolean }) => void
  setMousePos: (pos: { x: number; y: number }) => void
}

/**
 * Custom hook to manage the movement of guides in the ruler component.
 *
 * This hook handles the logic for updating the position of guides based on user interactions.
 * It calculates snapping points and updates the dragging guide's position accordingly.
 *
 * @param {UseGuideMovementProps} props - The properties for the hook.
 * @param {number} props.scale - The current scale of the canvas.
 * @param {{ x: number; y: number }} props.absoluteStagePos - The absolute position of the stage.
 * @param {number} props.rulerSize - The size of the ruler.
 * @param {React.RefObject<Konva.Line>} props.draggingGuideLineRef - Ref for the currently dragging guide line.
 * @param {React.RefObject<DraggedGuideState>} props.draggingGuideRef - Ref for the currently dragging guide state.
 * @param {function} props.setDraggingGuide - Function to set the currently dragging guide.
 * @param {function} props.updateCoordinateDisplay - Function to update the coordinate display based on the guide's position.
 * @param {function} props.setMousePos - Function to set the mouse position.
 *
 * @returns {Object} - An object containing the handleGuideMovement function.
 */
export const useGuideMovement = (props: UseGuideMovementProps) => {
  const {
    scale,
    absoluteStagePos,
    rulerSize,
    draggingGuideLineRef,
    draggingGuideRef,
    setDraggingGuide,
    updateCoordinateDisplay,
    setMousePos,
  } = props

  const handleGuideMovement = useCallback(
    (args: { point: { x: number; y: number }; stage: Konva.Stage; isHorizontal: boolean; draggingGuideId: string }) => {
      const { point, stage, isHorizontal, draggingGuideId } = args

      const layer = stage.findOne('Layer') as Konva.Layer | null
      if (!layer) {
        console.warn(RULER_CONSTANTS.ERRORS.LAYER_NOT_FOUND)
        return
      }

      const draggingLine = draggingGuideLineRef.current
      if (!draggingLine) {
        console.warn(RULER_CONSTANTS.ERRORS.DRAGGING_LINE_NOT_FOUND)
        return
      }

      // Create a mock node for the current guide
      const mockGuide: Konva.Node = {
        getClientRect: () => ({
          x: point.x,
          y: point.y,
          width: 0,
          height: 0,
        }),
        getStage: () => stage,
      } as Konva.Node

      // Get snapping points from objects
      const lineGuideStops = getLineGuideStops({
        nodes: [mockGuide],
        layerName: LAYER_NAME,
        gridBackgroundName: GRID_BACKGROUND_NAME,
      })

      // Get snapping edges for the guide
      const objectSnappingEdges = {
        vertical: isHorizontal ? [] : [{ guide: point.x, offset: 0, snap: 'start' as const }],
        horizontal: isHorizontal ? [{ guide: point.y, offset: 0, snap: 'start' as const }] : [],
      }

      // Find snapping guides
      const guides = getGuides(lineGuideStops, objectSnappingEdges, RULER_CONSTANTS.SNAP_THRESHOLD)

      // Update guide position with snapping
      const basePosition = isHorizontal ? point.y : point.x
      let newPosition = basePosition * scale - (isHorizontal ? absoluteStagePos.y : absoluteStagePos.x)

      if (guides.length > 0) {
        const guide = guides.find(g => g.orientation === (isHorizontal ? 'H' : 'V'))
        if (guide) {
          newPosition = getRelativeSnappingPoint({
            guide,
            scale,
            absoluteStagePos,
            isHorizontal,
          })
        }
      }

      setDraggingGuide({
        id: draggingGuideId,
        isHorizontal,
        position: newPosition,
      })

      // Update dragging line appearance
      const isInRulerArea = isHorizontal ? point.y <= rulerSize / scale : point.x <= rulerSize / scale
      draggingLine.stroke(isInRulerArea ? RULER_CONSTANTS.RULER_DELETE_COLOR : RULER_CONSTANTS.RULER_NORMAL_COLOR)
      draggingLine.opacity(RULER_CONSTANTS.GUIDE_OPACITY)

      const guideLine = draggingLine.getLayer()
      if (guideLine) {
        guideLine.batchDraw()
      }

      // Update coordinate display
      updateCoordinateDisplay({
        position: draggingGuideRef.current?.position || 0,
        point,
        isHorizontal,
      })

      setMousePos({
        x: isHorizontal ? point.x * scale : guides.length > 0 ? newPosition + absoluteStagePos.x : point.x * scale,
        y: isHorizontal ? (guides.length > 0 ? newPosition + absoluteStagePos.y : point.y * scale) : point.y * scale,
      })
    },
    [
      scale,
      absoluteStagePos,
      rulerSize,
      draggingGuideLineRef,
      draggingGuideRef,
      setDraggingGuide,
      updateCoordinateDisplay,
      setMousePos,
    ]
  )

  return { handleGuideMovement }
}
