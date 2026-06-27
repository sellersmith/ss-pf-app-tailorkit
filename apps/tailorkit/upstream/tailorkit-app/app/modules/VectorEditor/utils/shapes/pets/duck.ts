/**
 * Duck Shape Generator
 * Cute duck with orange beak and webbed feet
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateDuckCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Body (oval)
  const bodyCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.45, y: cy + scale * 0.1 },
    {
      type: 'C',
      x: cx,
      y: cy - scale * 0.15,
      cp1: { x: cx - scale * 0.45, y: cy - scale * 0.15 },
      cp2: { x: cx - scale * 0.2, y: cy - scale * 0.25 },
    },
    {
      type: 'C',
      x: cx + scale * 0.4,
      y: cy + scale * 0.1,
      cp1: { x: cx + scale * 0.2, y: cy - scale * 0.25 },
      cp2: { x: cx + scale * 0.4, y: cy - scale * 0.1 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + scale * 0.35,
      cp1: { x: cx + scale * 0.4, y: cy + scale * 0.3 },
      cp2: { x: cx + scale * 0.15, y: cy + scale * 0.35 },
    },
    {
      type: 'C',
      x: cx - scale * 0.45,
      y: cy + scale * 0.1,
      cp1: { x: cx - scale * 0.15, y: cy + scale * 0.35 },
      cp2: { x: cx - scale * 0.45, y: cy + scale * 0.3 },
    },
    { type: 'Z', x: cx - scale * 0.45, y: cy + scale * 0.1 },
  ]

  parts.push({
    commands: bodyCommands,
    fill: colors.feathers.yellow,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 10,
  })

  // Head
  parts.push({
    commands: generateCircle(cx - scale * 0.25, cy - scale * 0.2, scale * 0.22),
    fill: colors.feathers.yellow,
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 12,
  })

  // Beak (flat duck bill)
  const beakCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.35, y: cy - scale * 0.22 },
    {
      type: 'C',
      x: cx - scale * 0.65,
      y: cy - scale * 0.15,
      cp1: { x: cx - scale * 0.45, y: cy - scale * 0.28 },
      cp2: { x: cx - scale * 0.6, y: cy - scale * 0.22 },
    },
    {
      type: 'C',
      x: cx - scale * 0.35,
      y: cy - scale * 0.1,
      cp1: { x: cx - scale * 0.6, y: cy - scale * 0.08 },
      cp2: { x: cx - scale * 0.45, y: cy - scale * 0.05 },
    },
    { type: 'Z', x: cx - scale * 0.35, y: cy - scale * 0.22 },
  ]

  parts.push({
    commands: beakCommands,
    fill: '#FF9800', // Orange beak
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 15,
  })

  // Eye
  parts.push({
    commands: generateCircle(cx - scale * 0.18, cy - scale * 0.25, scale * 0.05),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 14,
  })

  // Eye highlight
  parts.push({
    commands: generateCircle(cx - scale * 0.2, cy - scale * 0.27, scale * 0.015),
    fill: colors.eyeHighlight,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  // Wing
  const wingCommands: PathCommand[] = [
    { type: 'M', x: cx, y: cy - scale * 0.05 },
    {
      type: 'C',
      x: cx + scale * 0.25,
      y: cy + scale * 0.2,
      cp1: { x: cx + scale * 0.2, y: cy - scale * 0.05 },
      cp2: { x: cx + scale * 0.3, y: cy + scale * 0.1 },
    },
    {
      type: 'C',
      x: cx - scale * 0.05,
      y: cy + scale * 0.15,
      cp1: { x: cx + scale * 0.15, y: cy + scale * 0.25 },
      cp2: { x: cx, y: cy + scale * 0.2 },
    },
    { type: 'Z', x: cx, y: cy - scale * 0.05 },
  ]

  parts.push({
    commands: wingCommands,
    fill: '#FDD835', // Slightly darker yellow
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 11,
  })

  // Left foot
  const leftFootCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.15, y: cy + scale * 0.32 },
    { type: 'L', x: cx - scale * 0.25, y: cy + scale * 0.5 },
    { type: 'L', x: cx - scale * 0.15, y: cy + scale * 0.45 },
    { type: 'L', x: cx - scale * 0.05, y: cy + scale * 0.5 },
    { type: 'L', x: cx - scale * 0.1, y: cy + scale * 0.32 },
    { type: 'Z', x: cx - scale * 0.15, y: cy + scale * 0.32 },
  ]

  parts.push({
    commands: leftFootCommands,
    fill: '#FF9800',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 8,
  })

  // Right foot
  const rightFootCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.1, y: cy + scale * 0.32 },
    { type: 'L', x: cx, y: cy + scale * 0.5 },
    { type: 'L', x: cx + scale * 0.1, y: cy + scale * 0.45 },
    { type: 'L', x: cx + scale * 0.2, y: cy + scale * 0.5 },
    { type: 'L', x: cx + scale * 0.15, y: cy + scale * 0.32 },
    { type: 'Z', x: cx + scale * 0.1, y: cy + scale * 0.32 },
  ]

  parts.push({
    commands: rightFootCommands,
    fill: '#FF9800',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 8,
  })

  // Tail feathers
  const tailCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.35, y: cy + scale * 0.05 },
    { type: 'L', x: cx + scale * 0.5, y: cy - scale * 0.05 },
    { type: 'L', x: cx + scale * 0.45, y: cy + scale * 0.1 },
    { type: 'L', x: cx + scale * 0.55, y: cy + scale * 0.15 },
    { type: 'L', x: cx + scale * 0.35, y: cy + scale * 0.15 },
    { type: 'Z', x: cx + scale * 0.35, y: cy + scale * 0.05 },
  ]

  parts.push({
    commands: tailCommands,
    fill: colors.feathers.yellow,
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 9,
  })

  return parts
}

export const generateDuckCartoon = wrapFantasyGenerator(_generateDuckCartoon, 'duck')
