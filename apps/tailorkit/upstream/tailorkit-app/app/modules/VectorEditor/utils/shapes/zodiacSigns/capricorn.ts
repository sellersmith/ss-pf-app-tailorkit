/**
 * Capricorn (Goat) Shape Generator - Earth Sign
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { getElementColors } from './helpers'

const _generateCapricornCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const colors = getElementColors('capricorn')
  const scale = Math.min(width, height) * 0.4

  // Capricorn symbol - V with a loop tail
  const vCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.3, y: cy - scale * 0.4 },
    { type: 'L', x: cx - scale * 0.1, y: cy + scale * 0.1 },
    { type: 'L', x: cx + scale * 0.1, y: cy - scale * 0.4 },
  ]

  // Loop tail
  const tailCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.1, y: cy + scale * 0.1 },
    {
      type: 'C',
      x: cx + scale * 0.15,
      y: cy + scale * 0.3,
      cp1: { x: cx - scale * 0.1, y: cy + scale * 0.3 },
      cp2: { x: cx + scale * 0.05, y: cy + scale * 0.4 },
    },
    {
      type: 'C',
      x: cx + scale * 0.4,
      y: cy + scale * 0.1,
      cp1: { x: cx + scale * 0.25, y: cy + scale * 0.2 },
      cp2: { x: cx + scale * 0.35, y: cy + scale * 0.05 },
    },
    {
      type: 'C',
      x: cx + scale * 0.25,
      y: cy + scale * 0.4,
      cp1: { x: cx + scale * 0.45, y: cy + scale * 0.15 },
      cp2: { x: cx + scale * 0.35, y: cy + scale * 0.35 },
    },
  ]

  parts.push({
    commands: vCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  parts.push({
    commands: tailCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  return parts
}

export const generateCapricornCartoon = wrapFantasyGenerator(_generateCapricornCartoon, 'capricorn')
