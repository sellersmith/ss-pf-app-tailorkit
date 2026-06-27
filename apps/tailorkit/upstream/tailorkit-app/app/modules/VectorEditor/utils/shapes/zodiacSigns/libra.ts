/**
 * Libra (Scales) Shape Generator - Air Sign
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { getElementColors } from './helpers'

const _generateLibraCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const colors = getElementColors('libra')
  const scale = Math.min(width, height) * 0.4

  // Horizontal line (balance beam)
  const beamCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.5, y: cy - scale * 0.1 },
    { type: 'L', x: cx + scale * 0.5, y: cy - scale * 0.1 },
  ]

  // Semicircle below
  const semicircleCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.4, y: cy + scale * 0.15 },
    {
      type: 'C',
      x: cx + scale * 0.4,
      y: cy + scale * 0.15,
      cp1: { x: cx - scale * 0.4, y: cy + scale * 0.5 },
      cp2: { x: cx + scale * 0.4, y: cy + scale * 0.5 },
    },
  ]

  // Base line
  const baseCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.5, y: cy + scale * 0.15 },
    { type: 'L', x: cx + scale * 0.5, y: cy + scale * 0.15 },
  ]

  parts.push({
    commands: beamCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  parts.push({
    commands: semicircleCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  parts.push({
    commands: baseCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  return parts
}

export const generateLibraCartoon = wrapFantasyGenerator(_generateLibraCartoon, 'libra')
