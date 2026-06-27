/**
 * Tropical Leaf Shape Generator
 * Creates a monstera-style tropical leaf with splits
 */

import type { PathCommand } from '../../../svg'
import type { NaturePathResult } from '../types'
import { LEAF_COLORS, STEM_COLORS } from '../types'

/**
 * Generate tropical leaf shape (monstera style)
 */
export function generateLeafTropical(cx: number, cy: number, width: number, height: number): NaturePathResult[] {
  const leafColor = LEAF_COLORS.tropical
  const stemColor = STEM_COLORS.green

  const w = width / 2
  const h = height / 2

  // Monstera-style tropical leaf
  const leaf: PathCommand[] = [
    { type: 'M', x: cx, y: cy + h * 0.9 },
    // Right side with characteristic splits
    {
      type: 'C',
      x: cx + w * 0.3,
      y: cy + h * 0.5,
      cp1: { x: cx + w * 0.15, y: cy + h * 0.75 },
      cp2: { x: cx + w * 0.25, y: cy + h * 0.6 },
    },
    // First split
    { type: 'L', x: cx + w * 0.15, y: cy + h * 0.3 },
    { type: 'L', x: cx + w * 0.4, y: cy + h * 0.35 },
    {
      type: 'C',
      x: cx + w * 0.6,
      y: cy + h * 0.1,
      cp1: { x: cx + w * 0.55, y: cy + h * 0.25 },
      cp2: { x: cx + w * 0.6, y: cy + h * 0.15 },
    },
    // Second split
    { type: 'L', x: cx + w * 0.35, y: cy - h * 0.05 },
    { type: 'L', x: cx + w * 0.55, y: cy - h * 0.1 },
    {
      type: 'C',
      x: cx + w * 0.7,
      y: cy - h * 0.35,
      cp1: { x: cx + w * 0.65, y: cy - h * 0.2 },
      cp2: { x: cx + w * 0.7, y: cy - h * 0.3 },
    },
    // Third split
    { type: 'L', x: cx + w * 0.4, y: cy - h * 0.4 },
    { type: 'L', x: cx + w * 0.5, y: cy - h * 0.55 },
    {
      type: 'C',
      x: cx + w * 0.35,
      y: cy - h * 0.75,
      cp1: { x: cx + w * 0.5, y: cy - h * 0.65 },
      cp2: { x: cx + w * 0.4, y: cy - h * 0.72 },
    },
    // Top
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.95,
      cp1: { x: cx + w * 0.2, y: cy - h * 0.85 },
      cp2: { x: cx + w * 0.1, y: cy - h * 0.92 },
    },
    // Left side (mirror with splits)
    {
      type: 'C',
      x: cx - w * 0.35,
      y: cy - h * 0.75,
      cp1: { x: cx - w * 0.1, y: cy - h * 0.92 },
      cp2: { x: cx - w * 0.2, y: cy - h * 0.85 },
    },
    { type: 'L', x: cx - w * 0.5, y: cy - h * 0.55 },
    { type: 'L', x: cx - w * 0.4, y: cy - h * 0.4 },
    {
      type: 'C',
      x: cx - w * 0.7,
      y: cy - h * 0.35,
      cp1: { x: cx - w * 0.7, y: cy - h * 0.3 },
      cp2: { x: cx - w * 0.65, y: cy - h * 0.2 },
    },
    { type: 'L', x: cx - w * 0.55, y: cy - h * 0.1 },
    { type: 'L', x: cx - w * 0.35, y: cy - h * 0.05 },
    {
      type: 'C',
      x: cx - w * 0.6,
      y: cy + h * 0.1,
      cp1: { x: cx - w * 0.6, y: cy + h * 0.15 },
      cp2: { x: cx - w * 0.55, y: cy + h * 0.25 },
    },
    { type: 'L', x: cx - w * 0.4, y: cy + h * 0.35 },
    { type: 'L', x: cx - w * 0.15, y: cy + h * 0.3 },
    { type: 'L', x: cx - w * 0.3, y: cy + h * 0.5 },
    {
      type: 'C',
      x: cx,
      y: cy + h * 0.9,
      cp1: { x: cx - w * 0.25, y: cy + h * 0.6 },
      cp2: { x: cx - w * 0.15, y: cy + h * 0.75 },
    },
    { type: 'Z', x: cx, y: cy + h * 0.9 },
  ]

  // Central vein
  const vein: PathCommand[] = [
    { type: 'M', x: cx, y: cy + h * 0.9 },
    { type: 'L', x: cx, y: cy - h * 0.9 },
  ]

  // Stem
  const stem: PathCommand[] = [
    { type: 'M', x: cx - w * 0.06, y: cy + h * 0.9 },
    {
      type: 'C',
      x: cx - w * 0.15,
      y: cy + h,
      cp1: { x: cx - w * 0.08, y: cy + h * 0.95 },
      cp2: { x: cx - w * 0.12, y: cy + h * 0.98 },
    },
    { type: 'L', x: cx - w * 0.08, y: cy + h },
    {
      type: 'C',
      x: cx + w * 0.06,
      y: cy + h * 0.9,
      cp1: { x: cx - w * 0.05, y: cy + h * 0.98 },
      cp2: { x: cx + w * 0.02, y: cy + h * 0.95 },
    },
    { type: 'Z', x: cx - w * 0.06, y: cy + h * 0.9 },
  ]

  return [
    {
      id: 'tropical-leaf-body',
      name: 'Leaf',
      commands: leaf,
      fill: leafColor.fill,
      stroke: leafColor.stroke,
      strokeWidth: 1.2,
      zIndex: 1,
    },
    {
      id: 'tropical-leaf-vein',
      name: 'Vein',
      commands: vein,
      fill: 'none',
      stroke: leafColor.vein,
      strokeWidth: 2,
      zIndex: 2,
    },
    {
      id: 'tropical-leaf-stem',
      name: 'Stem',
      commands: stem,
      fill: stemColor.fill,
      stroke: stemColor.stroke,
      strokeWidth: 0.5,
      zIndex: 0,
    },
  ]
}
