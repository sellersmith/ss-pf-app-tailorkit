/**
 * Snake Shape Generator
 * Cute pet snake with coiled body
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateSnakeCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Coiled body (spiral path)
  const bodyCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.4, y: cy + scale * 0.3 },
    {
      type: 'C',
      x: cx - scale * 0.3,
      y: cy + scale * 0.35,
      cp1: { x: cx + scale * 0.2, y: cy + scale * 0.5 },
      cp2: { x: cx - scale * 0.15, y: cy + scale * 0.5 },
    },
    {
      type: 'C',
      x: cx - scale * 0.35,
      y: cy,
      cp1: { x: cx - scale * 0.5, y: cy + scale * 0.25 },
      cp2: { x: cx - scale * 0.5, y: cy + scale * 0.1 },
    },
    {
      type: 'C',
      x: cx + scale * 0.2,
      y: cy - scale * 0.1,
      cp1: { x: cx - scale * 0.3, y: cy - scale * 0.15 },
      cp2: { x: cx, y: cy - scale * 0.2 },
    },
    {
      type: 'C',
      x: cx + scale * 0.3,
      y: cy + scale * 0.15,
      cp1: { x: cx + scale * 0.35, y: cy - scale * 0.05 },
      cp2: { x: cx + scale * 0.4, y: cy + scale * 0.05 },
    },
  ]

  // Body outline (thick stroke for snake body)
  parts.push({
    commands: bodyCommands,
    fill: 'none',
    stroke: '#8BC34A', // Light green
    strokeWidth: scale * 0.18,
    zIndex: 8,
  })

  // Body pattern overlay
  parts.push({
    commands: bodyCommands,
    fill: 'none',
    stroke: '#689F38', // Darker green pattern
    strokeWidth: scale * 0.12,
    zIndex: 9,
  })

  // Belly (lighter center line)
  parts.push({
    commands: bodyCommands,
    fill: 'none',
    stroke: '#C5E1A5', // Light belly
    strokeWidth: scale * 0.06,
    zIndex: 10,
  })

  // Head
  const headCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.25, y: cy + scale * 0.1 },
    {
      type: 'C',
      x: cx + scale * 0.5,
      y: cy + scale * 0.05,
      cp1: { x: cx + scale * 0.35, y: cy + scale * 0.02 },
      cp2: { x: cx + scale * 0.45, y: cy },
    },
    {
      type: 'C',
      x: cx + scale * 0.5,
      y: cy + scale * 0.25,
      cp1: { x: cx + scale * 0.55, y: cy + scale * 0.1 },
      cp2: { x: cx + scale * 0.55, y: cy + scale * 0.2 },
    },
    {
      type: 'C',
      x: cx + scale * 0.25,
      y: cy + scale * 0.2,
      cp1: { x: cx + scale * 0.45, y: cy + scale * 0.3 },
      cp2: { x: cx + scale * 0.35, y: cy + scale * 0.28 },
    },
    { type: 'Z', x: cx + scale * 0.25, y: cy + scale * 0.1 },
  ]

  parts.push({
    commands: headCommands,
    fill: '#8BC34A',
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 12,
  })

  // Eye
  parts.push({
    commands: generateCircle(cx + scale * 0.42, cy + scale * 0.1, scale * 0.05),
    fill: '#FFEB3B', // Yellow eye
    stroke: colors.outline,
    strokeWidth: scale * 0.015,
    zIndex: 13,
  })

  // Pupil (vertical slit)
  const pupilCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.42, y: cy + scale * 0.06 },
    {
      type: 'C',
      x: cx + scale * 0.42,
      y: cy + scale * 0.14,
      cp1: { x: cx + scale * 0.4, y: cy + scale * 0.08 },
      cp2: { x: cx + scale * 0.4, y: cy + scale * 0.12 },
    },
    {
      type: 'C',
      x: cx + scale * 0.42,
      y: cy + scale * 0.06,
      cp1: { x: cx + scale * 0.44, y: cy + scale * 0.12 },
      cp2: { x: cx + scale * 0.44, y: cy + scale * 0.08 },
    },
    { type: 'Z', x: cx + scale * 0.42, y: cy + scale * 0.06 },
  ]

  parts.push({
    commands: pupilCommands,
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 14,
  })

  // Tongue (forked)
  const tongueCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.5, y: cy + scale * 0.15 },
    { type: 'L', x: cx + scale * 0.65, y: cy + scale * 0.12 },
    { type: 'L', x: cx + scale * 0.62, y: cy + scale * 0.15 },
    { type: 'L', x: cx + scale * 0.65, y: cy + scale * 0.18 },
    { type: 'L', x: cx + scale * 0.5, y: cy + scale * 0.15 },
  ]

  parts.push({
    commands: tongueCommands,
    fill: '#E91E63', // Pink tongue
    stroke: '#C2185B',
    strokeWidth: scale * 0.01,
    zIndex: 15,
  })

  // Tail tip
  const tailCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.35, y: cy + scale * 0.28 },
    {
      type: 'C',
      x: cx + scale * 0.5,
      y: cy + scale * 0.4,
      cp1: { x: cx + scale * 0.42, y: cy + scale * 0.32 },
      cp2: { x: cx + scale * 0.48, y: cy + scale * 0.38 },
    },
  ]

  parts.push({
    commands: tailCommands,
    fill: 'none',
    stroke: '#8BC34A',
    strokeWidth: scale * 0.1,
    zIndex: 7,
  })

  // Pattern spots on head
  parts.push({
    commands: generateCircle(cx + scale * 0.35, cy + scale * 0.08, scale * 0.02),
    fill: '#689F38',
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 12,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.38, cy + scale * 0.2, scale * 0.015),
    fill: '#689F38',
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 12,
  })

  return parts
}

export const generateSnakeCartoon = wrapFantasyGenerator(_generateSnakeCartoon, 'snake')
