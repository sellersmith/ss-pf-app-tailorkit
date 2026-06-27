/**
 * Lizard Shape Generator
 * Gecko-like lizard with big eyes and curved tail
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateLizardCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Body
  const bodyCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.3, y: cy },
    {
      type: 'C',
      x: cx,
      y: cy - scale * 0.15,
      cp1: { x: cx - scale * 0.3, y: cy - scale * 0.12 },
      cp2: { x: cx - scale * 0.15, y: cy - scale * 0.15 },
    },
    {
      type: 'C',
      x: cx + scale * 0.25,
      y: cy,
      cp1: { x: cx + scale * 0.15, y: cy - scale * 0.15 },
      cp2: { x: cx + scale * 0.25, y: cy - scale * 0.1 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + scale * 0.12,
      cp1: { x: cx + scale * 0.25, y: cy + scale * 0.08 },
      cp2: { x: cx + scale * 0.15, y: cy + scale * 0.12 },
    },
    {
      type: 'C',
      x: cx - scale * 0.3,
      y: cy,
      cp1: { x: cx - scale * 0.15, y: cy + scale * 0.12 },
      cp2: { x: cx - scale * 0.3, y: cy + scale * 0.1 },
    },
    { type: 'Z', x: cx - scale * 0.3, y: cy },
  ]

  parts.push({
    commands: bodyCommands,
    fill: '#4CAF50', // Green
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 10,
  })

  // Head
  const headCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.25, y: cy - scale * 0.05 },
    {
      type: 'C',
      x: cx - scale * 0.5,
      y: cy - scale * 0.1,
      cp1: { x: cx - scale * 0.35, y: cy - scale * 0.15 },
      cp2: { x: cx - scale * 0.45, y: cy - scale * 0.15 },
    },
    {
      type: 'C',
      x: cx - scale * 0.5,
      y: cy + scale * 0.1,
      cp1: { x: cx - scale * 0.55, y: cy - scale * 0.05 },
      cp2: { x: cx - scale * 0.55, y: cy + scale * 0.05 },
    },
    {
      type: 'C',
      x: cx - scale * 0.25,
      y: cy + scale * 0.05,
      cp1: { x: cx - scale * 0.45, y: cy + scale * 0.15 },
      cp2: { x: cx - scale * 0.35, y: cy + scale * 0.12 },
    },
    { type: 'Z', x: cx - scale * 0.25, y: cy - scale * 0.05 },
  ]

  parts.push({
    commands: headCommands,
    fill: '#4CAF50',
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 11,
  })

  // Left eye
  parts.push({
    commands: generateCircle(cx - scale * 0.42, cy - scale * 0.05, scale * 0.08),
    fill: '#FFEB3B', // Yellow eye
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 12,
  })

  // Left pupil (vertical slit)
  const leftPupilCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.42, y: cy - scale * 0.1 },
    {
      type: 'C',
      x: cx - scale * 0.42,
      y: cy,
      cp1: { x: cx - scale * 0.45, y: cy - scale * 0.07 },
      cp2: { x: cx - scale * 0.45, y: cy - scale * 0.03 },
    },
    {
      type: 'C',
      x: cx - scale * 0.42,
      y: cy - scale * 0.1,
      cp1: { x: cx - scale * 0.39, y: cy - scale * 0.03 },
      cp2: { x: cx - scale * 0.39, y: cy - scale * 0.07 },
    },
    { type: 'Z', x: cx - scale * 0.42, y: cy - scale * 0.1 },
  ]

  parts.push({
    commands: leftPupilCommands,
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 13,
  })

  // Tail (curved)
  const tailCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.2, y: cy - scale * 0.05 },
    {
      type: 'C',
      x: cx + scale * 0.7,
      y: cy + scale * 0.3,
      cp1: { x: cx + scale * 0.4, y: cy },
      cp2: { x: cx + scale * 0.6, y: cy + scale * 0.15 },
    },
    {
      type: 'C',
      x: cx + scale * 0.55,
      y: cy + scale * 0.45,
      cp1: { x: cx + scale * 0.75, y: cy + scale * 0.4 },
      cp2: { x: cx + scale * 0.65, y: cy + scale * 0.5 },
    },
    {
      type: 'C',
      x: cx + scale * 0.2,
      y: cy + scale * 0.05,
      cp1: { x: cx + scale * 0.45, y: cy + scale * 0.35 },
      cp2: { x: cx + scale * 0.3, y: cy + scale * 0.1 },
    },
    { type: 'Z', x: cx + scale * 0.2, y: cy - scale * 0.05 },
  ]

  parts.push({
    commands: tailCommands,
    fill: '#66BB6A',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 8,
  })

  // Front left leg
  const frontLeftLegCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.2, y: cy + scale * 0.08 },
    { type: 'L', x: cx - scale * 0.35, y: cy + scale * 0.25 },
    { type: 'L', x: cx - scale * 0.45, y: cy + scale * 0.22 },
    { type: 'L', x: cx - scale * 0.35, y: cy + scale * 0.28 },
    { type: 'L', x: cx - scale * 0.4, y: cy + scale * 0.35 },
    { type: 'L', x: cx - scale * 0.3, y: cy + scale * 0.28 },
    { type: 'L', x: cx - scale * 0.25, y: cy + scale * 0.35 },
    { type: 'L', x: cx - scale * 0.25, y: cy + scale * 0.25 },
  ]

  parts.push({
    commands: frontLeftLegCommands,
    fill: 'none',
    stroke: '#4CAF50',
    strokeWidth: scale * 0.05,
    zIndex: 9,
  })

  // Front right leg
  const frontRightLegCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.2, y: cy - scale * 0.08 },
    { type: 'L', x: cx - scale * 0.35, y: cy - scale * 0.25 },
    { type: 'L', x: cx - scale * 0.45, y: cy - scale * 0.22 },
    { type: 'L', x: cx - scale * 0.35, y: cy - scale * 0.28 },
    { type: 'L', x: cx - scale * 0.4, y: cy - scale * 0.35 },
    { type: 'L', x: cx - scale * 0.3, y: cy - scale * 0.28 },
    { type: 'L', x: cx - scale * 0.25, y: cy - scale * 0.35 },
    { type: 'L', x: cx - scale * 0.25, y: cy - scale * 0.25 },
  ]

  parts.push({
    commands: frontRightLegCommands,
    fill: 'none',
    stroke: '#4CAF50',
    strokeWidth: scale * 0.05,
    zIndex: 9,
  })

  // Back left leg
  const backLeftLegCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.15, y: cy + scale * 0.08 },
    { type: 'L', x: cx + scale * 0.1, y: cy + scale * 0.3 },
    { type: 'L', x: cx, y: cy + scale * 0.28 },
    { type: 'L', x: cx + scale * 0.08, y: cy + scale * 0.35 },
    { type: 'L', x: cx + scale * 0.15, y: cy + scale * 0.4 },
    { type: 'L', x: cx + scale * 0.18, y: cy + scale * 0.32 },
    { type: 'L', x: cx + scale * 0.25, y: cy + scale * 0.38 },
    { type: 'L', x: cx + scale * 0.2, y: cy + scale * 0.28 },
  ]

  parts.push({
    commands: backLeftLegCommands,
    fill: 'none',
    stroke: '#4CAF50',
    strokeWidth: scale * 0.05,
    zIndex: 9,
  })

  // Back right leg
  const backRightLegCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.15, y: cy - scale * 0.08 },
    { type: 'L', x: cx + scale * 0.1, y: cy - scale * 0.3 },
    { type: 'L', x: cx, y: cy - scale * 0.28 },
    { type: 'L', x: cx + scale * 0.08, y: cy - scale * 0.35 },
    { type: 'L', x: cx + scale * 0.15, y: cy - scale * 0.4 },
    { type: 'L', x: cx + scale * 0.18, y: cy - scale * 0.32 },
    { type: 'L', x: cx + scale * 0.25, y: cy - scale * 0.38 },
    { type: 'L', x: cx + scale * 0.2, y: cy - scale * 0.28 },
  ]

  parts.push({
    commands: backRightLegCommands,
    fill: 'none',
    stroke: '#4CAF50',
    strokeWidth: scale * 0.05,
    zIndex: 9,
  })

  // Belly spots
  parts.push({
    commands: generateCircle(cx - scale * 0.05, cy, scale * 0.03),
    fill: '#81C784',
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 11,
  })

  parts.push({
    commands: generateCircle(cx + scale * 0.1, cy - scale * 0.03, scale * 0.025),
    fill: '#81C784',
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 11,
  })

  return parts
}

export const generateLizardCartoon = wrapFantasyGenerator(_generateLizardCartoon, 'lizard')
