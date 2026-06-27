/**
 * Cat Shape Generator
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generatePointedEar } from './helpers'

const _generateCatCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Face (slightly angular)
  const faceCommands: PathCommand[] = [
    { type: 'M', x: cx, y: cy - scale * 0.35 },
    {
      type: 'C',
      x: cx + scale * 0.35,
      y: cy + scale * 0.05,
      cp1: { x: cx + scale * 0.3, y: cy - scale * 0.35 },
      cp2: { x: cx + scale * 0.4, y: cy - scale * 0.15 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + scale * 0.35,
      cp1: { x: cx + scale * 0.35, y: cy + scale * 0.25 },
      cp2: { x: cx + scale * 0.15, y: cy + scale * 0.4 },
    },
    {
      type: 'C',
      x: cx - scale * 0.35,
      y: cy + scale * 0.05,
      cp1: { x: cx - scale * 0.15, y: cy + scale * 0.4 },
      cp2: { x: cx - scale * 0.35, y: cy + scale * 0.25 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - scale * 0.35,
      cp1: { x: cx - scale * 0.4, y: cy - scale * 0.15 },
      cp2: { x: cx - scale * 0.3, y: cy - scale * 0.35 },
    },
    { type: 'Z', x: cx, y: cy - scale * 0.35 },
  ]

  parts.push({
    commands: faceCommands,
    fill: colors.fur.orange,
    stroke: colors.outline,
    strokeWidth: scale * 0.05,
    zIndex: 10,
  })

  // Pointed ears
  parts.push({
    commands: generatePointedEar(cx - scale * 0.28, cy - scale * 0.4, scale * 0.25, scale * 0.35, -15),
    fill: colors.fur.orange,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  parts.push({
    commands: generatePointedEar(cx + scale * 0.28, cy - scale * 0.4, scale * 0.25, scale * 0.35, 15),
    fill: colors.fur.orange,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  // Inner ears (pink)
  parts.push({
    commands: generatePointedEar(cx - scale * 0.28, cy - scale * 0.38, scale * 0.15, scale * 0.2, -15),
    fill: colors.nose,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 6,
    opacity: 0.5,
  })

  parts.push({
    commands: generatePointedEar(cx + scale * 0.28, cy - scale * 0.38, scale * 0.15, scale * 0.2, 15),
    fill: colors.nose,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 6,
    opacity: 0.5,
  })

  // Cat eyes (almond shaped)
  const leftEyeCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.2, y: cy - scale * 0.05 },
    {
      type: 'C',
      x: cx - scale * 0.05,
      y: cy - scale * 0.05,
      cp1: { x: cx - scale * 0.18, y: cy - scale * 0.15 },
      cp2: { x: cx - scale * 0.07, y: cy - scale * 0.15 },
    },
    {
      type: 'C',
      x: cx - scale * 0.2,
      y: cy - scale * 0.05,
      cp1: { x: cx - scale * 0.07, y: cy + scale * 0.05 },
      cp2: { x: cx - scale * 0.18, y: cy + scale * 0.05 },
    },
    { type: 'Z', x: cx - scale * 0.2, y: cy - scale * 0.05 },
  ]

  const rightEyeCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.2, y: cy - scale * 0.05 },
    {
      type: 'C',
      x: cx + scale * 0.05,
      y: cy - scale * 0.05,
      cp1: { x: cx + scale * 0.18, y: cy - scale * 0.15 },
      cp2: { x: cx + scale * 0.07, y: cy - scale * 0.15 },
    },
    {
      type: 'C',
      x: cx + scale * 0.2,
      y: cy - scale * 0.05,
      cp1: { x: cx + scale * 0.07, y: cy + scale * 0.05 },
      cp2: { x: cx + scale * 0.18, y: cy + scale * 0.05 },
    },
    { type: 'Z', x: cx + scale * 0.2, y: cy - scale * 0.05 },
  ]

  parts.push({
    commands: leftEyeCommands,
    fill: '#32CD32', // Green cat eyes
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 15,
  })

  parts.push({
    commands: rightEyeCommands,
    fill: '#32CD32',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 15,
  })

  // Nose (triangle)
  const noseCommands: PathCommand[] = [
    { type: 'M', x: cx, y: cy + scale * 0.05 },
    { type: 'L', x: cx - scale * 0.05, y: cy + scale * 0.15 },
    { type: 'L', x: cx + scale * 0.05, y: cy + scale * 0.15 },
    { type: 'Z', x: cx, y: cy + scale * 0.05 },
  ]

  parts.push({
    commands: noseCommands,
    fill: colors.nose,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 17,
  })

  // Whiskers
  const whiskerCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.35, y: cy + scale * 0.05 },
    { type: 'L', x: cx - scale * 0.1, y: cy + scale * 0.1 },
    { type: 'M', x: cx - scale * 0.35, y: cy + scale * 0.15 },
    { type: 'L', x: cx - scale * 0.1, y: cy + scale * 0.15 },
    { type: 'M', x: cx + scale * 0.35, y: cy + scale * 0.05 },
    { type: 'L', x: cx + scale * 0.1, y: cy + scale * 0.1 },
    { type: 'M', x: cx + scale * 0.35, y: cy + scale * 0.15 },
    { type: 'L', x: cx + scale * 0.1, y: cy + scale * 0.15 },
  ]

  parts.push({
    commands: whiskerCommands,
    fill: 'none',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 18,
  })

  return parts
}

export const generateCatCartoon = wrapFantasyGenerator(_generateCatCartoon, 'cat')
