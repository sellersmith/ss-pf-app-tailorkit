/**
 * Ball Shape Generators
 * Creates various ball shapes for sports
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { OBJECT_COLORS } from '../types'

const K = 0.5522847498 // Bezier approximation of circle

/**
 * Generate basic ball/sphere shape
 */
export function generateBall(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = OBJECT_COLORS.sports.ball
  const r = Math.min(width, height) / 2

  // Main ball body
  const ball: PathCommand[] = [
    { type: 'M', x: cx, y: cy - r },
    {
      type: 'C',
      x: cx + r,
      y: cy,
      cp1: { x: cx + r * K, y: cy - r },
      cp2: { x: cx + r, y: cy - r * K },
    },
    {
      type: 'C',
      x: cx,
      y: cy + r,
      cp1: { x: cx + r, y: cy + r * K },
      cp2: { x: cx + r * K, y: cy + r },
    },
    {
      type: 'C',
      x: cx - r,
      y: cy,
      cp1: { x: cx - r * K, y: cy + r },
      cp2: { x: cx - r, y: cy + r * K },
    },
    {
      type: 'C',
      x: cx,
      y: cy - r,
      cp1: { x: cx - r, y: cy - r * K },
      cp2: { x: cx - r * K, y: cy - r },
    },
    { type: 'Z', x: cx, y: cy - r },
  ]

  // Highlight for 3D effect
  const highlightR = r * 0.3
  const highlightCx = cx - r * 0.35
  const highlightCy = cy - r * 0.35

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
      id: 'ball-body',
      name: 'Ball',
      commands: ball,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'ball-highlight',
      name: 'Highlight',
      commands: highlight,
      fill: '#FFFFFF',
      stroke: 'none',
      strokeWidth: 0,
      zIndex: 1,
    },
  ]
}

/**
 * Generate basketball shape
 */
export function generateBasketball(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = OBJECT_COLORS.sports.basketball
  const r = Math.min(width, height) / 2

  // Main ball body
  const ball: PathCommand[] = [
    { type: 'M', x: cx, y: cy - r },
    {
      type: 'C',
      x: cx + r,
      y: cy,
      cp1: { x: cx + r * K, y: cy - r },
      cp2: { x: cx + r, y: cy - r * K },
    },
    {
      type: 'C',
      x: cx,
      y: cy + r,
      cp1: { x: cx + r, y: cy + r * K },
      cp2: { x: cx + r * K, y: cy + r },
    },
    {
      type: 'C',
      x: cx - r,
      y: cy,
      cp1: { x: cx - r * K, y: cy + r },
      cp2: { x: cx - r, y: cy + r * K },
    },
    {
      type: 'C',
      x: cx,
      y: cy - r,
      cp1: { x: cx - r, y: cy - r * K },
      cp2: { x: cx - r * K, y: cy - r },
    },
    { type: 'Z', x: cx, y: cy - r },
  ]

  // Horizontal seam line through center
  const horizontalLine: PathCommand[] = [
    { type: 'M', x: cx - r, y: cy },
    { type: 'L', x: cx + r, y: cy },
  ]

  // Vertical seam line through center
  const verticalLine: PathCommand[] = [
    { type: 'M', x: cx, y: cy - r },
    { type: 'L', x: cx, y: cy + r },
  ]

  // Left curved seam - bows INWARD toward center (characteristic basketball curve)
  // Starts at top-left edge, curves toward center, ends at bottom-left edge
  const leftCurve: PathCommand[] = [
    { type: 'M', x: cx - r * 0.7, y: cy - r * 0.72 },
    {
      type: 'C',
      x: cx - r * 0.7,
      y: cy + r * 0.72,
      cp1: { x: cx - r * 0.15, y: cy - r * 0.4 },
      cp2: { x: cx - r * 0.15, y: cy + r * 0.4 },
    },
  ]

  // Right curved seam - bows INWARD toward center (mirror of left curve)
  const rightCurve: PathCommand[] = [
    { type: 'M', x: cx + r * 0.7, y: cy - r * 0.72 },
    {
      type: 'C',
      x: cx + r * 0.7,
      y: cy + r * 0.72,
      cp1: { x: cx + r * 0.15, y: cy - r * 0.4 },
      cp2: { x: cx + r * 0.15, y: cy + r * 0.4 },
    },
  ]

  return [
    {
      id: 'basketball-body',
      name: 'Ball',
      commands: ball,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 1.5,
      zIndex: 0,
    },
    {
      id: 'basketball-horizontal',
      name: 'Horizontal Line',
      commands: horizontalLine,
      fill: 'none',
      stroke: colors.lines,
      strokeWidth: 2,
      zIndex: 1,
    },
    {
      id: 'basketball-vertical',
      name: 'Vertical Line',
      commands: verticalLine,
      fill: 'none',
      stroke: colors.lines,
      strokeWidth: 2,
      zIndex: 1,
    },
    {
      id: 'basketball-left-curve',
      name: 'Left Curve',
      commands: leftCurve,
      fill: 'none',
      stroke: colors.lines,
      strokeWidth: 2,
      zIndex: 1,
    },
    {
      id: 'basketball-right-curve',
      name: 'Right Curve',
      commands: rightCurve,
      fill: 'none',
      stroke: colors.lines,
      strokeWidth: 2,
      zIndex: 1,
    },
  ]
}

/**
 * Generate soccer ball shape
 */
export function generateSoccerBall(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = OBJECT_COLORS.sports.soccer
  const r = Math.min(width, height) / 2

  // Main ball body
  const ball: PathCommand[] = [
    { type: 'M', x: cx, y: cy - r },
    {
      type: 'C',
      x: cx + r,
      y: cy,
      cp1: { x: cx + r * K, y: cy - r },
      cp2: { x: cx + r, y: cy - r * K },
    },
    {
      type: 'C',
      x: cx,
      y: cy + r,
      cp1: { x: cx + r, y: cy + r * K },
      cp2: { x: cx + r * K, y: cy + r },
    },
    {
      type: 'C',
      x: cx - r,
      y: cy,
      cp1: { x: cx - r * K, y: cy + r },
      cp2: { x: cx - r, y: cy + r * K },
    },
    {
      type: 'C',
      x: cx,
      y: cy - r,
      cp1: { x: cx - r, y: cy - r * K },
      cp2: { x: cx - r * K, y: cy - r },
    },
    { type: 'Z', x: cx, y: cy - r },
  ]

  // Center pentagon (simplified)
  const pentR = r * 0.35
  const pentagon: PathCommand[] = []
  for (let i = 0; i < 5; i++) {
    const angle = ((i * 72 - 90) * Math.PI) / 180
    const px = cx + Math.cos(angle) * pentR
    const py = cy + Math.sin(angle) * pentR
    pentagon.push(i === 0 ? { type: 'M', x: px, y: py } : { type: 'L', x: px, y: py })
  }
  pentagon.push({ type: 'Z', x: pentagon[0].x, y: pentagon[0].y })

  return [
    {
      id: 'soccer-body',
      name: 'Ball',
      commands: ball,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 1.5,
      zIndex: 0,
    },
    {
      id: 'soccer-pentagon',
      name: 'Center Panel',
      commands: pentagon,
      fill: colors.panels,
      stroke: colors.panels,
      strokeWidth: 0.5,
      zIndex: 1,
    },
  ]
}

/**
 * Generate tennis ball shape
 * Tennis balls have a characteristic curved seam that wraps around in an S-curve pattern
 */
export function generateTennisBall(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = OBJECT_COLORS.sports.tennis
  const r = Math.min(width, height) / 2

  // Main ball body
  const ball: PathCommand[] = [
    { type: 'M', x: cx, y: cy - r },
    {
      type: 'C',
      x: cx + r,
      y: cy,
      cp1: { x: cx + r * K, y: cy - r },
      cp2: { x: cx + r, y: cy - r * K },
    },
    {
      type: 'C',
      x: cx,
      y: cy + r,
      cp1: { x: cx + r, y: cy + r * K },
      cp2: { x: cx + r * K, y: cy + r },
    },
    {
      type: 'C',
      x: cx - r,
      y: cy,
      cp1: { x: cx - r * K, y: cy + r },
      cp2: { x: cx - r, y: cy + r * K },
    },
    {
      type: 'C',
      x: cx,
      y: cy - r,
      cp1: { x: cx - r, y: cy - r * K },
      cp2: { x: cx - r * K, y: cy - r },
    },
    { type: 'Z', x: cx, y: cy - r },
  ]

  // Tennis ball curved seam - characteristic S-curve on left side
  // The seam curves inward at top, outward at middle, inward at bottom
  const leftSeam: PathCommand[] = [
    { type: 'M', x: cx - r * 0.15, y: cy - r },
    {
      type: 'C',
      x: cx - r * 0.85,
      y: cy,
      cp1: { x: cx - r * 0.7, y: cy - r * 0.85 },
      cp2: { x: cx - r * 0.85, y: cy - r * 0.4 },
    },
    {
      type: 'C',
      x: cx - r * 0.15,
      y: cy + r,
      cp1: { x: cx - r * 0.85, y: cy + r * 0.4 },
      cp2: { x: cx - r * 0.7, y: cy + r * 0.85 },
    },
  ]

  // Tennis ball curved seam - characteristic S-curve on right side (mirror)
  const rightSeam: PathCommand[] = [
    { type: 'M', x: cx + r * 0.15, y: cy - r },
    {
      type: 'C',
      x: cx + r * 0.85,
      y: cy,
      cp1: { x: cx + r * 0.7, y: cy - r * 0.85 },
      cp2: { x: cx + r * 0.85, y: cy - r * 0.4 },
    },
    {
      type: 'C',
      x: cx + r * 0.15,
      y: cy + r,
      cp1: { x: cx + r * 0.85, y: cy + r * 0.4 },
      cp2: { x: cx + r * 0.7, y: cy + r * 0.85 },
    },
  ]

  return [
    {
      id: 'tennis-body',
      name: 'Ball',
      commands: ball,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 1.5,
      zIndex: 0,
    },
    {
      id: 'tennis-left-seam',
      name: 'Left Seam',
      commands: leftSeam,
      fill: 'none',
      stroke: colors.seam,
      strokeWidth: 2,
      zIndex: 1,
    },
    {
      id: 'tennis-right-seam',
      name: 'Right Seam',
      commands: rightSeam,
      fill: 'none',
      stroke: colors.seam,
      strokeWidth: 2,
      zIndex: 1,
    },
  ]
}

/**
 * Generate pickleball shape
 * Pickleballs have distinctive holes pattern
 */
export function generatePickleball(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const r = Math.min(width, height) / 2

  // Main ball body - yellow/lime green
  const ball: PathCommand[] = [
    { type: 'M', x: cx, y: cy - r },
    {
      type: 'C',
      x: cx + r,
      y: cy,
      cp1: { x: cx + r * K, y: cy - r },
      cp2: { x: cx + r, y: cy - r * K },
    },
    {
      type: 'C',
      x: cx,
      y: cy + r,
      cp1: { x: cx + r, y: cy + r * K },
      cp2: { x: cx + r * K, y: cy + r },
    },
    {
      type: 'C',
      x: cx - r,
      y: cy,
      cp1: { x: cx - r * K, y: cy + r },
      cp2: { x: cx - r, y: cy + r * K },
    },
    {
      type: 'C',
      x: cx,
      y: cy - r,
      cp1: { x: cx - r, y: cy - r * K },
      cp2: { x: cx - r * K, y: cy - r },
    },
    { type: 'Z', x: cx, y: cy - r },
  ]

  const results: ObjectPathResult[] = [
    {
      id: 'pickleball-body',
      name: 'Ball',
      commands: ball,
      fill: '#CDDC39',
      stroke: '#9E9D24',
      strokeWidth: 1.5,
      zIndex: 0,
    },
  ]

  // Add holes pattern - arranged in concentric rings
  const holeRadius = r * 0.08
  const holeK = 0.5522847498

  // Helper to create a circle hole
  const createHole = (hx: number, hy: number, id: string): ObjectPathResult => {
    const hole: PathCommand[] = [
      { type: 'M', x: hx, y: hy - holeRadius },
      {
        type: 'C',
        x: hx + holeRadius,
        y: hy,
        cp1: { x: hx + holeRadius * holeK, y: hy - holeRadius },
        cp2: { x: hx + holeRadius, y: hy - holeRadius * holeK },
      },
      {
        type: 'C',
        x: hx,
        y: hy + holeRadius,
        cp1: { x: hx + holeRadius, y: hy + holeRadius * holeK },
        cp2: { x: hx + holeRadius * holeK, y: hy + holeRadius },
      },
      {
        type: 'C',
        x: hx - holeRadius,
        y: hy,
        cp1: { x: hx - holeRadius * holeK, y: hy + holeRadius },
        cp2: { x: hx - holeRadius, y: hy + holeRadius * holeK },
      },
      {
        type: 'C',
        x: hx,
        y: hy - holeRadius,
        cp1: { x: hx - holeRadius, y: hy - holeRadius * holeK },
        cp2: { x: hx - holeRadius * holeK, y: hy - holeRadius },
      },
      { type: 'Z', x: hx, y: hy - holeRadius },
    ]
    return {
      id,
      name: 'Hole',
      commands: hole,
      fill: '#9E9D24',
      stroke: 'none',
      strokeWidth: 0,
      zIndex: 1,
    }
  }

  // Center hole
  results.push(createHole(cx, cy, 'pickleball-hole-center'))

  // Inner ring of holes (6 holes)
  const innerRingRadius = r * 0.35
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 - 90) * (Math.PI / 180)
    const hx = cx + Math.cos(angle) * innerRingRadius
    const hy = cy + Math.sin(angle) * innerRingRadius
    results.push(createHole(hx, hy, `pickleball-hole-inner-${i}`))
  }

  // Outer ring of holes (12 holes)
  const outerRingRadius = r * 0.7
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 - 90) * (Math.PI / 180)
    const hx = cx + Math.cos(angle) * outerRingRadius
    const hy = cy + Math.sin(angle) * outerRingRadius
    results.push(createHole(hx, hy, `pickleball-hole-outer-${i}`))
  }

  return results
}
