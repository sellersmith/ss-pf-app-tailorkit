/**
 * Eraser Shape Generator
 * Creates a rectangular eraser shape with wrapper and eraser body
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { OBJECT_COLORS } from '../types'

/**
 * Generate eraser shape
 */
export function generateEraser(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = OBJECT_COLORS.stationery.eraser
  const w = width / 2
  const h = height / 2

  // Main eraser body (pink rubber part)
  const body: PathCommand[] = [
    { type: 'M', x: cx - w * 0.4, y: cy - h * 0.3 },
    { type: 'L', x: cx + w * 0.4, y: cy - h * 0.3 },
    { type: 'L', x: cx + w * 0.4, y: cy + h * 0.3 },
    { type: 'L', x: cx - w * 0.4, y: cy + h * 0.3 },
    { type: 'Z', x: cx - w * 0.4, y: cy - h * 0.3 },
  ]

  // Paper wrapper/sleeve (covers part of eraser)
  const wrapper: PathCommand[] = [
    { type: 'M', x: cx - w * 0.4, y: cy - h * 0.3 },
    { type: 'L', x: cx - w * 0.1, y: cy - h * 0.3 },
    { type: 'L', x: cx - w * 0.1, y: cy + h * 0.3 },
    { type: 'L', x: cx - w * 0.4, y: cy + h * 0.3 },
    { type: 'Z', x: cx - w * 0.4, y: cy - h * 0.3 },
  ]

  // Top edge highlight
  const highlight: PathCommand[] = [
    { type: 'M', x: cx - w * 0.4, y: cy - h * 0.25 },
    { type: 'L', x: cx + w * 0.4, y: cy - h * 0.25 },
  ]

  // Brand text area (small rectangle on wrapper)
  const brandArea: PathCommand[] = [
    { type: 'M', x: cx - w * 0.35, y: cy - h * 0.15 },
    { type: 'L', x: cx - w * 0.15, y: cy - h * 0.15 },
    { type: 'L', x: cx - w * 0.15, y: cy + h * 0.15 },
    { type: 'L', x: cx - w * 0.35, y: cy + h * 0.15 },
    { type: 'Z', x: cx - w * 0.35, y: cy - h * 0.15 },
  ]

  return [
    {
      id: 'eraser-body',
      name: 'Eraser Body',
      commands: body,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'eraser-wrapper',
      name: 'Wrapper',
      commands: wrapper,
      fill: '#ECEFF1',
      stroke: '#B0BEC5',
      strokeWidth: 0.5,
      zIndex: 1,
    },
    {
      id: 'eraser-highlight',
      name: 'Highlight',
      commands: highlight,
      fill: 'none',
      stroke: '#FFCDD2',
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'eraser-brand',
      name: 'Brand Area',
      commands: brandArea,
      fill: '#1565C0',
      stroke: '#0D47A1',
      strokeWidth: 0.3,
      zIndex: 3,
    },
  ]
}
