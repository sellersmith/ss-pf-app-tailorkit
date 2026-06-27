/**
 * Shared text path geometry calculations
 * Used by both admin app and extensions
 */

import { calculateSafeRadius, validateGeometryParams } from './text-path-utils'
import { scaleCustomPathToFit } from './scale-custom-path'

export interface PathGeometry {
  centerX: number
  centerY: number
  radius: number
}

export interface PathGeometryOptions {
  width: number
  height: number
  fontSize: number
  textShape: 'none' | 'circle' | 'curve' | 'custom'
  circleStartAngle: number
  circleEndAngle: number
  circleInverted?: boolean
  curvePeaks?: number
  curveBend?: number
  /** Custom path data for 'custom' text shape (SVG d attribute) */
  customPathData?: string
  /** Metadata for custom path scaling */
  customPathMetadata?: {
    viewBoxWidth: number
    viewBoxHeight: number
  }
  /** Invert custom path direction (text flows in reverse when true) */
  customPathInverted?: boolean
  fontFamily: string
  color: string
  align: string
  verticalAlign: string
}

/**
 * Calculate base path geometry for text shapes
 */
export function calculatePathGeometry(width: number, height: number): PathGeometry {
  // Validate inputs and calculate safe geometry
  const { width: safeWidth, height: safeHeight } = validateGeometryParams({
    width,
    height,
  })

  const centerX = safeWidth / 2
  const centerY = safeHeight / 2
  const radius = calculateSafeRadius(safeWidth, safeHeight)

  return { centerX, centerY, radius }
}

/**
 * Generate full circle path for reference display
 */
export function generateFullCirclePath(pathGeometry: PathGeometry): string {
  const { centerX, centerY, radius } = pathGeometry
  // Static full circle path starting from top (12 o'clock)
  return `M ${centerX},${centerY - radius} A ${radius},${radius} 0 1,1 ${centerX - 0.1},${centerY - radius}`
}

/**
 * Generate circle text path based on start and end angles
 */
export function generateCircleTextPath(
  pathGeometry: PathGeometry,
  circleStartAngle: number,
  circleEndAngle: number,
  fullCirclePath: string,
  circleInverted: boolean = false
): string {
  const { centerX, centerY, radius } = pathGeometry

  // Calculate arc span for proper path direction
  let arcSpan = circleEndAngle - circleStartAngle
  if (arcSpan < 0) arcSpan += 2 * Math.PI

  // Check if it's a full circle or intentionally overlapping anchors for full circle
  const isFullCircle = Math.abs(circleEndAngle - circleStartAngle) >= 2 * Math.PI - 0.01
  const isIntentionalFullCircle = Math.abs(arcSpan) < 0.01 || Math.abs(arcSpan - 2 * Math.PI) < 0.01

  if (isFullCircle || isIntentionalFullCircle) {
    // For inverted full circle, trace counter-clockwise to flip text to inside
    if (circleInverted) {
      // Counter-clockwise full circle (sweep=0, large-arc=1)
      return `M ${centerX},${centerY - radius} A ${radius},${radius} 0 1,0 ${centerX + 0.1},${centerY - radius}`
    }
    return fullCirclePath
  }

  // Minimum arc span to ensure text visibility (approximately 0.1 radians ≈ 5.7 degrees)
  // Only apply this for small arcs that are NOT intended to be full circles
  const minArcSpan = 0.1
  if (arcSpan < minArcSpan && arcSpan > 0.01) {
    // When angles are close but not the same, create a small arc centered around the start angle
    const halfMinSpan = minArcSpan / 2
    const adjustedStartAngle = circleStartAngle - halfMinSpan
    const adjustedEndAngle = circleStartAngle + halfMinSpan

    const startX = centerX + radius * Math.cos(adjustedStartAngle)
    const startY = centerY + radius * Math.sin(adjustedStartAngle)
    const endX = centerX + radius * Math.cos(adjustedEndAngle)
    const endY = centerY + radius * Math.sin(adjustedEndAngle)

    // When inverted: swap start/end and flip sweep to trace same arc backwards
    if (circleInverted) {
      return `M ${endX},${endY} A ${radius},${radius} 0 0 0 ${startX},${startY}`
    }
    return `M ${startX},${startY} A ${radius},${radius} 0 0 1 ${endX},${endY}`
  }

  // Calculate points on the circle
  const startX = centerX + radius * Math.cos(circleStartAngle)
  const startY = centerY + radius * Math.sin(circleStartAngle)
  const endX = centerX + radius * Math.cos(circleEndAngle)
  const endY = centerY + radius * Math.sin(circleEndAngle)

  const largeArcFlag = arcSpan > Math.PI ? 1 : 0

  // Normal: path from start to end, clockwise (sweep=1)
  // Inverted: path from end to start, counter-clockwise (sweep=0)
  // This traces the SAME arc but in opposite direction, flipping text to inside
  if (circleInverted) {
    return `M ${endX},${endY} A ${radius},${radius} 0 ${largeArcFlag} 0 ${startX},${startY}`
  }

  return `M ${startX},${startY} A ${radius},${radius} 0 ${largeArcFlag} 1 ${endX},${endY}`
}

/**
 * Generate sinusoidal curve text path
 * Creates the same curve as the admin app generateCurvePath function
 */
export function generateCurveTextPath(
  width: number,
  height: number,
  fontSize: number,
  curvePeaks: number = 1,
  curveBend: number = 50
): string {
  // Calculate the amplitude based on bend percentage and container height
  // When bend is 100%, the peak touches the top/bottom boundary
  const maxAmplitude = height / 2
  const amplitude = (curveBend / 100) * maxAmplitude

  // Baseline Y position (center of container)
  const baselineY = height / 2

  // Calculate number of points for smooth curve
  const steps = Math.max(50, width / 4) // More points for smoother curves
  const stepSize = width / steps

  // Generate path points
  let pathData = ''

  for (let i = 0; i <= steps; i++) {
    // X position: start at 0, end at width
    const x = i * stepSize

    // Calculate Y position using sinusoidal wave
    // Each peak represents a half cycle (up or down)
    // 1 peak = π (up), 2 peaks = 2π (up,down), 3 peaks = 3π (up,down,up)
    const angle = (i / steps) * (curvePeaks * Math.PI)
    const y = baselineY - amplitude * Math.sin(angle)

    if (i === 0) {
      pathData += `M ${x} ${y}`
    } else {
      pathData += ` L ${x} ${y}`
    }
  }

  return pathData
}

/**
 * Main function to generate text path based on shape and parameters
 */
export function generateTextPath(options: PathGeometryOptions): {
  pathGeometry: PathGeometry
  fullCirclePath: string
  textPath: string | null
} {
  const { width, height, fontSize, textShape, circleStartAngle, circleEndAngle } = options

  // Calculate base geometry
  const pathGeometry = calculatePathGeometry(width, height)
  const fullCirclePath = generateFullCirclePath(pathGeometry)

  let textPath: string | null = null

  if (textShape === 'circle') {
    textPath = generateCircleTextPath(
      pathGeometry,
      circleStartAngle,
      circleEndAngle,
      fullCirclePath,
      options.circleInverted ?? false
    )
  } else if (textShape === 'curve') {
    // Pass curvePeaks and curveBend parameters from options
    textPath = generateCurveTextPath(width, height, fontSize || 0, options.curvePeaks || 1, options.curveBend || 50)
  } else if (textShape === 'custom' && options.customPathData) {
    // Scale custom path from VectorEditor to fit within text layer dimensions
    textPath = scaleCustomPathToFit(options.customPathData, width, height, {
      metadata: options.customPathMetadata,
      inverted: options.customPathInverted,
    })
  }

  return {
    pathGeometry,
    fullCirclePath,
    textPath,
  }
}
