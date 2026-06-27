/**
 * Cherry Blossom Shape Generator
 * Creates a delicate cherry blossom with 5 petals
 */

import type { PathCommand } from '../../../svg'
import type { NaturePathResult } from '../types'
import { FLOWER_COLORS } from '../types'

/**
 * Generate cherry blossom shape
 */
export function generateFlowerCherryBlossom(cx: number, cy: number, width: number, height: number): NaturePathResult[] {
  const flowerColor = FLOWER_COLORS.cherryBlossom

  const w = width / 2
  const h = height / 2

  const results: NaturePathResult[] = []

  // 5 petals with characteristic notch at tip
  const petalCount = 5
  const petalLength = h * 0.85
  const petalWidth = w * 0.4

  for (let i = 0; i < petalCount; i++) {
    const angle = (i * 360) / petalCount - 90
    const rad = angle * (Math.PI / 180)

    const tipX = cx + Math.cos(rad) * petalLength
    const tipY = cy + Math.sin(rad) * petalLength

    // Notch at the tip
    const notchDepth = petalLength * 0.15
    const notchWidth = petalWidth * 0.3

    const petal: PathCommand[] = [
      { type: 'M', x: cx, y: cy },
      // Left side of petal
      {
        type: 'C',
        x: tipX + Math.cos(rad + Math.PI / 2) * notchWidth - Math.cos(rad) * notchDepth,
        y: tipY + Math.sin(rad + Math.PI / 2) * notchWidth - Math.sin(rad) * notchDepth,
        cp1: {
          x: cx + Math.cos(rad) * petalLength * 0.3 + Math.cos(rad + Math.PI / 2) * petalWidth,
          y: cy + Math.sin(rad) * petalLength * 0.3 + Math.sin(rad + Math.PI / 2) * petalWidth,
        },
        cp2: {
          x: tipX + Math.cos(rad + Math.PI / 2) * petalWidth * 0.7,
          y: tipY + Math.sin(rad + Math.PI / 2) * petalWidth * 0.7,
        },
      },
      // Notch
      {
        type: 'C',
        x: tipX,
        y: tipY,
        cp1: {
          x: tipX + Math.cos(rad + Math.PI / 2) * notchWidth * 0.3,
          y: tipY + Math.sin(rad + Math.PI / 2) * notchWidth * 0.3,
        },
        cp2: {
          x: tipX + Math.cos(rad) * notchDepth * 0.3,
          y: tipY + Math.sin(rad) * notchDepth * 0.3,
        },
      },
      {
        type: 'C',
        x: tipX + Math.cos(rad - Math.PI / 2) * notchWidth - Math.cos(rad) * notchDepth,
        y: tipY + Math.sin(rad - Math.PI / 2) * notchWidth - Math.sin(rad) * notchDepth,
        cp1: {
          x: tipX + Math.cos(rad) * notchDepth * 0.3,
          y: tipY + Math.sin(rad) * notchDepth * 0.3,
        },
        cp2: {
          x: tipX + Math.cos(rad - Math.PI / 2) * notchWidth * 0.3,
          y: tipY + Math.sin(rad - Math.PI / 2) * notchWidth * 0.3,
        },
      },
      // Right side of petal
      {
        type: 'C',
        x: cx,
        y: cy,
        cp1: {
          x: tipX + Math.cos(rad - Math.PI / 2) * petalWidth * 0.7,
          y: tipY + Math.sin(rad - Math.PI / 2) * petalWidth * 0.7,
        },
        cp2: {
          x: cx + Math.cos(rad) * petalLength * 0.3 + Math.cos(rad - Math.PI / 2) * petalWidth,
          y: cy + Math.sin(rad) * petalLength * 0.3 + Math.sin(rad - Math.PI / 2) * petalWidth,
        },
      },
      { type: 'Z', x: cx, y: cy },
    ]

    results.push({
      id: `cherry-blossom-petal-${i}`,
      name: `Petal ${i + 1}`,
      commands: petal,
      fill: flowerColor.petal,
      stroke: flowerColor.petalStroke,
      strokeWidth: 0.5,
      zIndex: 1,
    })
  }

  // Center with stamens
  const centerRadius = w * 0.15
  const center: PathCommand[] = [
    { type: 'M', x: cx, y: cy - centerRadius },
    {
      type: 'C',
      x: cx + centerRadius,
      y: cy,
      cp1: { x: cx + centerRadius * 0.55, y: cy - centerRadius },
      cp2: { x: cx + centerRadius, y: cy - centerRadius * 0.55 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + centerRadius,
      cp1: { x: cx + centerRadius, y: cy + centerRadius * 0.55 },
      cp2: { x: cx + centerRadius * 0.55, y: cy + centerRadius },
    },
    {
      type: 'C',
      x: cx - centerRadius,
      y: cy,
      cp1: { x: cx - centerRadius * 0.55, y: cy + centerRadius },
      cp2: { x: cx - centerRadius, y: cy + centerRadius * 0.55 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - centerRadius,
      cp1: { x: cx - centerRadius, y: cy - centerRadius * 0.55 },
      cp2: { x: cx - centerRadius * 0.55, y: cy - centerRadius },
    },
    { type: 'Z', x: cx, y: cy - centerRadius },
  ]

  results.push({
    id: 'cherry-blossom-center',
    name: 'Center',
    commands: center,
    fill: flowerColor.center,
    stroke: flowerColor.centerStroke,
    strokeWidth: 0.5,
    zIndex: 2,
  })

  // Stamens
  const stamenCount = 6
  const stamenLength = w * 0.25

  for (let i = 0; i < stamenCount; i++) {
    const angle = (i * 360) / stamenCount
    const rad = angle * (Math.PI / 180)

    const stamen: PathCommand[] = [
      { type: 'M', x: cx, y: cy },
      {
        type: 'L',
        x: cx + Math.cos(rad) * stamenLength,
        y: cy + Math.sin(rad) * stamenLength,
      },
    ]

    results.push({
      id: `cherry-blossom-stamen-${i}`,
      name: `Stamen ${i + 1}`,
      commands: stamen,
      fill: 'none',
      stroke: flowerColor.centerStroke,
      strokeWidth: 1,
      zIndex: 3,
    })
  }

  return results
}
