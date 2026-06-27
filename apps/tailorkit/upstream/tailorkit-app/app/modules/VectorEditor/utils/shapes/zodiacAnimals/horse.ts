/**
 * Horse Shape Generator (Year 7: 2026, 2014, 2002...)
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle, generateEar } from './helpers'

const _generateHorseCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Horse head (elongated)
  const headCommands: PathCommand[] = [
    { type: 'M', x: cx, y: cy - scale * 0.4 },
    {
      type: 'C',
      x: cx + scale * 0.25,
      y: cy - scale * 0.1,
      cp1: { x: cx + scale * 0.25, y: cy - scale * 0.35 },
      cp2: { x: cx + scale * 0.3, y: cy - scale * 0.2 },
    },
    {
      type: 'C',
      x: cx + scale * 0.15,
      y: cy + scale * 0.45,
      cp1: { x: cx + scale * 0.2, y: cy + scale * 0.1 },
      cp2: { x: cx + scale * 0.2, y: cy + scale * 0.35 },
    },
    {
      type: 'C',
      x: cx - scale * 0.15,
      y: cy + scale * 0.45,
      cp1: { x: cx + scale * 0.05, y: cy + scale * 0.5 },
      cp2: { x: cx - scale * 0.05, y: cy + scale * 0.5 },
    },
    {
      type: 'C',
      x: cx - scale * 0.25,
      y: cy - scale * 0.1,
      cp1: { x: cx - scale * 0.2, y: cy + scale * 0.35 },
      cp2: { x: cx - scale * 0.2, y: cy + scale * 0.1 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - scale * 0.4,
      cp1: { x: cx - scale * 0.3, y: cy - scale * 0.2 },
      cp2: { x: cx - scale * 0.25, y: cy - scale * 0.35 },
    },
    { type: 'Z', x: cx, y: cy - scale * 0.4 },
  ]

  parts.push({
    commands: headCommands,
    fill: colors.body.medium,
    stroke: colors.outline,
    strokeWidth: scale * 0.05,
    zIndex: 10,
  })

  // Mane
  const maneCommands: PathCommand[] = [
    { type: 'M', x: cx, y: cy - scale * 0.4 },
    {
      type: 'C',
      x: cx - scale * 0.15,
      y: cy - scale * 0.6,
      cp1: { x: cx - scale * 0.1, y: cy - scale * 0.45 },
      cp2: { x: cx - scale * 0.15, y: cy - scale * 0.55 },
    },
    {
      type: 'C',
      x: cx + scale * 0.05,
      y: cy - scale * 0.5,
      cp1: { x: cx - scale * 0.1, y: cy - scale * 0.6 },
      cp2: { x: cx, y: cy - scale * 0.55 },
    },
    {
      type: 'C',
      x: cx - scale * 0.1,
      y: cy - scale * 0.65,
      cp1: { x: cx - scale * 0.05, y: cy - scale * 0.55 },
      cp2: { x: cx - scale * 0.1, y: cy - scale * 0.6 },
    },
  ]

  parts.push({
    commands: maneCommands,
    fill: 'none',
    stroke: colors.body.dark,
    strokeWidth: scale * 0.08,
    zIndex: 5,
  })

  // Ears
  parts.push({
    commands: generateEar(cx - scale * 0.15, cy - scale * 0.45, scale * 0.1, scale * 0.18, -15),
    fill: colors.body.medium,
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 8,
  })

  parts.push({
    commands: generateEar(cx + scale * 0.15, cy - scale * 0.45, scale * 0.1, scale * 0.18, 15),
    fill: colors.body.medium,
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 8,
  })

  // Eyes
  parts.push({
    commands: generateCircle(cx - scale * 0.1, cy - scale * 0.1, scale * 0.06),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.1, cy - scale * 0.1, scale * 0.06),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  // Nostrils
  parts.push({
    commands: generateCircle(cx - scale * 0.06, cy + scale * 0.3, scale * 0.035),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.06, cy + scale * 0.3, scale * 0.035),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  return parts
}

export const generateHorseCartoon = wrapFantasyGenerator(_generateHorseCartoon, 'horse')
