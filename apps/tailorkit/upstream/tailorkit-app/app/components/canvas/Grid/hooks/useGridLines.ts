import { type RefObject, useMemo } from 'react'
import type Konva from 'konva'
import { useGridSize } from './useGridSize'
import { calculateLineThickness, getLineProperties } from '../fns'
import { DEFAULT_GRID_THICKNESS_RATIO, ROT_LINE_OPACITY } from '../constants'
import type { MEASUREMENT_UNIT } from '~/constants/measurement-units'
import type { RESOLUTION } from '~/constants/resolution'

export function useGridLines(props: {
  stageRef: RefObject<Konva.Stage>
  scale?: number
  stagePos: { x: number; y: number }
  width: number
  height: number
  measurementUnit: MEASUREMENT_UNIT
  resolution: RESOLUTION
}) {
  const { stageRef, scale = 1, stagePos, width, height, measurementUnit, resolution } = props
  const { gridExtents, effectiveGridSize } = useGridSize({ stageRef, scale, stagePos, measurementUnit, resolution })

  const { verticalGridLines, horizontalGridLines } = useMemo(() => {
    const vLines = []
    const hLines = []

    // Limit the number of lines to prevent performance issues
    const maxLines = 1000 // Maximum number of lines to render
    const step = effectiveGridSize
    const totalVerticalLines = Math.ceil(width / step)
    const totalHorizontalLines = Math.ceil(height / step)

    // Adjust step size if too many lines
    const adjustedStep = Math.max(step, Math.ceil(Math.max(totalVerticalLines, totalHorizontalLines) / maxLines) * step)

    // Generate vertical grid lines
    for (let x = 0; x <= width; x += adjustedStep) {
      if (x < gridExtents.startX - adjustedStep || x > gridExtents.endX + adjustedStep) continue
      vLines.push({
        points: [x, 0, x, height],
        ...getLineProperties({
          isMajor: false, //Math.round(y / effectiveGridSize) % MAJOR_LINE_INTERVAL === 0,
          lineThickness: calculateLineThickness({
            scale,
            effectiveGridSize,
            thicknessRatio: DEFAULT_GRID_THICKNESS_RATIO,
          }),
        }),
      })
    }

    // Generate horizontal grid lines
    for (let y = 0; y <= height; y += adjustedStep) {
      if (y < gridExtents.startY - adjustedStep || y > gridExtents.endY + adjustedStep) continue
      hLines.push({
        points: [0, y, width, y],
        ...getLineProperties({
          isMajor: false, //Math.round(y / effectiveGridSize) % MAJOR_LINE_INTERVAL === 0,
          lineThickness: calculateLineThickness({
            scale,
            effectiveGridSize,
            thicknessRatio: DEFAULT_GRID_THICKNESS_RATIO,
          }),
        }),
      })
    }

    return {
      verticalGridLines: vLines,
      horizontalGridLines: hLines,
    }
  }, [gridExtents, scale, effectiveGridSize, width, height])

  // Memoize rule of thirds lines
  const ruleOfThirdsLines = useMemo(() => {
    const lineThickness = calculateLineThickness({
      scale,
      effectiveGridSize: 1,
      thicknessRatio: 1,
    })
    const thirdWidth = width / 3
    const thirdHeight = height / 3

    const commonProps = {
      ...getLineProperties({ isMajor: true, lineThickness }),
      dash: [10 / scale, 5 / scale],
      opacity: ROT_LINE_OPACITY,
    }

    return [
      { points: [thirdWidth, 0, thirdWidth, height], ...commonProps },
      { points: [thirdWidth * 2, 0, thirdWidth * 2, height], ...commonProps },
      { points: [0, thirdHeight, width, thirdHeight], ...commonProps },
      { points: [0, thirdHeight * 2, width, thirdHeight * 2], ...commonProps },
    ]
  }, [scale, width, height])

  return { verticalGridLines, horizontalGridLines, ruleOfThirdsLines }
}
