/**
 * Tiger Shape Generator (Year 3: 2022, 2010, 1998...)
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle, generateEar } from './helpers'

const _generateTigerCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Face (wide, rounded)
  parts.push({
    commands: generateCircle(cx, cy, scale * 0.4),
    fill: '#FF8C00', // Orange
    stroke: colors.outline,
    strokeWidth: scale * 0.05,
    zIndex: 10,
  })

  // Ears
  parts.push({
    commands: generateEar(cx - scale * 0.3, cy - scale * 0.4, scale * 0.2, scale * 0.25, -15),
    fill: '#FF8C00',
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  parts.push({
    commands: generateEar(cx + scale * 0.3, cy - scale * 0.4, scale * 0.2, scale * 0.25, 15),
    fill: '#FF8C00',
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  // Tiger stripes on forehead (characteristic)
  const stripeCommands: PathCommand[] = [
    { type: 'M', x: cx, y: cy - scale * 0.35 },
    { type: 'L', x: cx, y: cy - scale * 0.15 },
    { type: 'M', x: cx - scale * 0.12, y: cy - scale * 0.3 },
    { type: 'L', x: cx - scale * 0.08, y: cy - scale * 0.15 },
    { type: 'M', x: cx + scale * 0.12, y: cy - scale * 0.3 },
    { type: 'L', x: cx + scale * 0.08, y: cy - scale * 0.15 },
  ]

  parts.push({
    commands: stripeCommands,
    fill: 'none',
    stroke: colors.accents.black,
    strokeWidth: scale * 0.06,
    zIndex: 15,
  })

  // White muzzle area
  const muzzleCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.25, y: cy + scale * 0.05 },
    {
      type: 'C',
      x: cx + scale * 0.25,
      y: cy + scale * 0.05,
      cp1: { x: cx - scale * 0.25, y: cy + scale * 0.35 },
      cp2: { x: cx + scale * 0.25, y: cy + scale * 0.35 },
    },
    {
      type: 'C',
      x: cx - scale * 0.25,
      y: cy + scale * 0.05,
      cp1: { x: cx + scale * 0.15, y: cy },
      cp2: { x: cx - scale * 0.15, y: cy },
    },
    { type: 'Z', x: cx - scale * 0.25, y: cy + scale * 0.05 },
  ]

  parts.push({
    commands: muzzleCommands,
    fill: colors.accents.white,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 12,
  })

  // Eyes
  parts.push({
    commands: generateCircle(cx - scale * 0.15, cy - scale * 0.05, scale * 0.07),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.15, cy - scale * 0.05, scale * 0.07),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  // Nose
  parts.push({
    commands: generateCircle(cx, cy + scale * 0.1, scale * 0.06),
    fill: colors.nose,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 17,
  })

  return parts
}

export const generateTigerCartoon = wrapFantasyGenerator(_generateTigerCartoon, 'tiger')
