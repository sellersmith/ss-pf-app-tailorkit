/**
 * Scorpio (Scorpion) Shape Generator - Water Sign
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { getElementColors } from './helpers'

const _generateScorpioCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const colors = getElementColors('scorpio')
  const scale = Math.min(width, height) * 0.4

  // Scorpio symbol - M with arrow tail
  const mCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.4, y: cy + scale * 0.3 },
    { type: 'L', x: cx - scale * 0.4, y: cy - scale * 0.3 },
    {
      type: 'C',
      x: cx - scale * 0.15,
      y: cy - scale * 0.3,
      cp1: { x: cx - scale * 0.4, y: cy - scale * 0.5 },
      cp2: { x: cx - scale * 0.15, y: cy - scale * 0.5 },
    },
    { type: 'L', x: cx - scale * 0.15, y: cy + scale * 0.3 },
    { type: 'M', x: cx - scale * 0.15, y: cy - scale * 0.3 },
    {
      type: 'C',
      x: cx + scale * 0.1,
      y: cy - scale * 0.3,
      cp1: { x: cx - scale * 0.15, y: cy - scale * 0.5 },
      cp2: { x: cx + scale * 0.1, y: cy - scale * 0.5 },
    },
    { type: 'L', x: cx + scale * 0.1, y: cy + scale * 0.2 },
  ]

  // Arrow tail
  const arrowCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.1, y: cy + scale * 0.2 },
    {
      type: 'C',
      x: cx + scale * 0.4,
      y: cy + scale * 0.35,
      cp1: { x: cx + scale * 0.25, y: cy + scale * 0.25 },
      cp2: { x: cx + scale * 0.35, y: cy + scale * 0.3 },
    },
    { type: 'L', x: cx + scale * 0.5, y: cy + scale * 0.2 },
    { type: 'M', x: cx + scale * 0.4, y: cy + scale * 0.35 },
    { type: 'L', x: cx + scale * 0.5, y: cy + scale * 0.45 },
  ]

  parts.push({
    commands: mCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  parts.push({
    commands: arrowCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  return parts
}

export const generateScorpioCartoon = wrapFantasyGenerator(_generateScorpioCartoon, 'scorpio')
