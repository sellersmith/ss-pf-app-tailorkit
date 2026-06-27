/**
 * Pig Shape Generator (Year 12: 2031, 2019, 2007...)
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle, generateEar } from './helpers'

const _generatePigCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Face (round)
  parts.push({
    commands: generateCircle(cx, cy, scale * 0.38),
    fill: colors.nose, // Pink
    stroke: colors.outline,
    strokeWidth: scale * 0.05,
    zIndex: 10,
  })

  // Ears
  parts.push({
    commands: generateEar(cx - scale * 0.3, cy - scale * 0.35, scale * 0.2, scale * 0.25, -20),
    fill: colors.nose,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  parts.push({
    commands: generateEar(cx + scale * 0.3, cy - scale * 0.35, scale * 0.2, scale * 0.25, 20),
    fill: colors.nose,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  // Snout (oval)
  const snoutCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.2, y: cy + scale * 0.05 },
    {
      type: 'C',
      x: cx + scale * 0.2,
      y: cy + scale * 0.05,
      cp1: { x: cx - scale * 0.2, y: cy + scale * 0.3 },
      cp2: { x: cx + scale * 0.2, y: cy + scale * 0.3 },
    },
    {
      type: 'C',
      x: cx - scale * 0.2,
      y: cy + scale * 0.05,
      cp1: { x: cx + scale * 0.2, y: cy - scale * 0.05 },
      cp2: { x: cx - scale * 0.2, y: cy - scale * 0.05 },
    },
    { type: 'Z', x: cx - scale * 0.2, y: cy + scale * 0.05 },
  ]

  parts.push({
    commands: snoutCommands,
    fill: '#FFB6C1', // Lighter pink
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 12,
  })

  // Nostrils
  parts.push({
    commands: generateCircle(cx - scale * 0.07, cy + scale * 0.12, scale * 0.04),
    fill: colors.outline,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.07, cy + scale * 0.12, scale * 0.04),
    fill: colors.outline,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  // Eyes
  parts.push({
    commands: generateCircle(cx - scale * 0.12, cy - scale * 0.1, scale * 0.06),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.12, cy - scale * 0.1, scale * 0.06),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  return parts
}

export const generatePigCartoon = wrapFantasyGenerator(_generatePigCartoon, 'pig')
