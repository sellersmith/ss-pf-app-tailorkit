/**
 * Monkey Shape Generator (Year 9: 2028, 2016, 2004...)
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateMonkeyCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Face
  parts.push({
    commands: generateCircle(cx, cy, scale * 0.38),
    fill: colors.body.medium,
    stroke: colors.outline,
    strokeWidth: scale * 0.05,
    zIndex: 10,
  })

  // Ears (big round)
  parts.push({
    commands: generateCircle(cx - scale * 0.4, cy - scale * 0.05, scale * 0.15),
    fill: colors.body.medium,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.4, cy - scale * 0.05, scale * 0.15),
    fill: colors.body.medium,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  // Inner ears (lighter)
  parts.push({
    commands: generateCircle(cx - scale * 0.4, cy - scale * 0.05, scale * 0.08),
    fill: colors.body.light,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 6,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.4, cy - scale * 0.05, scale * 0.08),
    fill: colors.body.light,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 6,
  })

  // Face patch (lighter area around eyes and muzzle)
  const facePatchCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.25, y: cy - scale * 0.2 },
    {
      type: 'C',
      x: cx + scale * 0.25,
      y: cy - scale * 0.2,
      cp1: { x: cx - scale * 0.15, y: cy - scale * 0.35 },
      cp2: { x: cx + scale * 0.15, y: cy - scale * 0.35 },
    },
    {
      type: 'C',
      x: cx + scale * 0.2,
      y: cy + scale * 0.25,
      cp1: { x: cx + scale * 0.3, y: cy },
      cp2: { x: cx + scale * 0.25, y: cy + scale * 0.15 },
    },
    {
      type: 'C',
      x: cx - scale * 0.2,
      y: cy + scale * 0.25,
      cp1: { x: cx + scale * 0.1, y: cy + scale * 0.35 },
      cp2: { x: cx - scale * 0.1, y: cy + scale * 0.35 },
    },
    {
      type: 'C',
      x: cx - scale * 0.25,
      y: cy - scale * 0.2,
      cp1: { x: cx - scale * 0.25, y: cy + scale * 0.15 },
      cp2: { x: cx - scale * 0.3, y: cy },
    },
    { type: 'Z', x: cx - scale * 0.25, y: cy - scale * 0.2 },
  ]

  parts.push({
    commands: facePatchCommands,
    fill: colors.body.light,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 12,
  })

  // Eyes
  parts.push({
    commands: generateCircle(cx - scale * 0.12, cy - scale * 0.05, scale * 0.06),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.12, cy - scale * 0.05, scale * 0.06),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  // Nose/muzzle
  parts.push({
    commands: generateCircle(cx, cy + scale * 0.15, scale * 0.1),
    fill: colors.body.light,
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 14,
  })

  return parts
}

export const generateMonkeyCartoon = wrapFantasyGenerator(_generateMonkeyCartoon, 'monkey')
