import type { TextStyle } from 'extensions/tailorkit-src/src/assets/libraries/generate-shape-path'
import { RECTANGLE, ELLIPSE, TRIANGLE, STAR, HEART } from 'extensions/tailorkit-src/src/assets/constants/shape'

interface PathGeneratorArgs {
  width: number
  height: number
  style: TextStyle
}

/**
 * Generates a rectangle path for text
 */
export function generateRectanglePath({ width, height, style: { fontSize = 0 } }: PathGeneratorArgs): string {
  return `M ${fontSize} ${fontSize} H ${width + fontSize} V ${height + fontSize} H ${fontSize} Z`
}

/**
 * Generates an ellipse path for text
 */
export function generateEllipsePath({ width, height, style: { fontSize = 0 } }: PathGeneratorArgs): string {
  const centerX = width / 2 + fontSize
  const centerY = height / 2 + fontSize
  const radiusX = width / 2
  const radiusY = height / 2

  return `M ${centerX - radiusX}, ${centerY} a ${radiusX},${radiusY} 0 1,1 ${2 * radiusX},0 a ${radiusX},${radiusY} 0 1,1 ${-2 * radiusX},0`
}

/**
 * Generates a sinusoidal curve path for text
 * @param width - Container width
 * @param height - Container height
 * @param curvePeaks - Number of wave peaks (1-4)
 * @param curveBend - Bend percentage (-100% to 100%)
 * @param fontSize - Font size for positioning offset
 */
export function generateCurvePath(
  width: number,
  height: number,
  curvePeaks: number = 1,
  curveBend: number = 50,
  fontSize: number = 0
): string {
  // Calculate the amplitude based on bend percentage and container height
  // When bend is 100%, the peak touches the top/bottom boundary
  const maxAmplitude = height / 2
  const amplitude = (curveBend / 100) * maxAmplitude

  // Baseline Y position (center of container) - no fontSize offset needed for TextPath
  const baselineY = height / 2

  // Calculate number of points for smooth curve
  const steps = Math.max(50, width / 4) // More points for smoother curves
  const stepSize = width / steps

  // Generate path points
  let pathData = ''

  for (let i = 0; i <= steps; i++) {
    // X position: start at 0, end at width (no fontSize offset)
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
 * Generates a triangle path for text
 */
export function generateTrianglePath({ width, height, style: { fontSize = 0 } }: PathGeneratorArgs): string {
  const pointA = { x: width / 2 + fontSize, y: fontSize }
  const pointB = { x: fontSize, y: height + fontSize }
  const pointC = { x: width + fontSize, y: height + fontSize }
  const vertexGap = (fontSize * 1.2) / 2

  const firstLine = `M ${pointA.x},${pointA.y} L ${pointC.x},${pointC.y - vertexGap}`
  const secondLine = `M ${pointC.x}, ${pointB.y} L ${pointA.y},${pointB.y}`
  const thirdLine = `M ${pointA.y}, ${pointB.y - vertexGap} L ${pointA.x},${pointA.y}`

  return `${firstLine} ${secondLine} ${thirdLine} Z`
}

/**
 * Generates a star path for text
 */
export function generateStarPath({ width, height, style: { fontSize = 0 } }: PathGeneratorArgs): string {
  const centerX = width / 2 + fontSize
  const centerY = height / 2 + fontSize
  const outerRadius = Math.min(width, height) / 2
  const innerRadius = outerRadius / 2.5
  const points = 5
  const vertexGap = 5

  let path = ''
  for (let i = 0; i < 2 * points; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    const angle = (i * Math.PI) / points - Math.PI / 2
    const nextAngle = ((i + 1) * Math.PI) / points - Math.PI / 2
    const x = centerX + radius * Math.cos(angle)
    const y = centerY + radius * Math.sin(angle)
    const nextRadius = (i + 1) % 2 === 0 ? outerRadius : innerRadius
    const nextX = centerX + nextRadius * Math.cos(nextAngle)
    const nextY = centerY + nextRadius * Math.sin(nextAngle)

    const dx = nextX - x
    const dy = nextY - y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const startX = x + (dx * vertexGap) / distance
    const startY = y + (dy * vertexGap) / distance
    const endX = nextX - (dx * vertexGap) / distance
    const endY = nextY - (dy * vertexGap) / distance

    path += i === 0 ? `M ${startX},${startY} L ${endX},${endY} ` : `M ${startX},${startY} L ${endX},${endY} `
  }

  return `${path}Z`
}

/**
 * Generates a heart path for text
 */
export function generateHeartPath({ width, height, style: { fontSize = 0 } }: PathGeneratorArgs): string {
  const heartDepth = 0.3
  const centerX = width / 2 + fontSize
  const centerY = height / 2 + fontSize
  const topCurveHeight = height * heartDepth

  return `M ${centerX},${topCurveHeight} C ${centerX + width / 2 - fontSize},${centerY - height} ${
    centerX + width - fontSize
  },${centerY + height / 3} ${centerX},${centerY + height / 2} C ${centerX - width + fontSize},${
    centerY + height / 3
  } ${centerX - width / 2 + fontSize},${centerY - height} ${centerX},${topCurveHeight} Z`
}

/**
 * Main function to generate path based on shape type
 */
export function generatePath(shape: string, args: PathGeneratorArgs): string {
  const pathGenerators: Record<string, (args: PathGeneratorArgs) => string> = {
    [RECTANGLE]: generateRectanglePath,
    [ELLIPSE]: generateEllipsePath,
    [TRIANGLE]: generateTrianglePath,
    [STAR]: generateStarPath,
    [HEART]: generateHeartPath,
  }

  const generator = pathGenerators[shape]
  return generator ? generator(args) : ''
}
