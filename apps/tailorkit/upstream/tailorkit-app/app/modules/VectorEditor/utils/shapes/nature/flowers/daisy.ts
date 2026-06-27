/**
 * Daisy Flower Shape Generator
 * Creates a simple daisy with elongated petals
 */

import type { PathCommand } from '../../../svg'
import type { NaturePathResult } from '../types'
import { FLOWER_COLORS, STEM_COLORS } from '../types'

/**
 * Generate daisy flower shape
 */
export function generateFlowerDaisy(cx: number, cy: number, width: number, height: number): NaturePathResult[] {
  const flowerColor = FLOWER_COLORS.white
  const stemColor = STEM_COLORS.green

  const w = width / 2
  const h = height / 2

  const results: NaturePathResult[] = []

  // Stem
  const stem: PathCommand[] = [
    { type: 'M', x: cx - w * 0.04, y: cy + h * 0.15 },
    { type: 'L', x: cx - w * 0.06, y: cy + h },
    { type: 'L', x: cx + w * 0.06, y: cy + h },
    { type: 'L', x: cx + w * 0.04, y: cy + h * 0.15 },
    { type: 'Z', x: cx - w * 0.04, y: cy + h * 0.15 },
  ]

  results.push({
    id: 'daisy-stem',
    name: 'Stem',
    commands: stem,
    fill: stemColor.fill,
    stroke: stemColor.stroke,
    strokeWidth: 0.5,
    zIndex: 0,
  })

  // Petals (12 elongated petals)
  const petalCount = 12
  const petalLength = h * 0.85
  const petalWidth = w * 0.18

  for (let i = 0; i < petalCount; i++) {
    const angle = (i * 360) / petalCount - 90
    const rad = angle * (Math.PI / 180)

    const tipX = cx + Math.cos(rad) * petalLength
    const tipY = cy - h * 0.15 + Math.sin(rad) * petalLength

    const petal: PathCommand[] = [
      { type: 'M', x: cx, y: cy - h * 0.15 },
      {
        type: 'C',
        x: tipX,
        y: tipY,
        cp1: {
          x: cx + Math.cos(rad) * petalLength * 0.3 + Math.cos(rad + Math.PI / 2) * petalWidth,
          y: cy - h * 0.15 + Math.sin(rad) * petalLength * 0.3 + Math.sin(rad + Math.PI / 2) * petalWidth,
        },
        cp2: {
          x: tipX + Math.cos(rad + Math.PI / 2) * petalWidth * 0.5,
          y: tipY + Math.sin(rad + Math.PI / 2) * petalWidth * 0.5,
        },
      },
      {
        type: 'C',
        x: cx,
        y: cy - h * 0.15,
        cp1: {
          x: tipX + Math.cos(rad - Math.PI / 2) * petalWidth * 0.5,
          y: tipY + Math.sin(rad - Math.PI / 2) * petalWidth * 0.5,
        },
        cp2: {
          x: cx + Math.cos(rad) * petalLength * 0.3 + Math.cos(rad - Math.PI / 2) * petalWidth,
          y: cy - h * 0.15 + Math.sin(rad) * petalLength * 0.3 + Math.sin(rad - Math.PI / 2) * petalWidth,
        },
      },
      { type: 'Z', x: cx, y: cy - h * 0.15 },
    ]

    results.push({
      id: `daisy-petal-${i}`,
      name: `Petal ${i + 1}`,
      commands: petal,
      fill: flowerColor.petal,
      stroke: flowerColor.petalStroke,
      strokeWidth: 0.5,
      zIndex: 1,
    })
  }

  // Center (yellow disc)
  const centerRadius = w * 0.25
  const center: PathCommand[] = [
    { type: 'M', x: cx, y: cy - h * 0.15 - centerRadius },
    {
      type: 'C',
      x: cx + centerRadius,
      y: cy - h * 0.15,
      cp1: { x: cx + centerRadius * 0.55, y: cy - h * 0.15 - centerRadius },
      cp2: { x: cx + centerRadius, y: cy - h * 0.15 - centerRadius * 0.55 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.15 + centerRadius,
      cp1: { x: cx + centerRadius, y: cy - h * 0.15 + centerRadius * 0.55 },
      cp2: { x: cx + centerRadius * 0.55, y: cy - h * 0.15 + centerRadius },
    },
    {
      type: 'C',
      x: cx - centerRadius,
      y: cy - h * 0.15,
      cp1: { x: cx - centerRadius * 0.55, y: cy - h * 0.15 + centerRadius },
      cp2: { x: cx - centerRadius, y: cy - h * 0.15 + centerRadius * 0.55 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.15 - centerRadius,
      cp1: { x: cx - centerRadius, y: cy - h * 0.15 - centerRadius * 0.55 },
      cp2: { x: cx - centerRadius * 0.55, y: cy - h * 0.15 - centerRadius },
    },
    { type: 'Z', x: cx, y: cy - h * 0.15 - centerRadius },
  ]

  results.push({
    id: 'daisy-center',
    name: 'Center',
    commands: center,
    fill: flowerColor.center,
    stroke: flowerColor.centerStroke,
    strokeWidth: 1,
    zIndex: 2,
  })

  return results
}
