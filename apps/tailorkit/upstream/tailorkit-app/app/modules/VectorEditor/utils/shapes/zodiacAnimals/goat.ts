/**
 * Goat/Sheep Shape Generator (Year 8: 2027, 2015, 2003...)
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateGoatCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Fluffy wool (background)
  const woolCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.35, y: cy - scale * 0.2 },
    {
      type: 'C',
      x: cx - scale * 0.2,
      y: cy - scale * 0.45,
      cp1: { x: cx - scale * 0.45, y: cy - scale * 0.35 },
      cp2: { x: cx - scale * 0.35, y: cy - scale * 0.5 },
    },
    {
      type: 'C',
      x: cx + scale * 0.2,
      y: cy - scale * 0.45,
      cp1: { x: cx - scale * 0.05, y: cy - scale * 0.55 },
      cp2: { x: cx + scale * 0.05, y: cy - scale * 0.55 },
    },
    {
      type: 'C',
      x: cx + scale * 0.35,
      y: cy - scale * 0.2,
      cp1: { x: cx + scale * 0.35, y: cy - scale * 0.5 },
      cp2: { x: cx + scale * 0.45, y: cy - scale * 0.35 },
    },
  ]

  parts.push({
    commands: woolCommands,
    fill: colors.accents.white,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  // Face
  parts.push({
    commands: generateCircle(cx, cy + scale * 0.05, scale * 0.32),
    fill: colors.body.light,
    stroke: colors.outline,
    strokeWidth: scale * 0.05,
    zIndex: 10,
  })

  // Ears (drooping)
  const leftEarCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.3, y: cy - scale * 0.05 },
    {
      type: 'C',
      x: cx - scale * 0.5,
      y: cy + scale * 0.15,
      cp1: { x: cx - scale * 0.4, y: cy - scale * 0.05 },
      cp2: { x: cx - scale * 0.5, y: cy + scale * 0.05 },
    },
    {
      type: 'C',
      x: cx - scale * 0.28,
      y: cy + scale * 0.05,
      cp1: { x: cx - scale * 0.45, y: cy + scale * 0.2 },
      cp2: { x: cx - scale * 0.35, y: cy + scale * 0.1 },
    },
    { type: 'Z', x: cx - scale * 0.3, y: cy - scale * 0.05 },
  ]

  const rightEarCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.3, y: cy - scale * 0.05 },
    {
      type: 'C',
      x: cx + scale * 0.5,
      y: cy + scale * 0.15,
      cp1: { x: cx + scale * 0.4, y: cy - scale * 0.05 },
      cp2: { x: cx + scale * 0.5, y: cy + scale * 0.05 },
    },
    {
      type: 'C',
      x: cx + scale * 0.28,
      y: cy + scale * 0.05,
      cp1: { x: cx + scale * 0.45, y: cy + scale * 0.2 },
      cp2: { x: cx + scale * 0.35, y: cy + scale * 0.1 },
    },
    { type: 'Z', x: cx + scale * 0.3, y: cy - scale * 0.05 },
  ]

  parts.push({
    commands: leftEarCommands,
    fill: colors.body.light,
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 8,
  })

  parts.push({
    commands: rightEarCommands,
    fill: colors.body.light,
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 8,
  })

  // Eyes
  parts.push({
    commands: generateCircle(cx - scale * 0.1, cy, scale * 0.05),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.1, cy, scale * 0.05),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  // Nose
  parts.push({
    commands: generateCircle(cx, cy + scale * 0.2, scale * 0.05),
    fill: colors.nose,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  return parts
}

export const generateGoatCartoon = wrapFantasyGenerator(_generateGoatCartoon, 'goat')
