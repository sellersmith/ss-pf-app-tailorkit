/**
 * Tulip Flower Shape Generator
 * Creates a stylized tulip with overlapping petals
 */

import type { PathCommand } from '../../../svg'
import type { NaturePathResult } from '../types'
import { FLOWER_COLORS, STEM_COLORS } from '../types'

/**
 * Generate tulip flower shape
 */
export function generateFlowerTulip(cx: number, cy: number, width: number, height: number): NaturePathResult[] {
  const flowerColor = FLOWER_COLORS.pink
  const stemColor = STEM_COLORS.green

  const w = width / 2
  const h = height / 2

  const results: NaturePathResult[] = []

  // Stem
  const stem: PathCommand[] = [
    { type: 'M', x: cx - w * 0.05, y: cy + h * 0.2 },
    { type: 'L', x: cx - w * 0.06, y: cy + h },
    { type: 'L', x: cx + w * 0.06, y: cy + h },
    { type: 'L', x: cx + w * 0.05, y: cy + h * 0.2 },
    { type: 'Z', x: cx - w * 0.05, y: cy + h * 0.2 },
  ]

  results.push({
    id: 'tulip-stem',
    name: 'Stem',
    commands: stem,
    fill: stemColor.fill,
    stroke: stemColor.stroke,
    strokeWidth: 0.5,
    zIndex: 0,
  })

  // Leaf
  const leaf: PathCommand[] = [
    { type: 'M', x: cx, y: cy + h * 0.6 },
    {
      type: 'C',
      x: cx + w * 0.5,
      y: cy + h * 0.3,
      cp1: { x: cx + w * 0.2, y: cy + h * 0.55 },
      cp2: { x: cx + w * 0.4, y: cy + h * 0.4 },
    },
    {
      type: 'C',
      x: cx + w * 0.1,
      y: cy + h * 0.75,
      cp1: { x: cx + w * 0.5, y: cy + h * 0.5 },
      cp2: { x: cx + w * 0.3, y: cy + h * 0.7 },
    },
    { type: 'Z', x: cx, y: cy + h * 0.6 },
  ]

  results.push({
    id: 'tulip-leaf',
    name: 'Leaf',
    commands: leaf,
    fill: stemColor.fill,
    stroke: stemColor.stroke,
    strokeWidth: 0.5,
    zIndex: 0,
  })

  // Back petals (2)
  const backLeftPetal: PathCommand[] = [
    { type: 'M', x: cx - w * 0.1, y: cy + h * 0.2 },
    {
      type: 'C',
      x: cx - w * 0.5,
      y: cy - h * 0.6,
      cp1: { x: cx - w * 0.4, y: cy + h * 0.1 },
      cp2: { x: cx - w * 0.55, y: cy - h * 0.3 },
    },
    {
      type: 'C',
      x: cx - w * 0.1,
      y: cy - h * 0.85,
      cp1: { x: cx - w * 0.45, y: cy - h * 0.75 },
      cp2: { x: cx - w * 0.25, y: cy - h * 0.85 },
    },
    {
      type: 'C',
      x: cx - w * 0.1,
      y: cy + h * 0.2,
      cp1: { x: cx - w * 0.1, y: cy - h * 0.5 },
      cp2: { x: cx - w * 0.1, y: cy - h * 0.1 },
    },
    { type: 'Z', x: cx - w * 0.1, y: cy + h * 0.2 },
  ]

  const backRightPetal: PathCommand[] = [
    { type: 'M', x: cx + w * 0.1, y: cy + h * 0.2 },
    {
      type: 'C',
      x: cx + w * 0.5,
      y: cy - h * 0.6,
      cp1: { x: cx + w * 0.4, y: cy + h * 0.1 },
      cp2: { x: cx + w * 0.55, y: cy - h * 0.3 },
    },
    {
      type: 'C',
      x: cx + w * 0.1,
      y: cy - h * 0.85,
      cp1: { x: cx + w * 0.45, y: cy - h * 0.75 },
      cp2: { x: cx + w * 0.25, y: cy - h * 0.85 },
    },
    {
      type: 'C',
      x: cx + w * 0.1,
      y: cy + h * 0.2,
      cp1: { x: cx + w * 0.1, y: cy - h * 0.5 },
      cp2: { x: cx + w * 0.1, y: cy - h * 0.1 },
    },
    { type: 'Z', x: cx + w * 0.1, y: cy + h * 0.2 },
  ]

  results.push({
    id: 'tulip-back-left-petal',
    name: 'Back Left Petal',
    commands: backLeftPetal,
    fill: flowerColor.petal,
    stroke: flowerColor.petalStroke,
    strokeWidth: 0.8,
    zIndex: 1,
  })

  results.push({
    id: 'tulip-back-right-petal',
    name: 'Back Right Petal',
    commands: backRightPetal,
    fill: flowerColor.petal,
    stroke: flowerColor.petalStroke,
    strokeWidth: 0.8,
    zIndex: 1,
  })

  // Front center petal
  const frontPetal: PathCommand[] = [
    { type: 'M', x: cx, y: cy + h * 0.25 },
    {
      type: 'C',
      x: cx - w * 0.35,
      y: cy - h * 0.5,
      cp1: { x: cx - w * 0.25, y: cy + h * 0.15 },
      cp2: { x: cx - w * 0.4, y: cy - h * 0.2 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.9,
      cp1: { x: cx - w * 0.3, y: cy - h * 0.7 },
      cp2: { x: cx - w * 0.1, y: cy - h * 0.85 },
    },
    {
      type: 'C',
      x: cx + w * 0.35,
      y: cy - h * 0.5,
      cp1: { x: cx + w * 0.1, y: cy - h * 0.85 },
      cp2: { x: cx + w * 0.3, y: cy - h * 0.7 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + h * 0.25,
      cp1: { x: cx + w * 0.4, y: cy - h * 0.2 },
      cp2: { x: cx + w * 0.25, y: cy + h * 0.15 },
    },
    { type: 'Z', x: cx, y: cy + h * 0.25 },
  ]

  results.push({
    id: 'tulip-front-petal',
    name: 'Front Petal',
    commands: frontPetal,
    fill: flowerColor.petal,
    stroke: flowerColor.petalStroke,
    strokeWidth: 0.8,
    zIndex: 2,
  })

  return results
}
