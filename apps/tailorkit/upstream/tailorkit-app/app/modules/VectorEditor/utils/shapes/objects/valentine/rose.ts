/**
 * Rose Shape Generator
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { VALENTINE_COLORS } from './colors'

/**
 * Generate rose shape
 */
export function generateRose(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = VALENTINE_COLORS.rose
  const w = width
  const h = height

  // Stem
  const stem: PathCommand[] = [
    { type: 'M', x: cx - w * 0.02, y: cy + h * 0.1 },
    { type: 'L', x: cx + w * 0.02, y: cy + h * 0.1 },
    { type: 'L', x: cx + w * 0.02, y: cy + h * 0.5 },
    { type: 'L', x: cx - w * 0.02, y: cy + h * 0.5 },
    { type: 'Z', x: cx - w * 0.02, y: cy + h * 0.1 },
  ]

  // Leaf left
  const leafL: PathCommand[] = [
    { type: 'M', x: cx, y: cy + h * 0.3 },
    {
      type: 'C',
      x: cx - w * 0.25,
      y: cy + h * 0.25,
      cp1: { x: cx - w * 0.1, y: cy + h * 0.28 },
      cp2: { x: cx - w * 0.2, y: cy + h * 0.22 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + h * 0.3,
      cp1: { x: cx - w * 0.2, y: cy + h * 0.32 },
      cp2: { x: cx - w * 0.1, y: cy + h * 0.32 },
    },
    { type: 'Z', x: cx, y: cy + h * 0.3 },
  ]

  // Leaf right
  const leafR: PathCommand[] = [
    { type: 'M', x: cx, y: cy + h * 0.35 },
    {
      type: 'C',
      x: cx + w * 0.2,
      y: cy + h * 0.32,
      cp1: { x: cx + w * 0.08, y: cy + h * 0.33 },
      cp2: { x: cx + w * 0.15, y: cy + h * 0.3 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + h * 0.35,
      cp1: { x: cx + w * 0.15, y: cy + h * 0.38 },
      cp2: { x: cx + w * 0.08, y: cy + h * 0.38 },
    },
    { type: 'Z', x: cx, y: cy + h * 0.35 },
  ]

  // Outer petals
  const outerPetals: PathCommand[] = [
    { type: 'M', x: cx, y: cy + h * 0.1 },
    {
      type: 'C',
      x: cx - w * 0.35,
      y: cy,
      cp1: { x: cx - w * 0.15, y: cy + h * 0.1 },
      cp2: { x: cx - w * 0.3, y: cy + h * 0.08 },
    },
    {
      type: 'C',
      x: cx - w * 0.25,
      y: cy - h * 0.3,
      cp1: { x: cx - w * 0.4, y: cy - h * 0.1 },
      cp2: { x: cx - w * 0.35, y: cy - h * 0.25 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.35,
      cp1: { x: cx - w * 0.15, y: cy - h * 0.35 },
      cp2: { x: cx - w * 0.05, y: cy - h * 0.38 },
    },
    {
      type: 'C',
      x: cx + w * 0.25,
      y: cy - h * 0.3,
      cp1: { x: cx + w * 0.05, y: cy - h * 0.38 },
      cp2: { x: cx + w * 0.15, y: cy - h * 0.35 },
    },
    {
      type: 'C',
      x: cx + w * 0.35,
      y: cy,
      cp1: { x: cx + w * 0.35, y: cy - h * 0.25 },
      cp2: { x: cx + w * 0.4, y: cy - h * 0.1 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + h * 0.1,
      cp1: { x: cx + w * 0.3, y: cy + h * 0.08 },
      cp2: { x: cx + w * 0.15, y: cy + h * 0.1 },
    },
    { type: 'Z', x: cx, y: cy + h * 0.1 },
  ]

  // Inner petals / center
  const innerPetals: PathCommand[] = [
    { type: 'M', x: cx, y: cy },
    {
      type: 'C',
      x: cx - w * 0.15,
      y: cy - h * 0.05,
      cp1: { x: cx - w * 0.08, y: cy },
      cp2: { x: cx - w * 0.15, y: cy - h * 0.02 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.2,
      cp1: { x: cx - w * 0.15, y: cy - h * 0.12 },
      cp2: { x: cx - w * 0.05, y: cy - h * 0.18 },
    },
    {
      type: 'C',
      x: cx + w * 0.15,
      y: cy - h * 0.05,
      cp1: { x: cx + w * 0.05, y: cy - h * 0.18 },
      cp2: { x: cx + w * 0.15, y: cy - h * 0.12 },
    },
    {
      type: 'C',
      x: cx,
      y: cy,
      cp1: { x: cx + w * 0.15, y: cy - h * 0.02 },
      cp2: { x: cx + w * 0.08, y: cy },
    },
    { type: 'Z', x: cx, y: cy },
  ]

  return [
    {
      id: 'rose-stem',
      name: 'Stem',
      commands: stem,
      fill: colors.stem,
      stroke: colors.stemStroke,
      strokeWidth: 0.5,
      zIndex: 0,
    },
    {
      id: 'rose-leaf-l',
      name: 'Leaf Left',
      commands: leafL,
      fill: colors.leaf,
      stroke: colors.leafStroke,
      strokeWidth: 0.3,
      zIndex: 1,
    },
    {
      id: 'rose-leaf-r',
      name: 'Leaf Right',
      commands: leafR,
      fill: colors.leaf,
      stroke: colors.leafStroke,
      strokeWidth: 0.3,
      zIndex: 1,
    },
    {
      id: 'rose-outer',
      name: 'Outer Petals',
      commands: outerPetals,
      fill: colors.petals,
      stroke: colors.petalsStroke,
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'rose-inner',
      name: 'Inner Petals',
      commands: innerPetals,
      fill: colors.center,
      stroke: colors.petalsStroke,
      strokeWidth: 0.3,
      zIndex: 3,
    },
  ]
}
