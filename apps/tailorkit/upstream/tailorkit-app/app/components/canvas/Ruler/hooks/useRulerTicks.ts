import { useCallback, useMemo } from 'react'
import { estimateEffectiveGridSize } from '../fns'
import type { TickData } from '../types'

const MAJOR_TICK = 10

interface UseRulerTicksProps {
  absoluteWidth: number
  absoluteHeight: number
  scale: number
  gridSize: number
  absoluteStagePos: { x: number; y: number }
  rulerSize: number
}

/**
 * Custom hook to calculate the positions of ticks for the ruler component.
 *
 * This hook generates horizontal and vertical tick positions based on the
 * provided dimensions, scale, and grid size. It calculates the effective
 * grid size and determines which ticks should be displayed based on the
 * current viewport position.
 *
 * @param {UseRulerTicksProps} props - The properties for the hook.
 * @param {number} props.absoluteWidth - The absolute width of the ruler.
 * @param {number} props.absoluteHeight - The absolute height of the ruler.
 * @param {number} props.scale - The current scale of the canvas.
 * @param {number} props.gridSize - The size of the grid.
 * @param {{ x: number; y: number }} props.absoluteStagePos - The absolute position of the stage.
 * @param {number} props.rulerSize - The size of the ruler.
 *
 * @returns {{ horizontalTicks: TickData[], verticalTicks: TickData[] }} - An object containing
 * the calculated horizontal and vertical tick data.
 */
export const useRulerTicks = (props: UseRulerTicksProps) => {
  const { absoluteWidth, absoluteHeight, scale, gridSize, absoluteStagePos, rulerSize } = props

  const getTickPositions = useCallback(
    (isHorizontal: boolean): TickData[] => {
      const result: TickData[] = []
      const viewSize = isHorizontal ? absoluteWidth : absoluteHeight

      // Calculate the inverse scale
      const invScale = 1 / scale
      // Estimate the effective grid size based on the scale
      const effectiveGridSize = estimateEffectiveGridSize(invScale, gridSize)

      // Calculate start position based on stage position
      const viewportPos = isHorizontal ? absoluteStagePos.x : absoluteStagePos.y
      const startPos = Math.floor(-viewportPos / effectiveGridSize) * effectiveGridSize

      // Calculate maximum position
      const maxPosition = viewSize - viewportPos

      let position = startPos

      // Use a counter to prevent too many iterations
      let counter = 0
      const maxIterations = 1000 // Safety limit

      while (position < maxPosition && counter < maxIterations) {
        // Calculate screen position
        const screenPos = position + viewportPos

        // Only show ticks that are on the screen
        if (screenPos >= 0) {
          // Calculate the modulus of the position with the effective grid size
          const modulus = Math.abs(position % (effectiveGridSize * MAJOR_TICK))

          // Determine if the current position is a major tick
          const isMajorTick = modulus < effectiveGridSize
          const tickSize = rulerSize / (isMajorTick ? 4 : 8)

          result.push({
            position,
            screenPos,
            tickSize,
            showLabel: isMajorTick,
          })
        }

        position += effectiveGridSize
        counter++
      }

      return result
    },
    [absoluteWidth, absoluteHeight, scale, gridSize, absoluteStagePos.x, absoluteStagePos.y, rulerSize]
  )

  const horizontalTicks = useMemo(() => getTickPositions(true), [getTickPositions])
  const verticalTicks = useMemo(() => getTickPositions(false), [getTickPositions])

  return { horizontalTicks, verticalTicks }
}
