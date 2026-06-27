/**
 * Wedding Rings Shape Generator
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { K, WEDDING_COLORS } from './colors'

/**
 * Generate wedding rings shape (interlocked)
 */
export function generateWeddingRings(cx: number, cy: number, width: number, _height: number): ObjectPathResult[] {
  const colors = WEDDING_COLORS.rings
  const w = width

  // Left ring outer
  const leftRingCx = cx - w * 0.12
  const ringR = w * 0.25
  const ringInnerR = w * 0.16

  const leftRingOuter: PathCommand[] = [
    { type: 'M', x: leftRingCx, y: cy - ringR },
    {
      type: 'C',
      x: leftRingCx + ringR,
      y: cy,
      cp1: { x: leftRingCx + ringR * K, y: cy - ringR },
      cp2: { x: leftRingCx + ringR, y: cy - ringR * K },
    },
    {
      type: 'C',
      x: leftRingCx,
      y: cy + ringR,
      cp1: { x: leftRingCx + ringR, y: cy + ringR * K },
      cp2: { x: leftRingCx + ringR * K, y: cy + ringR },
    },
    {
      type: 'C',
      x: leftRingCx - ringR,
      y: cy,
      cp1: { x: leftRingCx - ringR * K, y: cy + ringR },
      cp2: { x: leftRingCx - ringR, y: cy + ringR * K },
    },
    {
      type: 'C',
      x: leftRingCx,
      y: cy - ringR,
      cp1: { x: leftRingCx - ringR, y: cy - ringR * K },
      cp2: { x: leftRingCx - ringR * K, y: cy - ringR },
    },
    { type: 'Z', x: leftRingCx, y: cy - ringR },
  ]

  // Left ring inner (hole)
  const leftRingInner: PathCommand[] = [
    { type: 'M', x: leftRingCx, y: cy - ringInnerR },
    {
      type: 'C',
      x: leftRingCx + ringInnerR,
      y: cy,
      cp1: { x: leftRingCx + ringInnerR * K, y: cy - ringInnerR },
      cp2: { x: leftRingCx + ringInnerR, y: cy - ringInnerR * K },
    },
    {
      type: 'C',
      x: leftRingCx,
      y: cy + ringInnerR,
      cp1: { x: leftRingCx + ringInnerR, y: cy + ringInnerR * K },
      cp2: { x: leftRingCx + ringInnerR * K, y: cy + ringInnerR },
    },
    {
      type: 'C',
      x: leftRingCx - ringInnerR,
      y: cy,
      cp1: { x: leftRingCx - ringInnerR * K, y: cy + ringInnerR },
      cp2: { x: leftRingCx - ringInnerR, y: cy + ringInnerR * K },
    },
    {
      type: 'C',
      x: leftRingCx,
      y: cy - ringInnerR,
      cp1: { x: leftRingCx - ringInnerR, y: cy - ringInnerR * K },
      cp2: { x: leftRingCx - ringInnerR * K, y: cy - ringInnerR },
    },
    { type: 'Z', x: leftRingCx, y: cy - ringInnerR },
  ]

  // Right ring outer
  const rightRingCx = cx + w * 0.12

  const rightRingOuter: PathCommand[] = [
    { type: 'M', x: rightRingCx, y: cy - ringR },
    {
      type: 'C',
      x: rightRingCx + ringR,
      y: cy,
      cp1: { x: rightRingCx + ringR * K, y: cy - ringR },
      cp2: { x: rightRingCx + ringR, y: cy - ringR * K },
    },
    {
      type: 'C',
      x: rightRingCx,
      y: cy + ringR,
      cp1: { x: rightRingCx + ringR, y: cy + ringR * K },
      cp2: { x: rightRingCx + ringR * K, y: cy + ringR },
    },
    {
      type: 'C',
      x: rightRingCx - ringR,
      y: cy,
      cp1: { x: rightRingCx - ringR * K, y: cy + ringR },
      cp2: { x: rightRingCx - ringR, y: cy + ringR * K },
    },
    {
      type: 'C',
      x: rightRingCx,
      y: cy - ringR,
      cp1: { x: rightRingCx - ringR, y: cy - ringR * K },
      cp2: { x: rightRingCx - ringR * K, y: cy - ringR },
    },
    { type: 'Z', x: rightRingCx, y: cy - ringR },
  ]

  // Right ring inner (hole)
  const rightRingInner: PathCommand[] = [
    { type: 'M', x: rightRingCx, y: cy - ringInnerR },
    {
      type: 'C',
      x: rightRingCx + ringInnerR,
      y: cy,
      cp1: { x: rightRingCx + ringInnerR * K, y: cy - ringInnerR },
      cp2: { x: rightRingCx + ringInnerR, y: cy - ringInnerR * K },
    },
    {
      type: 'C',
      x: rightRingCx,
      y: cy + ringInnerR,
      cp1: { x: rightRingCx + ringInnerR, y: cy + ringInnerR * K },
      cp2: { x: rightRingCx + ringInnerR * K, y: cy + ringInnerR },
    },
    {
      type: 'C',
      x: rightRingCx - ringInnerR,
      y: cy,
      cp1: { x: rightRingCx - ringInnerR * K, y: cy + ringInnerR },
      cp2: { x: rightRingCx - ringInnerR, y: cy + ringInnerR * K },
    },
    {
      type: 'C',
      x: rightRingCx,
      y: cy - ringInnerR,
      cp1: { x: rightRingCx - ringInnerR, y: cy - ringInnerR * K },
      cp2: { x: rightRingCx - ringInnerR * K, y: cy - ringInnerR },
    },
    { type: 'Z', x: rightRingCx, y: cy - ringInnerR },
  ]

  // Small diamond on right ring
  const gemSize = w * 0.06
  const gemCx = rightRingCx
  const gemCy = cy - ringR + w * 0.03
  const gem: PathCommand[] = [
    { type: 'M', x: gemCx, y: gemCy - gemSize },
    { type: 'L', x: gemCx + gemSize * 0.7, y: gemCy },
    { type: 'L', x: gemCx, y: gemCy + gemSize * 0.5 },
    { type: 'L', x: gemCx - gemSize * 0.7, y: gemCy },
    { type: 'Z', x: gemCx, y: gemCy - gemSize },
  ]

  return [
    {
      id: 'rings-left',
      name: 'Left Ring',
      commands: leftRingOuter,
      fill: colors.band,
      stroke: colors.bandStroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'rings-left-hole',
      name: 'Left Hole',
      commands: leftRingInner,
      fill: '#FFFFFF',
      stroke: colors.bandStroke,
      strokeWidth: 0.5,
      zIndex: 1,
    },
    {
      id: 'rings-right',
      name: 'Right Ring',
      commands: rightRingOuter,
      fill: colors.band,
      stroke: colors.bandStroke,
      strokeWidth: 1,
      zIndex: 2,
    },
    {
      id: 'rings-right-hole',
      name: 'Right Hole',
      commands: rightRingInner,
      fill: '#FFFFFF',
      stroke: colors.bandStroke,
      strokeWidth: 0.5,
      zIndex: 3,
    },
    {
      id: 'rings-gem',
      name: 'Diamond',
      commands: gem,
      fill: colors.gem,
      stroke: colors.gemStroke,
      strokeWidth: 0.5,
      zIndex: 4,
    },
  ]
}
