/**
 * Turtle Shape Generator
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateTurtleCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Shell (hexagonal-ish oval)
  const shellCommands: PathCommand[] = [
    { type: 'M', x: cx, y: cy - scale * 0.35 },
    {
      type: 'C',
      x: cx + scale * 0.4,
      y: cy,
      cp1: { x: cx + scale * 0.35, y: cy - scale * 0.35 },
      cp2: { x: cx + scale * 0.45, y: cy - scale * 0.15 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + scale * 0.35,
      cp1: { x: cx + scale * 0.45, y: cy + scale * 0.15 },
      cp2: { x: cx + scale * 0.35, y: cy + scale * 0.35 },
    },
    {
      type: 'C',
      x: cx - scale * 0.4,
      y: cy,
      cp1: { x: cx - scale * 0.35, y: cy + scale * 0.35 },
      cp2: { x: cx - scale * 0.45, y: cy + scale * 0.15 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - scale * 0.35,
      cp1: { x: cx - scale * 0.45, y: cy - scale * 0.15 },
      cp2: { x: cx - scale * 0.35, y: cy - scale * 0.35 },
    },
    { type: 'Z', x: cx, y: cy - scale * 0.35 },
  ]

  parts.push({
    commands: shellCommands,
    fill: '#228B22', // Forest green
    stroke: colors.outline,
    strokeWidth: scale * 0.05,
    zIndex: 10,
  })

  // Shell pattern (center hexagon)
  parts.push({
    commands: generateCircle(cx, cy, scale * 0.15),
    fill: '#32CD32', // Lighter green
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 12,
  })

  // Head (peeking out)
  const headCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.35, y: cy - scale * 0.1 },
    {
      type: 'C',
      x: cx + scale * 0.55,
      y: cy - scale * 0.15,
      cp1: { x: cx + scale * 0.45, y: cy - scale * 0.2 },
      cp2: { x: cx + scale * 0.55, y: cy - scale * 0.2 },
    },
    {
      type: 'C',
      x: cx + scale * 0.35,
      y: cy + scale * 0.05,
      cp1: { x: cx + scale * 0.55, y: cy - scale * 0.05 },
      cp2: { x: cx + scale * 0.45, y: cy + scale * 0.05 },
    },
    { type: 'Z', x: cx + scale * 0.35, y: cy - scale * 0.1 },
  ]

  parts.push({
    commands: headCommands,
    fill: '#90EE90', // Light green (skin)
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 15,
  })

  // Eye
  parts.push({
    commands: generateCircle(cx + scale * 0.48, cy - scale * 0.1, scale * 0.05),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 17,
  })

  // Eye highlight
  parts.push({
    commands: generateCircle(cx + scale * 0.46, cy - scale * 0.12, scale * 0.015),
    fill: colors.eyeHighlight,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 18,
  })

  return parts
}

export const generateTurtleCartoon = wrapFantasyGenerator(_generateTurtleCartoon, 'turtle')
