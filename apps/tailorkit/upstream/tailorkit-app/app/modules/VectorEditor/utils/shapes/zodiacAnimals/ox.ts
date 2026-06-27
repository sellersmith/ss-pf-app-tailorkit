/**
 * Ox Shape Generator (Year 2: 2021, 2009, 1997...)
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle, generateEar } from './helpers'

const _generateOxCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Face (wider, more square)
  const faceCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.35, y: cy - scale * 0.25 },
    {
      type: 'C',
      x: cx + scale * 0.35,
      y: cy - scale * 0.25,
      cp1: { x: cx - scale * 0.2, y: cy - scale * 0.4 },
      cp2: { x: cx + scale * 0.2, y: cy - scale * 0.4 },
    },
    {
      type: 'C',
      x: cx + scale * 0.35,
      y: cy + scale * 0.3,
      cp1: { x: cx + scale * 0.45, y: cy - scale * 0.1 },
      cp2: { x: cx + scale * 0.45, y: cy + scale * 0.15 },
    },
    {
      type: 'C',
      x: cx - scale * 0.35,
      y: cy + scale * 0.3,
      cp1: { x: cx + scale * 0.15, y: cy + scale * 0.45 },
      cp2: { x: cx - scale * 0.15, y: cy + scale * 0.45 },
    },
    {
      type: 'C',
      x: cx - scale * 0.35,
      y: cy - scale * 0.25,
      cp1: { x: cx - scale * 0.45, y: cy + scale * 0.15 },
      cp2: { x: cx - scale * 0.45, y: cy - scale * 0.1 },
    },
    { type: 'Z', x: cx - scale * 0.35, y: cy - scale * 0.25 },
  ]

  parts.push({
    commands: faceCommands,
    fill: colors.body.medium,
    stroke: colors.outline,
    strokeWidth: scale * 0.05,
    zIndex: 10,
  })

  // Horns
  const leftHornCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.25, y: cy - scale * 0.3 },
    {
      type: 'C',
      x: cx - scale * 0.5,
      y: cy - scale * 0.5,
      cp1: { x: cx - scale * 0.35, y: cy - scale * 0.45 },
      cp2: { x: cx - scale * 0.5, y: cy - scale * 0.5 },
    },
    {
      type: 'C',
      x: cx - scale * 0.15,
      y: cy - scale * 0.35,
      cp1: { x: cx - scale * 0.4, y: cy - scale * 0.45 },
      cp2: { x: cx - scale * 0.2, y: cy - scale * 0.4 },
    },
    { type: 'Z', x: cx - scale * 0.25, y: cy - scale * 0.3 },
  ]

  const rightHornCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.25, y: cy - scale * 0.3 },
    {
      type: 'C',
      x: cx + scale * 0.5,
      y: cy - scale * 0.5,
      cp1: { x: cx + scale * 0.35, y: cy - scale * 0.45 },
      cp2: { x: cx + scale * 0.5, y: cy - scale * 0.5 },
    },
    {
      type: 'C',
      x: cx + scale * 0.15,
      y: cy - scale * 0.35,
      cp1: { x: cx + scale * 0.4, y: cy - scale * 0.45 },
      cp2: { x: cx + scale * 0.2, y: cy - scale * 0.4 },
    },
    { type: 'Z', x: cx + scale * 0.25, y: cy - scale * 0.3 },
  ]

  parts.push({
    commands: leftHornCommands,
    fill: colors.body.dark,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  parts.push({
    commands: rightHornCommands,
    fill: colors.body.dark,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 5,
  })

  // Ears (small)
  parts.push({
    commands: generateEar(cx - scale * 0.4, cy - scale * 0.15, scale * 0.15, scale * 0.2, -30),
    fill: colors.body.medium,
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 8,
  })

  parts.push({
    commands: generateEar(cx + scale * 0.4, cy - scale * 0.15, scale * 0.15, scale * 0.2, 30),
    fill: colors.body.medium,
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 8,
  })

  // Eyes
  parts.push({
    commands: generateCircle(cx - scale * 0.15, cy - scale * 0.05, scale * 0.06),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.15, cy - scale * 0.05, scale * 0.06),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  // Nose ring area (oval)
  const snoutCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.2, y: cy + scale * 0.15 },
    {
      type: 'C',
      x: cx + scale * 0.2,
      y: cy + scale * 0.15,
      cp1: { x: cx - scale * 0.2, y: cy + scale * 0.35 },
      cp2: { x: cx + scale * 0.2, y: cy + scale * 0.35 },
    },
    {
      type: 'C',
      x: cx - scale * 0.2,
      y: cy + scale * 0.15,
      cp1: { x: cx + scale * 0.2, y: cy + scale * 0.1 },
      cp2: { x: cx - scale * 0.2, y: cy + scale * 0.1 },
    },
    { type: 'Z', x: cx - scale * 0.2, y: cy + scale * 0.15 },
  ]

  parts.push({
    commands: snoutCommands,
    fill: colors.body.light,
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 12,
  })

  return parts
}

export const generateOxCartoon = wrapFantasyGenerator(_generateOxCartoon, 'ox')
