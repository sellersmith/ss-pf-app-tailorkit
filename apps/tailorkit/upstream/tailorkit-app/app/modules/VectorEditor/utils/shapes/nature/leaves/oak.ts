/**
 * Oak Leaf Shape Generator
 * Creates an oak leaf with lobed edges
 */

import type { PathCommand } from '../../../svg'
import type { NaturePathResult } from '../types'
import { LEAF_COLORS, STEM_COLORS } from '../types'

/**
 * Generate oak leaf shape
 */
export function generateLeafOak(cx: number, cy: number, width: number, height: number): NaturePathResult[] {
  const leafColor = LEAF_COLORS.green
  const stemColor = STEM_COLORS.brown

  const w = width / 2
  const h = height / 2

  // Oak leaf with lobed edges
  const leaf: PathCommand[] = [
    { type: 'M', x: cx, y: cy + h * 0.9 },
    // Right side lobes
    {
      type: 'C',
      x: cx + w * 0.3,
      y: cy + h * 0.5,
      cp1: { x: cx + w * 0.1, y: cy + h * 0.8 },
      cp2: { x: cx + w * 0.2, y: cy + h * 0.6 },
    },
    {
      type: 'C',
      x: cx + w * 0.5,
      y: cy + h * 0.3,
      cp1: { x: cx + w * 0.5, y: cy + h * 0.5 },
      cp2: { x: cx + w * 0.4, y: cy + h * 0.35 },
    },
    {
      type: 'C',
      x: cx + w * 0.7,
      y: cy,
      cp1: { x: cx + w * 0.7, y: cy + h * 0.25 },
      cp2: { x: cx + w * 0.6, y: cy + h * 0.1 },
    },
    {
      type: 'C',
      x: cx + w * 0.5,
      y: cy - h * 0.3,
      cp1: { x: cx + w * 0.8, y: cy - h * 0.15 },
      cp2: { x: cx + w * 0.6, y: cy - h * 0.2 },
    },
    {
      type: 'C',
      x: cx + w * 0.3,
      y: cy - h * 0.5,
      cp1: { x: cx + w * 0.5, y: cy - h * 0.4 },
      cp2: { x: cx + w * 0.4, y: cy - h * 0.45 },
    },
    // Top
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.9,
      cp1: { x: cx + w * 0.2, y: cy - h * 0.6 },
      cp2: { x: cx + w * 0.1, y: cy - h * 0.8 },
    },
    // Left side lobes (mirror)
    {
      type: 'C',
      x: cx - w * 0.3,
      y: cy - h * 0.5,
      cp1: { x: cx - w * 0.1, y: cy - h * 0.8 },
      cp2: { x: cx - w * 0.2, y: cy - h * 0.6 },
    },
    {
      type: 'C',
      x: cx - w * 0.5,
      y: cy - h * 0.3,
      cp1: { x: cx - w * 0.4, y: cy - h * 0.45 },
      cp2: { x: cx - w * 0.5, y: cy - h * 0.4 },
    },
    {
      type: 'C',
      x: cx - w * 0.7,
      y: cy,
      cp1: { x: cx - w * 0.6, y: cy - h * 0.2 },
      cp2: { x: cx - w * 0.8, y: cy - h * 0.15 },
    },
    {
      type: 'C',
      x: cx - w * 0.5,
      y: cy + h * 0.3,
      cp1: { x: cx - w * 0.6, y: cy + h * 0.1 },
      cp2: { x: cx - w * 0.7, y: cy + h * 0.25 },
    },
    {
      type: 'C',
      x: cx - w * 0.3,
      y: cy + h * 0.5,
      cp1: { x: cx - w * 0.4, y: cy + h * 0.35 },
      cp2: { x: cx - w * 0.5, y: cy + h * 0.5 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + h * 0.9,
      cp1: { x: cx - w * 0.2, y: cy + h * 0.6 },
      cp2: { x: cx - w * 0.1, y: cy + h * 0.8 },
    },
    { type: 'Z', x: cx, y: cy + h * 0.9 },
  ]

  // Central vein
  const vein: PathCommand[] = [
    { type: 'M', x: cx, y: cy + h * 0.9 },
    { type: 'L', x: cx, y: cy - h * 0.85 },
  ]

  // Stem
  const stem: PathCommand[] = [
    { type: 'M', x: cx - w * 0.05, y: cy + h * 0.9 },
    { type: 'L', x: cx - w * 0.08, y: cy + h },
    { type: 'L', x: cx + w * 0.08, y: cy + h },
    { type: 'L', x: cx + w * 0.05, y: cy + h * 0.9 },
    { type: 'Z', x: cx - w * 0.05, y: cy + h * 0.9 },
  ]

  return [
    {
      id: 'oak-leaf-body',
      name: 'Leaf',
      commands: leaf,
      fill: leafColor.fill,
      stroke: leafColor.stroke,
      strokeWidth: 1,
      zIndex: 1,
    },
    {
      id: 'oak-leaf-vein',
      name: 'Vein',
      commands: vein,
      fill: 'none',
      stroke: leafColor.vein,
      strokeWidth: 1.5,
      zIndex: 2,
    },
    {
      id: 'oak-leaf-stem',
      name: 'Stem',
      commands: stem,
      fill: stemColor.fill,
      stroke: stemColor.stroke,
      strokeWidth: 0.5,
      zIndex: 0,
    },
  ]
}
