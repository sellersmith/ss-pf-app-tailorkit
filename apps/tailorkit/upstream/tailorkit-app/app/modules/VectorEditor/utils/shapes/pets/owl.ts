/**
 * Owl Shape Generator
 * Wise owl with large eyes and ear tufts
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateOwlCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Body (round owl body)
  const bodyCommands: PathCommand[] = [
    { type: 'M', x: cx, y: cy - scale * 0.4 },
    {
      type: 'C',
      x: cx + scale * 0.4,
      y: cy + scale * 0.1,
      cp1: { x: cx + scale * 0.45, y: cy - scale * 0.35 },
      cp2: { x: cx + scale * 0.5, y: cy - scale * 0.1 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + scale * 0.5,
      cp1: { x: cx + scale * 0.45, y: cy + scale * 0.35 },
      cp2: { x: cx + scale * 0.2, y: cy + scale * 0.5 },
    },
    {
      type: 'C',
      x: cx - scale * 0.4,
      y: cy + scale * 0.1,
      cp1: { x: cx - scale * 0.2, y: cy + scale * 0.5 },
      cp2: { x: cx - scale * 0.45, y: cy + scale * 0.35 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - scale * 0.4,
      cp1: { x: cx - scale * 0.5, y: cy - scale * 0.1 },
      cp2: { x: cx - scale * 0.45, y: cy - scale * 0.35 },
    },
    { type: 'Z', x: cx, y: cy - scale * 0.4 },
  ]

  parts.push({
    commands: bodyCommands,
    fill: '#8D6E63', // Brown body
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 10,
  })

  // Belly (lighter)
  const bellyCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.25, y: cy },
    {
      type: 'C',
      x: cx,
      y: cy + scale * 0.4,
      cp1: { x: cx - scale * 0.3, y: cy + scale * 0.25 },
      cp2: { x: cx - scale * 0.15, y: cy + scale * 0.4 },
    },
    {
      type: 'C',
      x: cx + scale * 0.25,
      y: cy,
      cp1: { x: cx + scale * 0.15, y: cy + scale * 0.4 },
      cp2: { x: cx + scale * 0.3, y: cy + scale * 0.25 },
    },
    {
      type: 'C',
      x: cx - scale * 0.25,
      y: cy,
      cp1: { x: cx + scale * 0.15, y: cy - scale * 0.1 },
      cp2: { x: cx - scale * 0.15, y: cy - scale * 0.1 },
    },
    { type: 'Z', x: cx - scale * 0.25, y: cy },
  ]

  parts.push({
    commands: bellyCommands,
    fill: '#D7CCC8', // Light belly
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 11,
  })

  // Left ear tuft
  const leftEarCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.25, y: cy - scale * 0.35 },
    { type: 'L', x: cx - scale * 0.35, y: cy - scale * 0.6 },
    { type: 'L', x: cx - scale * 0.15, y: cy - scale * 0.4 },
    { type: 'Z', x: cx - scale * 0.25, y: cy - scale * 0.35 },
  ]

  parts.push({
    commands: leftEarCommands,
    fill: '#8D6E63',
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 9,
  })

  // Right ear tuft
  const rightEarCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.25, y: cy - scale * 0.35 },
    { type: 'L', x: cx + scale * 0.35, y: cy - scale * 0.6 },
    { type: 'L', x: cx + scale * 0.15, y: cy - scale * 0.4 },
    { type: 'Z', x: cx + scale * 0.25, y: cy - scale * 0.35 },
  ]

  parts.push({
    commands: rightEarCommands,
    fill: '#8D6E63',
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 9,
  })

  // Left eye circle (white)
  parts.push({
    commands: generateCircle(cx - scale * 0.15, cy - scale * 0.15, scale * 0.15),
    fill: '#FFFFFF',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 12,
  })

  // Right eye circle (white)
  parts.push({
    commands: generateCircle(cx + scale * 0.15, cy - scale * 0.15, scale * 0.15),
    fill: '#FFFFFF',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 12,
  })

  // Left pupil
  parts.push({
    commands: generateCircle(cx - scale * 0.15, cy - scale * 0.15, scale * 0.08),
    fill: '#FF8F00', // Amber eye
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 13,
  })

  // Right pupil
  parts.push({
    commands: generateCircle(cx + scale * 0.15, cy - scale * 0.15, scale * 0.08),
    fill: '#FF8F00',
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 13,
  })

  // Left pupil center
  parts.push({
    commands: generateCircle(cx - scale * 0.15, cy - scale * 0.15, scale * 0.04),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 14,
  })

  // Right pupil center
  parts.push({
    commands: generateCircle(cx + scale * 0.15, cy - scale * 0.15, scale * 0.04),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 14,
  })

  // Left eye highlight
  parts.push({
    commands: generateCircle(cx - scale * 0.17, cy - scale * 0.17, scale * 0.02),
    fill: colors.eyeHighlight,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  // Right eye highlight
  parts.push({
    commands: generateCircle(cx + scale * 0.13, cy - scale * 0.17, scale * 0.02),
    fill: colors.eyeHighlight,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  // Beak
  const beakCommands: PathCommand[] = [
    { type: 'M', x: cx, y: cy - scale * 0.05 },
    { type: 'L', x: cx + scale * 0.08, y: cy + scale * 0.12 },
    { type: 'L', x: cx - scale * 0.08, y: cy + scale * 0.12 },
    { type: 'Z', x: cx, y: cy - scale * 0.05 },
  ]

  parts.push({
    commands: beakCommands,
    fill: '#FFA726', // Orange beak
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 15,
  })

  return parts
}

export const generateOwlCartoon = wrapFantasyGenerator(_generateOwlCartoon, 'owl')
