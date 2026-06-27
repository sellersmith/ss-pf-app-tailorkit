/**
 * Valentine Color Presets
 * Shared colors for Valentine-themed shapes
 */

import type { PathCommand } from '../../../svg'

export const K = 0.5522847498 // Bezier approximation of circle

/**
 * Helper function to generate a proper heart shape at given position and size
 * Uses the proven working heart formula from shapeGenerators
 */
export function createHeartPath(cx: number, cy: number, width: number, height: number): PathCommand[] {
  const hw = width / 2
  const hh = height / 2
  const topOffset = hh * 0.3

  return [
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
}

export const VALENTINE_COLORS = {
  heart: {
    body: '#E91E63',
    bodyStroke: '#AD1457',
    highlight: '#F8BBD9',
  },
  cupidArrow: {
    shaft: '#8D6E63',
    shaftStroke: '#5D4037',
    head: '#9E9E9E',
    headStroke: '#616161',
    feather: '#F44336',
    featherStroke: '#C62828',
  },
  loveLetter: {
    envelope: '#FFECB3',
    envelopeStroke: '#FFB300',
    flap: '#FFF8E1',
    heart: '#E91E63',
    heartStroke: '#AD1457',
  },
  rose: {
    petals: '#E91E63',
    petalsStroke: '#AD1457',
    center: '#C2185B',
    stem: '#4CAF50',
    stemStroke: '#2E7D32',
    leaf: '#81C784',
    leafStroke: '#4CAF50',
  },
  ring: {
    band: '#FFD54F',
    bandStroke: '#FF8F00',
    gem: '#E91E63',
    gemStroke: '#AD1457',
    shine: '#FFECB3',
  },
  chocolateBox: {
    box: '#8D6E63',
    boxStroke: '#5D4037',
    lid: '#6D4C41',
    ribbon: '#E91E63',
    ribbonStroke: '#AD1457',
    chocolates: '#4E342E',
    chocolatesStroke: '#3E2723',
  },
}
