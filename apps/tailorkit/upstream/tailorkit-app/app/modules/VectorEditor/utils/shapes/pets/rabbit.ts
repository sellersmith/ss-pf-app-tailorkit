/**
 * Rabbit (Pet version) Shape Generator
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateRabbitCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Face (oval)
  parts.push({
    commands: generateCircle(cx, cy + scale * 0.1, scale * 0.35),
    fill: colors.fur.white,
    stroke: colors.outline,
    strokeWidth: scale * 0.05,
    zIndex: 10,
  })

  // Long ears
  const leftEarCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.15, y: cy - scale * 0.2 },
    {
      type: 'C',
      x: cx - scale * 0.22,
      y: cy - scale * 0.7,
      cp1: { x: cx - scale * 0.28, y: cy - scale * 0.3 },
      cp2: { x: cx - scale * 0.32, y: cy - scale * 0.6 },
    },
    {
      type: 'C',
      x: cx - scale * 0.05,
      y: cy - scale * 0.2,
      cp1: { x: cx - scale * 0.12, y: cy - scale * 0.6 },
      cp2: { x: cx - scale * 0.08, y: cy - scale * 0.3 },
    },
    { type: 'Z', x: cx - scale * 0.15, y: cy - scale * 0.2 },
  ]

  const rightEarCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.15, y: cy - scale * 0.2 },
    {
      type: 'C',
      x: cx + scale * 0.22,
      y: cy - scale * 0.7,
      cp1: { x: cx + scale * 0.28, y: cy - scale * 0.3 },
      cp2: { x: cx + scale * 0.32, y: cy - scale * 0.6 },
    },
    {
      type: 'C',
      x: cx + scale * 0.05,
      y: cy - scale * 0.2,
      cp1: { x: cx + scale * 0.12, y: cy - scale * 0.6 },
      cp2: { x: cx + scale * 0.08, y: cy - scale * 0.3 },
    },
    { type: 'Z', x: cx + scale * 0.15, y: cy - scale * 0.2 },
  ]

  parts.push({
    commands: leftEarCommands,
    fill: colors.fur.white,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  parts.push({
    commands: rightEarCommands,
    fill: colors.fur.white,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  // Inner ears (pink)
  const innerLeftEarCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.13, y: cy - scale * 0.25 },
    {
      type: 'C',
      x: cx - scale * 0.18,
      y: cy - scale * 0.55,
      cp1: { x: cx - scale * 0.2, y: cy - scale * 0.3 },
      cp2: { x: cx - scale * 0.23, y: cy - scale * 0.5 },
    },
    {
      type: 'C',
      x: cx - scale * 0.07,
      y: cy - scale * 0.25,
      cp1: { x: cx - scale * 0.13, y: cy - scale * 0.5 },
      cp2: { x: cx - scale * 0.1, y: cy - scale * 0.3 },
    },
    { type: 'Z', x: cx - scale * 0.13, y: cy - scale * 0.25 },
  ]

  const innerRightEarCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.13, y: cy - scale * 0.25 },
    {
      type: 'C',
      x: cx + scale * 0.18,
      y: cy - scale * 0.55,
      cp1: { x: cx + scale * 0.2, y: cy - scale * 0.3 },
      cp2: { x: cx + scale * 0.23, y: cy - scale * 0.5 },
    },
    {
      type: 'C',
      x: cx + scale * 0.07,
      y: cy - scale * 0.25,
      cp1: { x: cx + scale * 0.13, y: cy - scale * 0.5 },
      cp2: { x: cx + scale * 0.1, y: cy - scale * 0.3 },
    },
    { type: 'Z', x: cx + scale * 0.13, y: cy - scale * 0.25 },
  ]

  parts.push({
    commands: innerLeftEarCommands,
    fill: colors.nose,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 6,
    opacity: 0.4,
  })

  parts.push({
    commands: innerRightEarCommands,
    fill: colors.nose,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 6,
    opacity: 0.4,
  })

  // Eyes
  parts.push({
    commands: generateCircle(cx - scale * 0.12, cy + scale * 0.05, scale * 0.07),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.12, cy + scale * 0.05, scale * 0.07),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  // Eye highlights
  parts.push({
    commands: generateCircle(cx - scale * 0.14, cy + scale * 0.03, scale * 0.025),
    fill: colors.eyeHighlight,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 16,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.1, cy + scale * 0.03, scale * 0.025),
    fill: colors.eyeHighlight,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 16,
  })

  // Nose
  parts.push({
    commands: generateCircle(cx, cy + scale * 0.2, scale * 0.05),
    fill: colors.nose,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 17,
  })

  return parts
}

export const generateRabbitCartoon = wrapFantasyGenerator(_generateRabbitCartoon, 'rabbit')
