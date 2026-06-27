import type Konva from 'konva'
import type { RefObject } from 'react'
import React, { useEffect, useRef } from 'react'
import { Layer, Line, Rect } from 'react-konva'
import { DEFAULT_GRID_COLOR, DEFAULT_GRID_OPACITY, LINE_BATCH_SIZE } from './constants'
import { useGridSize } from './hooks/useGridSize'
import { useGridLines } from './hooks/useGridLines'
import type { MEASUREMENT_UNIT } from '~/constants/measurement-units'
import type { RESOLUTION } from '~/constants/resolution'
import { TOOL_LAYER_IDS } from '~/constants/canvas'

interface ICanvasGridProps {
  id: string
  stageRef: RefObject<Konva.Stage>
  width: number
  height: number
  scale?: number
  stagePos: {
    x: number
    y: number
  }
  measurementUnit?: MEASUREMENT_UNIT
  resolution?: RESOLUTION
}

/**
 * CanvasGrid Component - Renders the grid lines with optimized performance
 */
function CanvasGrid(props: ICanvasGridProps) {
  const { stageRef, scale = 1, stagePos, width, height, measurementUnit = 'px', resolution = 300 } = props

  const gridLayerRef = useRef<Konva.Layer>(null)
  const { strokeWidthCanvasBounds } = useGridSize({ stageRef, scale, stagePos, measurementUnit, resolution })
  const { verticalGridLines, horizontalGridLines, ruleOfThirdsLines } = useGridLines({
    ...props,
    measurementUnit,
    resolution,
  })

  // Batch render updates
  useEffect(() => {
    const layer = gridLayerRef.current
    if (layer) {
      requestAnimationFrame(() => {
        layer.batchDraw()
      })
    }
  }, [verticalGridLines, horizontalGridLines, ruleOfThirdsLines])

  return (
    <Layer id={TOOL_LAYER_IDS.GRID} ref={gridLayerRef} listening={false}>
      {/* Canvas bounds indicator */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        stroke={DEFAULT_GRID_COLOR}
        opacity={DEFAULT_GRID_OPACITY}
        strokeWidth={strokeWidthCanvasBounds}
        perfectDrawEnabled={false}
        listening={false}
      />

      {/* Render vertical grid lines in batches */}
      {Array.from({ length: Math.ceil(verticalGridLines.length / LINE_BATCH_SIZE) }).map((_, batchIndex) => (
        <React.Fragment key={`v-batch-${batchIndex}`}>
          {verticalGridLines
            .slice(batchIndex * LINE_BATCH_SIZE, (batchIndex + 1) * LINE_BATCH_SIZE)
            .map((line, index) => (
              <Line key={`v-${batchIndex}-${index}`} {...line} perfectDrawEnabled={false} listening={false} />
            ))}
        </React.Fragment>
      ))}

      {/* Render horizontal grid lines in batches */}
      {Array.from({ length: Math.ceil(horizontalGridLines.length / LINE_BATCH_SIZE) }).map((_, batchIndex) => (
        <React.Fragment key={`h-batch-${batchIndex}`}>
          {horizontalGridLines
            .slice(batchIndex * LINE_BATCH_SIZE, (batchIndex + 1) * LINE_BATCH_SIZE)
            .map((line, index) => (
              <Line key={`h-${batchIndex}-${index}`} {...line} perfectDrawEnabled={false} listening={false} />
            ))}
        </React.Fragment>
      ))}

      {/* Render rule of thirds lines */}
      {ruleOfThirdsLines.map((line, index) => (
        <Line key={`rot-${index}`} {...line} perfectDrawEnabled={false} listening={false} />
      ))}
    </Layer>
  )
}

export default CanvasGrid
