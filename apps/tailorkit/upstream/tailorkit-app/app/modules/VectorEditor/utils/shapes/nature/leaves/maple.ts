/**
 * Maple Leaf Shape Generator
 * Creates a maple leaf with pointed lobes
 */

import type { PathCommand } from '../../../svg'
import type { NaturePathResult } from '../types'
import { LEAF_COLORS, STEM_COLORS } from '../types'

/**
 * Generate maple leaf shape
 */
export function generateLeafMaple(cx: number, cy: number, width: number, height: number): NaturePathResult[] {
  const leafColor = LEAF_COLORS.autumnRed
  const stemColor = STEM_COLORS.brown

  const w = width / 2
  const h = height / 2

  // Maple leaf with pointed lobes
  const leaf: PathCommand[] = [
    { type: 'M', x: cx, y: cy + h * 0.85 },
    // Bottom right lobe
    {
      type: 'C',
      x: cx + w * 0.25,
      y: cy + h * 0.4,
      cp1: { x: cx + w * 0.1, y: cy + h * 0.7 },
      cp2: { x: cx + w * 0.15, y: cy + h * 0.5 },
    },
    // Right side point
    { type: 'L', x: cx + w * 0.5, y: cy + h * 0.5 },
    {
      type: 'C',
      x: cx + w * 0.4,
      y: cy + h * 0.15,
      cp1: { x: cx + w * 0.55, y: cy + h * 0.35 },
      cp2: { x: cx + w * 0.45, y: cy + h * 0.2 },
    },
    // Far right point
    { type: 'L', x: cx + w * 0.95, y: cy + h * 0.1 },
    {
      type: 'C',
      x: cx + w * 0.55,
      y: cy - h * 0.1,
      cp1: { x: cx + w * 0.8, y: cy },
      cp2: { x: cx + w * 0.65, y: cy - h * 0.05 },
    },
    // Upper right point
    { type: 'L', x: cx + w * 0.7, y: cy - h * 0.5 },
    {
      type: 'C',
      x: cx + w * 0.35,
      y: cy - h * 0.35,
      cp1: { x: cx + w * 0.55, y: cy - h * 0.45 },
      cp2: { x: cx + w * 0.4, y: cy - h * 0.4 },
    },
    // Top point
    { type: 'L', x: cx + w * 0.15, y: cy - h * 0.95 },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.6,
      cp1: { x: cx + w * 0.1, y: cy - h * 0.8 },
      cp2: { x: cx + w * 0.05, y: cy - h * 0.65 },
    },
    // Mirror left side
    {
      type: 'C',
      x: cx - w * 0.15,
      y: cy - h * 0.95,
      cp1: { x: cx - w * 0.05, y: cy - h * 0.65 },
      cp2: { x: cx - w * 0.1, y: cy - h * 0.8 },
    },
    { type: 'L', x: cx - w * 0.35, y: cy - h * 0.35 },
    {
      type: 'C',
      x: cx - w * 0.7,
      y: cy - h * 0.5,
      cp1: { x: cx - w * 0.4, y: cy - h * 0.4 },
      cp2: { x: cx - w * 0.55, y: cy - h * 0.45 },
    },
    { type: 'L', x: cx - w * 0.55, y: cy - h * 0.1 },
    {
      type: 'C',
      x: cx - w * 0.95,
      y: cy + h * 0.1,
      cp1: { x: cx - w * 0.65, y: cy - h * 0.05 },
      cp2: { x: cx - w * 0.8, y: cy },
    },
    { type: 'L', x: cx - w * 0.4, y: cy + h * 0.15 },
    {
      type: 'C',
      x: cx - w * 0.5,
      y: cy + h * 0.5,
      cp1: { x: cx - w * 0.45, y: cy + h * 0.2 },
      cp2: { x: cx - w * 0.55, y: cy + h * 0.35 },
    },
    { type: 'L', x: cx - w * 0.25, y: cy + h * 0.4 },
    {
      type: 'C',
      x: cx,
      y: cy + h * 0.85,
      cp1: { x: cx - w * 0.15, y: cy + h * 0.5 },
      cp2: { x: cx - w * 0.1, y: cy + h * 0.7 },
    },
    { type: 'Z', x: cx, y: cy + h * 0.85 },
  ]

  // Central vein
  const vein: PathCommand[] = [
    { type: 'M', x: cx, y: cy + h * 0.85 },
    { type: 'L', x: cx, y: cy - h * 0.6 },
  ]

  // Stem
  const stem: PathCommand[] = [
    { type: 'M', x: cx - w * 0.04, y: cy + h * 0.85 },
    { type: 'L', x: cx - w * 0.06, y: cy + h },
    { type: 'L', x: cx + w * 0.06, y: cy + h },
    { type: 'L', x: cx + w * 0.04, y: cy + h * 0.85 },
    { type: 'Z', x: cx - w * 0.04, y: cy + h * 0.85 },
  ]

  return [
    {
      id: 'maple-leaf-body',
      name: 'Leaf',
      commands: leaf,
      fill: leafColor.fill,
      stroke: leafColor.stroke,
      strokeWidth: 1,
      zIndex: 1,
    },
    {
      id: 'maple-leaf-vein',
      name: 'Vein',
      commands: vein,
      fill: 'none',
      stroke: leafColor.vein,
      strokeWidth: 1.5,
      zIndex: 2,
    },
    {
      id: 'maple-leaf-stem',
      name: 'Stem',
      commands: stem,
      fill: stemColor.fill,
      stroke: stemColor.stroke,
      strokeWidth: 0.5,
      zIndex: 0,
    },
  ]
}
