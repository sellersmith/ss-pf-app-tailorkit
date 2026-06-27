/**
 * Aquarius (Water Bearer) Shape Generator - Air Sign
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { getElementColors } from './helpers'

const _generateAquariusCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const colors = getElementColors('aquarius')
  const scale = Math.min(width, height) * 0.4

  // Aquarius symbol - two wavy lines
  const wave1Commands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.45, y: cy - scale * 0.15 },
    {
      type: 'C',
      x: cx - scale * 0.15,
      y: cy - scale * 0.15,
      cp1: { x: cx - scale * 0.35, y: cy - scale * 0.35 },
      cp2: { x: cx - scale * 0.25, y: cy + scale * 0.05 },
    },
    {
      type: 'C',
      x: cx + scale * 0.15,
      y: cy - scale * 0.15,
      cp1: { x: cx - scale * 0.05, y: cy - scale * 0.35 },
      cp2: { x: cx + scale * 0.05, y: cy + scale * 0.05 },
    },
    {
      type: 'C',
      x: cx + scale * 0.45,
      y: cy - scale * 0.15,
      cp1: { x: cx + scale * 0.25, y: cy - scale * 0.35 },
      cp2: { x: cx + scale * 0.35, y: cy + scale * 0.05 },
    },
  ]

  const wave2Commands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.45, y: cy + scale * 0.15 },
    {
      type: 'C',
      x: cx - scale * 0.15,
      y: cy + scale * 0.15,
      cp1: { x: cx - scale * 0.35, y: cy - scale * 0.05 },
      cp2: { x: cx - scale * 0.25, y: cy + scale * 0.35 },
    },
    {
      type: 'C',
      x: cx + scale * 0.15,
      y: cy + scale * 0.15,
      cp1: { x: cx - scale * 0.05, y: cy - scale * 0.05 },
      cp2: { x: cx + scale * 0.05, y: cy + scale * 0.35 },
    },
    {
      type: 'C',
      x: cx + scale * 0.45,
      y: cy + scale * 0.15,
      cp1: { x: cx + scale * 0.25, y: cy - scale * 0.05 },
      cp2: { x: cx + scale * 0.35, y: cy + scale * 0.35 },
    },
  ]

  parts.push({
    commands: wave1Commands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  parts.push({
    commands: wave2Commands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  return parts
}

export const generateAquariusCartoon = wrapFantasyGenerator(_generateAquariusCartoon, 'aquarius')
