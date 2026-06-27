/**
 * Fern Leaf Shape Generator
 * Creates a fern frond with multiple leaflets
 */

import type { PathCommand } from '../../../svg'
import type { NaturePathResult } from '../types'
import { LEAF_COLORS, STEM_COLORS } from '../types'

/**
 * Generate fern frond shape
 */
export function generateLeafFern(cx: number, cy: number, width: number, height: number): NaturePathResult[] {
  const leafColor = LEAF_COLORS.darkGreen
  const stemColor = STEM_COLORS.green

  const w = width / 2
  const h = height / 2

  const results: NaturePathResult[] = []

  // Central stem
  const stem: PathCommand[] = [
    { type: 'M', x: cx, y: cy + h },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.95,
      cp1: { x: cx - w * 0.05, y: cy + h * 0.3 },
      cp2: { x: cx + w * 0.03, y: cy - h * 0.5 },
    },
  ]

  results.push({
    id: 'fern-stem',
    name: 'Stem',
    commands: stem,
    fill: 'none',
    stroke: stemColor.fill,
    strokeWidth: 2,
    zIndex: 0,
  })

  // Generate leaflets along the stem
  const leafletCount = 8
  const leafletSpacing = (h * 1.8) / leafletCount

  for (let i = 0; i < leafletCount; i++) {
    const t = i / leafletCount
    const yPos = cy + h * 0.75 - i * leafletSpacing
    const leafletSize = (1 - t * 0.7) * w * 0.6 // Leaflets get smaller toward top

    // Right leaflet
    const rightLeaflet: PathCommand[] = [
      { type: 'M', x: cx, y: yPos },
      {
        type: 'C',
        x: cx + leafletSize,
        y: yPos - leafletSpacing * 0.3,
        cp1: { x: cx + leafletSize * 0.3, y: yPos - leafletSpacing * 0.1 },
        cp2: { x: cx + leafletSize * 0.7, y: yPos - leafletSpacing * 0.2 },
      },
      {
        type: 'C',
        x: cx,
        y: yPos - leafletSpacing * 0.15,
        cp1: { x: cx + leafletSize * 0.7, y: yPos - leafletSpacing * 0.35 },
        cp2: { x: cx + leafletSize * 0.3, y: yPos - leafletSpacing * 0.25 },
      },
      { type: 'Z', x: cx, y: yPos },
    ]

    // Left leaflet
    const leftLeaflet: PathCommand[] = [
      { type: 'M', x: cx, y: yPos },
      {
        type: 'C',
        x: cx - leafletSize,
        y: yPos - leafletSpacing * 0.3,
        cp1: { x: cx - leafletSize * 0.3, y: yPos - leafletSpacing * 0.1 },
        cp2: { x: cx - leafletSize * 0.7, y: yPos - leafletSpacing * 0.2 },
      },
      {
        type: 'C',
        x: cx,
        y: yPos - leafletSpacing * 0.15,
        cp1: { x: cx - leafletSize * 0.7, y: yPos - leafletSpacing * 0.35 },
        cp2: { x: cx - leafletSize * 0.3, y: yPos - leafletSpacing * 0.25 },
      },
      { type: 'Z', x: cx, y: yPos },
    ]

    results.push({
      id: `fern-leaflet-right-${i}`,
      name: `Right Leaflet ${i + 1}`,
      commands: rightLeaflet,
      fill: leafColor.fill,
      stroke: leafColor.stroke,
      strokeWidth: 0.5,
      zIndex: 1,
    })

    results.push({
      id: `fern-leaflet-left-${i}`,
      name: `Left Leaflet ${i + 1}`,
      commands: leftLeaflet,
      fill: leafColor.fill,
      stroke: leafColor.stroke,
      strokeWidth: 0.5,
      zIndex: 1,
    })
  }

  // Top tip leaflet
  const tipLeaflet: PathCommand[] = [
    { type: 'M', x: cx, y: cy - h * 0.75 },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.98,
      cp1: { x: cx + w * 0.1, y: cy - h * 0.85 },
      cp2: { x: cx + w * 0.05, y: cy - h * 0.95 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.75,
      cp1: { x: cx - w * 0.05, y: cy - h * 0.95 },
      cp2: { x: cx - w * 0.1, y: cy - h * 0.85 },
    },
    { type: 'Z', x: cx, y: cy - h * 0.75 },
  ]

  results.push({
    id: 'fern-tip',
    name: 'Tip',
    commands: tipLeaflet,
    fill: leafColor.fill,
    stroke: leafColor.stroke,
    strokeWidth: 0.5,
    zIndex: 1,
  })

  return results
}
