/**
 * Cancer (Crab) Shape Generator - Water Sign
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { getElementColors } from './helpers'

const _generateCancerCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const colors = getElementColors('cancer')
  const scale = Math.min(width, height) * 0.4

  // Cancer symbol - two 6-like spirals
  const leftSpiralCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.1, y: cy - scale * 0.1 },
    {
      type: 'C',
      x: cx - scale * 0.4,
      y: cy - scale * 0.3,
      cp1: { x: cx - scale * 0.3, y: cy - scale * 0.1 },
      cp2: { x: cx - scale * 0.45, y: cy - scale * 0.15 },
    },
    {
      type: 'C',
      x: cx - scale * 0.25,
      y: cy - scale * 0.45,
      cp1: { x: cx - scale * 0.35, y: cy - scale * 0.45 },
      cp2: { x: cx - scale * 0.3, y: cy - scale * 0.5 },
    },
    {
      type: 'C',
      x: cx - scale * 0.15,
      y: cy - scale * 0.25,
      cp1: { x: cx - scale * 0.2, y: cy - scale * 0.4 },
      cp2: { x: cx - scale * 0.15, y: cy - scale * 0.35 },
    },
  ]

  const rightSpiralCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.1, y: cy + scale * 0.1 },
    {
      type: 'C',
      x: cx + scale * 0.4,
      y: cy + scale * 0.3,
      cp1: { x: cx + scale * 0.3, y: cy + scale * 0.1 },
      cp2: { x: cx + scale * 0.45, y: cy + scale * 0.15 },
    },
    {
      type: 'C',
      x: cx + scale * 0.25,
      y: cy + scale * 0.45,
      cp1: { x: cx + scale * 0.35, y: cy + scale * 0.45 },
      cp2: { x: cx + scale * 0.3, y: cy + scale * 0.5 },
    },
    {
      type: 'C',
      x: cx + scale * 0.15,
      y: cy + scale * 0.25,
      cp1: { x: cx + scale * 0.2, y: cy + scale * 0.4 },
      cp2: { x: cx + scale * 0.15, y: cy + scale * 0.35 },
    },
  ]

  // Connecting line
  const connectingCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.1, y: cy - scale * 0.1 },
    {
      type: 'C',
      x: cx + scale * 0.1,
      y: cy + scale * 0.1,
      cp1: { x: cx + scale * 0.05, y: cy - scale * 0.05 },
      cp2: { x: cx - scale * 0.05, y: cy + scale * 0.05 },
    },
  ]

  parts.push({
    commands: leftSpiralCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  parts.push({
    commands: rightSpiralCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  parts.push({
    commands: connectingCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.08,
    zIndex: 5,
  })

  return parts
}

export const generateCancerCartoon = wrapFantasyGenerator(_generateCancerCartoon, 'cancer')
