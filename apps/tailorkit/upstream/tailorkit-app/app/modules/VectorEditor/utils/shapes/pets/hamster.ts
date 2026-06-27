/**
 * Hamster Shape Generator
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateHamsterCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Chubby face (wider than tall)
  const faceCommands: PathCommand[] = [
    { type: 'M', x: cx, y: cy - scale * 0.3 },
    {
      type: 'C',
      x: cx + scale * 0.45,
      y: cy,
      cp1: { x: cx + scale * 0.35, y: cy - scale * 0.3 },
      cp2: { x: cx + scale * 0.5, y: cy - scale * 0.15 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + scale * 0.35,
      cp1: { x: cx + scale * 0.45, y: cy + scale * 0.2 },
      cp2: { x: cx + scale * 0.2, y: cy + scale * 0.4 },
    },
    {
      type: 'C',
      x: cx - scale * 0.45,
      y: cy,
      cp1: { x: cx - scale * 0.2, y: cy + scale * 0.4 },
      cp2: { x: cx - scale * 0.45, y: cy + scale * 0.2 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - scale * 0.3,
      cp1: { x: cx - scale * 0.5, y: cy - scale * 0.15 },
      cp2: { x: cx - scale * 0.35, y: cy - scale * 0.3 },
    },
    { type: 'Z', x: cx, y: cy - scale * 0.3 },
  ]

  parts.push({
    commands: faceCommands,
    fill: colors.fur.ginger,
    stroke: colors.outline,
    strokeWidth: scale * 0.05,
    zIndex: 10,
  })

  // Small round ears
  parts.push({
    commands: generateCircle(cx - scale * 0.3, cy - scale * 0.28, scale * 0.12),
    fill: colors.fur.ginger,
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 5,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.3, cy - scale * 0.28, scale * 0.12),
    fill: colors.fur.ginger,
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 5,
  })

  // Cheek pouches (cream colored)
  parts.push({
    commands: generateCircle(cx - scale * 0.25, cy + scale * 0.08, scale * 0.15),
    fill: colors.fur.cream,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 12,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.25, cy + scale * 0.08, scale * 0.15),
    fill: colors.fur.cream,
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

  // Eye highlights
  parts.push({
    commands: generateCircle(cx - scale * 0.14, cy - scale * 0.07, scale * 0.02),
    fill: colors.eyeHighlight,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 16,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.1, cy - scale * 0.07, scale * 0.02),
    fill: colors.eyeHighlight,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 16,
  })

  // Nose
  parts.push({
    commands: generateCircle(cx, cy + scale * 0.1, scale * 0.05),
    fill: colors.nose,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 17,
  })

  return parts
}

export const generateHamsterCartoon = wrapFantasyGenerator(_generateHamsterCartoon, 'hamster')
