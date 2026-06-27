/**
 * Candle Shape Generator
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { BIRTHDAY_COLORS } from './colors'

/**
 * Generate single candle shape
 */
export function generateCandle(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = BIRTHDAY_COLORS.candle
  const w = width
  const h = height

  // Candle body
  const candleBody: PathCommand[] = [
    { type: 'M', x: cx - w * 0.2, y: cy - h * 0.2 },
    { type: 'L', x: cx + w * 0.2, y: cy - h * 0.2 },
    { type: 'L', x: cx + w * 0.2, y: cy + h * 0.4 },
    {
      type: 'C',
      x: cx - w * 0.2,
      y: cy + h * 0.4,
      cp1: { x: cx + w * 0.1, y: cy + h * 0.45 },
      cp2: { x: cx - w * 0.1, y: cy + h * 0.45 },
    },
    { type: 'Z', x: cx - w * 0.2, y: cy - h * 0.2 },
  ]

  // Stripe decoration
  const stripe: PathCommand[] = [
    { type: 'M', x: cx - w * 0.2, y: cy + h * 0.05 },
    { type: 'L', x: cx + w * 0.2, y: cy + h * 0.05 },
    { type: 'L', x: cx + w * 0.2, y: cy + h * 0.15 },
    { type: 'L', x: cx - w * 0.2, y: cy + h * 0.15 },
    { type: 'Z', x: cx - w * 0.2, y: cy + h * 0.05 },
  ]

  // Wick
  const wick: PathCommand[] = [
    { type: 'M', x: cx - w * 0.02, y: cy - h * 0.35 },
    { type: 'L', x: cx + w * 0.02, y: cy - h * 0.35 },
    { type: 'L', x: cx + w * 0.02, y: cy - h * 0.2 },
    { type: 'L', x: cx - w * 0.02, y: cy - h * 0.2 },
    { type: 'Z', x: cx - w * 0.02, y: cy - h * 0.35 },
  ]

  // Flame outer
  const flameOuter: PathCommand[] = [
    { type: 'M', x: cx, y: cy - h * 0.5 },
    {
      type: 'C',
      x: cx + w * 0.12,
      y: cy - h * 0.35,
      cp1: { x: cx + w * 0.15, y: cy - h * 0.45 },
      cp2: { x: cx + w * 0.15, y: cy - h * 0.38 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.5,
      cp1: { x: cx + w * 0.06, y: cy - h * 0.38 },
      cp2: { x: cx, y: cy - h * 0.42 },
    },
    {
      type: 'C',
      x: cx - w * 0.12,
      y: cy - h * 0.35,
      cp1: { x: cx, y: cy - h * 0.42 },
      cp2: { x: cx - w * 0.06, y: cy - h * 0.38 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.5,
      cp1: { x: cx - w * 0.15, y: cy - h * 0.38 },
      cp2: { x: cx - w * 0.15, y: cy - h * 0.45 },
    },
    { type: 'Z', x: cx, y: cy - h * 0.5 },
  ]

  // Flame inner
  const flameInner: PathCommand[] = [
    { type: 'M', x: cx, y: cy - h * 0.48 },
    {
      type: 'C',
      x: cx + w * 0.05,
      y: cy - h * 0.38,
      cp1: { x: cx + w * 0.06, y: cy - h * 0.44 },
      cp2: { x: cx + w * 0.06, y: cy - h * 0.4 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.48,
      cp1: { x: cx + w * 0.02, y: cy - h * 0.4 },
      cp2: { x: cx, y: cy - h * 0.43 },
    },
    {
      type: 'C',
      x: cx - w * 0.05,
      y: cy - h * 0.38,
      cp1: { x: cx, y: cy - h * 0.43 },
      cp2: { x: cx - w * 0.02, y: cy - h * 0.4 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.48,
      cp1: { x: cx - w * 0.06, y: cy - h * 0.4 },
      cp2: { x: cx - w * 0.06, y: cy - h * 0.44 },
    },
    { type: 'Z', x: cx, y: cy - h * 0.48 },
  ]

  return [
    {
      id: 'candle-body',
      name: 'Candle',
      commands: candleBody,
      fill: colors.body,
      stroke: colors.bodyStroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'candle-stripe',
      name: 'Stripe',
      commands: stripe,
      fill: '#E91E63',
      stroke: '#AD1457',
      strokeWidth: 0.3,
      zIndex: 1,
    },
    {
      id: 'candle-wick',
      name: 'Wick',
      commands: wick,
      fill: colors.wick,
      stroke: '#3E2723',
      strokeWidth: 0.3,
      zIndex: 2,
    },
    {
      id: 'candle-flame-outer',
      name: 'Flame',
      commands: flameOuter,
      fill: colors.flame,
      stroke: '#E65100',
      strokeWidth: 0.5,
      zIndex: 3,
    },
    {
      id: 'candle-flame-inner',
      name: 'Flame Core',
      commands: flameInner,
      fill: colors.flameInner,
      stroke: 'none',
      strokeWidth: 0,
      zIndex: 4,
    },
  ]
}
