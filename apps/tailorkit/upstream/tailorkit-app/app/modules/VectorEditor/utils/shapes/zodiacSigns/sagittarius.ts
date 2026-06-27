/**
 * Sagittarius (Archer) Shape Generator - Fire Sign
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { getElementColors } from './helpers'

const _generateSagittariusCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const colors = getElementColors('sagittarius')
  const scale = Math.min(width, height) * 0.4

  // Arrow shaft (diagonal)
  const shaftCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.4, y: cy + scale * 0.4 },
    { type: 'L', x: cx + scale * 0.4, y: cy - scale * 0.4 },
  ]

  // Arrow head
  const arrowHeadCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.4, y: cy - scale * 0.4 },
    { type: 'L', x: cx + scale * 0.15, y: cy - scale * 0.35 },
    { type: 'M', x: cx + scale * 0.4, y: cy - scale * 0.4 },
    { type: 'L', x: cx + scale * 0.35, y: cy - scale * 0.15 },
  ]

  // Cross line
  const crossCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.1, y: cy - scale * 0.3 },
    { type: 'L', x: cx + scale * 0.3, y: cy + scale * 0.1 },
  ]

  parts.push({
    commands: shaftCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  parts.push({
    commands: arrowHeadCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  parts.push({
    commands: crossCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.08,
    zIndex: 10,
  })

  return parts
}

export const generateSagittariusCartoon = wrapFantasyGenerator(_generateSagittariusCartoon, 'sagittarius')
