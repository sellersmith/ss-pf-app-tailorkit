/**
 * Pen Shape Generator
 * Creates a ballpoint pen shape with body, clip, and tip
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { OBJECT_COLORS } from '../types'

/**
 * Generate pen shape
 */
export function generatePen(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = OBJECT_COLORS.stationery.pen
  const w = width / 2
  const h = height / 2

  // Main pen body
  const body: PathCommand[] = [
    { type: 'M', x: cx - w * 0.12, y: cy - h * 0.8 },
    { type: 'L', x: cx + w * 0.12, y: cy - h * 0.8 },
    { type: 'L', x: cx + w * 0.12, y: cy + h * 0.4 },
    { type: 'L', x: cx - w * 0.12, y: cy + h * 0.4 },
    { type: 'Z', x: cx - w * 0.12, y: cy - h * 0.8 },
  ]

  // Pen tip section (narrower)
  const tipSection: PathCommand[] = [
    { type: 'M', x: cx - w * 0.12, y: cy + h * 0.4 },
    { type: 'L', x: cx + w * 0.12, y: cy + h * 0.4 },
    { type: 'L', x: cx + w * 0.08, y: cy + h * 0.7 },
    { type: 'L', x: cx - w * 0.08, y: cy + h * 0.7 },
    { type: 'Z', x: cx - w * 0.12, y: cy + h * 0.4 },
  ]

  // Metal tip
  const tip: PathCommand[] = [
    { type: 'M', x: cx - w * 0.08, y: cy + h * 0.7 },
    { type: 'L', x: cx, y: cy + h },
    { type: 'L', x: cx + w * 0.08, y: cy + h * 0.7 },
    { type: 'Z', x: cx - w * 0.08, y: cy + h * 0.7 },
  ]

  // Pen clip
  const clip: PathCommand[] = [
    { type: 'M', x: cx + w * 0.12, y: cy - h * 0.7 },
    { type: 'L', x: cx + w * 0.25, y: cy - h * 0.7 },
    { type: 'L', x: cx + w * 0.25, y: cy - h * 0.1 },
    { type: 'L', x: cx + w * 0.18, y: cy },
    { type: 'L', x: cx + w * 0.18, y: cy - h * 0.1 },
    { type: 'L', x: cx + w * 0.12, y: cy - h * 0.1 },
    { type: 'Z', x: cx + w * 0.12, y: cy - h * 0.7 },
  ]

  // Cap top
  const cap: PathCommand[] = [
    { type: 'M', x: cx - w * 0.12, y: cy - h * 0.8 },
    { type: 'L', x: cx + w * 0.12, y: cy - h * 0.8 },
    {
      type: 'C',
      x: cx + w * 0.12,
      y: cy - h,
      cp1: { x: cx + w * 0.12, y: cy - h * 0.9 },
      cp2: { x: cx + w * 0.08, y: cy - h },
    },
    {
      type: 'C',
      x: cx - w * 0.12,
      y: cy - h,
      cp1: { x: cx - w * 0.08, y: cy - h },
      cp2: { x: cx - w * 0.12, y: cy - h * 0.9 },
    },
    { type: 'Z', x: cx - w * 0.12, y: cy - h * 0.8 },
  ]

  return [
    {
      id: 'pen-body',
      name: 'Body',
      commands: body,
      fill: colors.body,
      stroke: '#0D47A1',
      strokeWidth: 1,
      zIndex: 1,
    },
    {
      id: 'pen-tip-section',
      name: 'Tip Section',
      commands: tipSection,
      fill: '#1976D2',
      stroke: '#0D47A1',
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'pen-tip',
      name: 'Metal Tip',
      commands: tip,
      fill: '#9E9E9E',
      stroke: '#616161',
      strokeWidth: 0.5,
      zIndex: 3,
    },
    {
      id: 'pen-clip',
      name: 'Clip',
      commands: clip,
      fill: colors.clip,
      stroke: '#1976D2',
      strokeWidth: 0.5,
      zIndex: 4,
    },
    {
      id: 'pen-cap',
      name: 'Cap',
      commands: cap,
      fill: colors.body,
      stroke: '#0D47A1',
      strokeWidth: 0.5,
      zIndex: 5,
    },
  ]
}
