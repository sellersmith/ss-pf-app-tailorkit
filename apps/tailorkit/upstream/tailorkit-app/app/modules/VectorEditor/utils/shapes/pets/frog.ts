/**
 * Frog Shape Generator
 * Cute frog with big eyes and webbed feet
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateFrogCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Body
  const bodyCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.4, y: cy },
    {
      type: 'C',
      x: cx,
      y: cy - scale * 0.25,
      cp1: { x: cx - scale * 0.4, y: cy - scale * 0.2 },
      cp2: { x: cx - scale * 0.2, y: cy - scale * 0.25 },
    },
    {
      type: 'C',
      x: cx + scale * 0.4,
      y: cy,
      cp1: { x: cx + scale * 0.2, y: cy - scale * 0.25 },
      cp2: { x: cx + scale * 0.4, y: cy - scale * 0.2 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + scale * 0.35,
      cp1: { x: cx + scale * 0.4, y: cy + scale * 0.25 },
      cp2: { x: cx + scale * 0.2, y: cy + scale * 0.35 },
    },
    {
      type: 'C',
      x: cx - scale * 0.4,
      y: cy,
      cp1: { x: cx - scale * 0.2, y: cy + scale * 0.35 },
      cp2: { x: cx - scale * 0.4, y: cy + scale * 0.25 },
    },
    { type: 'Z', x: cx - scale * 0.4, y: cy },
  ]

  parts.push({
    commands: bodyCommands,
    fill: '#4CAF50', // Green
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 10,
  })

  // Belly (lighter)
  const bellyCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.25, y: cy + scale * 0.05 },
    {
      type: 'C',
      x: cx,
      y: cy + scale * 0.28,
      cp1: { x: cx - scale * 0.25, y: cy + scale * 0.2 },
      cp2: { x: cx - scale * 0.1, y: cy + scale * 0.28 },
    },
    {
      type: 'C',
      x: cx + scale * 0.25,
      y: cy + scale * 0.05,
      cp1: { x: cx + scale * 0.1, y: cy + scale * 0.28 },
      cp2: { x: cx + scale * 0.25, y: cy + scale * 0.2 },
    },
    {
      type: 'C',
      x: cx - scale * 0.25,
      y: cy + scale * 0.05,
      cp1: { x: cx + scale * 0.15, y: cy },
      cp2: { x: cx - scale * 0.15, y: cy },
    },
    { type: 'Z', x: cx - scale * 0.25, y: cy + scale * 0.05 },
  ]

  parts.push({
    commands: bellyCommands,
    fill: '#C8E6C9', // Light green belly
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 11,
  })

  // Left eye bump
  parts.push({
    commands: generateCircle(cx - scale * 0.2, cy - scale * 0.35, scale * 0.15),
    fill: '#4CAF50',
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 12,
  })

  // Right eye bump
  parts.push({
    commands: generateCircle(cx + scale * 0.2, cy - scale * 0.35, scale * 0.15),
    fill: '#4CAF50',
    stroke: colors.outline,
    strokeWidth: scale * 0.03,
    zIndex: 12,
  })

  // Left eye (white)
  parts.push({
    commands: generateCircle(cx - scale * 0.2, cy - scale * 0.38, scale * 0.1),
    fill: '#FFFFFF',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 13,
  })

  // Right eye (white)
  parts.push({
    commands: generateCircle(cx + scale * 0.2, cy - scale * 0.38, scale * 0.1),
    fill: '#FFFFFF',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 13,
  })

  // Left pupil
  parts.push({
    commands: generateCircle(cx - scale * 0.2, cy - scale * 0.38, scale * 0.05),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 14,
  })

  // Right pupil
  parts.push({
    commands: generateCircle(cx + scale * 0.2, cy - scale * 0.38, scale * 0.05),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 14,
  })

  // Left eye highlight
  parts.push({
    commands: generateCircle(cx - scale * 0.22, cy - scale * 0.4, scale * 0.02),
    fill: colors.eyeHighlight,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  // Right eye highlight
  parts.push({
    commands: generateCircle(cx + scale * 0.18, cy - scale * 0.4, scale * 0.02),
    fill: colors.eyeHighlight,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  // Mouth (wide smile)
  const mouthCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.2, y: cy + scale * 0.05 },
    {
      type: 'C',
      x: cx + scale * 0.2,
      y: cy + scale * 0.05,
      cp1: { x: cx - scale * 0.1, y: cy + scale * 0.15 },
      cp2: { x: cx + scale * 0.1, y: cy + scale * 0.15 },
    },
  ]

  parts.push({
    commands: mouthCommands,
    fill: 'none',
    stroke: colors.outline,
    strokeWidth: scale * 0.025,
    zIndex: 12,
  })

  // Left front leg
  const leftFrontLegCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.35, y: cy + scale * 0.1 },
    { type: 'L', x: cx - scale * 0.5, y: cy + scale * 0.35 },
    { type: 'L', x: cx - scale * 0.6, y: cy + scale * 0.32 },
    { type: 'L', x: cx - scale * 0.5, y: cy + scale * 0.38 },
    { type: 'L', x: cx - scale * 0.55, y: cy + scale * 0.45 },
    { type: 'L', x: cx - scale * 0.45, y: cy + scale * 0.4 },
    { type: 'L', x: cx - scale * 0.4, y: cy + scale * 0.48 },
    { type: 'L', x: cx - scale * 0.38, y: cy + scale * 0.38 },
    { type: 'L', x: cx - scale * 0.3, y: cy + scale * 0.2 },
  ]

  parts.push({
    commands: leftFrontLegCommands,
    fill: '#4CAF50',
    stroke: colors.outline,
    strokeWidth: scale * 0.025,
    zIndex: 9,
  })

  // Right front leg
  const rightFrontLegCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.35, y: cy + scale * 0.1 },
    { type: 'L', x: cx + scale * 0.5, y: cy + scale * 0.35 },
    { type: 'L', x: cx + scale * 0.6, y: cy + scale * 0.32 },
    { type: 'L', x: cx + scale * 0.5, y: cy + scale * 0.38 },
    { type: 'L', x: cx + scale * 0.55, y: cy + scale * 0.45 },
    { type: 'L', x: cx + scale * 0.45, y: cy + scale * 0.4 },
    { type: 'L', x: cx + scale * 0.4, y: cy + scale * 0.48 },
    { type: 'L', x: cx + scale * 0.38, y: cy + scale * 0.38 },
    { type: 'L', x: cx + scale * 0.3, y: cy + scale * 0.2 },
  ]

  parts.push({
    commands: rightFrontLegCommands,
    fill: '#4CAF50',
    stroke: colors.outline,
    strokeWidth: scale * 0.025,
    zIndex: 9,
  })

  // Left back leg (folded)
  const leftBackLegCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.3, y: cy + scale * 0.2 },
    {
      type: 'C',
      x: cx - scale * 0.55,
      y: cy + scale * 0.15,
      cp1: { x: cx - scale * 0.4, y: cy + scale * 0.25 },
      cp2: { x: cx - scale * 0.5, y: cy + scale * 0.22 },
    },
    {
      type: 'C',
      x: cx - scale * 0.45,
      y: cy + scale * 0.05,
      cp1: { x: cx - scale * 0.6, y: cy + scale * 0.1 },
      cp2: { x: cx - scale * 0.55, y: cy + scale * 0.05 },
    },
  ]

  parts.push({
    commands: leftBackLegCommands,
    fill: 'none',
    stroke: '#4CAF50',
    strokeWidth: scale * 0.1,
    zIndex: 8,
  })

  // Right back leg (folded)
  const rightBackLegCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.3, y: cy + scale * 0.2 },
    {
      type: 'C',
      x: cx + scale * 0.55,
      y: cy + scale * 0.15,
      cp1: { x: cx + scale * 0.4, y: cy + scale * 0.25 },
      cp2: { x: cx + scale * 0.5, y: cy + scale * 0.22 },
    },
    {
      type: 'C',
      x: cx + scale * 0.45,
      y: cy + scale * 0.05,
      cp1: { x: cx + scale * 0.6, y: cy + scale * 0.1 },
      cp2: { x: cx + scale * 0.55, y: cy + scale * 0.05 },
    },
  ]

  parts.push({
    commands: rightBackLegCommands,
    fill: 'none',
    stroke: '#4CAF50',
    strokeWidth: scale * 0.1,
    zIndex: 8,
  })

  // Spots on body
  parts.push({
    commands: generateCircle(cx - scale * 0.15, cy - scale * 0.05, scale * 0.04),
    fill: '#388E3C',
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 11,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.1, cy + scale * 0.02, scale * 0.03),
    fill: '#388E3C',
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 11,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.25, cy - scale * 0.08, scale * 0.025),
    fill: '#388E3C',
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 11,
  })

  return parts
}

export const generateFrogCartoon = wrapFantasyGenerator(_generateFrogCartoon, 'frog')
