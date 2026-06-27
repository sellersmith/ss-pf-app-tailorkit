/**
 * Pisces (Fish) Shape Generator - Water Sign
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { getElementColors } from './helpers'

const _generatePiscesCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const colors = getElementColors('pisces')
  const scale = Math.min(width, height) * 0.4

  // Pisces symbol - two curved fish shapes with connecting line
  const leftFishCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.1, y: cy - scale * 0.4 },
    {
      type: 'C',
      x: cx - scale * 0.4,
      y: cy,
      cp1: { x: cx - scale * 0.35, y: cy - scale * 0.4 },
      cp2: { x: cx - scale * 0.45, y: cy - scale * 0.2 },
    },
    {
      type: 'C',
      x: cx - scale * 0.1,
      y: cy + scale * 0.4,
      cp1: { x: cx - scale * 0.45, y: cy + scale * 0.2 },
      cp2: { x: cx - scale * 0.35, y: cy + scale * 0.4 },
    },
  ]

  const rightFishCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.1, y: cy - scale * 0.4 },
    {
      type: 'C',
      x: cx + scale * 0.4,
      y: cy,
      cp1: { x: cx + scale * 0.35, y: cy - scale * 0.4 },
      cp2: { x: cx + scale * 0.45, y: cy - scale * 0.2 },
    },
    {
      type: 'C',
      x: cx + scale * 0.1,
      y: cy + scale * 0.4,
      cp1: { x: cx + scale * 0.45, y: cy + scale * 0.2 },
      cp2: { x: cx + scale * 0.35, y: cy + scale * 0.4 },
    },
  ]

  // Connecting horizontal line
  const connectCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.15, y: cy },
    { type: 'L', x: cx + scale * 0.15, y: cy },
  ]

  parts.push({
    commands: leftFishCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  parts.push({
    commands: rightFishCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  parts.push({
    commands: connectCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.08,
    zIndex: 5,
  })

  return parts
}

export const generatePiscesCartoon = wrapFantasyGenerator(_generatePiscesCartoon, 'pisces')
