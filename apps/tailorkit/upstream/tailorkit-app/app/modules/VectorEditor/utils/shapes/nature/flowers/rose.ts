/**
 * Rose Flower Shape Generator
 * Creates a stylized rose with layered petals
 */

import type { PathCommand } from '../../../svg'
import type { NaturePathResult } from '../types'
import { FLOWER_COLORS, STEM_COLORS } from '../types'

/**
 * Generate rose flower shape
 */
export function generateFlowerRose(cx: number, cy: number, width: number, height: number): NaturePathResult[] {
  const flowerColor = FLOWER_COLORS.red
  const stemColor = STEM_COLORS.green

  const w = width / 2
  const h = height / 2

  const results: NaturePathResult[] = []

  // Stem
  const stem: PathCommand[] = [
    { type: 'M', x: cx - w * 0.05, y: cy + h * 0.3 },
    {
      type: 'C',
      x: cx - w * 0.1,
      y: cy + h,
      cp1: { x: cx - w * 0.03, y: cy + h * 0.5 },
      cp2: { x: cx - w * 0.08, y: cy + h * 0.8 },
    },
    { type: 'L', x: cx + w * 0.05, y: cy + h },
    {
      type: 'C',
      x: cx + w * 0.05,
      y: cy + h * 0.3,
      cp1: { x: cx + w * 0.08, y: cy + h * 0.8 },
      cp2: { x: cx + w * 0.03, y: cy + h * 0.5 },
    },
    { type: 'Z', x: cx - w * 0.05, y: cy + h * 0.3 },
  ]

  results.push({
    id: 'rose-stem',
    name: 'Stem',
    commands: stem,
    fill: stemColor.fill,
    stroke: stemColor.stroke,
    strokeWidth: 0.5,
    zIndex: 0,
  })

  // Outer petals (5 petals)
  const outerPetalAngles = [0, 72, 144, 216, 288]
  const outerRadius = w * 0.9
  const petalWidth = w * 0.55

  outerPetalAngles.forEach((angle, i) => {
    const rad = (angle - 90) * (Math.PI / 180)
    const petalCx = cx + Math.cos(rad) * outerRadius * 0.4
    const petalCy = cy - h * 0.2 + Math.sin(rad) * outerRadius * 0.4
    const tipX = cx + Math.cos(rad) * outerRadius
    const tipY = cy - h * 0.2 + Math.sin(rad) * outerRadius

    const petal: PathCommand[] = [
      { type: 'M', x: cx, y: cy - h * 0.2 },
      {
        type: 'C',
        x: tipX,
        y: tipY,
        cp1: {
          x: petalCx + Math.cos(rad + Math.PI / 2) * petalWidth,
          y: petalCy + Math.sin(rad + Math.PI / 2) * petalWidth,
        },
        cp2: {
          x: tipX + Math.cos(rad + Math.PI / 2) * petalWidth * 0.5,
          y: tipY + Math.sin(rad + Math.PI / 2) * petalWidth * 0.5,
        },
      },
      {
        type: 'C',
        x: cx,
        y: cy - h * 0.2,
        cp1: {
          x: tipX + Math.cos(rad - Math.PI / 2) * petalWidth * 0.5,
          y: tipY + Math.sin(rad - Math.PI / 2) * petalWidth * 0.5,
        },
        cp2: {
          x: petalCx + Math.cos(rad - Math.PI / 2) * petalWidth,
          y: petalCy + Math.sin(rad - Math.PI / 2) * petalWidth,
        },
      },
      { type: 'Z', x: cx, y: cy - h * 0.2 },
    ]

    results.push({
      id: `rose-outer-petal-${i}`,
      name: `Outer Petal ${i + 1}`,
      commands: petal,
      fill: flowerColor.petal,
      stroke: flowerColor.petalStroke,
      strokeWidth: 0.8,
      zIndex: 1,
    })
  })

  // Inner petals (spiral effect)
  const innerPetalAngles = [36, 108, 180, 252, 324]
  const innerRadius = w * 0.5

  innerPetalAngles.forEach((angle, i) => {
    const rad = (angle - 90) * (Math.PI / 180)
    const petalCx = cx + Math.cos(rad) * innerRadius * 0.3
    const petalCy = cy - h * 0.2 + Math.sin(rad) * innerRadius * 0.3
    const tipX = cx + Math.cos(rad) * innerRadius
    const tipY = cy - h * 0.2 + Math.sin(rad) * innerRadius

    const petal: PathCommand[] = [
      { type: 'M', x: cx, y: cy - h * 0.2 },
      {
        type: 'C',
        x: tipX,
        y: tipY,
        cp1: {
          x: petalCx + Math.cos(rad + Math.PI / 2) * petalWidth * 0.5,
          y: petalCy + Math.sin(rad + Math.PI / 2) * petalWidth * 0.5,
        },
        cp2: {
          x: tipX + Math.cos(rad + Math.PI / 2) * petalWidth * 0.3,
          y: tipY + Math.sin(rad + Math.PI / 2) * petalWidth * 0.3,
        },
      },
      {
        type: 'C',
        x: cx,
        y: cy - h * 0.2,
        cp1: {
          x: tipX + Math.cos(rad - Math.PI / 2) * petalWidth * 0.3,
          y: tipY + Math.sin(rad - Math.PI / 2) * petalWidth * 0.3,
        },
        cp2: {
          x: petalCx + Math.cos(rad - Math.PI / 2) * petalWidth * 0.5,
          y: petalCy + Math.sin(rad - Math.PI / 2) * petalWidth * 0.5,
        },
      },
      { type: 'Z', x: cx, y: cy - h * 0.2 },
    ]

    results.push({
      id: `rose-inner-petal-${i}`,
      name: `Inner Petal ${i + 1}`,
      commands: petal,
      fill: flowerColor.petal,
      stroke: flowerColor.petalStroke,
      strokeWidth: 0.5,
      zIndex: 2,
    })
  })

  // Center bud
  const center: PathCommand[] = [
    { type: 'M', x: cx, y: cy - h * 0.35 },
    {
      type: 'C',
      x: cx + w * 0.15,
      y: cy - h * 0.2,
      cp1: { x: cx + w * 0.1, y: cy - h * 0.35 },
      cp2: { x: cx + w * 0.15, y: cy - h * 0.28 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.1,
      cp1: { x: cx + w * 0.15, y: cy - h * 0.12 },
      cp2: { x: cx + w * 0.08, y: cy - h * 0.1 },
    },
    {
      type: 'C',
      x: cx - w * 0.15,
      y: cy - h * 0.2,
      cp1: { x: cx - w * 0.08, y: cy - h * 0.1 },
      cp2: { x: cx - w * 0.15, y: cy - h * 0.12 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.35,
      cp1: { x: cx - w * 0.15, y: cy - h * 0.28 },
      cp2: { x: cx - w * 0.1, y: cy - h * 0.35 },
    },
    { type: 'Z', x: cx, y: cy - h * 0.35 },
  ]

  results.push({
    id: 'rose-center',
    name: 'Center',
    commands: center,
    fill: flowerColor.petalStroke,
    stroke: flowerColor.petalStroke,
    strokeWidth: 0.5,
    zIndex: 3,
  })

  return results
}
