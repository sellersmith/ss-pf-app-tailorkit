/**
 * Simple Leaf Shape Generator
 * Creates a basic oval leaf shape
 */

import type { PathCommand } from '../../../svg'
import type { NaturePathResult } from '../types'
import { LEAF_COLORS, STEM_COLORS } from '../types'

/**
 * Generate simple oval leaf shape
 */
export function generateLeafSimple(cx: number, cy: number, width: number, height: number): NaturePathResult[] {
  const leafColor = LEAF_COLORS.lightGreen
  const stemColor = STEM_COLORS.green

  const w = width / 2
  const h = height / 2

  // Simple oval leaf
  const leaf: PathCommand[] = [
    { type: 'M', x: cx, y: cy + h * 0.85 },
    // Right side curve
    {
      type: 'C',
      x: cx + w * 0.7,
      y: cy,
      cp1: { x: cx + w * 0.2, y: cy + h * 0.8 },
      cp2: { x: cx + w * 0.6, y: cy + h * 0.4 },
    },
    // Top right to tip
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.95,
      cp1: { x: cx + w * 0.7, y: cy - h * 0.5 },
      cp2: { x: cx + w * 0.3, y: cy - h * 0.85 },
    },
    // Tip to left side
    {
      type: 'C',
      x: cx - w * 0.7,
      y: cy,
      cp1: { x: cx - w * 0.3, y: cy - h * 0.85 },
      cp2: { x: cx - w * 0.7, y: cy - h * 0.5 },
    },
    // Left side curve back to base
    {
      type: 'C',
      x: cx,
      y: cy + h * 0.85,
      cp1: { x: cx - w * 0.6, y: cy + h * 0.4 },
      cp2: { x: cx - w * 0.2, y: cy + h * 0.8 },
    },
    { type: 'Z', x: cx, y: cy + h * 0.85 },
  ]

  // Central vein
  const vein: PathCommand[] = [
    { type: 'M', x: cx, y: cy + h * 0.85 },
    { type: 'L', x: cx, y: cy - h * 0.9 },
  ]

  // Side veins
  const sideVeins: PathCommand[] = [
    // Right veins
    { type: 'M', x: cx, y: cy + h * 0.4 },
    { type: 'L', x: cx + w * 0.4, y: cy + h * 0.25 },
    { type: 'M', x: cx, y: cy },
    { type: 'L', x: cx + w * 0.5, y: cy - h * 0.2 },
    { type: 'M', x: cx, y: cy - h * 0.4 },
    { type: 'L', x: cx + w * 0.4, y: cy - h * 0.55 },
    // Left veins
    { type: 'M', x: cx, y: cy + h * 0.4 },
    { type: 'L', x: cx - w * 0.4, y: cy + h * 0.25 },
    { type: 'M', x: cx, y: cy },
    { type: 'L', x: cx - w * 0.5, y: cy - h * 0.2 },
    { type: 'M', x: cx, y: cy - h * 0.4 },
    { type: 'L', x: cx - w * 0.4, y: cy - h * 0.55 },
  ]

  // Stem
  const stem: PathCommand[] = [
    { type: 'M', x: cx - w * 0.05, y: cy + h * 0.85 },
    { type: 'L', x: cx - w * 0.06, y: cy + h },
    { type: 'L', x: cx + w * 0.06, y: cy + h },
    { type: 'L', x: cx + w * 0.05, y: cy + h * 0.85 },
    { type: 'Z', x: cx - w * 0.05, y: cy + h * 0.85 },
  ]

  return [
    {
      id: 'simple-leaf-body',
      name: 'Leaf',
      commands: leaf,
      fill: leafColor.fill,
      stroke: leafColor.stroke,
      strokeWidth: 1,
      zIndex: 1,
    },
    {
      id: 'simple-leaf-vein',
      name: 'Center Vein',
      commands: vein,
      fill: 'none',
      stroke: leafColor.vein,
      strokeWidth: 1.5,
      zIndex: 2,
    },
    {
      id: 'simple-leaf-side-veins',
      name: 'Side Veins',
      commands: sideVeins,
      fill: 'none',
      stroke: leafColor.vein,
      strokeWidth: 0.8,
      zIndex: 2,
    },
    {
      id: 'simple-leaf-stem',
      name: 'Stem',
      commands: stem,
      fill: stemColor.fill,
      stroke: stemColor.stroke,
      strokeWidth: 0.5,
      zIndex: 0,
    },
  ]
}
