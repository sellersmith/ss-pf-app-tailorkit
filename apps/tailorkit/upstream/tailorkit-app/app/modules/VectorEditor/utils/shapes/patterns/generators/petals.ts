/**
 * Flower Petals Pattern Generator
 * Creates scattered flower petals
 */

import type { PathCommand } from '../../../svg'
import type { PatternConfig, PatternElement } from '../types'
import { PATTERN_COLORS } from '../types'
import { scatter, transformPoint } from '../utils/scatter'

/**
 * Generate a single petal shape centered at origin
 */
function generatePetalPath(size: number): PathCommand[] {
  const w = size * 0.4
  const h = size

  return [
    { type: 'M', x: 0, y: -h / 2 },
    {
      type: 'C',
      x: w,
      y: 0,
      cp1: { x: w * 0.8, y: -h * 0.4 },
      cp2: { x: w, y: -h * 0.2 },
    },
    {
      type: 'C',
      x: 0,
      y: h / 2,
      cp1: { x: w, y: h * 0.2 },
      cp2: { x: w * 0.5, y: h * 0.4 },
    },
    {
      type: 'C',
      x: -w,
      y: 0,
      cp1: { x: -w * 0.5, y: h * 0.4 },
      cp2: { x: -w, y: h * 0.2 },
    },
    {
      type: 'C',
      x: 0,
      y: -h / 2,
      cp1: { x: -w, y: -h * 0.2 },
      cp2: { x: -w * 0.8, y: -h * 0.4 },
    },
    { type: 'Z', x: 0, y: -h / 2 },
  ]
}

/**
 * Transform petal path commands based on scatter point
 */
function transformPetalCommands(
  commands: PathCommand[],
  point: ReturnType<typeof scatter>[0],
  petalSize: number
): PathCommand[] {
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
 * Generate scattered flower petals pattern
 */
export function generatePatternPetals(
  cx: number,
  cy: number,
  width: number,
  height: number,
  config: PatternConfig = {}
): PatternElement[] {
  const colors = config.colors ?? PATTERN_COLORS.petals.pink
  const mergedConfig: PatternConfig = {
    ...config,
    colors,
    rotation: config.rotation ?? { min: 0, max: 360 },
    scale: config.scale ?? { min: 0.6, max: 1.2 },
    count: config.count ?? 15,
  }

  const points = scatter(cx, cy, width, height, mergedConfig)
  const baseSize = Math.min(width, height) * 0.15

  return points.map((point, i) => {
    const petalSize = baseSize * point.scale
    const basePath = generatePetalPath(petalSize)
    const transformedCommands = transformPetalCommands(basePath, point, petalSize)
    const color = colors[point.colorIndex % colors.length]

    return {
      id: `petal-${i}`,
      name: `Petal ${i + 1}`,
      commands: transformedCommands,
      fill: color,
      stroke: adjustColor(color, -20),
      strokeWidth: 0.5,
      zIndex: i,
      x: point.x,
      y: point.y,
      rotation: point.rotation,
      scale: point.scale,
    }
  })
}

/**
 * Adjust color brightness
 */
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount))
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
