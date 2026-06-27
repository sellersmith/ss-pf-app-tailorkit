/**
 * Bird (Generic small bird/parakeet) Shape Generator
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateBirdCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Body/head (combined round shape)
  parts.push({
    commands: generateCircle(cx, cy, scale * 0.35),
    fill: colors.feathers.blue,
    stroke: colors.outline,
    strokeWidth: scale * 0.05,
    zIndex: 10,
  })

  // Wing (on side)
  const wingCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.3, y: cy - scale * 0.1 },
    {
      type: 'C',
      x: cx - scale * 0.5,
      y: cy + scale * 0.3,
      cp1: { x: cx - scale * 0.5, y: cy - scale * 0.05 },
      cp2: { x: cx - scale * 0.55, y: cy + scale * 0.2 },
    },
    {
      type: 'C',
      x: cx - scale * 0.2,
      y: cy + scale * 0.2,
      cp1: { x: cx - scale * 0.4, y: cy + scale * 0.35 },
      cp2: { x: cx - scale * 0.25, y: cy + scale * 0.25 },
    },
    { type: 'Z', x: cx - scale * 0.3, y: cy - scale * 0.1 },
  ]

  parts.push({
    commands: wingCommands,
    fill: colors.feathers.blue,
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 8,
  })

  // Belly (lighter area)
  parts.push({
    commands: generateCircle(cx + scale * 0.05, cy + scale * 0.1, scale * 0.2),
    fill: colors.feathers.yellow,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 12,
  })

  // Beak
  const beakCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.25, y: cy - scale * 0.05 },
    { type: 'L', x: cx + scale * 0.45, y: cy + scale * 0.02 },
    { type: 'L', x: cx + scale * 0.25, y: cy + scale * 0.08 },
    { type: 'Z', x: cx + scale * 0.25, y: cy - scale * 0.05 },
  ]

  parts.push({
    commands: beakCommands,
    fill: '#FF8C00', // Orange beak
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 15,
  })

  // Eye
  parts.push({
    commands: generateCircle(cx + scale * 0.1, cy - scale * 0.08, scale * 0.06),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  // Eye highlight
  parts.push({
    commands: generateCircle(cx + scale * 0.08, cy - scale * 0.1, scale * 0.02),
    fill: colors.eyeHighlight,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 16,
  })

  return parts
}

export const generateBirdCartoon = wrapFantasyGenerator(_generateBirdCartoon, 'bird')
