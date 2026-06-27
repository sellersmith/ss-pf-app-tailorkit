/**
 * Dog Shape Generator (Year 11: 2030, 2018, 2006...)
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateDogCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Face
  parts.push({
    commands: generateCircle(cx, cy, scale * 0.35),
    fill: colors.body.medium,
    stroke: colors.outline,
    strokeWidth: scale * 0.05,
    zIndex: 10,
  })

  // Floppy ears
  const leftEarCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.25, y: cy - scale * 0.2 },
    {
      type: 'C',
      x: cx - scale * 0.5,
      y: cy + scale * 0.25,
      cp1: { x: cx - scale * 0.45, y: cy - scale * 0.15 },
      cp2: { x: cx - scale * 0.55, y: cy + scale * 0.1 },
    },
    {
      type: 'C',
      x: cx - scale * 0.3,
      y: cy + scale * 0.1,
      cp1: { x: cx - scale * 0.45, y: cy + scale * 0.35 },
      cp2: { x: cx - scale * 0.35, y: cy + scale * 0.2 },
    },
    { type: 'Z', x: cx - scale * 0.25, y: cy - scale * 0.2 },
  ]

  const rightEarCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.25, y: cy - scale * 0.2 },
    {
      type: 'C',
      x: cx + scale * 0.5,
      y: cy + scale * 0.25,
      cp1: { x: cx + scale * 0.45, y: cy - scale * 0.15 },
      cp2: { x: cx + scale * 0.55, y: cy + scale * 0.1 },
    },
    {
      type: 'C',
      x: cx + scale * 0.3,
      y: cy + scale * 0.1,
      cp1: { x: cx + scale * 0.45, y: cy + scale * 0.35 },
      cp2: { x: cx + scale * 0.35, y: cy + scale * 0.2 },
    },
    { type: 'Z', x: cx + scale * 0.25, y: cy - scale * 0.2 },
  ]

  parts.push({
    commands: leftEarCommands,
    fill: colors.body.dark,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  parts.push({
    commands: rightEarCommands,
    fill: colors.body.dark,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  // Snout
  const snoutCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.15, y: cy + scale * 0.05 },
    {
      type: 'C',
      x: cx + scale * 0.15,
      y: cy + scale * 0.05,
      cp1: { x: cx - scale * 0.15, y: cy + scale * 0.3 },
      cp2: { x: cx + scale * 0.15, y: cy + scale * 0.3 },
    },
    {
      type: 'C',
      x: cx - scale * 0.15,
      y: cy + scale * 0.05,
      cp1: { x: cx + scale * 0.1, y: cy },
      cp2: { x: cx - scale * 0.1, y: cy },
    },
    { type: 'Z', x: cx - scale * 0.15, y: cy + scale * 0.05 },
  ]

  parts.push({
    commands: snoutCommands,
    fill: colors.body.light,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 12,
  })

  // Eyes
  parts.push({
    commands: generateCircle(cx - scale * 0.12, cy - scale * 0.08, scale * 0.06),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.12, cy - scale * 0.08, scale * 0.06),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  // Nose
  parts.push({
    commands: generateCircle(cx, cy + scale * 0.12, scale * 0.06),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 17,
  })

  return parts
}

export const generateDogCartoon = wrapFantasyGenerator(_generateDogCartoon, 'dog')
