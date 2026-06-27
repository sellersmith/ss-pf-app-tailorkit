/**
 * Love Letter Shape Generator
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { createHeartPath, VALENTINE_COLORS } from './colors'

/**
 * Generate love letter shape
 */
export function generateLoveLetter(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = VALENTINE_COLORS.loveLetter
  const w = width
  const h = height

  // Envelope body
  const envelope: PathCommand[] = [
    { type: 'M', x: cx - w * 0.45, y: cy - h * 0.3 },
    { type: 'L', x: cx + w * 0.45, y: cy - h * 0.3 },
    { type: 'L', x: cx + w * 0.45, y: cy + h * 0.35 },
    { type: 'L', x: cx - w * 0.45, y: cy + h * 0.35 },
    { type: 'Z', x: cx - w * 0.45, y: cy - h * 0.3 },
  ]

  // Envelope flap (triangular)
  const flap: PathCommand[] = [
    { type: 'M', x: cx - w * 0.45, y: cy - h * 0.3 },
    { type: 'L', x: cx, y: cy + h * 0.1 },
    { type: 'L', x: cx + w * 0.45, y: cy - h * 0.3 },
    { type: 'Z', x: cx - w * 0.45, y: cy - h * 0.3 },
  ]

  // Small heart seal - using the helper function for proper heart shape
  const heartSealCy = cy - h * 0.05
  const heartSealWidth = w * 0.18
  const heartSealHeight = h * 0.15
  const heart: PathCommand[] = createHeartPath(cx, heartSealCy, heartSealWidth, heartSealHeight)

  return [
    {
      id: 'letter-envelope',
      name: 'Envelope',
      commands: envelope,
      fill: colors.envelope,
      stroke: colors.envelopeStroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'letter-flap',
      name: 'Flap',
      commands: flap,
      fill: colors.flap,
      stroke: colors.envelopeStroke,
      strokeWidth: 0.5,
      zIndex: 1,
    },
    {
      id: 'letter-heart',
      name: 'Heart Seal',
      commands: heart,
      fill: colors.heart,
      stroke: colors.heartStroke,
      strokeWidth: 0.5,
      zIndex: 2,
    },
  ]
}
