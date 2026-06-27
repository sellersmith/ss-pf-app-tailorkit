/**
 * Dog Shape Generator
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle, generateFloppyEar } from './helpers'

const _generateDogCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Face
  parts.push({
    commands: generateCircle(cx, cy, scale * 0.38),
    fill: colors.fur.tan,
    stroke: colors.outline,
    strokeWidth: scale * 0.05,
    zIndex: 10,
  })

  // Floppy ears
  parts.push({
    commands: generateFloppyEar(cx - scale * 0.35, cy - scale * 0.1, scale * 0.25, scale * 0.5, -20),
    fill: colors.fur.brown,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  parts.push({
    commands: generateFloppyEar(cx + scale * 0.35, cy - scale * 0.1, scale * 0.25, scale * 0.5, 20),
    fill: colors.fur.brown,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  // Snout
  const snoutCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.18, y: cy + scale * 0.05 },
    {
      type: 'C',
      x: cx + scale * 0.18,
      y: cy + scale * 0.05,
      cp1: { x: cx - scale * 0.18, y: cy + scale * 0.35 },
      cp2: { x: cx + scale * 0.18, y: cy + scale * 0.35 },
    },
    {
      type: 'C',
      x: cx - scale * 0.18,
      y: cy + scale * 0.05,
      cp1: { x: cx + scale * 0.12, y: cy },
      cp2: { x: cx - scale * 0.12, y: cy },
    },
    { type: 'Z', x: cx - scale * 0.18, y: cy + scale * 0.05 },
  ]

  parts.push({
    commands: snoutCommands,
    fill: colors.fur.cream,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 12,
  })

  // Eyes
  parts.push({
    commands: generateCircle(cx - scale * 0.12, cy - scale * 0.08, scale * 0.07),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.12, cy - scale * 0.08, scale * 0.07),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  // Eye highlights
  parts.push({
    commands: generateCircle(cx - scale * 0.14, cy - scale * 0.1, scale * 0.025),
    fill: colors.eyeHighlight,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 16,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.1, cy - scale * 0.1, scale * 0.025),
    fill: colors.eyeHighlight,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 16,
  })

  // Nose
  parts.push({
    commands: generateCircle(cx, cy + scale * 0.12, scale * 0.07),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 17,
  })

  return parts
}

export const generateDogCartoon = wrapFantasyGenerator(_generateDogCartoon, 'dog')
