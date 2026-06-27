import type Konva from 'konva'
import { useCallback, useRef } from 'react'
import { RULER_CONSTANTS } from '../constants'
import type { MEASUREMENT_UNIT } from '~/constants/measurement-units'
import { formatLengthUnit, lengthUnitToLengthUnit } from '~/utils/lengthUnitToPixels'

interface UseCoordinateDisplayProps {
  scale: number
  rulerSize: number
  measurementUnit?: MEASUREMENT_UNIT
  resolution?: number
}

/**
 * Custom hook to manage the display of coordinate information on the ruler.
 *
 * @param {UseCoordinateDisplayProps} props - The properties for the hook.
 * @param {number} props.scale - The current scale of the canvas.
 * @param {number} props.rulerSize - The size of the ruler.
 *
 * @returns {Object} - An object containing:
 * @returns {React.RefObject<Konva.Group>} coordinateTextRef - A reference to the coordinate text group.
 * @returns {Function} updateCoordinateDisplay - A function to update the coordinate display based on the position and orientation.
 */
export const useCoordinateDisplay = (props: UseCoordinateDisplayProps) => {
  const { scale, rulerSize, measurementUnit = 'px', resolution = 300 } = props
  const coordinateTextRef = useRef<Konva.Group>(null)

  const updateCoordinateDisplay = useCallback(
    (args: { position: number; point: { x: number; y: number }; isHorizontal: boolean }) => {
      const { position, point, isHorizontal } = args
      const group = coordinateTextRef.current
      if (!group) return

      const textNode = group.findOne('Text') as Konva.Text | null
      const bgRect = group.findOne('Rect') as Konva.Rect | null

      if (!textNode || !bgRect) {
        console.warn(RULER_CONSTANTS.ERRORS.NODES_NOT_FOUND)
        return
      }

      const textByUnit = lengthUnitToLengthUnit('px', measurementUnit, position, resolution)
      const displayText = formatLengthUnit(textByUnit, measurementUnit, 2).toString()
      textNode.text(displayText)

      const textDimensions = textNode.measureSize(displayText)
      if (!textDimensions) return

      const textWidth = textDimensions.width
      const textHeight = textDimensions.height
      const padding = RULER_CONSTANTS.COORDINATE_PADDING * scale

      bgRect.width(textWidth + padding * 2)
      bgRect.height(textHeight + padding)

      group.rotation(isHorizontal ? -90 : 0)
      group.visible(true)

      group.position({
        x: isHorizontal ? rulerSize / 4 : point.x * scale,
        y: isHorizontal ? point.y * scale : rulerSize / 4,
      })

      textNode.position({
        x: padding,
        y: padding / 2,
      })

      const isInRulerArea = isHorizontal ? point.y <= rulerSize / scale : point.x <= rulerSize / scale
      const color = isInRulerArea ? RULER_CONSTANTS.RULER_DELETE_COLOR : RULER_CONSTANTS.RULER_NORMAL_COLOR
      textNode.fill(color)

      const layer = group.getLayer()
      if (layer) {
        layer.batchDraw()
      }
    },
    [measurementUnit, resolution, rulerSize, scale]
  )

  return { coordinateTextRef, updateCoordinateDisplay }
}
