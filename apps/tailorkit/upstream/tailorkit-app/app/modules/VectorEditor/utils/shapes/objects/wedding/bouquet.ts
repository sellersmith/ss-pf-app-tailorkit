/**
 * Wedding Bouquet Shape Generator
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { WEDDING_COLORS } from './colors'

/**
 * Generate wedding bouquet shape
 */
export function generateBouquet(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = WEDDING_COLORS.bouquet
  const w = width
  const h = height

  // Wrapper/handle
  const wrapper: PathCommand[] = [
    { type: 'M', x: cx - w * 0.1, y: cy + h * 0.1 },
    { type: 'L', x: cx + w * 0.1, y: cy + h * 0.1 },
    { type: 'L', x: cx + w * 0.08, y: cy + h * 0.45 },
    { type: 'L', x: cx - w * 0.08, y: cy + h * 0.45 },
    { type: 'Z', x: cx - w * 0.1, y: cy + h * 0.1 },
  ]

  // Ribbon on handle
  const handleRibbon: PathCommand[] = [
    { type: 'M', x: cx - w * 0.1, y: cy + h * 0.18 },
    { type: 'L', x: cx + w * 0.1, y: cy + h * 0.18 },
    { type: 'L', x: cx + w * 0.1, y: cy + h * 0.25 },
    { type: 'L', x: cx - w * 0.1, y: cy + h * 0.25 },
    { type: 'Z', x: cx - w * 0.1, y: cy + h * 0.18 },
  ]

  // Helper to create a simple flower
  const createFlower = (flowerCx: number, flowerCy: number, radius: number): PathCommand[] => {
    const commands: PathCommand[] = []
    // 5 petals in a circle
    for (let i = 0; i < 5; i++) {
      const angle = (i * 72 - 90) * (Math.PI / 180)
      const petalCx = flowerCx + Math.cos(angle) * radius * 0.5
      const petalCy = flowerCy + Math.sin(angle) * radius * 0.5

      if (i === 0) {
        commands.push({ type: 'M', x: flowerCx, y: flowerCy })
      }
      commands.push(
        {
          type: 'C',
          x: petalCx + Math.cos(angle) * radius * 0.5,
          y: petalCy + Math.sin(angle) * radius * 0.5,
          cp1: {
            x: flowerCx + Math.cos(angle - 0.3) * radius * 0.6,
            y: flowerCy + Math.sin(angle - 0.3) * radius * 0.6,
          },
          cp2: {
            x: petalCx + Math.cos(angle - 0.2) * radius * 0.4,
            y: petalCy + Math.sin(angle - 0.2) * radius * 0.4,
          },
        },
        {
          type: 'C',
          x: flowerCx,
          y: flowerCy,
          cp1: {
            x: petalCx + Math.cos(angle + 0.2) * radius * 0.4,
            y: petalCy + Math.sin(angle + 0.2) * radius * 0.4,
          },
          cp2: {
            x: flowerCx + Math.cos(angle + 0.3) * radius * 0.3,
            y: flowerCy + Math.sin(angle + 0.3) * radius * 0.3,
          },
        }
      )
    }
    commands.push({ type: 'Z', x: flowerCx, y: flowerCy })
    return commands
  }

  // Create flowers at different positions
  const flower1 = createFlower(cx, cy - h * 0.15, w * 0.2)
  const flower2 = createFlower(cx - w * 0.2, cy - h * 0.05, w * 0.18)
  const flower3 = createFlower(cx + w * 0.2, cy - h * 0.05, w * 0.18)
  const flower4 = createFlower(cx - w * 0.1, cy + h * 0.05, w * 0.15)
  const flower5 = createFlower(cx + w * 0.1, cy + h * 0.05, w * 0.15)

  // Leaves behind flowers
  const leaves: PathCommand[] = [
    { type: 'M', x: cx - w * 0.35, y: cy },
    {
      type: 'C',
      x: cx - w * 0.15,
      y: cy - h * 0.25,
      cp1: { x: cx - w * 0.4, y: cy - h * 0.15 },
      cp2: { x: cx - w * 0.25, y: cy - h * 0.25 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + h * 0.1,
      cp1: { x: cx - w * 0.1, y: cy - h * 0.2 },
      cp2: { x: cx - w * 0.05, y: cy },
    },
    // Right side
    { type: 'M', x: cx + w * 0.35, y: cy },
    {
      type: 'C',
      x: cx + w * 0.15,
      y: cy - h * 0.25,
      cp1: { x: cx + w * 0.4, y: cy - h * 0.15 },
      cp2: { x: cx + w * 0.25, y: cy - h * 0.25 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + h * 0.1,
      cp1: { x: cx + w * 0.1, y: cy - h * 0.2 },
      cp2: { x: cx + w * 0.05, y: cy },
    },
  ]

  return [
    {
      id: 'bouquet-leaves',
      name: 'Leaves',
      commands: leaves,
      fill: colors.leaves,
      stroke: colors.leavesStroke,
      strokeWidth: 0.5,
      zIndex: 0,
    },
    {
      id: 'bouquet-flower4',
      name: 'Flower 4',
      commands: flower4,
      fill: colors.flower2,
      stroke: colors.flower2Stroke,
      strokeWidth: 0.5,
      zIndex: 1,
    },
    {
      id: 'bouquet-flower5',
      name: 'Flower 5',
      commands: flower5,
      fill: colors.flower3,
      stroke: colors.flower3Stroke,
      strokeWidth: 0.5,
      zIndex: 1,
    },
    {
      id: 'bouquet-flower2',
      name: 'Flower 2',
      commands: flower2,
      fill: colors.flower2,
      stroke: colors.flower2Stroke,
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'bouquet-flower3',
      name: 'Flower 3',
      commands: flower3,
      fill: colors.flower3,
      stroke: colors.flower3Stroke,
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'bouquet-flower1',
      name: 'Main Flower',
      commands: flower1,
      fill: colors.flower1,
      stroke: colors.flower1Stroke,
      strokeWidth: 0.5,
      zIndex: 3,
    },
    {
      id: 'bouquet-wrapper',
      name: 'Wrapper',
      commands: wrapper,
      fill: colors.wrap,
      stroke: colors.wrapStroke,
      strokeWidth: 0.8,
      zIndex: 4,
    },
    {
      id: 'bouquet-ribbon',
      name: 'Handle Ribbon',
      commands: handleRibbon,
      fill: colors.flower1,
      stroke: colors.flower1Stroke,
      strokeWidth: 0.3,
      zIndex: 5,
    },
  ]
}
