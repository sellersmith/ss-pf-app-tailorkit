/**
 * Wedding Cake Shape Generator
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { WEDDING_COLORS } from './colors'

/**
 * Generate wedding cake shape (3-tier)
 */
export function generateWeddingCake(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = WEDDING_COLORS.cake
  const w = width
  const h = height

  // Bottom tier
  const bottomTier: PathCommand[] = [
    { type: 'M', x: cx - w * 0.45, y: cy + h * 0.2 },
    { type: 'L', x: cx + w * 0.45, y: cy + h * 0.2 },
    { type: 'L', x: cx + w * 0.45, y: cy + h * 0.45 },
    {
      type: 'C',
      x: cx - w * 0.45,
      y: cy + h * 0.45,
      cp1: { x: cx + w * 0.2, y: cy + h * 0.48 },
      cp2: { x: cx - w * 0.2, y: cy + h * 0.48 },
    },
    { type: 'Z', x: cx - w * 0.45, y: cy + h * 0.2 },
  ]

  // Middle tier
  const middleTier: PathCommand[] = [
    { type: 'M', x: cx - w * 0.32, y: cy - h * 0.05 },
    { type: 'L', x: cx + w * 0.32, y: cy - h * 0.05 },
    { type: 'L', x: cx + w * 0.32, y: cy + h * 0.2 },
    { type: 'L', x: cx - w * 0.32, y: cy + h * 0.2 },
    { type: 'Z', x: cx - w * 0.32, y: cy - h * 0.05 },
  ]

  // Top tier
  const topTier: PathCommand[] = [
    { type: 'M', x: cx - w * 0.2, y: cy - h * 0.25 },
    { type: 'L', x: cx + w * 0.2, y: cy - h * 0.25 },
    { type: 'L', x: cx + w * 0.2, y: cy - h * 0.05 },
    { type: 'L', x: cx - w * 0.2, y: cy - h * 0.05 },
    { type: 'Z', x: cx - w * 0.2, y: cy - h * 0.25 },
  ]

  // Decorative swirls on bottom tier
  const deco1: PathCommand[] = [
    { type: 'M', x: cx - w * 0.4, y: cy + h * 0.32 },
    {
      type: 'C',
      x: cx - w * 0.2,
      y: cy + h * 0.28,
      cp1: { x: cx - w * 0.35, y: cy + h * 0.38 },
      cp2: { x: cx - w * 0.25, y: cy + h * 0.32 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + h * 0.32,
      cp1: { x: cx - w * 0.15, y: cy + h * 0.24 },
      cp2: { x: cx - w * 0.05, y: cy + h * 0.28 },
    },
    {
      type: 'C',
      x: cx + w * 0.2,
      y: cy + h * 0.28,
      cp1: { x: cx + w * 0.05, y: cy + h * 0.36 },
      cp2: { x: cx + w * 0.15, y: cy + h * 0.32 },
    },
    {
      type: 'C',
      x: cx + w * 0.4,
      y: cy + h * 0.32,
      cp1: { x: cx + w * 0.25, y: cy + h * 0.24 },
      cp2: { x: cx + w * 0.35, y: cy + h * 0.28 },
    },
  ]

  // Heart topper
  const heartTopperCy = cy - h * 0.35
  const heartW = w * 0.12
  const heartH = h * 0.1
  const hw = heartW / 2
  const hh = heartH / 2
  const topOffset = hh * 0.3

  const heartTopper: PathCommand[] = [
    { type: 'M', x: cx, y: heartTopperCy + hh },
    {
      type: 'C',
      x: cx - hw,
      y: heartTopperCy - topOffset,
      cp1: { x: cx - hw, y: heartTopperCy + hh * 0.3 },
      cp2: { x: cx - hw, y: heartTopperCy },
    },
    {
      type: 'C',
      x: cx,
      y: heartTopperCy - hh * 0.2,
      cp1: { x: cx - hw, y: heartTopperCy - hh * 0.6 },
      cp2: { x: cx - hw * 0.3, y: heartTopperCy - hh * 0.5 },
    },
    {
      type: 'C',
      x: cx + hw,
      y: heartTopperCy - topOffset,
      cp1: { x: cx + hw * 0.3, y: heartTopperCy - hh * 0.5 },
      cp2: { x: cx + hw, y: heartTopperCy - hh * 0.6 },
    },
    {
      type: 'C',
      x: cx,
      y: heartTopperCy + hh,
      cp1: { x: cx + hw, y: heartTopperCy },
      cp2: { x: cx + hw, y: heartTopperCy + hh * 0.3 },
    },
    { type: 'Z', x: cx, y: heartTopperCy + hh },
  ]

  return [
    {
      id: 'cake-bottom',
      name: 'Bottom Tier',
      commands: bottomTier,
      fill: colors.base,
      stroke: colors.baseStroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'cake-middle',
      name: 'Middle Tier',
      commands: middleTier,
      fill: colors.tier,
      stroke: colors.tierStroke,
      strokeWidth: 0.8,
      zIndex: 1,
    },
    {
      id: 'cake-top',
      name: 'Top Tier',
      commands: topTier,
      fill: colors.base,
      stroke: colors.baseStroke,
      strokeWidth: 0.8,
      zIndex: 2,
    },
    {
      id: 'cake-deco',
      name: 'Decoration',
      commands: deco1,
      fill: 'none',
      stroke: colors.decoration,
      strokeWidth: 2,
      zIndex: 3,
    },
    {
      id: 'cake-topper',
      name: 'Heart Topper',
      commands: heartTopper,
      fill: colors.topper,
      stroke: colors.topperStroke,
      strokeWidth: 0.5,
      zIndex: 4,
    },
  ]
}
