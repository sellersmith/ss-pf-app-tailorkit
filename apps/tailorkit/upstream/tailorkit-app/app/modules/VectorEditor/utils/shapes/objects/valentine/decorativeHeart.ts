/**
 * Decorative Heart Shape Generator
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { K, VALENTINE_COLORS } from './colors'

/**
 * Generate decorative heart shape with highlight
 */
export function generateDecorativeHeart(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = VALENTINE_COLORS.heart
  const hw = width / 2
  const hh = height / 2
  const topOffset = hh * 0.3

  // Main heart body - using the proven working heart shape formula
  const heartBody: PathCommand[] = [
    { type: 'M', x: cx, y: cy + hh }, // Bottom point
    {
      type: 'C',
      x: cx - hw,
      y: cy - topOffset,
      cp1: { x: cx - hw, y: cy + hh * 0.3 },
      cp2: { x: cx - hw, y: cy },
    },
    {
      type: 'C',
      x: cx,
      y: cy - hh * 0.2,
      cp1: { x: cx - hw, y: cy - hh * 0.6 },
      cp2: { x: cx - hw * 0.3, y: cy - hh * 0.5 },
    },
    {
      type: 'C',
      x: cx + hw,
      y: cy - topOffset,
      cp1: { x: cx + hw * 0.3, y: cy - hh * 0.5 },
      cp2: { x: cx + hw, y: cy - hh * 0.6 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + hh,
      cp1: { x: cx + hw, y: cy },
      cp2: { x: cx + hw, y: cy + hh * 0.3 },
    },
    { type: 'Z', x: cx, y: cy + hh },
  ]

  // Highlight on left lobe
  const highlightR = width * 0.08
  const highlightCx = cx - hw * 0.5
  const highlightCy = cy - hh * 0.2
  const highlight: PathCommand[] = [
    { type: 'M', x: highlightCx, y: highlightCy - highlightR },
    {
      type: 'C',
      x: highlightCx + highlightR,
      y: highlightCy,
      cp1: { x: highlightCx + highlightR * K, y: highlightCy - highlightR },
      cp2: { x: highlightCx + highlightR, y: highlightCy - highlightR * K },
    },
    {
      type: 'C',
      x: highlightCx,
      y: highlightCy + highlightR,
      cp1: { x: highlightCx + highlightR, y: highlightCy + highlightR * K },
      cp2: { x: highlightCx + highlightR * K, y: highlightCy + highlightR },
    },
    {
      type: 'C',
      x: highlightCx - highlightR,
      y: highlightCy,
      cp1: { x: highlightCx - highlightR * K, y: highlightCy + highlightR },
      cp2: { x: highlightCx - highlightR, y: highlightCy + highlightR * K },
    },
    {
      type: 'C',
      x: highlightCx,
      y: highlightCy - highlightR,
      cp1: { x: highlightCx - highlightR, y: highlightCy - highlightR * K },
      cp2: { x: highlightCx - highlightR * K, y: highlightCy - highlightR },
    },
    { type: 'Z', x: highlightCx, y: highlightCy - highlightR },
  ]

  return [
    {
      id: 'heart-body',
      name: 'Heart',
      commands: heartBody,
      fill: colors.body,
      stroke: colors.bodyStroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'heart-highlight',
      name: 'Highlight',
      commands: highlight,
      fill: colors.highlight,
      stroke: 'none',
      strokeWidth: 0,
      zIndex: 1,
    },
  ]
}
