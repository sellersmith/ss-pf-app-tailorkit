/**
 * Box Shape Generator
 * Creates a cardboard box shape with open flaps
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { OBJECT_COLORS } from '../types'

/**
 * Generate box shape
 */
export function generateBox(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = OBJECT_COLORS.containers.box
  const w = width / 2
  const h = height / 2

  // Main box body (front face)
  const body: PathCommand[] = [
    { type: 'M', x: cx - w * 0.5, y: cy - h * 0.3 },
    { type: 'L', x: cx + w * 0.5, y: cy - h * 0.3 },
    { type: 'L', x: cx + w * 0.5, y: cy + h * 0.7 },
    { type: 'L', x: cx - w * 0.5, y: cy + h * 0.7 },
    { type: 'Z', x: cx - w * 0.5, y: cy - h * 0.3 },
  ]

  // Left flap (open)
  const leftFlap: PathCommand[] = [
    { type: 'M', x: cx - w * 0.5, y: cy - h * 0.3 },
    { type: 'L', x: cx - w * 0.7, y: cy - h * 0.6 },
    { type: 'L', x: cx - w * 0.2, y: cy - h * 0.6 },
    { type: 'L', x: cx, y: cy - h * 0.3 },
    { type: 'Z', x: cx - w * 0.5, y: cy - h * 0.3 },
  ]

  // Right flap (open)
  const rightFlap: PathCommand[] = [
    { type: 'M', x: cx + w * 0.5, y: cy - h * 0.3 },
    { type: 'L', x: cx + w * 0.7, y: cy - h * 0.6 },
    { type: 'L', x: cx + w * 0.2, y: cy - h * 0.6 },
    { type: 'L', x: cx, y: cy - h * 0.3 },
    { type: 'Z', x: cx + w * 0.5, y: cy - h * 0.3 },
  ]

  // Back flap (visible behind)
  const backFlap: PathCommand[] = [
    { type: 'M', x: cx - w * 0.4, y: cy - h * 0.3 },
    { type: 'L', x: cx - w * 0.4, y: cy - h * 0.8 },
    { type: 'L', x: cx + w * 0.4, y: cy - h * 0.8 },
    { type: 'L', x: cx + w * 0.4, y: cy - h * 0.3 },
  ]

  // Tape strip
  const tape: PathCommand[] = [
    { type: 'M', x: cx - w * 0.15, y: cy - h * 0.3 },
    { type: 'L', x: cx - w * 0.15, y: cy + h * 0.3 },
    { type: 'L', x: cx + w * 0.15, y: cy + h * 0.3 },
    { type: 'L', x: cx + w * 0.15, y: cy - h * 0.3 },
    { type: 'Z', x: cx - w * 0.15, y: cy - h * 0.3 },
  ]

  return [
    {
      id: 'box-back-flap',
      name: 'Back Flap',
      commands: backFlap,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 0.5,
      zIndex: 0,
    },
    {
      id: 'box-body',
      name: 'Body',
      commands: body,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 1,
      zIndex: 1,
    },
    {
      id: 'box-left-flap',
      name: 'Left Flap',
      commands: leftFlap,
      fill: colors.flap,
      stroke: colors.stroke,
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'box-right-flap',
      name: 'Right Flap',
      commands: rightFlap,
      fill: colors.flap,
      stroke: colors.stroke,
      strokeWidth: 0.5,
      zIndex: 3,
    },
    {
      id: 'box-tape',
      name: 'Tape',
      commands: tape,
      fill: '#FFCC80',
      stroke: '#FFA726',
      strokeWidth: 0.3,
      zIndex: 4,
    },
  ]
}
