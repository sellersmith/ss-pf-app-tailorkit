import type { RefObject } from 'react'
import { useEffect, useMemo } from 'react'
import type Konva from 'konva'
import { formatLengthUnit, lengthUnitToLengthUnit } from '~/utils/lengthUnitToPixels'
import { useTools } from '~/modules/TemplateEditor/hooks/useTools'
import { calculateLineThickness, computeExtent } from '../fns'
import { DEFAULT_GRID_SIZE, DEFAULT_GRID_THICKNESS_RATIO } from '../constants'
import type { MEASUREMENT_UNIT } from '~/constants/measurement-units'
import type { RESOLUTION } from '~/constants/resolution'

interface GridCalculations {
  effectiveGridSize: number
  gridExtents: {
    startX: number
    startY: number
    endX: number
    endY: number
  }
  strokeWidthCanvasBounds: number
}

/**
 * Hook to calculate grid-related measurements based on zoom level using a continuous function
 * @returns Object containing grid calculations
 */
export function useGridSize(props: {
  stageRef: RefObject<Konva.Stage>
  scale?: number
  stagePos: { x: number; y: number }
  measurementUnit: MEASUREMENT_UNIT
  resolution: RESOLUTION
}): GridCalculations {
  const { stageRef, scale = 1, stagePos, measurementUnit, resolution } = props
  const { x: left, y: top } = stagePos
  const {
    toolBarSettings: { grid },
    onGridSizeChangeHandler,
  } = useTools()

  const gridSize = useMemo(() => {
    return grid?.gridSize || DEFAULT_GRID_SIZE
  }, [grid])

  // Convert grid size to pixels based on measurement unit and resolution
  const gridSizeInPixels = useMemo(() => {
    const convertedSize = lengthUnitToLengthUnit(measurementUnit, 'px', gridSize, resolution)

    return convertedSize
  }, [gridSize, measurementUnit, resolution])

  // Update effectiveGridSize calculation to handle both modes
  const effectiveGridSize = useMemo(() => {
    // Ensure non-negative and non-zero to avoid divisions and infinite loops
    const safeGridSize = Math.max(1, Math.abs(gridSizeInPixels))
    if (grid?.gridMode === 'fixed') {
      return safeGridSize
    }

    // Auto mode - existing dynamic calculation
    const logScale = Math.log2(scale)
    const adjustment = Math.pow(2, Math.floor(-logScale)) // Use floor instead of round for smoother transitions
    const adjustedSize = safeGridSize * adjustment

    return Math.max(1, Math.abs(adjustedSize))
  }, [grid?.gridMode, gridSizeInPixels, scale])

  // Memoize viewport dimensions calculation
  const viewportDimensions = useMemo(() => {
    if (!stageRef.current) return { width: 0, height: 0 }
    const container = stageRef.current.container()
    return {
      width: container.clientWidth / scale,
      height: container.clientHeight / scale,
    }
  }, [stageRef, scale])

  // Calculate grid extents
  const gridExtents = useMemo(() => {
    const leftEdge = -left / scale
    const topEdge = -top / scale
    const rightEdge = leftEdge + viewportDimensions.width
    const bottomEdge = topEdge + viewportDimensions.height

    return {
      startX: computeExtent(leftEdge, effectiveGridSize, Math.floor),
      startY: computeExtent(topEdge, effectiveGridSize, Math.floor),
      endX: computeExtent(rightEdge, effectiveGridSize, Math.ceil),
      endY: computeExtent(bottomEdge, effectiveGridSize, Math.ceil),
    }
  }, [left, top, scale, viewportDimensions, effectiveGridSize])

  const strokeWidthCanvasBounds = useMemo(() => {
    return calculateLineThickness({
      scale,
      effectiveGridSize,
      thicknessRatio: DEFAULT_GRID_THICKNESS_RATIO,
    })
  }, [scale, effectiveGridSize])

  useEffect(() => {
    const gridSizeInMeasurementUnit = lengthUnitToLengthUnit('px', measurementUnit, DEFAULT_GRID_SIZE, resolution)
    const formattedGridSize = formatLengthUnit(gridSizeInMeasurementUnit, measurementUnit)
    onGridSizeChangeHandler(formattedGridSize)
    /**
     * onGridSizeChangeHandler is a callback function that is called when the grid size changes.
     * This function is used to update the grid size in the template editor.
     * Even though useCallback is wrapped in the declaration, it still causes useEffect to be called repeatedly when it is included in dependencies,
     * so I added the eslint-disable-next-line react-hooks/exhaustive-deps rule to ignore the dependency.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurementUnit, resolution])

  return { effectiveGridSize, gridExtents, strokeWidthCanvasBounds }
}
