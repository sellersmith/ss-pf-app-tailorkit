/**
 * Cup/Mug Shape Generator
 * Creates cup and mug shapes
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { OBJECT_COLORS } from '../types'

/**
 * Generate coffee cup/mug shape
 */
export function generateCup(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = OBJECT_COLORS.containers.ceramic
  const w = width / 2
  const h = height / 2

  // Cup body
  const body: PathCommand[] = [
    { type: 'M', x: cx - w * 0.7, y: cy - h * 0.8 },
    { type: 'L', x: cx + w * 0.7, y: cy - h * 0.8 },
    // Right side tapering down
    {
      type: 'C',
      x: cx + w * 0.55,
      y: cy + h * 0.9,
      cp1: { x: cx + w * 0.7, y: cy },
      cp2: { x: cx + w * 0.6, y: cy + h * 0.5 },
    },
    // Bottom curve
    {
      type: 'C',
      x: cx - w * 0.55,
      y: cy + h * 0.9,
      cp1: { x: cx + w * 0.3, y: cy + h },
      cp2: { x: cx - w * 0.3, y: cy + h },
    },
    // Left side tapering up
    {
      type: 'C',
      x: cx - w * 0.7,
      y: cy - h * 0.8,
      cp1: { x: cx - w * 0.6, y: cy + h * 0.5 },
      cp2: { x: cx - w * 0.7, y: cy },
    },
    { type: 'Z', x: cx - w * 0.7, y: cy - h * 0.8 },
  ]

  // Handle (right side)
  const handle: PathCommand[] = [
    { type: 'M', x: cx + w * 0.65, y: cy - h * 0.4 },
    {
      type: 'C',
      x: cx + w,
      y: cy,
      cp1: { x: cx + w * 0.9, y: cy - h * 0.5 },
      cp2: { x: cx + w, y: cy - h * 0.3 },
    },
    {
      type: 'C',
      x: cx + w * 0.6,
      y: cy + h * 0.3,
      cp1: { x: cx + w, y: cy + h * 0.2 },
      cp2: { x: cx + w * 0.85, y: cy + h * 0.35 },
    },
    // Inner curve of handle
    {
      type: 'C',
      x: cx + w * 0.75,
      y: cy,
      cp1: { x: cx + w * 0.7, y: cy + h * 0.2 },
      cp2: { x: cx + w * 0.75, y: cy + h * 0.1 },
    },
    {
      type: 'C',
      x: cx + w * 0.65,
      y: cy - h * 0.4,
      cp1: { x: cx + w * 0.75, y: cy - h * 0.15 },
      cp2: { x: cx + w * 0.7, y: cy - h * 0.3 },
    },
    { type: 'Z', x: cx + w * 0.65, y: cy - h * 0.4 },
  ]

  // Rim
  const rim: PathCommand[] = [
    { type: 'M', x: cx - w * 0.7, y: cy - h * 0.8 },
    { type: 'L', x: cx + w * 0.7, y: cy - h * 0.8 },
    {
      type: 'C',
      x: cx + w * 0.72,
      y: cy - h * 0.9,
      cp1: { x: cx + w * 0.72, y: cy - h * 0.82 },
      cp2: { x: cx + w * 0.72, y: cy - h * 0.88 },
    },
    { type: 'L', x: cx - w * 0.72, y: cy - h * 0.9 },
    {
      type: 'C',
      x: cx - w * 0.7,
      y: cy - h * 0.8,
      cp1: { x: cx - w * 0.72, y: cy - h * 0.88 },
      cp2: { x: cx - w * 0.72, y: cy - h * 0.82 },
    },
    { type: 'Z', x: cx - w * 0.7, y: cy - h * 0.8 },
  ]

  // Liquid inside (optional - coffee)
  const liquid: PathCommand[] = [
    { type: 'M', x: cx - w * 0.6, y: cy - h * 0.7 },
    { type: 'L', x: cx + w * 0.6, y: cy - h * 0.7 },
    {
      type: 'C',
      x: cx - w * 0.6,
      y: cy - h * 0.7,
      cp1: { x: cx + w * 0.3, y: cy - h * 0.5 },
      cp2: { x: cx - w * 0.3, y: cy - h * 0.5 },
    },
    { type: 'Z', x: cx - w * 0.6, y: cy - h * 0.7 },
  ]

  return [
    {
      id: 'cup-body',
      name: 'Body',
      commands: body,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 1.5,
      zIndex: 0,
    },
    {
      id: 'cup-handle',
      name: 'Handle',
      commands: handle,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 1.5,
      zIndex: 1,
    },
    {
      id: 'cup-rim',
      name: 'Rim',
      commands: rim,
      fill: '#FFFFFF',
      stroke: colors.stroke,
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'cup-liquid',
      name: 'Liquid',
      commands: liquid,
      fill: '#4E342E',
      stroke: 'none',
      strokeWidth: 0,
      zIndex: 3,
    },
  ]
}
