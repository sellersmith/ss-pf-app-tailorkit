/**
 * Dragon Shape Generator (Year 5: 2024, 2012, 2000...)
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateDragonCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Dragon face (elongated snout)
  const faceCommands: PathCommand[] = [
    { type: 'M', x: cx, y: cy - scale * 0.35 },
    {
      type: 'C',
      x: cx + scale * 0.35,
      y: cy,
      cp1: { x: cx + scale * 0.35, y: cy - scale * 0.35 },
      cp2: { x: cx + scale * 0.4, y: cy - scale * 0.1 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + scale * 0.4,
      cp1: { x: cx + scale * 0.35, y: cy + scale * 0.2 },
      cp2: { x: cx + scale * 0.15, y: cy + scale * 0.4 },
    },
    {
      type: 'C',
      x: cx - scale * 0.35,
      y: cy,
      cp1: { x: cx - scale * 0.15, y: cy + scale * 0.4 },
      cp2: { x: cx - scale * 0.35, y: cy + scale * 0.2 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - scale * 0.35,
      cp1: { x: cx - scale * 0.4, y: cy - scale * 0.1 },
      cp2: { x: cx - scale * 0.35, y: cy - scale * 0.35 },
    },
    { type: 'Z', x: cx, y: cy - scale * 0.35 },
  ]

  parts.push({
    commands: faceCommands,
    fill: colors.accents.gold,
    stroke: colors.outline,
    strokeWidth: scale * 0.05,
    zIndex: 10,
  })

  // Dragon horns (antler-like)
  const leftHornCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.2, y: cy - scale * 0.3 },
    {
      type: 'C',
      x: cx - scale * 0.45,
      y: cy - scale * 0.6,
      cp1: { x: cx - scale * 0.3, y: cy - scale * 0.35 },
      cp2: { x: cx - scale * 0.4, y: cy - scale * 0.5 },
    },
    { type: 'L', x: cx - scale * 0.35, y: cy - scale * 0.5 },
    { type: 'L', x: cx - scale * 0.5, y: cy - scale * 0.45 },
  ]

  const rightHornCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.2, y: cy - scale * 0.3 },
    {
      type: 'C',
      x: cx + scale * 0.45,
      y: cy - scale * 0.6,
      cp1: { x: cx + scale * 0.3, y: cy - scale * 0.35 },
      cp2: { x: cx + scale * 0.4, y: cy - scale * 0.5 },
    },
    { type: 'L', x: cx + scale * 0.35, y: cy - scale * 0.5 },
    { type: 'L', x: cx + scale * 0.5, y: cy - scale * 0.45 },
  ]

  parts.push({
    commands: leftHornCommands,
    fill: 'none',
    stroke: colors.accents.gold,
    strokeWidth: scale * 0.06,
    zIndex: 5,
  })

  parts.push({
    commands: rightHornCommands,
    fill: 'none',
    stroke: colors.accents.gold,
    strokeWidth: scale * 0.06,
    zIndex: 5,
  })

  // Fierce eyes
  parts.push({
    commands: generateCircle(cx - scale * 0.12, cy - scale * 0.05, scale * 0.08),
    fill: colors.accents.red,
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 15,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.12, cy - scale * 0.05, scale * 0.08),
    fill: colors.accents.red,
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 15,
  })

  // Nostrils
  parts.push({
    commands: generateCircle(cx - scale * 0.06, cy + scale * 0.2, scale * 0.04),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.06, cy + scale * 0.2, scale * 0.04),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  return parts
}

export const generateDragonCartoon = wrapFantasyGenerator(_generateDragonCartoon, 'dragon')
