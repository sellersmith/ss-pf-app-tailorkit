/**
 * Halo Shape Generators
 * Generates halo/nimbus shapes
 */

import type { PathCommand } from '../../../svg'
import type { FantasyPathPart } from '../types'
import { wrapFantasyGenerator, HALO_COLORS } from '../types'

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate an elliptical arc path
 */
function generateEllipse(cx: number, cy: number, rx: number, ry: number): PathCommand[] {
  // Using 4 cubic bezier curves to approximate an ellipse
  const kappa = 0.5522847498 // Magic number for bezier circle approximation

  const ox = rx * kappa // Control point offset horizontal
  const oy = ry * kappa // Control point offset vertical

  return [
    { type: 'M', x: cx - rx, y: cy },
    {
      type: 'C',
      x: cx,
      y: cy - ry,
      cp1: { x: cx - rx, y: cy - oy },
      cp2: { x: cx - ox, y: cy - ry },
    },
    {
      type: 'C',
      x: cx + rx,
      y: cy,
      cp1: { x: cx + ox, y: cy - ry },
      cp2: { x: cx + rx, y: cy - oy },
    },
    {
      type: 'C',
      x: cx,
      y: cy + ry,
      cp1: { x: cx + rx, y: cy + oy },
      cp2: { x: cx + ox, y: cy + ry },
    },
    {
      type: 'C',
      x: cx - rx,
      y: cy,
      cp1: { x: cx - ox, y: cy + ry },
      cp2: { x: cx - rx, y: cy + oy },
    },
    { type: 'Z', x: cx - rx, y: cy },
  ]
}

/**
 * Generate a ring (donut) shape using two ellipses
 */
function generateRing(
  cx: number,
  cy: number,
  outerRx: number,
  outerRy: number,
  innerRx: number,
  innerRy: number
): PathCommand[] {
  const kappa = 0.5522847498

  // Outer ellipse (clockwise)
  const outerOx = outerRx * kappa
  const outerOy = outerRy * kappa

  // Inner ellipse (counter-clockwise for hole)
  const innerOx = innerRx * kappa
  const innerOy = innerRy * kappa

  return [
    // Outer ellipse (clockwise)
    { type: 'M', x: cx - outerRx, y: cy },
    {
      type: 'C',
      x: cx,
      y: cy - outerRy,
      cp1: { x: cx - outerRx, y: cy - outerOy },
      cp2: { x: cx - outerOx, y: cy - outerRy },
    },
    {
      type: 'C',
      x: cx + outerRx,
      y: cy,
      cp1: { x: cx + outerOx, y: cy - outerRy },
      cp2: { x: cx + outerRx, y: cy - outerOy },
    },
    {
      type: 'C',
      x: cx,
      y: cy + outerRy,
      cp1: { x: cx + outerRx, y: cy + outerOy },
      cp2: { x: cx + outerOx, y: cy + outerRy },
    },
    {
      type: 'C',
      x: cx - outerRx,
      y: cy,
      cp1: { x: cx - outerOx, y: cy + outerRy },
      cp2: { x: cx - outerRx, y: cy + outerOy },
    },
    { type: 'Z', x: cx - outerRx, y: cy },

    // Inner ellipse (counter-clockwise for hole)
    { type: 'M', x: cx - innerRx, y: cy },
    {
      type: 'C',
      x: cx,
      y: cy + innerRy,
      cp1: { x: cx - innerRx, y: cy + innerOy },
      cp2: { x: cx - innerOx, y: cy + innerRy },
    },
    {
      type: 'C',
      x: cx + innerRx,
      y: cy,
      cp1: { x: cx + innerOx, y: cy + innerRy },
      cp2: { x: cx + innerRx, y: cy + innerOy },
    },
    {
      type: 'C',
      x: cx,
      y: cy - innerRy,
      cp1: { x: cx + innerRx, y: cy - innerOy },
      cp2: { x: cx + innerOx, y: cy - innerRy },
    },
    {
      type: 'C',
      x: cx - innerRx,
      y: cy,
      cp1: { x: cx - innerOx, y: cy - innerRy },
      cp2: { x: cx - innerRx, y: cy - innerOy },
    },
    { type: 'Z', x: cx - innerRx, y: cy },
  ]
}

// =============================================================================
// Halo Generators
// =============================================================================

/**
 * Generate halo - cartoon style
 * Classic golden ring with glow effect
 */
const _generateHaloCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const haloWidth = width * 0.9
  const haloHeight = height * 0.35

  // Outer glow (largest, more transparent - using alpha in fill)
  const glowRx = haloWidth * 0.55
  const glowRy = haloHeight * 0.7
  parts.push({
    id: 'outer-glow',
    name: 'Outer Glow',
    commands: generateEllipse(cx, cy, glowRx, glowRy),
    fill: '#FFF8DC4D', // HALO_COLORS.glow with ~30% opacity
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 5,
  })

  // Main halo ring
  const outerRx = haloWidth * 0.5
  const outerRy = haloHeight * 0.5
  const innerRx = haloWidth * 0.38
  const innerRy = haloHeight * 0.35

  parts.push({
    id: 'halo-ring',
    name: 'Halo Ring',
    commands: generateRing(cx, cy, outerRx, outerRy, innerRx, innerRy),
    fill: HALO_COLORS.primary,
    stroke: HALO_COLORS.outline,
    strokeWidth: 1.5,
    zIndex: 10,
  })

  // Inner highlight (top portion of ring)
  const highlightCommands: PathCommand[] = [
    { type: 'M', x: cx - outerRx * 0.85, y: cy - outerRy * 0.2 },
    {
      type: 'C',
      x: cx + outerRx * 0.85,
      y: cy - outerRy * 0.2,
      cp1: { x: cx - outerRx * 0.5, y: cy - outerRy * 0.9 },
      cp2: { x: cx + outerRx * 0.5, y: cy - outerRy * 0.9 },
    },
    {
      type: 'C',
      x: cx - outerRx * 0.85,
      y: cy - outerRy * 0.2,
      cp1: { x: cx + outerRx * 0.4, y: cy - outerRy * 0.6 },
      cp2: { x: cx - outerRx * 0.4, y: cy - outerRy * 0.6 },
    },
    { type: 'Z', x: cx - outerRx * 0.85, y: cy - outerRy * 0.2 },
  ]

  parts.push({
    id: 'halo-highlight',
    name: 'Halo Highlight',
    commands: highlightCommands,
    fill: '#FFFACD99', // HALO_COLORS.divine with ~60% opacity
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 15,
  })

  return parts
}

export const generateHaloCartoon = wrapFantasyGenerator(_generateHaloCartoon, 'halo')

/**
 * Generate divine halo - cartoon style
 * More elaborate with rays of light
 */
const _generateDivineHaloCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const haloWidth = width * 0.9
  const haloHeight = height * 0.4

  // Light rays behind the halo
  const rayCount = 12
  const rayLength = haloHeight * 1.2

  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2 - Math.PI / 2
    const rayCommands: PathCommand[] = [
      {
        type: 'M',
        x: cx + Math.cos(angle) * haloWidth * 0.2,
        y: cy + Math.sin(angle) * haloHeight * 0.2,
      },
      {
        type: 'L',
        x: cx + Math.cos(angle - 0.1) * rayLength,
        y: cy + Math.sin(angle - 0.1) * rayLength * 0.8,
      },
      {
        type: 'L',
        x: cx + Math.cos(angle + 0.1) * rayLength,
        y: cy + Math.sin(angle + 0.1) * rayLength * 0.8,
      },
      {
        type: 'Z',
        x: cx + Math.cos(angle) * haloWidth * 0.2,
        y: cy + Math.sin(angle) * haloHeight * 0.2,
      },
    ]

    parts.push({
      id: `ray-${i}`,
      name: `Light Ray ${i + 1}`,
      commands: rayCommands,
      fill: '#FFF8DC66', // HALO_COLORS.glow with ~40% opacity
      stroke: 'none',
      strokeWidth: 0,
      zIndex: 1 + i,
    })
  }

  // Main halo ring (using cartoon style)
  const mainHalo = generateHaloCartoon(cx, cy, width, height)
  mainHalo.forEach((part, i) => {
    parts.push({
      ...part,
      id: `divine-${part.id}`,
      name: part.name,
      zIndex: (part.zIndex || 0) + 20,
    })
  })

  return parts
}

export const generateDivineHaloCartoon = wrapFantasyGenerator(_generateDivineHaloCartoon, 'divine-halo')
