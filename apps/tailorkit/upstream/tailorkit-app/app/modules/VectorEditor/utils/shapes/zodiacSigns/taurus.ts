/**
 * Taurus (Bull) Shape Generator - Earth Sign
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { generateCircle, getElementColors } from './helpers'

const _generateTaurusCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const colors = getElementColors('taurus')
  const scale = Math.min(width, height) * 0.4

  // Bull head circle
  parts.push({
    commands: generateCircle(cx, cy + scale * 0.1, scale * 0.35),
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  // Left horn
  const leftHornCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.3, y: cy - scale * 0.15 },
    {
      type: 'C',
      x: cx - scale * 0.5,
      y: cy - scale * 0.5,
      cp1: { x: cx - scale * 0.5, y: cy - scale * 0.2 },
      cp2: { x: cx - scale * 0.55, y: cy - scale * 0.4 },
    },
  ]

  // Right horn
  const rightHornCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.3, y: cy - scale * 0.15 },
    {
      type: 'C',
      x: cx + scale * 0.5,
      y: cy - scale * 0.5,
      cp1: { x: cx + scale * 0.5, y: cy - scale * 0.2 },
      cp2: { x: cx + scale * 0.55, y: cy - scale * 0.4 },
    },
  ]

  parts.push({
    commands: leftHornCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  parts.push({
    commands: rightHornCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  return parts
}

export const generateTaurusCartoon = wrapFantasyGenerator(_generateTaurusCartoon, 'taurus')
