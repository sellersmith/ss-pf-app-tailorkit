/**
 * Crab Shape Generator
 * Cute crab with claws and legs
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateCrabCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Body (wide oval)
  const bodyCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.45, y: cy },
    {
      type: 'C',
      x: cx,
      y: cy - scale * 0.25,
      cp1: { x: cx - scale * 0.45, y: cy - scale * 0.2 },
      cp2: { x: cx - scale * 0.2, y: cy - scale * 0.25 },
    },
    {
      type: 'C',
      x: cx + scale * 0.45,
      y: cy,
      cp1: { x: cx + scale * 0.2, y: cy - scale * 0.25 },
      cp2: { x: cx + scale * 0.45, y: cy - scale * 0.2 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + scale * 0.2,
      cp1: { x: cx + scale * 0.45, y: cy + scale * 0.15 },
      cp2: { x: cx + scale * 0.2, y: cy + scale * 0.2 },
    },
    {
      type: 'C',
      x: cx - scale * 0.45,
      y: cy,
      cp1: { x: cx - scale * 0.2, y: cy + scale * 0.2 },
      cp2: { x: cx - scale * 0.45, y: cy + scale * 0.15 },
    },
    { type: 'Z', x: cx - scale * 0.45, y: cy },
  ]

  parts.push({
    commands: bodyCommands,
    fill: '#E53935', // Red
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 10,
  })

  // Left eye stalk
  const leftEyeStalkCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.15, y: cy - scale * 0.2 },
    { type: 'L', x: cx - scale * 0.2, y: cy - scale * 0.4 },
    { type: 'L', x: cx - scale * 0.12, y: cy - scale * 0.4 },
    { type: 'L', x: cx - scale * 0.1, y: cy - scale * 0.2 },
    { type: 'Z', x: cx - scale * 0.15, y: cy - scale * 0.2 },
  ]

  parts.push({
    commands: leftEyeStalkCommands,
    fill: '#E53935',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 11,
  })

  // Right eye stalk
  const rightEyeStalkCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.15, y: cy - scale * 0.2 },
    { type: 'L', x: cx + scale * 0.2, y: cy - scale * 0.4 },
    { type: 'L', x: cx + scale * 0.12, y: cy - scale * 0.4 },
    { type: 'L', x: cx + scale * 0.1, y: cy - scale * 0.2 },
    { type: 'Z', x: cx + scale * 0.15, y: cy - scale * 0.2 },
  ]

  parts.push({
    commands: rightEyeStalkCommands,
    fill: '#E53935',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 11,
  })

  // Left eye
  parts.push({
    commands: generateCircle(cx - scale * 0.16, cy - scale * 0.45, scale * 0.06),
    fill: '#FFFFFF',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 12,
  })

  // Right eye
  parts.push({
    commands: generateCircle(cx + scale * 0.16, cy - scale * 0.45, scale * 0.06),
    fill: '#FFFFFF',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 12,
  })

  // Left pupil
  parts.push({
    commands: generateCircle(cx - scale * 0.16, cy - scale * 0.45, scale * 0.03),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 13,
  })

  // Right pupil
  parts.push({
    commands: generateCircle(cx + scale * 0.16, cy - scale * 0.45, scale * 0.03),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 13,
  })

  // Left claw arm
  const leftArmCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.4, y: cy - scale * 0.1 },
    { type: 'L', x: cx - scale * 0.6, y: cy - scale * 0.25 },
    { type: 'L', x: cx - scale * 0.55, y: cy - scale * 0.15 },
    { type: 'L', x: cx - scale * 0.4, y: cy },
    { type: 'Z', x: cx - scale * 0.4, y: cy - scale * 0.1 },
  ]

  parts.push({
    commands: leftArmCommands,
    fill: '#EF5350',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 9,
  })

  // Left claw
  const leftClawCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.6, y: cy - scale * 0.25 },
    { type: 'L', x: cx - scale * 0.8, y: cy - scale * 0.35 },
    { type: 'L', x: cx - scale * 0.65, y: cy - scale * 0.25 },
    { type: 'L', x: cx - scale * 0.75, y: cy - scale * 0.15 },
    { type: 'L', x: cx - scale * 0.55, y: cy - scale * 0.15 },
    { type: 'Z', x: cx - scale * 0.6, y: cy - scale * 0.25 },
  ]

  parts.push({
    commands: leftClawCommands,
    fill: '#EF5350',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 8,
  })

  // Right claw arm
  const rightArmCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.4, y: cy - scale * 0.1 },
    { type: 'L', x: cx + scale * 0.6, y: cy - scale * 0.25 },
    { type: 'L', x: cx + scale * 0.55, y: cy - scale * 0.15 },
    { type: 'L', x: cx + scale * 0.4, y: cy },
    { type: 'Z', x: cx + scale * 0.4, y: cy - scale * 0.1 },
  ]

  parts.push({
    commands: rightArmCommands,
    fill: '#EF5350',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 9,
  })

  // Right claw
  const rightClawCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.6, y: cy - scale * 0.25 },
    { type: 'L', x: cx + scale * 0.8, y: cy - scale * 0.35 },
    { type: 'L', x: cx + scale * 0.65, y: cy - scale * 0.25 },
    { type: 'L', x: cx + scale * 0.75, y: cy - scale * 0.15 },
    { type: 'L', x: cx + scale * 0.55, y: cy - scale * 0.15 },
    { type: 'Z', x: cx + scale * 0.6, y: cy - scale * 0.25 },
  ]

  parts.push({
    commands: rightClawCommands,
    fill: '#EF5350',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 8,
  })

  // Legs (3 on each side)
  const legPositions = [
    { x: -0.35, y: 0.05, angle: -20 },
    { x: -0.4, y: 0.12, angle: 0 },
    { x: -0.35, y: 0.18, angle: 20 },
  ]

  legPositions.forEach(pos => {
    // Left leg
    const leftLegCommands: PathCommand[] = [
      { type: 'M', x: cx + pos.x * scale, y: cy + pos.y * scale },
      { type: 'L', x: cx + (pos.x - 0.25) * scale, y: cy + (pos.y + 0.15) * scale },
      { type: 'L', x: cx + (pos.x - 0.3) * scale, y: cy + (pos.y + 0.25) * scale },
    ]

    parts.push({
      commands: leftLegCommands,
      fill: 'none',
      stroke: '#E53935',
      strokeWidth: scale * 0.04,
      zIndex: 7,
    })

    // Right leg (mirror)
    const rightLegCommands: PathCommand[] = [
      { type: 'M', x: cx - pos.x * scale, y: cy + pos.y * scale },
      { type: 'L', x: cx - (pos.x - 0.25) * scale, y: cy + (pos.y + 0.15) * scale },
      { type: 'L', x: cx - (pos.x - 0.3) * scale, y: cy + (pos.y + 0.25) * scale },
    ]

    parts.push({
      commands: rightLegCommands,
      fill: 'none',
      stroke: '#E53935',
      strokeWidth: scale * 0.04,
      zIndex: 7,
    })
  })

  // Smile
  const smileCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.1, y: cy + scale * 0.05 },
    {
      type: 'C',
      x: cx + scale * 0.1,
      y: cy + scale * 0.05,
      cp1: { x: cx - scale * 0.05, y: cy + scale * 0.12 },
      cp2: { x: cx + scale * 0.05, y: cy + scale * 0.12 },
    },
  ]

  parts.push({
    commands: smileCommands,
    fill: 'none',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 11,
  })

  return parts
}

export const generateCrabCartoon = wrapFantasyGenerator(_generateCrabCartoon, 'crab')
