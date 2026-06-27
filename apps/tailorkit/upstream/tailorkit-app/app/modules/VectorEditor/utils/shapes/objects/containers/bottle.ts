/**
 * Bottle Shape Generator
 * Creates a water bottle shape with cap and body
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { OBJECT_COLORS } from '../types'

/**
 * Generate bottle shape
 */
export function generateBottle(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = OBJECT_COLORS.containers.bottle
  const w = width / 2
  const h = height / 2

  // Main bottle body
  const body: PathCommand[] = [
    { type: 'M', x: cx - w * 0.3, y: cy - h * 0.5 },
    { type: 'L', x: cx - w * 0.3, y: cy + h * 0.9 },
    {
      type: 'C',
      x: cx + w * 0.3,
      y: cy + h * 0.9,
      cp1: { x: cx - w * 0.3, y: cy + h },
      cp2: { x: cx + w * 0.3, y: cy + h },
    },
    { type: 'L', x: cx + w * 0.3, y: cy - h * 0.5 },
    { type: 'Z', x: cx - w * 0.3, y: cy - h * 0.5 },
  ]

  // Bottle neck
  const neck: PathCommand[] = [
    { type: 'M', x: cx - w * 0.15, y: cy - h * 0.5 },
    { type: 'L', x: cx - w * 0.15, y: cy - h * 0.8 },
    { type: 'L', x: cx + w * 0.15, y: cy - h * 0.8 },
    { type: 'L', x: cx + w * 0.15, y: cy - h * 0.5 },
    { type: 'Z', x: cx - w * 0.15, y: cy - h * 0.5 },
  ]

  // Bottle cap
  const cap: PathCommand[] = [
    { type: 'M', x: cx - w * 0.18, y: cy - h * 0.8 },
    { type: 'L', x: cx - w * 0.18, y: cy - h },
    { type: 'L', x: cx + w * 0.18, y: cy - h },
    { type: 'L', x: cx + w * 0.18, y: cy - h * 0.8 },
    { type: 'Z', x: cx - w * 0.18, y: cy - h * 0.8 },
  ]

  // Label area
  const label: PathCommand[] = [
    { type: 'M', x: cx - w * 0.28, y: cy - h * 0.2 },
    { type: 'L', x: cx + w * 0.28, y: cy - h * 0.2 },
    { type: 'L', x: cx + w * 0.28, y: cy + h * 0.3 },
    { type: 'L', x: cx - w * 0.28, y: cy + h * 0.3 },
    { type: 'Z', x: cx - w * 0.28, y: cy - h * 0.2 },
  ]

  return [
    {
      id: 'bottle-body',
      name: 'Body',
      commands: body,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'bottle-neck',
      name: 'Neck',
      commands: neck,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 0.5,
      zIndex: 1,
    },
    {
      id: 'bottle-cap',
      name: 'Cap',
      commands: cap,
      fill: '#1565C0',
      stroke: '#0D47A1',
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'bottle-label',
      name: 'Label',
      commands: label,
      fill: '#FFFFFF',
      stroke: '#E0E0E0',
      strokeWidth: 0.3,
      zIndex: 3,
    },
  ]
}
