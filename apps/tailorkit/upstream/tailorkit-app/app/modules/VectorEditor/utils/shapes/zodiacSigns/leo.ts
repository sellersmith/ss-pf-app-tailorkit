/**
 * Leo (Lion) Shape Generator - Fire Sign
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { generateCircle, getElementColors } from './helpers'

const _generateLeoCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const colors = getElementColors('leo')
  const scale = Math.min(width, height) * 0.4

  // Leo symbol - curved line with circle and tail
  const mainCurveCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.3, y: cy - scale * 0.4 },
    {
      type: 'C',
      x: cx - scale * 0.4,
      y: cy,
      cp1: { x: cx - scale * 0.5, y: cy - scale * 0.3 },
      cp2: { x: cx - scale * 0.5, y: cy - scale * 0.1 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + scale * 0.2,
      cp1: { x: cx - scale * 0.3, y: cy + scale * 0.15 },
      cp2: { x: cx - scale * 0.1, y: cy + scale * 0.25 },
    },
    {
      type: 'C',
      x: cx + scale * 0.3,
      y: cy - scale * 0.1,
      cp1: { x: cx + scale * 0.15, y: cy + scale * 0.15 },
      cp2: { x: cx + scale * 0.3, y: cy + scale * 0.1 },
    },
    {
      type: 'C',
      x: cx + scale * 0.4,
      y: cy + scale * 0.4,
      cp1: { x: cx + scale * 0.3, y: cy + scale * 0.15 },
      cp2: { x: cx + scale * 0.35, y: cy + scale * 0.3 },
    },
  ]

  // Small circle at the end
  parts.push({
    commands: generateCircle(cx + scale * 0.4, cy + scale * 0.4, scale * 0.12),
    fill: colors.accent,
    stroke: colors.primary,
    strokeWidth: scale * 0.08,
    zIndex: 15,
  })

  parts.push({
    commands: mainCurveCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  return parts
}

export const generateLeoCartoon = wrapFantasyGenerator(_generateLeoCartoon, 'leo')
