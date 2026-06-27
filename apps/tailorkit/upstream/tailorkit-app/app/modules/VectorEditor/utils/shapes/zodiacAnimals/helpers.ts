/**
 * Shared helper functions for zodiac animal shape generators
 */

import type { PathCommand } from '../../svg'
import { ZODIAC_ANIMAL_COLORS } from '../fantasy/types'

export const colors = ZODIAC_ANIMAL_COLORS

/**
 * Generate a circle path using bezier curves
 */
export function generateCircle(cx: number, cy: number, r: number): PathCommand[] {
  const kappa = 0.5522847498
  const o = r * kappa

  return [
    { type: 'M', x: cx - r, y: cy },
    { type: 'C', x: cx, y: cy - r, cp1: { x: cx - r, y: cy - o }, cp2: { x: cx - o, y: cy - r } },
    { type: 'C', x: cx + r, y: cy, cp1: { x: cx + o, y: cy - r }, cp2: { x: cx + r, y: cy - o } },
    { type: 'C', x: cx, y: cy + r, cp1: { x: cx + r, y: cy + o }, cp2: { x: cx + o, y: cy + r } },
    { type: 'C', x: cx - r, y: cy, cp1: { x: cx - o, y: cy + r }, cp2: { x: cx - r, y: cy + o } },
    { type: 'Z', x: cx - r, y: cy },
  ]
}

/**
 * Generate rounded ear shape
 */
export function generateEar(cx: number, cy: number, width: number, height: number, angle: number = 0): PathCommand[] {
  const rad = (angle * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  // Transform point by rotation
  const transform = (x: number, y: number) => ({
    x: cx + x * cos - y * sin,
    y: cy + x * sin + y * cos,
  })

  const bottom = transform(0, height * 0.5)
  const top = transform(0, -height * 0.5)
  const left = transform(-width * 0.5, 0)
  const right = transform(width * 0.5, 0)

  return [
    { type: 'M', x: bottom.x, y: bottom.y },
    {
      type: 'C',
      x: top.x,
      y: top.y,
      cp1: { x: left.x, y: left.y },
      cp2: { x: left.x, y: top.y },
    },
    {
      type: 'C',
      x: bottom.x,
      y: bottom.y,
      cp1: { x: right.x, y: top.y },
      cp2: { x: right.x, y: right.y },
    },
    { type: 'Z', x: bottom.x, y: bottom.y },
  ]
}
