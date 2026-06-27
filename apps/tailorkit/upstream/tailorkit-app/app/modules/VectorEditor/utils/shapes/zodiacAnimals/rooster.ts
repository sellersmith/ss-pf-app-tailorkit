/**
 * Rooster Shape Generator (Year 10: 2029, 2017, 2005...)
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateRoosterCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Comb (red crown)
  const combCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.15, y: cy - scale * 0.25 },
    {
      type: 'C',
      x: cx - scale * 0.1,
      y: cy - scale * 0.5,
      cp1: { x: cx - scale * 0.2, y: cy - scale * 0.35 },
      cp2: { x: cx - scale * 0.15, y: cy - scale * 0.45 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - scale * 0.35,
      cp1: { x: cx - scale * 0.05, y: cy - scale * 0.5 },
      cp2: { x: cx - scale * 0.02, y: cy - scale * 0.4 },
    },
    {
      type: 'C',
      x: cx + scale * 0.1,
      y: cy - scale * 0.55,
      cp1: { x: cx + scale * 0.02, y: cy - scale * 0.4 },
      cp2: { x: cx + scale * 0.05, y: cy - scale * 0.5 },
    },
    {
      type: 'C',
      x: cx + scale * 0.15,
      y: cy - scale * 0.25,
      cp1: { x: cx + scale * 0.15, y: cy - scale * 0.5 },
      cp2: { x: cx + scale * 0.2, y: cy - scale * 0.35 },
    },
  ]

  parts.push({
    commands: combCommands,
    fill: colors.accents.red,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  // Head
  parts.push({
    commands: generateCircle(cx, cy, scale * 0.3),
    fill: colors.accents.white,
    stroke: colors.outline,
    strokeWidth: scale * 0.05,
    zIndex: 10,
  })

  // Wattle (red hanging thing)
  const wattleCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.05, y: cy + scale * 0.25 },
    {
      type: 'C',
      x: cx,
      y: cy + scale * 0.45,
      cp1: { x: cx - scale * 0.1, y: cy + scale * 0.35 },
      cp2: { x: cx - scale * 0.05, y: cy + scale * 0.45 },
    },
    {
      type: 'C',
      x: cx + scale * 0.05,
      y: cy + scale * 0.25,
      cp1: { x: cx + scale * 0.05, y: cy + scale * 0.45 },
      cp2: { x: cx + scale * 0.1, y: cy + scale * 0.35 },
    },
    { type: 'Z', x: cx - scale * 0.05, y: cy + scale * 0.25 },
  ]

  parts.push({
    commands: wattleCommands,
    fill: colors.accents.red,
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 12,
  })

  // Beak
  const beakCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.25, y: cy - scale * 0.05 },
    { type: 'L', x: cx + scale * 0.45, y: cy + scale * 0.05 },
    { type: 'L', x: cx + scale * 0.25, y: cy + scale * 0.1 },
    { type: 'Z', x: cx + scale * 0.25, y: cy - scale * 0.05 },
  ]

  parts.push({
    commands: beakCommands,
    fill: colors.accents.gold,
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 15,
  })

  // Eye
  parts.push({
    commands: generateCircle(cx + scale * 0.08, cy - scale * 0.05, scale * 0.06),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  return parts
}

export const generateRoosterCartoon = wrapFantasyGenerator(_generateRoosterCartoon, 'rooster')
