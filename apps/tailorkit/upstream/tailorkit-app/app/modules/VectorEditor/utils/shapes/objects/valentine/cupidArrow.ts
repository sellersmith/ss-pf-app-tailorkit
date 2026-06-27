/**
 * Cupid Arrow Shape Generator
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { VALENTINE_COLORS } from './colors'

/**
 * Generate cupid's arrow shape
 */
export function generateCupidArrow(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = VALENTINE_COLORS.cupidArrow
  const w = width
  const h = height

  // Arrow shaft
  const shaft: PathCommand[] = [
    { type: 'M', x: cx - w * 0.4, y: cy - h * 0.02 },
    { type: 'L', x: cx + w * 0.3, y: cy - h * 0.02 },
    { type: 'L', x: cx + w * 0.3, y: cy + h * 0.02 },
    { type: 'L', x: cx - w * 0.4, y: cy + h * 0.02 },
    { type: 'Z', x: cx - w * 0.4, y: cy - h * 0.02 },
  ]

  // Arrow head (heart shape rotated 90 degrees to point right)
  // Heart pointing right: tip at right, lobes at left
  // Position the heart so its left edge (lobes) touches the shaft end
  const headCx = cx + w * 0.32
  const headW = w * 0.22
  const headH = h * 0.32
  const hw = headW / 2
  const hh = headH / 2
  const topOffset = hh * 0.3

  const arrowHead: PathCommand[] = [
    { type: 'M', x: headCx + hw, y: cy }, // Right tip (was bottom)
    {
      type: 'C',
      x: headCx - topOffset,
      y: cy - hh,
      cp1: { x: headCx + hw * 0.3, y: cy - hh },
      cp2: { x: headCx, y: cy - hh },
    },
    {
      type: 'C',
      x: headCx - hw * 0.2,
      y: cy,
      cp1: { x: headCx - hh * 0.6, y: cy - hh },
      cp2: { x: headCx - hh * 0.5, y: cy - hh * 0.3 },
    },
    {
      type: 'C',
      x: headCx - topOffset,
      y: cy + hh,
      cp1: { x: headCx - hh * 0.5, y: cy + hh * 0.3 },
      cp2: { x: headCx - hh * 0.6, y: cy + hh },
    },
    {
      type: 'C',
      x: headCx + hw,
      y: cy,
      cp1: { x: headCx, y: cy + hh },
      cp2: { x: headCx + hw * 0.3, y: cy + hh },
    },
    { type: 'Z', x: headCx + hw, y: cy },
  ]

  // Feather left
  const featherL: PathCommand[] = [
    { type: 'M', x: cx - w * 0.4, y: cy },
    {
      type: 'C',
      x: cx - w * 0.5,
      y: cy - h * 0.2,
      cp1: { x: cx - w * 0.42, y: cy - h * 0.08 },
      cp2: { x: cx - w * 0.48, y: cy - h * 0.15 },
    },
    { type: 'L', x: cx - w * 0.45, y: cy },
    { type: 'Z', x: cx - w * 0.4, y: cy },
  ]

  // Feather right
  const featherR: PathCommand[] = [
    { type: 'M', x: cx - w * 0.4, y: cy },
    {
      type: 'C',
      x: cx - w * 0.5,
      y: cy + h * 0.2,
      cp1: { x: cx - w * 0.42, y: cy + h * 0.08 },
      cp2: { x: cx - w * 0.48, y: cy + h * 0.15 },
    },
    { type: 'L', x: cx - w * 0.45, y: cy },
    { type: 'Z', x: cx - w * 0.4, y: cy },
  ]

  return [
    {
      id: 'arrow-shaft',
      name: 'Shaft',
      commands: shaft,
      fill: colors.shaft,
      stroke: colors.shaftStroke,
      strokeWidth: 0.5,
      zIndex: 0,
    },
    {
      id: 'arrow-head',
      name: 'Arrow Head',
      commands: arrowHead,
      fill: colors.head,
      stroke: colors.headStroke,
      strokeWidth: 0.5,
      zIndex: 1,
    },
    {
      id: 'arrow-feather-l',
      name: 'Feather Left',
      commands: featherL,
      fill: colors.feather,
      stroke: colors.featherStroke,
      strokeWidth: 0.3,
      zIndex: 1,
    },
    {
      id: 'arrow-feather-r',
      name: 'Feather Right',
      commands: featherR,
      fill: colors.feather,
      stroke: colors.featherStroke,
      strokeWidth: 0.3,
      zIndex: 1,
    },
  ]
}
