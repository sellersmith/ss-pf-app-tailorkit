/**
 * Zodiac Signs Helper Functions
 * Shared utilities for zodiac sign generators
 */

import type { PathCommand } from '../../svg'
import { ZODIAC_SIGN_COLORS, ZODIAC_SIGN_ELEMENTS, type WesternZodiacSign } from '../fantasy/types'

/**
 * Get colors based on zodiac element
 */
export function getElementColors(sign: WesternZodiacSign) {
  const element = ZODIAC_SIGN_ELEMENTS[sign]
  return ZODIAC_SIGN_COLORS[element]
}

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
 * Generate an arc path
 */
export function generateArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
  _strokeWidth: number = 2
): PathCommand[] {
  const startRad = (startAngle * Math.PI) / 180
  const endRad = (endAngle * Math.PI) / 180

  const startX = cx + Math.cos(startRad) * r
  const startY = cy + Math.sin(startRad) * r
  const endX = cx + Math.cos(endRad) * r
  const endY = cy + Math.sin(endRad) * r

  // Control points for smooth arc
  const cp1Angle = startRad + (endRad - startRad) * 0.33
  const cp2Angle = startRad + (endRad - startRad) * 0.66

  return [
    { type: 'M', x: startX, y: startY },
    {
      type: 'C',
      x: endX,
      y: endY,
      cp1: { x: cx + Math.cos(cp1Angle) * r * 1.1, y: cy + Math.sin(cp1Angle) * r * 1.1 },
      cp2: { x: cx + Math.cos(cp2Angle) * r * 1.1, y: cy + Math.sin(cp2Angle) * r * 1.1 },
    },
  ]
}
