/**
 * Estimates the width of a text string based on its length and font size
 * @param text - The text string to estimate the width of
 * @param fontSize - The font size of the text
 * @returns The estimated width of the text
 */
export const estimateTextWidth = (text: string, fontSize: number): number => {
  // Average character width is approximately 0.6 times the font size
  return text.length * fontSize * 0.6
}

/**
 * Estimates the effective grid size based on the inverse scale
 * @param scale - The scale of the canvas
 * @param gridSize - The size of the grid
 * @param multiplier - The multiplier to use for the effective grid size
 * @returns The estimated effective grid size
 */
export const estimateEffectiveGridSize = (scale: number, gridSize: number, multiplier: number = 5): number => {
  let effectiveGridSize = gridSize
  const diff = 0.3

  if (scale > 1 + diff) {
    effectiveGridSize = gridSize / multiplier
  } else if (scale < diff) {
    effectiveGridSize = gridSize * multiplier
  }

  return effectiveGridSize
}

/**
 * Checks if a point is near a guide line
 * @param point - The point to check
 * @param guidePosition - The position of the guide
 * @param isHorizontal - Whether the guide is horizontal
 * @param threshold - The threshold distance to consider "near"
 * @returns Whether the point is near the guide
 */
export const isPointNearGuide = (
  point: { x: number; y: number },
  guidePosition: number,
  isHorizontal: boolean,
  threshold: number = 10
): boolean => {
  if (isHorizontal) {
    return Math.abs(point.y - guidePosition) <= threshold
  }
  return Math.abs(point.x - guidePosition) <= threshold
}

/**
 * Gets the appropriate cursor style for a guide
 * @param isHorizontal - Whether the guide is horizontal
 * @returns The cursor style to use
 */
export const getGuideCursor = (isHorizontal: boolean): string => {
  return isHorizontal ? 'ns-resize' : 'ew-resize'
}

/**
 * Constrains a position to only move in one direction
 * @param pos - The position to constrain
 * @param originalPos - The original position
 * @param isHorizontal - Whether to constrain to horizontal movement
 * @returns The constrained position
 */
export const constrainGuideMovement = (
  pos: { x: number; y: number },
  originalPos: { x: number; y: number },
  isHorizontal: boolean
): { x: number; y: number } => {
  if (isHorizontal) {
    // Horizontal guides can only move vertically
    return {
      x: originalPos.x,
      y: pos.y,
    }
  }
  // Vertical guides can only move horizontally
  return {
    x: pos.x,
    y: originalPos.y,
  }
}
