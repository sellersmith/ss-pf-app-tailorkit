/**
 * Rat Shape Generator (Year 1: 2020, 2008, 1996...)
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateRatCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Face (rounded triangle shape)
  const faceCommands: PathCommand[] = [
    { type: 'M', x: cx, y: cy - scale * 0.3 },
    {
      type: 'C',
      x: cx + scale * 0.35,
      y: cy + scale * 0.2,
      cp1: { x: cx + scale * 0.4, y: cy - scale * 0.2 },
      cp2: { x: cx + scale * 0.4, y: cy + scale * 0.1 },
    },
    {
      type: 'C',
      x: cx - scale * 0.35,
      y: cy + scale * 0.2,
      cp1: { x: cx + scale * 0.15, y: cy + scale * 0.4 },
      cp2: { x: cx - scale * 0.15, y: cy + scale * 0.4 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - scale * 0.3,
      cp1: { x: cx - scale * 0.4, y: cy + scale * 0.1 },
      cp2: { x: cx - scale * 0.4, y: cy - scale * 0.2 },
    },
    { type: 'Z', x: cx, y: cy - scale * 0.3 },
  ]

  parts.push({
    commands: faceCommands,
    fill: colors.body.light,
    stroke: colors.outline,
    strokeWidth: scale * 0.05,
    zIndex: 10,
  })

  // Round ears
  parts.push({
    commands: generateCircle(cx - scale * 0.3, cy - scale * 0.35, scale * 0.18),
    fill: colors.body.light,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.3, cy - scale * 0.35, scale * 0.18),
    fill: colors.body.light,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  // Inner ears (pink)
  parts.push({
    commands: generateCircle(cx - scale * 0.3, cy - scale * 0.35, scale * 0.1),
    fill: colors.accents.red,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 6,
    opacity: 0.3,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.3, cy - scale * 0.35, scale * 0.1),
    fill: colors.accents.red,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 6,
    opacity: 0.3,
  })

  // Eyes
  parts.push({
    commands: generateCircle(cx - scale * 0.12, cy - scale * 0.05, scale * 0.06),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.12, cy - scale * 0.05, scale * 0.06),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  // Nose
  parts.push({
    commands: generateCircle(cx, cy + scale * 0.15, scale * 0.06),
    fill: colors.nose,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  return parts
}

export const generateRatCartoon = wrapFantasyGenerator(_generateRatCartoon, 'rat')
