/**
 * Snake Shape Generator (Year 6: 2025, 2013, 2001...)
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateSnakeCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Snake head (diamond/triangular)
  const headCommands: PathCommand[] = [
    { type: 'M', x: cx, y: cy - scale * 0.35 },
    {
      type: 'C',
      x: cx + scale * 0.3,
      y: cy,
      cp1: { x: cx + scale * 0.25, y: cy - scale * 0.3 },
      cp2: { x: cx + scale * 0.35, y: cy - scale * 0.15 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + scale * 0.35,
      cp1: { x: cx + scale * 0.25, y: cy + scale * 0.15 },
      cp2: { x: cx + scale * 0.1, y: cy + scale * 0.3 },
    },
    {
      type: 'C',
      x: cx - scale * 0.3,
      y: cy,
      cp1: { x: cx - scale * 0.1, y: cy + scale * 0.3 },
      cp2: { x: cx - scale * 0.25, y: cy + scale * 0.15 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - scale * 0.35,
      cp1: { x: cx - scale * 0.35, y: cy - scale * 0.15 },
      cp2: { x: cx - scale * 0.25, y: cy - scale * 0.3 },
    },
    { type: 'Z', x: cx, y: cy - scale * 0.35 },
  ]

  parts.push({
    commands: headCommands,
    fill: '#228B22', // Forest green
    stroke: colors.outline,
    strokeWidth: scale * 0.05,
    zIndex: 10,
  })

  // Snake pattern (diamond on forehead)
  const patternCommands: PathCommand[] = [
    { type: 'M', x: cx, y: cy - scale * 0.25 },
    { type: 'L', x: cx + scale * 0.1, y: cy - scale * 0.1 },
    { type: 'L', x: cx, y: cy + scale * 0.05 },
    { type: 'L', x: cx - scale * 0.1, y: cy - scale * 0.1 },
    { type: 'Z', x: cx, y: cy - scale * 0.25 },
  ]

  parts.push({
    commands: patternCommands,
    fill: '#32CD32', // Lighter green
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 12,
  })

  // Snake eyes (slitted)
  parts.push({
    commands: generateCircle(cx - scale * 0.12, cy - scale * 0.05, scale * 0.06),
    fill: colors.accents.gold,
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 15,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.12, cy - scale * 0.05, scale * 0.06),
    fill: colors.accents.gold,
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 15,
  })

  // Tongue (forked)
  const tongueCommands: PathCommand[] = [
    { type: 'M', x: cx, y: cy + scale * 0.3 },
    { type: 'L', x: cx, y: cy + scale * 0.5 },
    { type: 'L', x: cx - scale * 0.05, y: cy + scale * 0.55 },
    { type: 'M', x: cx, y: cy + scale * 0.5 },
    { type: 'L', x: cx + scale * 0.05, y: cy + scale * 0.55 },
  ]

  parts.push({
    commands: tongueCommands,
    fill: 'none',
    stroke: colors.accents.red,
    strokeWidth: scale * 0.04,
    zIndex: 20,
  })

  return parts
}

export const generateSnakeCartoon = wrapFantasyGenerator(_generateSnakeCartoon, 'snake')
