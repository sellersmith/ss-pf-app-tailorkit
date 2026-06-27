/**
 * Falling Leaves Pattern Generator
 * Creates scattered falling leaf shapes
 */

import type { PathCommand } from '../../../svg'
import type { PatternConfig, PatternElement } from '../types'
import { PATTERN_COLORS } from '../types'
import { scatter, transformPoint } from '../utils/scatter'

/**
 * Generate a simple leaf shape centered at origin
 */
function generateLeafPath(size: number): PathCommand[] {
  const w = size * 0.35
  const h = size

  return [
    { type: 'M', x: 0, y: -h / 2 },
    {
      type: 'C',
      x: w,
      y: 0,
      cp1: { x: w * 0.6, y: -h * 0.35 },
      cp2: { x: w, y: -h * 0.15 },
    },
    {
      type: 'C',
      x: 0,
      y: h / 2,
      cp1: { x: w, y: h * 0.15 },
      cp2: { x: w * 0.4, y: h * 0.4 },
    },
    {
      type: 'C',
      x: -w,
      y: 0,
      cp1: { x: -w * 0.4, y: h * 0.4 },
      cp2: { x: -w, y: h * 0.15 },
    },
    {
      type: 'C',
      x: 0,
      y: -h / 2,
      cp1: { x: -w, y: -h * 0.15 },
      cp2: { x: -w * 0.6, y: -h * 0.35 },
    },
    { type: 'Z', x: 0, y: -h / 2 },
  ]
}

/**
 * Generate maple-style leaf shape
 */
function generateMapleLeafPath(size: number): PathCommand[] {
  const s = size * 0.5

  return [
    { type: 'M', x: 0, y: -s },
    { type: 'L', x: s * 0.3, y: -s * 0.4 },
    { type: 'L', x: s * 0.8, y: -s * 0.5 },
    { type: 'L', x: s * 0.5, y: -s * 0.1 },
    { type: 'L', x: s * 0.9, y: s * 0.2 },
    { type: 'L', x: s * 0.4, y: s * 0.2 },
    { type: 'L', x: s * 0.3, y: s * 0.6 },
    { type: 'L', x: 0, y: s * 0.3 },
    { type: 'L', x: -s * 0.3, y: s * 0.6 },
    { type: 'L', x: -s * 0.4, y: s * 0.2 },
    { type: 'L', x: -s * 0.9, y: s * 0.2 },
    { type: 'L', x: -s * 0.5, y: -s * 0.1 },
    { type: 'L', x: -s * 0.8, y: -s * 0.5 },
    { type: 'L', x: -s * 0.3, y: -s * 0.4 },
    { type: 'Z', x: 0, y: -s },
  ]
}

/**
 * Transform leaf path commands based on scatter point
 */
function transformLeafCommands(commands: PathCommand[], point: ReturnType<typeof scatter>[0]): PathCommand[] {
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
 * Generate scattered falling leaves pattern
 */
export function generatePatternLeaves(
  cx: number,
  cy: number,
  width: number,
  height: number,
  config: PatternConfig = {}
): PatternElement[] {
  const colors = config.colors ?? PATTERN_COLORS.leaves.autumn
  const mergedConfig: PatternConfig = {
    ...config,
    colors,
    rotation: config.rotation ?? { min: -45, max: 45 },
    scale: config.scale ?? { min: 0.5, max: 1.3 },
    count: config.count ?? 12,
  }

  const points = scatter(cx, cy, width, height, mergedConfig)
  const baseSize = Math.min(width, height) * 0.12

  return points.map((point, i) => {
    // Alternate between leaf types
    const isMaple = i % 3 === 0
    const leafSize = baseSize * point.scale
    const basePath = isMaple ? generateMapleLeafPath(leafSize) : generateLeafPath(leafSize)
    const transformedCommands = transformLeafCommands(basePath, point)
    const color = colors[point.colorIndex % colors.length]

    return {
      id: `leaf-${i}`,
      name: `Leaf ${i + 1}`,
      commands: transformedCommands,
      fill: color,
      stroke: adjustColor(color, -30),
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
