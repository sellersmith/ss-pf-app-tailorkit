/**
 * Pencil Shape Generator
 * Creates a pencil shape with body, tip, and eraser
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { OBJECT_COLORS } from '../types'

/**
 * Generate pencil shape
 */
export function generatePencil(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = OBJECT_COLORS.stationery.pencil
  const w = width / 2
  const h = height / 2

  // Main pencil body
  const body: PathCommand[] = [
    { type: 'M', x: cx - w * 0.15, y: cy - h * 0.7 },
    { type: 'L', x: cx + w * 0.15, y: cy - h * 0.7 },
    { type: 'L', x: cx + w * 0.15, y: cy + h * 0.5 },
    { type: 'L', x: cx - w * 0.15, y: cy + h * 0.5 },
    { type: 'Z', x: cx - w * 0.15, y: cy - h * 0.7 },
  ]

  // Pencil tip (wood)
  const tip: PathCommand[] = [
    { type: 'M', x: cx - w * 0.15, y: cy + h * 0.5 },
    { type: 'L', x: cx, y: cy + h },
    { type: 'L', x: cx + w * 0.15, y: cy + h * 0.5 },
    { type: 'Z', x: cx - w * 0.15, y: cy + h * 0.5 },
  ]

  // Graphite tip
  const graphite: PathCommand[] = [
    { type: 'M', x: cx - w * 0.05, y: cy + h * 0.7 },
    { type: 'L', x: cx, y: cy + h },
    { type: 'L', x: cx + w * 0.05, y: cy + h * 0.7 },
    { type: 'Z', x: cx - w * 0.05, y: cy + h * 0.7 },
  ]

  // Metal ferrule
  const ferrule: PathCommand[] = [
    { type: 'M', x: cx - w * 0.18, y: cy - h * 0.7 },
    { type: 'L', x: cx + w * 0.18, y: cy - h * 0.7 },
    { type: 'L', x: cx + w * 0.18, y: cy - h * 0.55 },
    { type: 'L', x: cx - w * 0.18, y: cy - h * 0.55 },
    { type: 'Z', x: cx - w * 0.18, y: cy - h * 0.7 },
  ]

  // Eraser
  const eraser: PathCommand[] = [
    { type: 'M', x: cx - w * 0.15, y: cy - h * 0.7 },
    { type: 'L', x: cx + w * 0.15, y: cy - h * 0.7 },
    {
      type: 'C',
      x: cx + w * 0.15,
      y: cy - h,
      cp1: { x: cx + w * 0.15, y: cy - h * 0.85 },
      cp2: { x: cx + w * 0.1, y: cy - h },
    },
    {
      type: 'C',
      x: cx - w * 0.15,
      y: cy - h,
      cp1: { x: cx - w * 0.1, y: cy - h },
      cp2: { x: cx - w * 0.15, y: cy - h * 0.85 },
    },
    { type: 'Z', x: cx - w * 0.15, y: cy - h * 0.7 },
  ]

  return [
    {
      id: 'pencil-body',
      name: 'Body',
      commands: body,
      fill: colors.body,
      stroke: '#B8860B',
      strokeWidth: 1,
      zIndex: 1,
    },
    {
      id: 'pencil-tip',
      name: 'Wood Tip',
      commands: tip,
      fill: colors.tip,
      stroke: '#4E342E',
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'pencil-graphite',
      name: 'Graphite',
      commands: graphite,
      fill: '#212121',
      stroke: '#000000',
      strokeWidth: 0.3,
      zIndex: 3,
    },
    {
      id: 'pencil-ferrule',
      name: 'Ferrule',
      commands: ferrule,
      fill: colors.metal,
      stroke: '#757575',
      strokeWidth: 0.5,
      zIndex: 4,
    },
    {
      id: 'pencil-eraser',
      name: 'Eraser',
      commands: eraser,
      fill: colors.eraser,
      stroke: '#C2185B',
      strokeWidth: 0.5,
      zIndex: 5,
    },
  ]
}
