/**
 * Shape Generator Functions
 *
 * Pure functions that generate PathCommand[] arrays for predefined shapes.
 * Extracted from VectorEditor for reuse across modules.
 */

import type { Point } from '~/types/geometry'
import type { PathCommand } from '~/types/svg-path'

export type ShapeGenerator = (cx: number, cy: number, width: number, height: number) => PathCommand[]

/**
 * Helper to generate regular polygon points
 */
export function generatePolygonPoints(
  cx: number,
  cy: number,
  radius: number,
  sides: number,
  rotation = -Math.PI / 2
): Point[] {
  const points: Point[] = []
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (i * 2 * Math.PI) / sides
    points.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    })
  }
  return points
}

/**
 * Helper to generate star points (alternating outer/inner radius)
 */
export function generateStarPoints(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  points: number,
  rotation = -Math.PI / 2
): Point[] {
  const result: Point[] = []
  const totalPoints = points * 2
  for (let i = 0; i < totalPoints; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    const angle = rotation + (i * Math.PI) / points
    result.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    })
  }
  return result
}

/**
 * Convert points array to closed path commands
 */
export function pointsToPath(points: Point[]): PathCommand[] {
  if (points.length === 0) return []
  const commands: PathCommand[] = [{ type: 'M', x: points[0].x, y: points[0].y }]
  for (let i = 1; i < points.length; i++) {
    commands.push({ type: 'L', x: points[i].x, y: points[i].y })
  }
  commands.push({ type: 'Z', x: points[0].x, y: points[0].y })
  return commands
}

// =============================================================================
// Basic Shapes
// =============================================================================

/**
 * Circle - uses arc commands
 */
export function generateCircle(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const r = Math.min(width, height) / 2
  return [
    { type: 'M', x: cx - r, y: cy },
    { type: 'A', x: cx + r, y: cy, rx: r, ry: r, rotation: 0, largeArc: true, sweep: true },
    { type: 'A', x: cx - r, y: cy, rx: r, ry: r, rotation: 0, largeArc: true, sweep: true },
    { type: 'Z', x: cx - r, y: cy },
  ]
}

/**
 * Ellipse - uses arc commands
 */
export function generateEllipse(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const rx = width / 2
  const ry = height / 2
  return [
    { type: 'M', x: cx - rx, y: cy },
    { type: 'A', x: cx + rx, y: cy, rx, ry, rotation: 0, largeArc: true, sweep: true },
    { type: 'A', x: cx - rx, y: cy, rx, ry, rotation: 0, largeArc: true, sweep: true },
    { type: 'Z', x: cx - rx, y: cy },
  ]
}

/**
 * Semicircle - half circle arc (open path)
 */
export function generateSemicircle(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const r = Math.min(width, height) / 2
  return [
    { type: 'M', x: cx - r, y: cy },
    { type: 'A', x: cx + r, y: cy, rx: r, ry: r, rotation: 0, largeArc: false, sweep: false },
  ]
}

/**
 * Quarter Arc - 90 degree arc (open path)
 */
export function generateQuarterArc(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const r = Math.min(width, height) / 2
  return [
    { type: 'M', x: cx + r, y: cy },
    { type: 'A', x: cx, y: cy - r, rx: r, ry: r, rotation: 0, largeArc: false, sweep: false },
  ]
}

/**
 * Three Quarter Arc - 270 degree arc (open path)
 * Uses two connected arcs (semicircle + quarter) for better rendering at small sizes
 */
export function generateThreeQuarterArc(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const r = Math.min(width, height) / 2
  // Start at right (0°), go clockwise: right -> bottom -> left (semicircle), then left -> top (quarter)
  return [
    { type: 'M', x: cx + r, y: cy },
    // Semicircle from right to left (through bottom)
    { type: 'A', x: cx - r, y: cy, rx: r, ry: r, rotation: 0, largeArc: false, sweep: true },
    // Quarter arc from left to top
    { type: 'A', x: cx, y: cy - r, rx: r, ry: r, rotation: 0, largeArc: false, sweep: true },
  ]
}

/**
 * Rectangle
 */
export function generateRectangle(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const hw = width / 2
  const hh = height / 2
  return [
    { type: 'M', x: cx - hw, y: cy - hh },
    { type: 'L', x: cx + hw, y: cy - hh },
    { type: 'L', x: cx + hw, y: cy + hh },
    { type: 'L', x: cx - hw, y: cy + hh },
    { type: 'Z', x: cx - hw, y: cy - hh },
  ]
}

/**
 * Square - rectangle with equal sides (uses min dimension)
 */
export function generateSquare(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const size = Math.min(width, height)
  const halfSize = size / 2
  return [
    { type: 'M', x: cx - halfSize, y: cy - halfSize },
    { type: 'L', x: cx + halfSize, y: cy - halfSize },
    { type: 'L', x: cx + halfSize, y: cy + halfSize },
    { type: 'L', x: cx - halfSize, y: cy + halfSize },
    { type: 'Z', x: cx - halfSize, y: cy - halfSize },
  ]
}

/**
 * Triangle (equilateral-ish, pointing up)
 */
export function generateTriangle(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const hw = width / 2
  const hh = height / 2
  return [
    { type: 'M', x: cx, y: cy - hh },
    { type: 'L', x: cx + hw, y: cy + hh },
    { type: 'L', x: cx - hw, y: cy + hh },
    { type: 'Z', x: cx, y: cy - hh },
  ]
}

// =============================================================================
// Regular Polygons
// =============================================================================

/**
 * Pentagon
 */
export function generatePentagon(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const r = Math.min(width, height) / 2
  return pointsToPath(generatePolygonPoints(cx, cy, r, 5))
}

/**
 * Hexagon
 */
export function generateHexagon(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const r = Math.min(width, height) / 2
  return pointsToPath(generatePolygonPoints(cx, cy, r, 6))
}

/**
 * Heptagon
 */
export function generateHeptagon(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const r = Math.min(width, height) / 2
  return pointsToPath(generatePolygonPoints(cx, cy, r, 7))
}

/**
 * Octagon
 */
export function generateOctagon(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const r = Math.min(width, height) / 2
  return pointsToPath(generatePolygonPoints(cx, cy, r, 8))
}

// =============================================================================
// Stars
// =============================================================================

/**
 * 5-pointed Star
 */
export function generateStar(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const outerR = Math.min(width, height) / 2
  const innerR = outerR * 0.4
  return pointsToPath(generateStarPoints(cx, cy, outerR, innerR, 5))
}

/**
 * 9-pointed Star
 */
export function generateNinePointStar(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const outerR = Math.min(width, height) / 2
  const innerR = outerR * 0.5
  return pointsToPath(generateStarPoints(cx, cy, outerR, innerR, 9))
}

// =============================================================================
// Nature Shapes
// =============================================================================

/**
 * Snowflake - 6 spokes with branches
 */
export function generateSnowflake(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const r = Math.min(width, height) / 2
  const branchR = r * 0.6
  const branchOffset = r * 0.35
  const commands: PathCommand[] = []

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 2
    const endX = cx + r * Math.cos(angle)
    const endY = cy + r * Math.sin(angle)

    // Main spoke
    commands.push({ type: 'M', x: cx, y: cy })
    commands.push({ type: 'L', x: endX, y: endY })

    // Branch 1
    const branchAngle1 = angle + Math.PI / 6
    const branch1X = cx + branchOffset * Math.cos(angle) + branchR * 0.3 * Math.cos(branchAngle1)
    const branch1Y = cy + branchOffset * Math.sin(angle) + branchR * 0.3 * Math.sin(branchAngle1)
    commands.push({ type: 'M', x: cx + branchOffset * Math.cos(angle), y: cy + branchOffset * Math.sin(angle) })
    commands.push({ type: 'L', x: branch1X, y: branch1Y })

    // Branch 2
    const branchAngle2 = angle - Math.PI / 6
    const branch2X = cx + branchOffset * Math.cos(angle) + branchR * 0.3 * Math.cos(branchAngle2)
    const branch2Y = cy + branchOffset * Math.sin(angle) + branchR * 0.3 * Math.sin(branchAngle2)
    commands.push({ type: 'M', x: cx + branchOffset * Math.cos(angle), y: cy + branchOffset * Math.sin(angle) })
    commands.push({ type: 'L', x: branch2X, y: branch2Y })
  }

  return commands
}

/**
 * Heart
 */
export function generateHeart(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const hw = width / 2
  const hh = height / 2
  const topOffset = hh * 0.3

  return [
    { type: 'M', x: cx, y: cy + hh }, // Bottom point
    {
      type: 'C',
      x: cx - hw,
      y: cy - topOffset,
      cp1: { x: cx - hw, y: cy + hh * 0.3 },
      cp2: { x: cx - hw, y: cy },
    },
    {
      type: 'C',
      x: cx,
      y: cy - hh * 0.2,
      cp1: { x: cx - hw, y: cy - hh * 0.6 },
      cp2: { x: cx - hw * 0.3, y: cy - hh * 0.5 },
    },
    {
      type: 'C',
      x: cx + hw,
      y: cy - topOffset,
      cp1: { x: cx + hw * 0.3, y: cy - hh * 0.5 },
      cp2: { x: cx + hw, y: cy - hh * 0.6 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + hh,
      cp1: { x: cx + hw, y: cy },
      cp2: { x: cx + hw, y: cy + hh * 0.3 },
    },
    { type: 'Z', x: cx, y: cy + hh },
  ]
}

/**
 * Moon (Crescent)
 */
export function generateMoon(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const rx = width / 2
  const ry = height / 2
  const innerRx = rx * 0.7

  return [
    { type: 'M', x: cx, y: cy - ry },
    // Outer arc (right side of moon)
    { type: 'A', x: cx, y: cy + ry, rx, ry, rotation: 0, largeArc: true, sweep: true },
    // Inner arc (creates crescent)
    { type: 'A', x: cx, y: cy - ry, rx: innerRx, ry: ry * 0.9, rotation: 0, largeArc: false, sweep: false },
    { type: 'Z', x: cx, y: cy - ry },
  ]
}

/**
 * Sun - circle with rays
 */
export function generateSun(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const r = Math.min(width, height) / 2
  const innerR = r * 0.5
  const rayLength = r * 0.35
  const commands: PathCommand[] = []

  // Circle (using arc commands)
  commands.push({ type: 'M', x: cx - innerR, y: cy })
  commands.push({ type: 'A', x: cx + innerR, y: cy, rx: innerR, ry: innerR, rotation: 0, largeArc: true, sweep: true })
  commands.push({ type: 'A', x: cx - innerR, y: cy, rx: innerR, ry: innerR, rotation: 0, largeArc: true, sweep: true })
  commands.push({ type: 'Z', x: cx - innerR, y: cy })

  // Rays (8 rays)
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4
    const startX = cx + (innerR + 2) * Math.cos(angle)
    const startY = cy + (innerR + 2) * Math.sin(angle)
    const endX = cx + (innerR + rayLength) * Math.cos(angle)
    const endY = cy + (innerR + rayLength) * Math.sin(angle)

    commands.push({ type: 'M', x: startX, y: startY })
    commands.push({ type: 'L', x: endX, y: endY })
  }

  return commands
}

/**
 * Mountain
 */
export function generateMountain(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const hw = width / 2
  const hh = height / 2

  return [
    { type: 'M', x: cx - hw, y: cy + hh }, // Bottom left
    { type: 'L', x: cx - hw * 0.3, y: cy - hh * 0.3 }, // First peak
    { type: 'L', x: cx, y: cy }, // Valley
    { type: 'L', x: cx + hw * 0.2, y: cy - hh }, // Main peak
    { type: 'L', x: cx + hw, y: cy + hh }, // Bottom right
    { type: 'Z', x: cx - hw, y: cy + hh },
  ]
}

/**
 * Waterdrop
 */
export function generateWaterdrop(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const hw = width / 2
  const hh = height / 2

  return [
    { type: 'M', x: cx, y: cy - hh }, // Top point
    {
      type: 'C',
      x: cx + hw,
      y: cy + hh * 0.3,
      cp1: { x: cx + hw * 0.3, y: cy - hh * 0.3 },
      cp2: { x: cx + hw, y: cy },
    },
    {
      type: 'C',
      x: cx,
      y: cy + hh,
      cp1: { x: cx + hw, y: cy + hh * 0.7 },
      cp2: { x: cx + hw * 0.5, y: cy + hh },
    },
    {
      type: 'C',
      x: cx - hw,
      y: cy + hh * 0.3,
      cp1: { x: cx - hw * 0.5, y: cy + hh },
      cp2: { x: cx - hw, y: cy + hh * 0.7 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - hh,
      cp1: { x: cx - hw, y: cy },
      cp2: { x: cx - hw * 0.3, y: cy - hh * 0.3 },
    },
    { type: 'Z', x: cx, y: cy - hh },
  ]
}

// =============================================================================
// Arrows
// =============================================================================

/**
 * Arrow (right-pointing)
 */
export function generateArrow(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const hw = width / 2
  const hh = height / 2
  const shaftWidth = hh * 0.4
  const headStart = hw * 0.3

  return [
    { type: 'M', x: cx - hw, y: cy - shaftWidth },
    { type: 'L', x: cx + headStart, y: cy - shaftWidth },
    { type: 'L', x: cx + headStart, y: cy - hh },
    { type: 'L', x: cx + hw, y: cy }, // Arrow tip
    { type: 'L', x: cx + headStart, y: cy + hh },
    { type: 'L', x: cx + headStart, y: cy + shaftWidth },
    { type: 'L', x: cx - hw, y: cy + shaftWidth },
    { type: 'Z', x: cx - hw, y: cy - shaftWidth },
  ]
}

/**
 * Two-headed Arrow
 */
export function generateDoubleArrow(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const hw = width / 2
  const hh = height / 2
  const shaftWidth = hh * 0.35
  const headWidth = hw * 0.3

  return [
    { type: 'M', x: cx - hw, y: cy }, // Left tip
    { type: 'L', x: cx - hw + headWidth, y: cy - hh },
    { type: 'L', x: cx - hw + headWidth, y: cy - shaftWidth },
    { type: 'L', x: cx + hw - headWidth, y: cy - shaftWidth },
    { type: 'L', x: cx + hw - headWidth, y: cy - hh },
    { type: 'L', x: cx + hw, y: cy }, // Right tip
    { type: 'L', x: cx + hw - headWidth, y: cy + hh },
    { type: 'L', x: cx + hw - headWidth, y: cy + shaftWidth },
    { type: 'L', x: cx - hw + headWidth, y: cy + shaftWidth },
    { type: 'L', x: cx - hw + headWidth, y: cy + hh },
    { type: 'Z', x: cx - hw, y: cy },
  ]
}

// =============================================================================
// Weather & Dynamic Shapes
// =============================================================================

/**
 * Wave (open path)
 */
export function generateWave(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const hw = width / 2
  const amplitude = height / 3
  const segments = 3

  const commands: PathCommand[] = [{ type: 'M', x: cx - hw, y: cy }]

  for (let i = 0; i < segments; i++) {
    const segmentWidth = width / segments
    const startX = cx - hw + i * segmentWidth
    const midX = startX + segmentWidth / 2
    const endX = startX + segmentWidth
    const direction = i % 2 === 0 ? -1 : 1

    commands.push({
      type: 'C',
      x: endX,
      y: cy,
      cp1: { x: midX, y: cy + direction * amplitude },
      cp2: { x: midX, y: cy + direction * amplitude },
    })
  }

  // Close the wave shape by going back
  const bottomY = cy + height / 3
  commands.push({ type: 'L', x: cx + hw, y: bottomY })
  commands.push({ type: 'L', x: cx - hw, y: bottomY })
  commands.push({ type: 'Z', x: cx - hw, y: cy })

  return commands
}

/**
 * Thunder/Lightning bolt
 */
export function generateThunder(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const hw = width / 2
  const hh = height / 2

  return [
    { type: 'M', x: cx + hw * 0.3, y: cy - hh },
    { type: 'L', x: cx - hw * 0.2, y: cy - hh * 0.1 },
    { type: 'L', x: cx + hw * 0.1, y: cy - hh * 0.1 },
    { type: 'L', x: cx - hw * 0.4, y: cy + hh },
    { type: 'L', x: cx, y: cy + hh * 0.1 },
    { type: 'L', x: cx - hw * 0.3, y: cy + hh * 0.1 },
    { type: 'Z', x: cx + hw * 0.3, y: cy - hh },
  ]
}

/**
 * Wind (multiple curved lines)
 */
export function generateWind(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const hw = width / 2
  const hh = height / 2
  const commands: PathCommand[] = []

  // Three wind lines at different heights
  const lines = [
    { y: cy - hh * 0.6, length: 0.7 },
    { y: cy, length: 1.0 },
    { y: cy + hh * 0.6, length: 0.6 },
  ]

  lines.forEach(line => {
    const startX = cx - hw
    const endX = cx - hw + width * line.length
    const curlRadius = hh * 0.2

    commands.push({ type: 'M', x: startX, y: line.y })
    commands.push({
      type: 'C',
      x: endX,
      y: line.y,
      cp1: { x: startX + (endX - startX) * 0.5, y: line.y },
      cp2: { x: endX - curlRadius, y: line.y },
    })
    // Curl at the end
    commands.push({
      type: 'C',
      x: endX - curlRadius * 0.3,
      y: line.y - curlRadius,
      cp1: { x: endX + curlRadius * 0.5, y: line.y },
      cp2: { x: endX + curlRadius * 0.3, y: line.y - curlRadius * 0.5 },
    })
  })

  return commands
}

// =============================================================================
// Export all generators map
// =============================================================================

export const shapeGenerators: Record<string, ShapeGenerator> = {
  circle: generateCircle,
  ellipse: generateEllipse,
  semicircle: generateSemicircle,
  'quarter-arc': generateQuarterArc,
  'three-quarter-arc': generateThreeQuarterArc,
  rectangle: generateRectangle,
  square: generateSquare,
  triangle: generateTriangle,
  pentagon: generatePentagon,
  hexagon: generateHexagon,
  heptagon: generateHeptagon,
  octagon: generateOctagon,
  star: generateStar,
  'nine-point-star': generateNinePointStar,
  snowflake: generateSnowflake,
  heart: generateHeart,
  moon: generateMoon,
  sun: generateSun,
  mountain: generateMountain,
  waterdrop: generateWaterdrop,
  arrow: generateArrow,
  'double-arrow': generateDoubleArrow,
  wave: generateWave,
  thunder: generateThunder,
  wind: generateWind,
}
