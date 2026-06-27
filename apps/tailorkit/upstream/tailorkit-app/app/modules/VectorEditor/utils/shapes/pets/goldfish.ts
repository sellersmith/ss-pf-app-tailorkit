/**
 * Goldfish Shape Generator
 * Fancy goldfish with flowing fins and tail
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateGoldfishCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Body (round goldfish body)
  const bodyCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.35, y: cy },
    {
      type: 'C',
      x: cx,
      y: cy - scale * 0.35,
      cp1: { x: cx - scale * 0.35, y: cy - scale * 0.25 },
      cp2: { x: cx - scale * 0.15, y: cy - scale * 0.35 },
    },
    {
      type: 'C',
      x: cx + scale * 0.3,
      y: cy,
      cp1: { x: cx + scale * 0.15, y: cy - scale * 0.35 },
      cp2: { x: cx + scale * 0.3, y: cy - scale * 0.2 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + scale * 0.35,
      cp1: { x: cx + scale * 0.3, y: cy + scale * 0.2 },
      cp2: { x: cx + scale * 0.15, y: cy + scale * 0.35 },
    },
    {
      type: 'C',
      x: cx - scale * 0.35,
      y: cy,
      cp1: { x: cx - scale * 0.15, y: cy + scale * 0.35 },
      cp2: { x: cx - scale * 0.35, y: cy + scale * 0.25 },
    },
    { type: 'Z', x: cx - scale * 0.35, y: cy },
  ]

  parts.push({
    commands: bodyCommands,
    fill: '#FF8F00', // Golden orange
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 10,
  })

  // Flowing tail
  const tailCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.25, y: cy - scale * 0.1 },
    {
      type: 'C',
      x: cx + scale * 0.65,
      y: cy - scale * 0.3,
      cp1: { x: cx + scale * 0.4, y: cy - scale * 0.15 },
      cp2: { x: cx + scale * 0.55, y: cy - scale * 0.35 },
    },
    {
      type: 'C',
      x: cx + scale * 0.5,
      y: cy,
      cp1: { x: cx + scale * 0.65, y: cy - scale * 0.15 },
      cp2: { x: cx + scale * 0.55, y: cy },
    },
    {
      type: 'C',
      x: cx + scale * 0.65,
      y: cy + scale * 0.3,
      cp1: { x: cx + scale * 0.55, y: cy },
      cp2: { x: cx + scale * 0.65, y: cy + scale * 0.15 },
    },
    {
      type: 'C',
      x: cx + scale * 0.25,
      y: cy + scale * 0.1,
      cp1: { x: cx + scale * 0.55, y: cy + scale * 0.35 },
      cp2: { x: cx + scale * 0.4, y: cy + scale * 0.15 },
    },
    { type: 'Z', x: cx + scale * 0.25, y: cy - scale * 0.1 },
  ]

  parts.push({
    commands: tailCommands,
    fill: '#FFB74D', // Lighter orange
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 8,
  })

  // Dorsal fin
  const dorsalCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.1, y: cy - scale * 0.32 },
    {
      type: 'C',
      x: cx + scale * 0.15,
      y: cy - scale * 0.55,
      cp1: { x: cx, y: cy - scale * 0.45 },
      cp2: { x: cx + scale * 0.1, y: cy - scale * 0.55 },
    },
    {
      type: 'C',
      x: cx + scale * 0.2,
      y: cy - scale * 0.3,
      cp1: { x: cx + scale * 0.2, y: cy - scale * 0.5 },
      cp2: { x: cx + scale * 0.22, y: cy - scale * 0.35 },
    },
    { type: 'Z', x: cx - scale * 0.1, y: cy - scale * 0.32 },
  ]

  parts.push({
    commands: dorsalCommands,
    fill: '#FFB74D',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 11,
  })

  // Pectoral fin
  const pectoralCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.1, y: cy + scale * 0.1 },
    {
      type: 'C',
      x: cx - scale * 0.3,
      y: cy + scale * 0.35,
      cp1: { x: cx - scale * 0.2, y: cy + scale * 0.2 },
      cp2: { x: cx - scale * 0.3, y: cy + scale * 0.3 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + scale * 0.2,
      cp1: { x: cx - scale * 0.2, y: cy + scale * 0.35 },
      cp2: { x: cx - scale * 0.05, y: cy + scale * 0.25 },
    },
    { type: 'Z', x: cx - scale * 0.1, y: cy + scale * 0.1 },
  ]

  parts.push({
    commands: pectoralCommands,
    fill: '#FFB74D',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 9,
  })

  // Eye
  parts.push({
    commands: generateCircle(cx - scale * 0.15, cy - scale * 0.05, scale * 0.08),
    fill: '#FFFFFF',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 12,
  })

  // Pupil
  parts.push({
    commands: generateCircle(cx - scale * 0.15, cy - scale * 0.05, scale * 0.04),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 13,
  })

  // Eye highlight
  parts.push({
    commands: generateCircle(cx - scale * 0.17, cy - scale * 0.07, scale * 0.015),
    fill: colors.eyeHighlight,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 14,
  })

  // Mouth (small curved line)
  const mouthCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.32, y: cy + scale * 0.05 },
    {
      type: 'C',
      x: cx - scale * 0.28,
      y: cy + scale * 0.1,
      cp1: { x: cx - scale * 0.33, y: cy + scale * 0.08 },
      cp2: { x: cx - scale * 0.3, y: cy + scale * 0.1 },
    },
  ]

  parts.push({
    commands: mouthCommands,
    fill: 'none',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 11,
  })

  // Scale pattern hints (subtle curves on body)
  const scaleCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.05, y: cy - scale * 0.15 },
    {
      type: 'C',
      x: cx + scale * 0.1,
      y: cy - scale * 0.1,
      cp1: { x: cx, y: cy - scale * 0.1 },
      cp2: { x: cx + scale * 0.05, y: cy - scale * 0.08 },
    },
  ]

  parts.push({
    commands: scaleCommands,
    fill: 'none',
    stroke: '#E65100',
    strokeWidth: scale * 0.015,
    zIndex: 11,
  })

  return parts
}

export const generateGoldfishCartoon = wrapFantasyGenerator(_generateGoldfishCartoon, 'goldfish')
