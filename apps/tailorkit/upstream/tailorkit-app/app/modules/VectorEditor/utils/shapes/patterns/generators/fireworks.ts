/**
 * Fireworks Pattern Generator
 * Creates a radial burst pattern resembling fireworks
 */

import type { PathCommand } from '../../../svg'
import type { PatternConfig, PatternElement } from '../types'
import { PATTERN_COLORS } from '../types'
import { createSeededRandom } from '../utils/random'

/**
 * Generate a single spark/streak shape
 */
function generateSparkPath(length: number, width: number): PathCommand[] {
  const hw = width / 2

  return [
    { type: 'M', x: 0, y: 0 },
    { type: 'L', x: -hw, y: length * 0.1 },
    {
      type: 'C',
      x: 0,
      y: length,
      cp1: { x: -hw * 0.5, y: length * 0.5 },
      cp2: { x: -hw * 0.2, y: length * 0.8 },
    },
    {
      type: 'C',
      x: hw,
      y: length * 0.1,
      cp1: { x: hw * 0.2, y: length * 0.8 },
      cp2: { x: hw * 0.5, y: length * 0.5 },
    },
    { type: 'Z', x: 0, y: 0 },
  ]
}

/**
 * Generate a small circular dot
 */
function generateDotPath(radius: number): PathCommand[] {
  const k = 0.5522847498

  return [
    { type: 'M', x: 0, y: -radius },
    {
      type: 'C',
      x: radius,
      y: 0,
      cp1: { x: radius * k, y: -radius },
      cp2: { x: radius, y: -radius * k },
    },
    {
      type: 'C',
      x: 0,
      y: radius,
      cp1: { x: radius, y: radius * k },
      cp2: { x: radius * k, y: radius },
    },
    {
      type: 'C',
      x: -radius,
      y: 0,
      cp1: { x: -radius * k, y: radius },
      cp2: { x: -radius, y: radius * k },
    },
    {
      type: 'C',
      x: 0,
      y: -radius,
      cp1: { x: -radius, y: -radius * k },
      cp2: { x: -radius * k, y: -radius },
    },
    { type: 'Z', x: 0, y: -radius },
  ]
}

/**
 * Transform path commands with translation and rotation
 */
function transformCommands(commands: PathCommand[], tx: number, ty: number, rotation: number): PathCommand[] {
  const rad = (rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  const transform = (x: number, y: number) => ({
    x: x * cos - y * sin + tx,
    y: x * sin + y * cos + ty,
  })

  return commands.map(cmd => {
    const transformed = transform(cmd.x, cmd.y)

    if (cmd.type === 'C' && cmd.cp1 && cmd.cp2) {
      const cp1 = transform(cmd.cp1.x, cmd.cp1.y)
      const cp2 = transform(cmd.cp2.x, cmd.cp2.y)
      return {
        ...cmd,
        x: transformed.x,
        y: transformed.y,
        cp1,
        cp2,
      }
    }

    return {
      ...cmd,
      x: transformed.x,
      y: transformed.y,
    }
  })
}

/**
 * Generate fireworks burst pattern
 */
export function generatePatternFireworks(
  cx: number,
  cy: number,
  width: number,
  height: number,
  config: PatternConfig = {}
): PatternElement[] {
  const colors = config.colors ?? PATTERN_COLORS.fireworks.gold
  const count = config.count ?? 20
  const seed = config.seed ?? 12345

  const rng = createSeededRandom(seed)
  const results: PatternElement[] = []

  const maxRadius = Math.min(width, height) * 0.45
  const minRadius = maxRadius * 0.3

  // Generate main burst rays
  for (let i = 0; i < count; i++) {
    const angle = (i * 360) / count + rng.range(-5, 5)
    const rad = (angle * Math.PI) / 180

    // Vary the length of rays
    const rayLength = rng.range(minRadius, maxRadius)
    const rayWidth = rng.range(3, 8)

    // Position along the ray
    const distance = rng.range(rayLength * 0.3, rayLength * 0.9)
    const px = cx + Math.cos(rad) * distance
    const py = cy + Math.sin(rad) * distance

    // Generate spark
    const sparkPath = generateSparkPath(rayLength * 0.3, rayWidth)
    const transformedSpark = transformCommands(sparkPath, px, py, angle + 90)

    const color = colors[i % colors.length]

    results.push({
      id: `firework-spark-${i}`,
      name: `Spark ${i + 1}`,
      commands: transformedSpark,
      fill: color,
      stroke: 'none',
      strokeWidth: 0,
      zIndex: i,
      x: px,
      y: py,
      rotation: angle,
      scale: 1,
    })
  }

  // Add scattered dots for sparkle effect
  const dotCount = Math.floor(count * 1.5)
  for (let i = 0; i < dotCount; i++) {
    const angle = rng.range(0, 360)
    const rad = (angle * Math.PI) / 180
    const distance = rng.range(minRadius * 0.5, maxRadius)

    const px = cx + Math.cos(rad) * distance
    const py = cy + Math.sin(rad) * distance
    const dotRadius = rng.range(1.5, 4)

    const dotPath = generateDotPath(dotRadius)
    const transformedDot = transformCommands(dotPath, px, py, 0)

    const color = colors[i % colors.length]

    results.push({
      id: `firework-dot-${i}`,
      name: `Dot ${i + 1}`,
      commands: transformedDot,
      fill: color,
      stroke: 'none',
      strokeWidth: 0,
      zIndex: count + i,
      x: px,
      y: py,
      rotation: 0,
      scale: 1,
    })
  }

  // Add center glow
  const centerGlowPath = generateDotPath(maxRadius * 0.08)
  const transformedCenter = transformCommands(centerGlowPath, cx, cy, 0)

  results.push({
    id: 'firework-center',
    name: 'Center Glow',
    commands: transformedCenter,
    fill: '#FFFFFF',
    stroke: 'none',
    strokeWidth: 0,
    zIndex: count + dotCount,
    x: cx,
    y: cy,
    rotation: 0,
    scale: 1,
  })

  return results
}
