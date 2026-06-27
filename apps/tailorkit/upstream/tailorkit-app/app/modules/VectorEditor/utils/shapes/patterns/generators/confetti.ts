/**
 * Confetti Pattern Generator
 * Creates scattered confetti pieces (rectangles, circles, streamers)
 */

import type { PathCommand } from '../../../svg'
import type { PatternConfig, PatternElement } from '../types'
import { PATTERN_COLORS } from '../types'
import { scatter, transformPoint } from '../utils/scatter'
import { createSeededRandom } from '../utils/random'

type ConfettiType = 'rectangle' | 'circle' | 'streamer'

/**
 * Generate rectangle confetti shape
 */
function generateRectanglePath(size: number): PathCommand[] {
  const w = size * 0.4
  const h = size

  return [
    { type: 'M', x: -w / 2, y: -h / 2 },
    { type: 'L', x: w / 2, y: -h / 2 },
    { type: 'L', x: w / 2, y: h / 2 },
    { type: 'L', x: -w / 2, y: h / 2 },
    { type: 'Z', x: -w / 2, y: -h / 2 },
  ]
}

/**
 * Generate circle confetti shape
 */
function generateCirclePath(size: number): PathCommand[] {
  const r = size * 0.3
  const k = 0.5522847498 // Bezier approximation of circle

  return [
    { type: 'M', x: 0, y: -r },
    {
      type: 'C',
      x: r,
      y: 0,
      cp1: { x: r * k, y: -r },
      cp2: { x: r, y: -r * k },
    },
    {
      type: 'C',
      x: 0,
      y: r,
      cp1: { x: r, y: r * k },
      cp2: { x: r * k, y: r },
    },
    {
      type: 'C',
      x: -r,
      y: 0,
      cp1: { x: -r * k, y: r },
      cp2: { x: -r, y: r * k },
    },
    {
      type: 'C',
      x: 0,
      y: -r,
      cp1: { x: -r, y: -r * k },
      cp2: { x: -r * k, y: -r },
    },
    { type: 'Z', x: 0, y: -r },
  ]
}

/**
 * Generate wavy streamer shape
 */
function generateStreamerPath(size: number): PathCommand[] {
  const w = size * 0.15
  const h = size * 1.2
  const waves = 3
  const waveHeight = h / waves

  const commands: PathCommand[] = [{ type: 'M', x: -w / 2, y: -h / 2 }]

  // Left side going down
  for (let i = 0; i < waves; i++) {
    const y1 = -h / 2 + i * waveHeight
    const y2 = y1 + waveHeight
    const isOdd = i % 2 === 0

    commands.push({
      type: 'C',
      x: -w / 2,
      y: y2,
      cp1: { x: isOdd ? -w : 0, y: y1 + waveHeight * 0.3 },
      cp2: { x: isOdd ? -w : 0, y: y2 - waveHeight * 0.3 },
    })
  }

  // Bottom edge
  commands.push({ type: 'L', x: w / 2, y: h / 2 })

  // Right side going up
  for (let i = waves - 1; i >= 0; i--) {
    const y1 = -h / 2 + (i + 1) * waveHeight
    const y2 = -h / 2 + i * waveHeight
    const isOdd = i % 2 === 0

    commands.push({
      type: 'C',
      x: w / 2,
      y: y2,
      cp1: { x: isOdd ? 0 : w, y: y1 - waveHeight * 0.3 },
      cp2: { x: isOdd ? 0 : w, y: y2 + waveHeight * 0.3 },
    })
  }

  commands.push({ type: 'Z', x: -w / 2, y: -h / 2 })

  return commands
}

/**
 * Transform confetti path commands based on scatter point
 */
function transformConfettiCommands(commands: PathCommand[], point: ReturnType<typeof scatter>[0]): PathCommand[] {
  return commands.map(cmd => {
    const transformed = transformPoint(cmd.x, cmd.y, point)

    if (cmd.type === 'C' && cmd.cp1 && cmd.cp2) {
      const cp1 = transformPoint(cmd.cp1.x, cmd.cp1.y, point)
      const cp2 = transformPoint(cmd.cp2.x, cmd.cp2.y, point)
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
 * Generate scattered confetti pattern
 */
export function generatePatternConfetti(
  cx: number,
  cy: number,
  width: number,
  height: number,
  config: PatternConfig = {}
): PatternElement[] {
  const colors = config.colors ?? PATTERN_COLORS.confetti.rainbow
  const mergedConfig: PatternConfig = {
    ...config,
    colors,
    rotation: config.rotation ?? { min: -30, max: 30 },
    scale: config.scale ?? { min: 0.6, max: 1.4 },
    count: config.count ?? 25,
  }

  const points = scatter(cx, cy, width, height, mergedConfig)
  const baseSize = Math.min(width, height) * 0.08
  const rng = createSeededRandom((config.seed ?? 12345) + 1000)

  const confettiTypes: ConfettiType[] = ['rectangle', 'circle', 'streamer']

  return points.map((point, i) => {
    const confettiType = rng.pick(confettiTypes)
    const confettiSize = baseSize * point.scale

    let basePath: PathCommand[]
    switch (confettiType) {
      case 'circle':
        basePath = generateCirclePath(confettiSize)
        break
      case 'streamer':
        basePath = generateStreamerPath(confettiSize)
        break
      case 'rectangle':
      default:
        basePath = generateRectanglePath(confettiSize)
    }

    const transformedCommands = transformConfettiCommands(basePath, point)
    const color = colors[point.colorIndex % colors.length]

    return {
      id: `confetti-${i}`,
      name: `Confetti ${i + 1}`,
      commands: transformedCommands,
      fill: color,
      stroke: 'none',
      strokeWidth: 0,
      zIndex: i,
      x: point.x,
      y: point.y,
      rotation: point.rotation,
      scale: point.scale,
    }
  })
}
