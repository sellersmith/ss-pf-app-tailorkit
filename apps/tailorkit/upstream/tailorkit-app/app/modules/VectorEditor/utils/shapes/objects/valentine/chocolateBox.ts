/**
 * Chocolate Box Shape Generator
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { K, createHeartPath, VALENTINE_COLORS } from './colors'

/**
 * Generate chocolate box shape
 */
export function generateChocolateBox(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = VALENTINE_COLORS.chocolateBox
  const w = width
  const h = height

  // Box body
  const boxBody: PathCommand[] = [
    { type: 'M', x: cx - w * 0.45, y: cy - h * 0.2 },
    { type: 'L', x: cx + w * 0.45, y: cy - h * 0.2 },
    { type: 'L', x: cx + w * 0.45, y: cy + h * 0.35 },
    { type: 'L', x: cx - w * 0.45, y: cy + h * 0.35 },
    { type: 'Z', x: cx - w * 0.45, y: cy - h * 0.2 },
  ]

  // Box lid
  const boxLid: PathCommand[] = [
    { type: 'M', x: cx - w * 0.48, y: cy - h * 0.35 },
    { type: 'L', x: cx + w * 0.48, y: cy - h * 0.35 },
    { type: 'L', x: cx + w * 0.48, y: cy - h * 0.2 },
    { type: 'L', x: cx - w * 0.48, y: cy - h * 0.2 },
    { type: 'Z', x: cx - w * 0.48, y: cy - h * 0.35 },
  ]

  // Heart decoration on lid - using the helper function for proper heart shape
  const heartDecoCy = cy - h * 0.28
  const heartDecoWidth = w * 0.22
  const heartDecoHeight = h * 0.18
  const heart: PathCommand[] = createHeartPath(cx, heartDecoCy, heartDecoWidth, heartDecoHeight)

  // Chocolates (3 circles in a row)
  const chocolates: PathCommand[] = []
  const chocR = w * 0.1
  const chocY = cy + h * 0.1
  for (let i = -1; i <= 1; i++) {
    const chocCx = cx + i * w * 0.25
    chocolates.push(
      { type: 'M', x: chocCx, y: chocY - chocR },
      {
        type: 'C',
        x: chocCx + chocR,
        y: chocY,
        cp1: { x: chocCx + chocR * K, y: chocY - chocR },
        cp2: { x: chocCx + chocR, y: chocY - chocR * K },
      },
      {
        type: 'C',
        x: chocCx,
        y: chocY + chocR,
        cp1: { x: chocCx + chocR, y: chocY + chocR * K },
        cp2: { x: chocCx + chocR * K, y: chocY + chocR },
      },
      {
        type: 'C',
        x: chocCx - chocR,
        y: chocY,
        cp1: { x: chocCx - chocR * K, y: chocY + chocR },
        cp2: { x: chocCx - chocR, y: chocY + chocR * K },
      },
      {
        type: 'C',
        x: chocCx,
        y: chocY - chocR,
        cp1: { x: chocCx - chocR, y: chocY - chocR * K },
        cp2: { x: chocCx - chocR * K, y: chocY - chocR },
      },
      { type: 'Z', x: chocCx, y: chocY - chocR }
    )
  }

  return [
    {
      id: 'chocbox-body',
      name: 'Box',
      commands: boxBody,
      fill: colors.box,
      stroke: colors.boxStroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'chocbox-chocolates',
      name: 'Chocolates',
      commands: chocolates,
      fill: colors.chocolates,
      stroke: colors.chocolatesStroke,
      strokeWidth: 0.5,
      zIndex: 1,
    },
    {
      id: 'chocbox-lid',
      name: 'Lid',
      commands: boxLid,
      fill: colors.lid,
      stroke: colors.boxStroke,
      strokeWidth: 1,
      zIndex: 2,
    },
    {
      id: 'chocbox-heart',
      name: 'Heart',
      commands: heart,
      fill: colors.ribbon,
      stroke: colors.ribbonStroke,
      strokeWidth: 0.5,
      zIndex: 3,
    },
  ]
}
