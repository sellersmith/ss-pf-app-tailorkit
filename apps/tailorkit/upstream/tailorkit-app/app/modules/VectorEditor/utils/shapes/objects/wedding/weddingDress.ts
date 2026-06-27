/**
 * Wedding Dress Shape Generator
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { WEDDING_COLORS } from './colors'

/**
 * Generate wedding dress shape
 */
export function generateWeddingDress(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = WEDDING_COLORS.dress
  const w = width
  const h = height

  // Bodice (top part)
  const bodice: PathCommand[] = [
    { type: 'M', x: cx - w * 0.15, y: cy - h * 0.35 },
    {
      type: 'C',
      x: cx - w * 0.2,
      y: cy - h * 0.15,
      cp1: { x: cx - w * 0.18, y: cy - h * 0.28 },
      cp2: { x: cx - w * 0.22, y: cy - h * 0.2 },
    },
    { type: 'L', x: cx + w * 0.2, y: cy - h * 0.15 },
    {
      type: 'C',
      x: cx + w * 0.15,
      y: cy - h * 0.35,
      cp1: { x: cx + w * 0.22, y: cy - h * 0.2 },
      cp2: { x: cx + w * 0.18, y: cy - h * 0.28 },
    },
    { type: 'Z', x: cx - w * 0.15, y: cy - h * 0.35 },
  ]

  // Neckline decoration
  const neckline: PathCommand[] = [
    { type: 'M', x: cx - w * 0.12, y: cy - h * 0.35 },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.28,
      cp1: { x: cx - w * 0.08, y: cy - h * 0.3 },
      cp2: { x: cx - w * 0.04, y: cy - h * 0.28 },
    },
    {
      type: 'C',
      x: cx + w * 0.12,
      y: cy - h * 0.35,
      cp1: { x: cx + w * 0.04, y: cy - h * 0.28 },
      cp2: { x: cx + w * 0.08, y: cy - h * 0.3 },
    },
  ]

  // Skirt (A-line)
  const skirt: PathCommand[] = [
    { type: 'M', x: cx - w * 0.2, y: cy - h * 0.15 },
    {
      type: 'C',
      x: cx - w * 0.45,
      y: cy + h * 0.45,
      cp1: { x: cx - w * 0.25, y: cy + h * 0.1 },
      cp2: { x: cx - w * 0.4, y: cy + h * 0.3 },
    },
    {
      type: 'C',
      x: cx + w * 0.45,
      y: cy + h * 0.45,
      cp1: { x: cx - w * 0.15, y: cy + h * 0.5 },
      cp2: { x: cx + w * 0.15, y: cy + h * 0.5 },
    },
    {
      type: 'C',
      x: cx + w * 0.2,
      y: cy - h * 0.15,
      cp1: { x: cx + w * 0.4, y: cy + h * 0.3 },
      cp2: { x: cx + w * 0.25, y: cy + h * 0.1 },
    },
    { type: 'Z', x: cx - w * 0.2, y: cy - h * 0.15 },
  ]

  // Waist ribbon/sash
  const ribbon: PathCommand[] = [
    { type: 'M', x: cx - w * 0.2, y: cy - h * 0.15 },
    { type: 'L', x: cx + w * 0.2, y: cy - h * 0.15 },
    { type: 'L', x: cx + w * 0.22, y: cy - h * 0.1 },
    { type: 'L', x: cx - w * 0.22, y: cy - h * 0.1 },
    { type: 'Z', x: cx - w * 0.2, y: cy - h * 0.15 },
  ]

  // Ribbon bow
  const bowLeft: PathCommand[] = [
    { type: 'M', x: cx, y: cy - h * 0.12 },
    {
      type: 'C',
      x: cx - w * 0.12,
      y: cy - h * 0.08,
      cp1: { x: cx - w * 0.04, y: cy - h * 0.14 },
      cp2: { x: cx - w * 0.1, y: cy - h * 0.12 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.12,
      cp1: { x: cx - w * 0.1, y: cy - h * 0.04 },
      cp2: { x: cx - w * 0.02, y: cy - h * 0.08 },
    },
    { type: 'Z', x: cx, y: cy - h * 0.12 },
  ]

  const bowRight: PathCommand[] = [
    { type: 'M', x: cx, y: cy - h * 0.12 },
    {
      type: 'C',
      x: cx + w * 0.12,
      y: cy - h * 0.08,
      cp1: { x: cx + w * 0.04, y: cy - h * 0.14 },
      cp2: { x: cx + w * 0.1, y: cy - h * 0.12 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.12,
      cp1: { x: cx + w * 0.1, y: cy - h * 0.04 },
      cp2: { x: cx + w * 0.02, y: cy - h * 0.08 },
    },
    { type: 'Z', x: cx, y: cy - h * 0.12 },
  ]

  return [
    {
      id: 'dress-skirt',
      name: 'Skirt',
      commands: skirt,
      fill: colors.body,
      stroke: colors.bodyStroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'dress-bodice',
      name: 'Bodice',
      commands: bodice,
      fill: colors.body,
      stroke: colors.bodyStroke,
      strokeWidth: 1,
      zIndex: 1,
    },
    {
      id: 'dress-neckline',
      name: 'Neckline',
      commands: neckline,
      fill: 'none',
      stroke: colors.detail,
      strokeWidth: 1.5,
      zIndex: 2,
    },
    {
      id: 'dress-ribbon',
      name: 'Ribbon',
      commands: ribbon,
      fill: colors.ribbon,
      stroke: colors.ribbonStroke,
      strokeWidth: 0.5,
      zIndex: 3,
    },
    {
      id: 'dress-bow-l',
      name: 'Bow Left',
      commands: bowLeft,
      fill: colors.ribbon,
      stroke: colors.ribbonStroke,
      strokeWidth: 0.3,
      zIndex: 4,
    },
    {
      id: 'dress-bow-r',
      name: 'Bow Right',
      commands: bowRight,
      fill: colors.ribbon,
      stroke: colors.ribbonStroke,
      strokeWidth: 0.3,
      zIndex: 4,
    },
  ]
}
