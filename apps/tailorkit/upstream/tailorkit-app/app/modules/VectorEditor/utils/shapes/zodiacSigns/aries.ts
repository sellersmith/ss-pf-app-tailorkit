/**
 * Aries (Ram) Shape Generator - Fire Sign
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { getElementColors } from './helpers'

const _generateAriesCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const colors = getElementColors('aries')
  const scale = Math.min(width, height) * 0.4

  // Ram horns symbol - two curved horns
  const leftHornCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.1, y: cy + scale * 0.4 },
    {
      type: 'C',
      x: cx - scale * 0.5,
      y: cy - scale * 0.2,
      cp1: { x: cx - scale * 0.1, y: cy },
      cp2: { x: cx - scale * 0.4, y: cy - scale * 0.3 },
    },
    {
      type: 'C',
      x: cx - scale * 0.3,
      y: cy - scale * 0.5,
      cp1: { x: cx - scale * 0.6, y: cy - scale * 0.1 },
      cp2: { x: cx - scale * 0.5, y: cy - scale * 0.4 },
    },
  ]

  const rightHornCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.1, y: cy + scale * 0.4 },
    {
      type: 'C',
      x: cx + scale * 0.5,
      y: cy - scale * 0.2,
      cp1: { x: cx + scale * 0.1, y: cy },
      cp2: { x: cx + scale * 0.4, y: cy - scale * 0.3 },
    },
    {
      type: 'C',
      x: cx + scale * 0.3,
      y: cy - scale * 0.5,
      cp1: { x: cx + scale * 0.6, y: cy - scale * 0.1 },
      cp2: { x: cx + scale * 0.5, y: cy - scale * 0.4 },
    },
  ]

  parts.push({
    commands: leftHornCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.12,
    zIndex: 10,
  })

  parts.push({
    commands: rightHornCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.12,
    zIndex: 10,
  })

  // Center connecting line
  const centerCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.1, y: cy + scale * 0.4 },
    { type: 'L', x: cx, y: cy + scale * 0.5 },
    { type: 'L', x: cx + scale * 0.1, y: cy + scale * 0.4 },
  ]

  parts.push({
    commands: centerCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  return parts
}

export const generateAriesCartoon = wrapFantasyGenerator(_generateAriesCartoon, 'aries')
