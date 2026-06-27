import type { KonvaEditorConfig } from '../types/editor-types'
import type { StageManager } from '../components/stage-manager'

/**
 * Convert degrees to radians
 */
function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function getScaledDimensions(
  stageManager: StageManager,
  imageElement: HTMLImageElement,
  config: KonvaEditorConfig
) {
  // Store original image dimensions
  const originalDimensions = {
    width: imageElement.naturalWidth,
    height: imageElement.naturalHeight,
  }

  let displayScale = 1

  // Ensure we have valid dimensions
  const safeWidth = Math.max(config.width || 200, 10)
  const safeHeight = Math.max(config.height || 200, 10)

  // Auto-scale very large boundaries to fit in view
  const maxBoundarySize = Math.min(stageManager.containerWidth * 0.8, stageManager.containerHeight * 0.8)
  const minBoundarySize = maxBoundarySize * 0.3 // Set minimum size to 30% of max boundary

  // Reduce the scale if the image is too large
  if (safeWidth > maxBoundarySize || safeHeight > maxBoundarySize) {
    const scaleX = maxBoundarySize / safeWidth
    const scaleY = maxBoundarySize / safeHeight
    displayScale = Math.min(scaleX, scaleY)
  }
  // Increase the scale if the image is too small
  else if (safeWidth < minBoundarySize && safeHeight < minBoundarySize) {
    const scaleX = minBoundarySize / safeWidth
    const scaleY = minBoundarySize / safeHeight
    displayScale = Math.min(scaleX, scaleY)
  }

  const scaledWidth = safeWidth * displayScale
  const scaledHeight = safeHeight * displayScale

  return {
    originalDimensions,
    displayScale,
    scaledWidth,
    scaledHeight,
  }
}

// Utility and type definitions (move outside the class)
export interface ShapeAttrs {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export function getCenter(shape: ShapeAttrs): { x: number; y: number } {
  const angleRad = degToRad(shape.rotation || 0)
  const halfW = shape.width / 2
  const halfH = shape.height / 2
  const cosA = Math.cos(angleRad)
  const sinA = Math.sin(angleRad)
  return {
    x: shape.x + halfW * cosA - halfH * sinA,
    y: shape.y + halfW * sinA + halfH * cosA,
  }
}

export function getTransformedTopLeft(
  center: { x: number; y: number },
  width: number,
  height: number,
  rotation: number
) {
  const angleRad = degToRad(rotation)
  const halfW = width / 2
  const halfH = height / 2
  const cosA = Math.cos(angleRad)
  const sinA = Math.sin(angleRad)
  return {
    x: center.x - (halfW * cosA - halfH * sinA),
    y: center.y - (halfW * sinA + halfH * cosA),
  }
}
