/**
 * Parrot Shape Generator
 * Colorful tropical parrot with curved beak
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateParrotCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Body (green)
  const bodyCommands: PathCommand[] = [
    { type: 'M', x: cx, y: cy - scale * 0.2 },
    {
      type: 'C',
      x: cx + scale * 0.35,
      y: cy + scale * 0.3,
      cp1: { x: cx + scale * 0.4, y: cy - scale * 0.1 },
      cp2: { x: cx + scale * 0.45, y: cy + scale * 0.2 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + scale * 0.5,
      cp1: { x: cx + scale * 0.3, y: cy + scale * 0.45 },
      cp2: { x: cx + scale * 0.1, y: cy + scale * 0.5 },
    },
    {
      type: 'C',
      x: cx - scale * 0.35,
      y: cy + scale * 0.3,
      cp1: { x: cx - scale * 0.1, y: cy + scale * 0.5 },
      cp2: { x: cx - scale * 0.3, y: cy + scale * 0.45 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - scale * 0.2,
      cp1: { x: cx - scale * 0.45, y: cy + scale * 0.2 },
      cp2: { x: cx - scale * 0.4, y: cy - scale * 0.1 },
    },
    { type: 'Z', x: cx, y: cy - scale * 0.2 },
  ]

  parts.push({
    commands: bodyCommands,
    fill: '#4CAF50', // Green body
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 10,
  })

  // Head (slightly different green)
  parts.push({
    commands: generateCircle(cx, cy - scale * 0.25, scale * 0.28),
    fill: '#66BB6A',
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 12,
  })

  // Curved beak (upper)
  const beakUpperCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.2, y: cy - scale * 0.3 },
    {
      type: 'C',
      x: cx + scale * 0.4,
      y: cy - scale * 0.15,
      cp1: { x: cx + scale * 0.35, y: cy - scale * 0.35 },
      cp2: { x: cx + scale * 0.45, y: cy - scale * 0.25 },
    },
    {
      type: 'C',
      x: cx + scale * 0.2,
      y: cy - scale * 0.15,
      cp1: { x: cx + scale * 0.35, y: cy - scale * 0.1 },
      cp2: { x: cx + scale * 0.25, y: cy - scale * 0.12 },
    },
    { type: 'Z', x: cx + scale * 0.2, y: cy - scale * 0.3 },
  ]

  parts.push({
    commands: beakUpperCommands,
    fill: '#37474F', // Dark gray beak
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 15,
  })

  // Eye patch (white)
  parts.push({
    commands: generateCircle(cx + scale * 0.08, cy - scale * 0.28, scale * 0.12),
    fill: '#FFFFFF',
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 13,
  })

  // Eye
  parts.push({
    commands: generateCircle(cx + scale * 0.1, cy - scale * 0.28, scale * 0.06),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 14,
  })

  // Eye highlight
  parts.push({
    commands: generateCircle(cx + scale * 0.08, cy - scale * 0.3, scale * 0.02),
    fill: colors.eyeHighlight,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  // Wing (blue accent)
  const wingCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.15, y: cy },
    {
      type: 'C',
      x: cx - scale * 0.35,
      y: cy + scale * 0.35,
      cp1: { x: cx - scale * 0.35, y: cy + scale * 0.05 },
      cp2: { x: cx - scale * 0.4, y: cy + scale * 0.25 },
    },
    {
      type: 'C',
      x: cx + scale * 0.05,
      y: cy + scale * 0.25,
      cp1: { x: cx - scale * 0.25, y: cy + scale * 0.4 },
      cp2: { x: cx, y: cy + scale * 0.3 },
    },
    { type: 'Z', x: cx - scale * 0.15, y: cy },
  ]

  parts.push({
    commands: wingCommands,
    fill: '#2196F3', // Blue wing
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 11,
  })

  // Tail feathers
  const tailCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.1, y: cy + scale * 0.45 },
    { type: 'L', x: cx - scale * 0.15, y: cy + scale * 0.7 },
    { type: 'L', x: cx, y: cy + scale * 0.65 },
    { type: 'L', x: cx + scale * 0.1, y: cy + scale * 0.7 },
    { type: 'L', x: cx + scale * 0.05, y: cy + scale * 0.45 },
    { type: 'Z', x: cx - scale * 0.1, y: cy + scale * 0.45 },
  ]

  parts.push({
    commands: tailCommands,
    fill: '#F44336', // Red tail
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 8,
  })

  return parts
}

export const generateParrotCartoon = wrapFantasyGenerator(_generateParrotCartoon, 'parrot')
