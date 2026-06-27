/**
 * Sunflower Shape Generator
 * Creates a sunflower with many petals and detailed center
 */

import type { PathCommand } from '../../../svg'
import type { NaturePathResult } from '../types'
import { FLOWER_COLORS, STEM_COLORS } from '../types'

/**
 * Generate sunflower shape
 */
export function generateFlowerSunflower(cx: number, cy: number, width: number, height: number): NaturePathResult[] {
  const flowerColor = FLOWER_COLORS.yellow
  const stemColor = STEM_COLORS.green

  const w = width / 2
  const h = height / 2

  const results: NaturePathResult[] = []

  // Stem
  const stem: PathCommand[] = [
    { type: 'M', x: cx - w * 0.06, y: cy + h * 0.15 },
    { type: 'L', x: cx - w * 0.08, y: cy + h },
    { type: 'L', x: cx + w * 0.08, y: cy + h },
    { type: 'L', x: cx + w * 0.06, y: cy + h * 0.15 },
    { type: 'Z', x: cx - w * 0.06, y: cy + h * 0.15 },
  ]

  results.push({
    id: 'sunflower-stem',
    name: 'Stem',
    commands: stem,
    fill: stemColor.fill,
    stroke: stemColor.stroke,
    strokeWidth: 0.5,
    zIndex: 0,
  })

  // Outer petals (16 petals)
  const outerPetalCount = 16
  const outerPetalLength = h * 0.85
  const outerPetalWidth = w * 0.15

  for (let i = 0; i < outerPetalCount; i++) {
    const angle = (i * 360) / outerPetalCount - 90
    const rad = angle * (Math.PI / 180)

    const tipX = cx + Math.cos(rad) * outerPetalLength
    const tipY = cy - h * 0.1 + Math.sin(rad) * outerPetalLength

    const petal: PathCommand[] = [
      { type: 'M', x: cx, y: cy - h * 0.1 },
      {
        type: 'C',
        x: tipX,
        y: tipY,
        cp1: {
          x: cx + Math.cos(rad) * outerPetalLength * 0.4 + Math.cos(rad + Math.PI / 2) * outerPetalWidth,
          y: cy - h * 0.1 + Math.sin(rad) * outerPetalLength * 0.4 + Math.sin(rad + Math.PI / 2) * outerPetalWidth,
        },
        cp2: {
          x: tipX + Math.cos(rad + Math.PI / 2) * outerPetalWidth * 0.4,
          y: tipY + Math.sin(rad + Math.PI / 2) * outerPetalWidth * 0.4,
        },
      },
      {
        type: 'C',
        x: cx,
        y: cy - h * 0.1,
        cp1: {
          x: tipX + Math.cos(rad - Math.PI / 2) * outerPetalWidth * 0.4,
          y: tipY + Math.sin(rad - Math.PI / 2) * outerPetalWidth * 0.4,
        },
        cp2: {
          x: cx + Math.cos(rad) * outerPetalLength * 0.4 + Math.cos(rad - Math.PI / 2) * outerPetalWidth,
          y: cy - h * 0.1 + Math.sin(rad) * outerPetalLength * 0.4 + Math.sin(rad - Math.PI / 2) * outerPetalWidth,
        },
      },
      { type: 'Z', x: cx, y: cy - h * 0.1 },
    ]

    results.push({
      id: `sunflower-outer-petal-${i}`,
      name: `Outer Petal ${i + 1}`,
      commands: petal,
      fill: flowerColor.petal,
      stroke: flowerColor.petalStroke,
      strokeWidth: 0.5,
      zIndex: 1,
    })
  }

  // Inner petals (offset layer)
  const innerPetalCount = 16
  const innerPetalLength = h * 0.55

  for (let i = 0; i < innerPetalCount; i++) {
    const angle = (i * 360) / innerPetalCount - 90 + 11.25 // Offset by half
    const rad = angle * (Math.PI / 180)

    const tipX = cx + Math.cos(rad) * innerPetalLength
    const tipY = cy - h * 0.1 + Math.sin(rad) * innerPetalLength

    const petal: PathCommand[] = [
      { type: 'M', x: cx, y: cy - h * 0.1 },
      {
        type: 'C',
        x: tipX,
        y: tipY,
        cp1: {
          x: cx + Math.cos(rad) * innerPetalLength * 0.4 + Math.cos(rad + Math.PI / 2) * outerPetalWidth * 0.8,
          y:
            cy - h * 0.1 + Math.sin(rad) * innerPetalLength * 0.4 + Math.sin(rad + Math.PI / 2) * outerPetalWidth * 0.8,
        },
        cp2: {
          x: tipX + Math.cos(rad + Math.PI / 2) * outerPetalWidth * 0.3,
          y: tipY + Math.sin(rad + Math.PI / 2) * outerPetalWidth * 0.3,
        },
      },
      {
        type: 'C',
        x: cx,
        y: cy - h * 0.1,
        cp1: {
          x: tipX + Math.cos(rad - Math.PI / 2) * outerPetalWidth * 0.3,
          y: tipY + Math.sin(rad - Math.PI / 2) * outerPetalWidth * 0.3,
        },
        cp2: {
          x: cx + Math.cos(rad) * innerPetalLength * 0.4 + Math.cos(rad - Math.PI / 2) * outerPetalWidth * 0.8,
          y:
            cy - h * 0.1 + Math.sin(rad) * innerPetalLength * 0.4 + Math.sin(rad - Math.PI / 2) * outerPetalWidth * 0.8,
        },
      },
      { type: 'Z', x: cx, y: cy - h * 0.1 },
    ]

    results.push({
      id: `sunflower-inner-petal-${i}`,
      name: `Inner Petal ${i + 1}`,
      commands: petal,
      fill: flowerColor.petal,
      stroke: flowerColor.petalStroke,
      strokeWidth: 0.5,
      zIndex: 2,
    })
  }

  // Center disc (brown)
  const centerRadius = w * 0.35
  const center: PathCommand[] = [
    { type: 'M', x: cx, y: cy - h * 0.1 - centerRadius },
    {
      type: 'C',
      x: cx + centerRadius,
      y: cy - h * 0.1,
      cp1: { x: cx + centerRadius * 0.55, y: cy - h * 0.1 - centerRadius },
      cp2: { x: cx + centerRadius, y: cy - h * 0.1 - centerRadius * 0.55 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.1 + centerRadius,
      cp1: { x: cx + centerRadius, y: cy - h * 0.1 + centerRadius * 0.55 },
      cp2: { x: cx + centerRadius * 0.55, y: cy - h * 0.1 + centerRadius },
    },
    {
      type: 'C',
      x: cx - centerRadius,
      y: cy - h * 0.1,
      cp1: { x: cx - centerRadius * 0.55, y: cy - h * 0.1 + centerRadius },
      cp2: { x: cx - centerRadius, y: cy - h * 0.1 + centerRadius * 0.55 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.1 - centerRadius,
      cp1: { x: cx - centerRadius, y: cy - h * 0.1 - centerRadius * 0.55 },
      cp2: { x: cx - centerRadius * 0.55, y: cy - h * 0.1 - centerRadius },
    },
    { type: 'Z', x: cx, y: cy - h * 0.1 - centerRadius },
  ]

  results.push({
    id: 'sunflower-center',
    name: 'Center',
    commands: center,
    fill: flowerColor.center,
    stroke: flowerColor.centerStroke,
    strokeWidth: 1.5,
    zIndex: 3,
  })

  return results
}
