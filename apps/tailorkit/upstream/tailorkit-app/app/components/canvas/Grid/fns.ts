import {
  DEFAULT_GRID_COLOR,
  DEFAULT_GRID_OPACITY,
  DEFAULT_MAX_GRID_THICKNESS,
  MAJOR_LINE_OPACITY_BOOST,
  MAJOR_LINE_THICKNESS_MULTIPLIER,
  DEFAULT_MIN_GRID_THICKNESS,
} from './constants'

/**
 * Calculate line thickness based on scale and constraints
 */
export const calculateLineThickness = (args: { scale: number; effectiveGridSize: number; thicknessRatio: number }) => {
  const { scale, effectiveGridSize, thicknessRatio } = args
  const minThickness = DEFAULT_MIN_GRID_THICKNESS / scale
  const maxThickness = DEFAULT_MAX_GRID_THICKNESS / scale
  const baseThickness = effectiveGridSize * thicknessRatio

  return Math.min(maxThickness, Math.max(minThickness, baseThickness))
}

/**
 * Generate common line properties
 */
export const getLineProperties = (args: { isMajor: boolean; lineThickness: number }) => {
  const { isMajor, lineThickness } = args

  const strokeWidth = isMajor ? lineThickness * MAJOR_LINE_THICKNESS_MULTIPLIER : lineThickness
  const opacity = isMajor ? DEFAULT_GRID_OPACITY + MAJOR_LINE_OPACITY_BOOST : DEFAULT_GRID_OPACITY

  return {
    stroke: DEFAULT_GRID_COLOR,
    strokeWidth,
    opacity,
    perfectDrawEnabled: false,
    listening: false,
  }
}

// Compute extent of a grid line based on position and effective grid size
export const computeExtent = (positionEdge: number, effectiveGridSize: number, fnMath: (x: number) => number) => {
  const safe = Math.max(1e-6, Math.abs(effectiveGridSize))
  return fnMath(positionEdge / safe) * safe
}
