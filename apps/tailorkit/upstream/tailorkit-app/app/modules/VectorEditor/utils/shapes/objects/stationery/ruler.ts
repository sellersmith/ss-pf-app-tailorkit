/**
 * Ruler Shape Generator
 * Creates a ruler shape with measurement marks
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { OBJECT_COLORS } from '../types'

/**
 * Generate ruler shape
 */
export function generateRuler(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = OBJECT_COLORS.stationery.ruler
  const w = width / 2
  const h = height / 2

  // Main ruler body (horizontal orientation)
  const body: PathCommand[] = [
    { type: 'M', x: cx - w, y: cy - h * 0.2 },
    { type: 'L', x: cx + w, y: cy - h * 0.2 },
    { type: 'L', x: cx + w, y: cy + h * 0.2 },
    { type: 'L', x: cx - w, y: cy + h * 0.2 },
    { type: 'Z', x: cx - w, y: cy - h * 0.2 },
  ]

  // Measurement marks (main ticks)
  const marks: PathCommand[] = []
  const numMarks = 10
  const spacing = (w * 2) / numMarks

  for (let i = 0; i <= numMarks; i++) {
    const x = cx - w + i * spacing
    const tickHeight = i % 5 === 0 ? h * 0.25 : h * 0.15 // Longer marks at every 5th position
    marks.push({ type: 'M', x: x, y: cy + h * 0.2 }, { type: 'L', x: x, y: cy + h * 0.2 - tickHeight })
  }

  // Edge line at top
  const edgeLine: PathCommand[] = [
    { type: 'M', x: cx - w, y: cy - h * 0.15 },
    { type: 'L', x: cx + w, y: cy - h * 0.15 },
  ]

  return [
    {
      id: 'ruler-body',
      name: 'Body',
      commands: body,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'ruler-marks',
      name: 'Measurement Marks',
      commands: marks,
      fill: 'none',
      stroke: colors.marks,
      strokeWidth: 1,
      zIndex: 1,
    },
    {
      id: 'ruler-edge',
      name: 'Edge Line',
      commands: edgeLine,
      fill: 'none',
      stroke: colors.stroke,
      strokeWidth: 0.5,
      zIndex: 2,
    },
  ]
}
