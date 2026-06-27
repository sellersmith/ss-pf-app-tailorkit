/**
 * Birthday Cake Shape Generator
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { BIRTHDAY_COLORS } from './colors'

/**
 * Generate birthday cake shape
 */
export function generateBirthdayCake(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = BIRTHDAY_COLORS.cake
  const w = width
  const h = height

  // Cake base layer (bottom)
  const baseLayer: PathCommand[] = [
    { type: 'M', x: cx - w * 0.45, y: cy + h * 0.15 },
    { type: 'L', x: cx + w * 0.45, y: cy + h * 0.15 },
    { type: 'L', x: cx + w * 0.45, y: cy + h * 0.45 },
    {
      type: 'C',
      x: cx - w * 0.45,
      y: cy + h * 0.45,
      cp1: { x: cx + w * 0.2, y: cy + h * 0.5 },
      cp2: { x: cx - w * 0.2, y: cy + h * 0.5 },
    },
    { type: 'Z', x: cx - w * 0.45, y: cy + h * 0.15 },
  ]

  // Frosting layer (top)
  const frostingLayer: PathCommand[] = [
    { type: 'M', x: cx - w * 0.4, y: cy - h * 0.1 },
    { type: 'L', x: cx + w * 0.4, y: cy - h * 0.1 },
    { type: 'L', x: cx + w * 0.4, y: cy + h * 0.15 },
    { type: 'L', x: cx - w * 0.4, y: cy + h * 0.15 },
    { type: 'Z', x: cx - w * 0.4, y: cy - h * 0.1 },
  ]

  // Frosting drip decoration (wavy top)
  const frostingDrip: PathCommand[] = [
    { type: 'M', x: cx - w * 0.4, y: cy - h * 0.1 },
    {
      type: 'C',
      x: cx - w * 0.2,
      y: cy - h * 0.15,
      cp1: { x: cx - w * 0.35, y: cy - h * 0.2 },
      cp2: { x: cx - w * 0.25, y: cy - h * 0.2 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.1,
      cp1: { x: cx - w * 0.15, y: cy - h * 0.1 },
      cp2: { x: cx - w * 0.05, y: cy - h * 0.1 },
    },
    {
      type: 'C',
      x: cx + w * 0.2,
      y: cy - h * 0.15,
      cp1: { x: cx + w * 0.05, y: cy - h * 0.1 },
      cp2: { x: cx + w * 0.15, y: cy - h * 0.2 },
    },
    {
      type: 'C',
      x: cx + w * 0.4,
      y: cy - h * 0.1,
      cp1: { x: cx + w * 0.25, y: cy - h * 0.1 },
      cp2: { x: cx + w * 0.35, y: cy - h * 0.1 },
    },
    { type: 'L', x: cx + w * 0.4, y: cy - h * 0.05 },
    { type: 'L', x: cx - w * 0.4, y: cy - h * 0.05 },
    { type: 'Z', x: cx - w * 0.4, y: cy - h * 0.1 },
  ]

  // Candle
  const candleBody: PathCommand[] = [
    { type: 'M', x: cx - w * 0.04, y: cy - h * 0.35 },
    { type: 'L', x: cx + w * 0.04, y: cy - h * 0.35 },
    { type: 'L', x: cx + w * 0.04, y: cy - h * 0.1 },
    { type: 'L', x: cx - w * 0.04, y: cy - h * 0.1 },
    { type: 'Z', x: cx - w * 0.04, y: cy - h * 0.35 },
  ]

  // Flame
  const flame: PathCommand[] = [
    { type: 'M', x: cx, y: cy - h * 0.5 },
    {
      type: 'C',
      x: cx + w * 0.04,
      y: cy - h * 0.38,
      cp1: { x: cx + w * 0.06, y: cy - h * 0.45 },
      cp2: { x: cx + w * 0.05, y: cy - h * 0.4 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.5,
      cp1: { x: cx + w * 0.02, y: cy - h * 0.42 },
      cp2: { x: cx, y: cy - h * 0.45 },
    },
    {
      type: 'C',
      x: cx - w * 0.04,
      y: cy - h * 0.38,
      cp1: { x: cx, y: cy - h * 0.45 },
      cp2: { x: cx - w * 0.02, y: cy - h * 0.42 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.5,
      cp1: { x: cx - w * 0.05, y: cy - h * 0.4 },
      cp2: { x: cx - w * 0.06, y: cy - h * 0.45 },
    },
    { type: 'Z', x: cx, y: cy - h * 0.5 },
  ]

  return [
    {
      id: 'cake-base',
      name: 'Cake Base',
      commands: baseLayer,
      fill: colors.base,
      stroke: colors.baseStroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'cake-frosting',
      name: 'Frosting Layer',
      commands: frostingLayer,
      fill: colors.frosting,
      stroke: colors.frostingStroke,
      strokeWidth: 0.5,
      zIndex: 1,
    },
    {
      id: 'cake-drip',
      name: 'Frosting Drip',
      commands: frostingDrip,
      fill: colors.frosting,
      stroke: colors.frostingStroke,
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'cake-candle',
      name: 'Candle',
      commands: candleBody,
      fill: BIRTHDAY_COLORS.candle.body,
      stroke: BIRTHDAY_COLORS.candle.bodyStroke,
      strokeWidth: 0.5,
      zIndex: 3,
    },
    {
      id: 'cake-flame',
      name: 'Flame',
      commands: flame,
      fill: BIRTHDAY_COLORS.candle.flame,
      stroke: '#E65100',
      strokeWidth: 0.3,
      zIndex: 4,
    },
  ]
}
