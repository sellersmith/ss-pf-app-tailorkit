/**
 * Pets Helper Functions
 * Shared utilities for pet shape generators
 */

import type { PathCommand } from '../../svg'
import { PET_COLORS } from '../fantasy/types'

export const colors = PET_COLORS

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
 * Generate a pointed ear shape
 */
export function generatePointedEar(
  cx: number,
  cy: number,
  width: number,
  height: number,
  angle: number = 0
): PathCommand[] {
  const rad = (angle * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  const transform = (x: number, y: number) => ({
    x: cx + x * cos - y * sin,
    y: cy + x * sin + y * cos,
  })

  const bottom = transform(0, height * 0.5)
  const top = transform(0, -height * 0.5)
  const left = transform(-width * 0.5, height * 0.3)
  const right = transform(width * 0.5, height * 0.3)

  return [
    { type: 'M', x: left.x, y: left.y },
    {
      type: 'C',
      x: top.x,
      y: top.y,
      cp1: { x: left.x, y: left.y - height * 0.3 },
      cp2: { x: top.x - width * 0.1, y: top.y + height * 0.1 },
    },
    {
      type: 'C',
      x: right.x,
      y: right.y,
      cp1: { x: top.x + width * 0.1, y: top.y + height * 0.1 },
      cp2: { x: right.x, y: right.y - height * 0.3 },
    },
    {
      type: 'C',
      x: left.x,
      y: left.y,
      cp1: { x: right.x - width * 0.2, y: bottom.y },
      cp2: { x: left.x + width * 0.2, y: bottom.y },
    },
    { type: 'Z', x: left.x, y: left.y },
  ]
}

/**
 * Generate a floppy ear shape
 */
export function generateFloppyEar(
  cx: number,
  cy: number,
  width: number,
  height: number,
  angle: number = 0
): PathCommand[] {
  const rad = (angle * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  const transform = (x: number, y: number) => ({
    x: cx + x * cos - y * sin,
    y: cy + x * sin + y * cos,
  })

  const top = transform(0, -height * 0.3)
  const bottom = transform(0, height * 0.5)

  return [
    { type: 'M', x: top.x, y: top.y },
    {
      type: 'C',
      x: bottom.x,
      y: bottom.y,
      cp1: { x: top.x + width * 0.6, y: top.y + height * 0.2 },
      cp2: { x: bottom.x + width * 0.4, y: bottom.y - height * 0.1 },
    },
    {
      type: 'C',
      x: top.x,
      y: top.y,
      cp1: { x: bottom.x - width * 0.4, y: bottom.y - height * 0.1 },
      cp2: { x: top.x - width * 0.3, y: top.y + height * 0.2 },
    },
    { type: 'Z', x: top.x, y: top.y },
  ]
}
