/**
 * Lotus Flower Shape Generator
 * Creates a stylized lotus with layered petals
 */

import type { PathCommand } from '../../../svg'
import type { NaturePathResult } from '../types'
import { FLOWER_COLORS } from '../types'

/**
 * Generate lotus flower shape
 */
export function generateFlowerLotus(cx: number, cy: number, width: number, height: number): NaturePathResult[] {
  const flowerColor = FLOWER_COLORS.lotus

  const w = width / 2
  const h = height / 2

  const results: NaturePathResult[] = []

  // Back row of petals (wider spread)
  const backPetalAngles = [-60, -30, 0, 30, 60]
  const backPetalLength = h * 0.95

  backPetalAngles.forEach((angle, i) => {
    const rad = (angle - 90) * (Math.PI / 180)
    const petalWidth = w * 0.3

    const tipX = cx + Math.cos(rad) * backPetalLength
    const tipY = cy + h * 0.1 + Math.sin(rad) * backPetalLength

    const petal: PathCommand[] = [
      { type: 'M', x: cx, y: cy + h * 0.1 },
      {
        type: 'C',
        x: tipX,
        y: tipY,
        cp1: {
          x: cx + Math.cos(rad) * backPetalLength * 0.5 + Math.cos(rad + Math.PI / 2) * petalWidth,
          y: cy + h * 0.1 + Math.sin(rad) * backPetalLength * 0.5 + Math.sin(rad + Math.PI / 2) * petalWidth,
        },
        cp2: {
          x: tipX + Math.cos(rad + Math.PI / 2) * petalWidth * 0.3,
          y: tipY + Math.sin(rad + Math.PI / 2) * petalWidth * 0.3,
        },
      },
      {
        type: 'C',
        x: cx,
        y: cy + h * 0.1,
        cp1: {
          x: tipX + Math.cos(rad - Math.PI / 2) * petalWidth * 0.3,
          y: tipY + Math.sin(rad - Math.PI / 2) * petalWidth * 0.3,
        },
        cp2: {
          x: cx + Math.cos(rad) * backPetalLength * 0.5 + Math.cos(rad - Math.PI / 2) * petalWidth,
          y: cy + h * 0.1 + Math.sin(rad) * backPetalLength * 0.5 + Math.sin(rad - Math.PI / 2) * petalWidth,
        },
      },
      { type: 'Z', x: cx, y: cy + h * 0.1 },
    ]

    results.push({
      id: `lotus-back-petal-${i}`,
      name: `Back Petal ${i + 1}`,
      commands: petal,
      fill: flowerColor.petal,
      stroke: flowerColor.petalStroke,
      strokeWidth: 0.8,
      zIndex: 1,
    })
  })

  // Middle row of petals
  const midPetalAngles = [-45, -15, 15, 45]
  const midPetalLength = h * 0.75

  midPetalAngles.forEach((angle, i) => {
    const rad = (angle - 90) * (Math.PI / 180)
    const petalWidth = w * 0.28

    const tipX = cx + Math.cos(rad) * midPetalLength
    const tipY = cy + h * 0.1 + Math.sin(rad) * midPetalLength

    const petal: PathCommand[] = [
      { type: 'M', x: cx, y: cy + h * 0.15 },
      {
        type: 'C',
        x: tipX,
        y: tipY,
        cp1: {
          x: cx + Math.cos(rad) * midPetalLength * 0.5 + Math.cos(rad + Math.PI / 2) * petalWidth,
          y: cy + h * 0.15 + Math.sin(rad) * midPetalLength * 0.5 + Math.sin(rad + Math.PI / 2) * petalWidth,
        },
        cp2: {
          x: tipX + Math.cos(rad + Math.PI / 2) * petalWidth * 0.25,
          y: tipY + Math.sin(rad + Math.PI / 2) * petalWidth * 0.25,
        },
      },
      {
        type: 'C',
        x: cx,
        y: cy + h * 0.15,
        cp1: {
          x: tipX + Math.cos(rad - Math.PI / 2) * petalWidth * 0.25,
          y: tipY + Math.sin(rad - Math.PI / 2) * petalWidth * 0.25,
        },
        cp2: {
          x: cx + Math.cos(rad) * midPetalLength * 0.5 + Math.cos(rad - Math.PI / 2) * petalWidth,
          y: cy + h * 0.15 + Math.sin(rad) * midPetalLength * 0.5 + Math.sin(rad - Math.PI / 2) * petalWidth,
        },
      },
      { type: 'Z', x: cx, y: cy + h * 0.15 },
    ]

    results.push({
      id: `lotus-mid-petal-${i}`,
      name: `Middle Petal ${i + 1}`,
      commands: petal,
      fill: flowerColor.petal,
      stroke: flowerColor.petalStroke,
      strokeWidth: 0.6,
      zIndex: 2,
    })
  })

  // Front row of petals (central)
  const frontPetalAngles = [-25, 0, 25]
  const frontPetalLength = h * 0.55

  frontPetalAngles.forEach((angle, i) => {
    const rad = (angle - 90) * (Math.PI / 180)
    const petalWidth = w * 0.22

    const tipX = cx + Math.cos(rad) * frontPetalLength
    const tipY = cy + h * 0.15 + Math.sin(rad) * frontPetalLength

    const petal: PathCommand[] = [
      { type: 'M', x: cx, y: cy + h * 0.2 },
      {
        type: 'C',
        x: tipX,
        y: tipY,
        cp1: {
          x: cx + Math.cos(rad) * frontPetalLength * 0.5 + Math.cos(rad + Math.PI / 2) * petalWidth,
          y: cy + h * 0.2 + Math.sin(rad) * frontPetalLength * 0.5 + Math.sin(rad + Math.PI / 2) * petalWidth,
        },
        cp2: {
          x: tipX + Math.cos(rad + Math.PI / 2) * petalWidth * 0.2,
          y: tipY + Math.sin(rad + Math.PI / 2) * petalWidth * 0.2,
        },
      },
      {
        type: 'C',
        x: cx,
        y: cy + h * 0.2,
        cp1: {
          x: tipX + Math.cos(rad - Math.PI / 2) * petalWidth * 0.2,
          y: tipY + Math.sin(rad - Math.PI / 2) * petalWidth * 0.2,
        },
        cp2: {
          x: cx + Math.cos(rad) * frontPetalLength * 0.5 + Math.cos(rad - Math.PI / 2) * petalWidth,
          y: cy + h * 0.2 + Math.sin(rad) * frontPetalLength * 0.5 + Math.sin(rad - Math.PI / 2) * petalWidth,
        },
      },
      { type: 'Z', x: cx, y: cy + h * 0.2 },
    ]

    results.push({
      id: `lotus-front-petal-${i}`,
      name: `Front Petal ${i + 1}`,
      commands: petal,
      fill: flowerColor.petal,
      stroke: flowerColor.petalStroke,
      strokeWidth: 0.5,
      zIndex: 3,
    })
  })

  // Center seed pod
  const centerRadius = w * 0.15
  const center: PathCommand[] = [
    { type: 'M', x: cx, y: cy + h * 0.1 - centerRadius },
    {
      type: 'C',
      x: cx + centerRadius,
      y: cy + h * 0.1,
      cp1: { x: cx + centerRadius * 0.55, y: cy + h * 0.1 - centerRadius },
      cp2: { x: cx + centerRadius, y: cy + h * 0.1 - centerRadius * 0.55 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + h * 0.1 + centerRadius,
      cp1: { x: cx + centerRadius, y: cy + h * 0.1 + centerRadius * 0.55 },
      cp2: { x: cx + centerRadius * 0.55, y: cy + h * 0.1 + centerRadius },
    },
    {
      type: 'C',
      x: cx - centerRadius,
      y: cy + h * 0.1,
      cp1: { x: cx - centerRadius * 0.55, y: cy + h * 0.1 + centerRadius },
      cp2: { x: cx - centerRadius, y: cy + h * 0.1 + centerRadius * 0.55 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + h * 0.1 - centerRadius,
      cp1: { x: cx - centerRadius, y: cy + h * 0.1 - centerRadius * 0.55 },
      cp2: { x: cx - centerRadius * 0.55, y: cy + h * 0.1 - centerRadius },
    },
    { type: 'Z', x: cx, y: cy + h * 0.1 - centerRadius },
  ]

  results.push({
    id: 'lotus-center',
    name: 'Center',
    commands: center,
    fill: flowerColor.center,
    stroke: flowerColor.centerStroke,
    strokeWidth: 1,
    zIndex: 4,
  })

  return results
}
