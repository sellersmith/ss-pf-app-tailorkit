/// <reference lib="dom" />
import { MAX_ZOOM_SPEED, MIN_SCALE } from '../../constants/canvas'

export const calculateOnZooming = (args: {
  e: WheelEvent
  oldScale: number
  oldLeft: number
  oldTop: number
  speedFactor: number
}) => {
  const { e, oldScale, oldLeft, oldTop, speedFactor } = args

  const offsetX = e.offsetX
  const offsetY = e.offsetY

  const deltaY = e.deltaY
  let evaluatedDeltaY = deltaY

  // Limit zoom speed to prevent wheeling too fast by user behavior
  if (deltaY > MAX_ZOOM_SPEED) {
    evaluatedDeltaY = MAX_ZOOM_SPEED
  } else if (deltaY < -MAX_ZOOM_SPEED) {
    evaluatedDeltaY = -MAX_ZOOM_SPEED
  }

  let newScale = oldScale - evaluatedDeltaY * oldScale * (0.005 * speedFactor)

  newScale = Math.max(newScale, MIN_SCALE)
  const speed = newScale / oldScale - 1

  const newLeft = oldLeft - (offsetX - oldLeft) * speed
  const newTop = oldTop - (offsetY - oldTop) * speed

  return {
    scale: newScale,
    left: newLeft,
    top: newTop,
  }
}

export const calculateOnMoving = (
  deltaX: number,
  deltaY: number,
  oldLeft: number,
  oldTop: number,
  oldScale: number
  // bounds: { x: number; y: number }
) => {
  // const { x, y } = bounds
  const newLeft = oldLeft - deltaX
  const newTop = oldTop - deltaY

  return {
    // left: newLeft < -x || newLeft > x ? oldLeft : newLeft,
    // top: newTop < -y || newTop > y ? oldTop : newTop,
    left: newLeft,
    top: newTop,
    scale: oldScale,
  }
}

/**
 * Calculates the initial scale, position for a template to fit optimally within the canvas
 * @param canvasWidth - Width of the canvas container
 * @param canvasHeight - Height of the canvas container
 * @param psdImage - Object containing width and height of the PSD image
 * @param scaleUp - Whether to scale up images smaller than canvas (default: true)
 * @param contentOffset - Optional offset of the content bounding box (for preview images with left/top positioning)
 * @returns Object with scale, top, and left values for optimal positioning
 */
export const calculateOnInitTemplate = (
  canvasWidth: number,
  canvasHeight: number,
  psdImage: { width: number; height: number },
  scaleUp: boolean = false,
  contentOffset?: { offsetX: number; offsetY: number }
) => {
  const { width: psdWidth = 0, height: psdHeight = 0 } = psdImage || {}
  const { offsetX = 0, offsetY = 0 } = contentOffset || {}

  // Calculate ratios for both dimensions
  const widthRatio = Math.floor((canvasWidth / psdWidth) * 100) / 100
  const heightRatio = Math.floor((canvasHeight / psdHeight) * 100) / 100

  // Calculate optimal scale
  const optimalScale = Math.min(widthRatio, heightRatio)

  // If scaleUp is false and we would be scaling up (scale > 1), keep original size
  const scale = !scaleUp && optimalScale > 1 ? 1 : optimalScale

  // Calculate centering positions
  // Use signed difference to correctly center when content is larger than canvas
  // When content exceeds canvas size, this yields negative offsets to keep center in view
  // Account for content offset - if content starts at negative coordinates, we need to shift the viewport
  const left = (canvasWidth - psdWidth * scale) / 2 - offsetX * scale
  const top = (canvasHeight - psdHeight * scale) / 2 - offsetY * scale

  return { scale, top, left }
}
