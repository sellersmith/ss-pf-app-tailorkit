/**
 * Headphones Shape Generator
 * Creates over-ear headphones shape with band and ear cups
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { OBJECT_COLORS } from '../types'

/**
 * Generate headphones shape
 */
export function generateHeadphones(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = OBJECT_COLORS.electronics.headphones
  const w = width / 2
  const h = height / 2

  // Headband
  const band: PathCommand[] = [
    { type: 'M', x: cx - w * 0.7, y: cy },
    {
      type: 'C',
      x: cx + w * 0.7,
      y: cy,
      cp1: { x: cx - w * 0.7, y: cy - h * 1.2 },
      cp2: { x: cx + w * 0.7, y: cy - h * 1.2 },
    },
  ]

  // Inner headband
  const bandInner: PathCommand[] = [
    { type: 'M', x: cx - w * 0.6, y: cy - h * 0.1 },
    {
      type: 'C',
      x: cx + w * 0.6,
      y: cy - h * 0.1,
      cp1: { x: cx - w * 0.6, y: cy - h * 0.9 },
      cp2: { x: cx + w * 0.6, y: cy - h * 0.9 },
    },
  ]

  // Left ear cup
  const leftCup: PathCommand[] = [
    { type: 'M', x: cx - w * 0.85, y: cy - h * 0.1 },
    {
      type: 'C',
      x: cx - w * 0.85,
      y: cy + h * 0.7,
      cp1: { x: cx - w * 1.1, y: cy - h * 0.1 },
      cp2: { x: cx - w * 1.1, y: cy + h * 0.7 },
    },
    {
      type: 'C',
      x: cx - w * 0.55,
      y: cy + h * 0.7,
      cp1: { x: cx - w * 0.85, y: cy + h * 0.95 },
      cp2: { x: cx - w * 0.55, y: cy + h * 0.95 },
    },
    {
      type: 'C',
      x: cx - w * 0.55,
      y: cy - h * 0.1,
      cp1: { x: cx - w * 0.3, y: cy + h * 0.7 },
      cp2: { x: cx - w * 0.3, y: cy - h * 0.1 },
    },
    { type: 'Z', x: cx - w * 0.85, y: cy - h * 0.1 },
  ]

  // Right ear cup
  const rightCup: PathCommand[] = [
    { type: 'M', x: cx + w * 0.85, y: cy - h * 0.1 },
    {
      type: 'C',
      x: cx + w * 0.85,
      y: cy + h * 0.7,
      cp1: { x: cx + w * 1.1, y: cy - h * 0.1 },
      cp2: { x: cx + w * 1.1, y: cy + h * 0.7 },
    },
    {
      type: 'C',
      x: cx + w * 0.55,
      y: cy + h * 0.7,
      cp1: { x: cx + w * 0.85, y: cy + h * 0.95 },
      cp2: { x: cx + w * 0.55, y: cy + h * 0.95 },
    },
    {
      type: 'C',
      x: cx + w * 0.55,
      y: cy - h * 0.1,
      cp1: { x: cx + w * 0.3, y: cy + h * 0.7 },
      cp2: { x: cx + w * 0.3, y: cy - h * 0.1 },
    },
    { type: 'Z', x: cx + w * 0.85, y: cy - h * 0.1 },
  ]

  // Left ear cushion
  const leftCushion: PathCommand[] = [
    { type: 'M', x: cx - w * 0.8, y: cy + h * 0.05 },
    {
      type: 'C',
      x: cx - w * 0.8,
      y: cy + h * 0.55,
      cp1: { x: cx - w * 0.95, y: cy + h * 0.05 },
      cp2: { x: cx - w * 0.95, y: cy + h * 0.55 },
    },
    {
      type: 'C',
      x: cx - w * 0.6,
      y: cy + h * 0.55,
      cp1: { x: cx - w * 0.8, y: cy + h * 0.7 },
      cp2: { x: cx - w * 0.6, y: cy + h * 0.7 },
    },
    {
      type: 'C',
      x: cx - w * 0.6,
      y: cy + h * 0.05,
      cp1: { x: cx - w * 0.45, y: cy + h * 0.55 },
      cp2: { x: cx - w * 0.45, y: cy + h * 0.05 },
    },
    { type: 'Z', x: cx - w * 0.8, y: cy + h * 0.05 },
  ]

  // Right ear cushion
  const rightCushion: PathCommand[] = [
    { type: 'M', x: cx + w * 0.8, y: cy + h * 0.05 },
    {
      type: 'C',
      x: cx + w * 0.8,
      y: cy + h * 0.55,
      cp1: { x: cx + w * 0.95, y: cy + h * 0.05 },
      cp2: { x: cx + w * 0.95, y: cy + h * 0.55 },
    },
    {
      type: 'C',
      x: cx + w * 0.6,
      y: cy + h * 0.55,
      cp1: { x: cx + w * 0.8, y: cy + h * 0.7 },
      cp2: { x: cx + w * 0.6, y: cy + h * 0.7 },
    },
    {
      type: 'C',
      x: cx + w * 0.6,
      y: cy + h * 0.05,
      cp1: { x: cx + w * 0.45, y: cy + h * 0.55 },
      cp2: { x: cx + w * 0.45, y: cy + h * 0.05 },
    },
    { type: 'Z', x: cx + w * 0.8, y: cy + h * 0.05 },
  ]

  return [
    {
      id: 'headphones-band',
      name: 'Band',
      commands: band,
      fill: 'none',
      stroke: colors.fill,
      strokeWidth: 8,
      zIndex: 0,
    },
    {
      id: 'headphones-band-inner',
      name: 'Band Inner',
      commands: bandInner,
      fill: 'none',
      stroke: colors.stroke,
      strokeWidth: 3,
      zIndex: 1,
    },
    {
      id: 'headphones-left-cup',
      name: 'Left Cup',
      commands: leftCup,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 1,
      zIndex: 2,
    },
    {
      id: 'headphones-right-cup',
      name: 'Right Cup',
      commands: rightCup,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 1,
      zIndex: 3,
    },
    {
      id: 'headphones-left-cushion',
      name: 'Left Cushion',
      commands: leftCushion,
      fill: '#424242',
      stroke: '#212121',
      strokeWidth: 0.5,
      zIndex: 4,
    },
    {
      id: 'headphones-right-cushion',
      name: 'Right Cushion',
      commands: rightCushion,
      fill: '#424242',
      stroke: '#212121',
      strokeWidth: 0.5,
      zIndex: 5,
    },
  ]
}
