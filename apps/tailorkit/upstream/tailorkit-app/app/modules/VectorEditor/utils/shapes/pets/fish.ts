/**
 * Fish (Goldfish style) Shape Generator
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateFishCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Body (oval fish shape)
  const bodyCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.4, y: cy },
    {
      type: 'C',
      x: cx + scale * 0.2,
      y: cy,
      cp1: { x: cx - scale * 0.4, y: cy - scale * 0.35 },
      cp2: { x: cx + scale * 0.15, y: cy - scale * 0.35 },
    },
    {
      type: 'C',
      x: cx - scale * 0.4,
      y: cy,
      cp1: { x: cx + scale * 0.15, y: cy + scale * 0.35 },
      cp2: { x: cx - scale * 0.4, y: cy + scale * 0.35 },
    },
    { type: 'Z', x: cx - scale * 0.4, y: cy },
  ]

  parts.push({
    commands: bodyCommands,
    fill: colors.scales.gold,
    stroke: colors.outline,
    strokeWidth: scale * 0.05,
    zIndex: 10,
  })

  // Tail fin
  const tailCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.15, y: cy },
    {
      type: 'C',
      x: cx + scale * 0.5,
      y: cy - scale * 0.3,
      cp1: { x: cx + scale * 0.3, y: cy - scale * 0.1 },
      cp2: { x: cx + scale * 0.45, y: cy - scale * 0.25 },
    },
    {
      type: 'C',
      x: cx + scale * 0.25,
      y: cy,
      cp1: { x: cx + scale * 0.45, y: cy - scale * 0.1 },
      cp2: { x: cx + scale * 0.3, y: cy },
    },
    {
      type: 'C',
      x: cx + scale * 0.5,
      y: cy + scale * 0.3,
      cp1: { x: cx + scale * 0.3, y: cy },
      cp2: { x: cx + scale * 0.45, y: cy + scale * 0.1 },
    },
    {
      type: 'C',
      x: cx + scale * 0.15,
      y: cy,
      cp1: { x: cx + scale * 0.45, y: cy + scale * 0.25 },
      cp2: { x: cx + scale * 0.3, y: cy + scale * 0.1 },
    },
    { type: 'Z', x: cx + scale * 0.15, y: cy },
  ]

  parts.push({
    commands: tailCommands,
    fill: colors.scales.orange,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  // Dorsal fin
  const dorsalCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.15, y: cy - scale * 0.25 },
    {
      type: 'C',
      x: cx + scale * 0.05,
      y: cy - scale * 0.45,
      cp1: { x: cx - scale * 0.1, y: cy - scale * 0.4 },
      cp2: { x: cx, y: cy - scale * 0.5 },
    },
    {
      type: 'C',
      x: cx + scale * 0.1,
      y: cy - scale * 0.2,
      cp1: { x: cx + scale * 0.1, y: cy - scale * 0.4 },
      cp2: { x: cx + scale * 0.12, y: cy - scale * 0.25 },
    },
    { type: 'Z', x: cx - scale * 0.15, y: cy - scale * 0.25 },
  ]

  parts.push({
    commands: dorsalCommands,
    fill: colors.scales.orange,
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 12,
  })

  // Eye
  parts.push({
    commands: generateCircle(cx - scale * 0.2, cy - scale * 0.05, scale * 0.08),
    fill: colors.eyeHighlight,
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 15,
  })

  // Pupil
  parts.push({
    commands: generateCircle(cx - scale * 0.2, cy - scale * 0.05, scale * 0.04),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 16,
  })

  return parts
}

export const generateFishCartoon = wrapFantasyGenerator(_generateFishCartoon, 'fish')
