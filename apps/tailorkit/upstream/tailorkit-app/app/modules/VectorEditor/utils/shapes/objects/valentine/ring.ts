/**
 * Engagement Ring Shape Generator
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { K, VALENTINE_COLORS } from './colors'

/**
 * Generate engagement ring shape
 */
export function generateRing(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = VALENTINE_COLORS.ring
  const w = width
  const h = height

  // Ring band outer
  const bandOuter: PathCommand[] = [
    { type: 'M', x: cx, y: cy - h * 0.25 },
    {
      type: 'C',
      x: cx + w * 0.35,
      y: cy,
      cp1: { x: cx + w * 0.25 * K, y: cy - h * 0.25 },
      cp2: { x: cx + w * 0.35, y: cy - h * 0.25 * K },
    },
    {
      type: 'C',
      x: cx,
      y: cy + h * 0.25,
      cp1: { x: cx + w * 0.35, y: cy + h * 0.25 * K },
      cp2: { x: cx + w * 0.25 * K, y: cy + h * 0.25 },
    },
    {
      type: 'C',
      x: cx - w * 0.35,
      y: cy,
      cp1: { x: cx - w * 0.25 * K, y: cy + h * 0.25 },
      cp2: { x: cx - w * 0.35, y: cy + h * 0.25 * K },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.25,
      cp1: { x: cx - w * 0.35, y: cy - h * 0.25 * K },
      cp2: { x: cx - w * 0.25 * K, y: cy - h * 0.25 },
    },
    { type: 'Z', x: cx, y: cy - h * 0.25 },
  ]

  // Ring band inner (hole)
  const bandInner: PathCommand[] = [
    { type: 'M', x: cx, y: cy - h * 0.15 },
    {
      type: 'C',
      x: cx + w * 0.22,
      y: cy,
      cp1: { x: cx + w * 0.15 * K, y: cy - h * 0.15 },
      cp2: { x: cx + w * 0.22, y: cy - h * 0.15 * K },
    },
    {
      type: 'C',
      x: cx,
      y: cy + h * 0.15,
      cp1: { x: cx + w * 0.22, y: cy + h * 0.15 * K },
      cp2: { x: cx + w * 0.15 * K, y: cy + h * 0.15 },
    },
    {
      type: 'C',
      x: cx - w * 0.22,
      y: cy,
      cp1: { x: cx - w * 0.15 * K, y: cy + h * 0.15 },
      cp2: { x: cx - w * 0.22, y: cy + h * 0.15 * K },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.15,
      cp1: { x: cx - w * 0.22, y: cy - h * 0.15 * K },
      cp2: { x: cx - w * 0.15 * K, y: cy - h * 0.15 },
    },
    { type: 'Z', x: cx, y: cy - h * 0.15 },
  ]

  // Gem (diamond shape)
  const gem: PathCommand[] = [
    { type: 'M', x: cx, y: cy - h * 0.5 },
    { type: 'L', x: cx + w * 0.15, y: cy - h * 0.35 },
    { type: 'L', x: cx + w * 0.15, y: cy - h * 0.28 },
    { type: 'L', x: cx, y: cy - h * 0.15 },
    { type: 'L', x: cx - w * 0.15, y: cy - h * 0.28 },
    { type: 'L', x: cx - w * 0.15, y: cy - h * 0.35 },
    { type: 'Z', x: cx, y: cy - h * 0.5 },
  ]

  // Gem facet
  const facet: PathCommand[] = [
    { type: 'M', x: cx, y: cy - h * 0.5 },
    { type: 'L', x: cx + w * 0.08, y: cy - h * 0.35 },
    { type: 'L', x: cx, y: cy - h * 0.22 },
    { type: 'L', x: cx - w * 0.08, y: cy - h * 0.35 },
    { type: 'Z', x: cx, y: cy - h * 0.5 },
  ]

  return [
    {
      id: 'ring-band',
      name: 'Band',
      commands: bandOuter,
      fill: colors.band,
      stroke: colors.bandStroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'ring-hole',
      name: 'Hole',
      commands: bandInner,
      fill: '#FFFFFF',
      stroke: colors.bandStroke,
      strokeWidth: 0.5,
      zIndex: 1,
    },
    {
      id: 'ring-gem',
      name: 'Gem',
      commands: gem,
      fill: colors.gem,
      stroke: colors.gemStroke,
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'ring-facet',
      name: 'Facet',
      commands: facet,
      fill: colors.shine,
      stroke: 'none',
      strokeWidth: 0,
      zIndex: 3,
    },
  ]
}
