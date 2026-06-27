/**
 * Cupcake Shape Generator
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { K, BIRTHDAY_COLORS } from './colors'

/**
 * Generate cupcake shape
 */
export function generateCupcake(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = BIRTHDAY_COLORS.cupcake
  const w = width
  const h = height

  // Cupcake wrapper (trapezoid with ridges)
  const wrapper: PathCommand[] = [
    { type: 'M', x: cx - w * 0.3, y: cy + h * 0.05 },
    { type: 'L', x: cx + w * 0.3, y: cy + h * 0.05 },
    { type: 'L', x: cx + w * 0.4, y: cy + h * 0.45 },
    { type: 'L', x: cx - w * 0.4, y: cy + h * 0.45 },
    { type: 'Z', x: cx - w * 0.3, y: cy + h * 0.05 },
  ]

  // Wrapper ridges (vertical lines on wrapper)
  const ridges: PathCommand[] = []
  for (let i = -3; i <= 3; i++) {
    const xTop = cx + i * w * 0.08
    const xBottom = cx + i * w * 0.1
    ridges.push({ type: 'M', x: xTop, y: cy + h * 0.08 }, { type: 'L', x: xBottom, y: cy + h * 0.42 })
  }

  // Cake body (visible above wrapper)
  const cakeBody: PathCommand[] = [
    { type: 'M', x: cx - w * 0.28, y: cy - h * 0.05 },
    { type: 'L', x: cx + w * 0.28, y: cy - h * 0.05 },
    { type: 'L', x: cx + w * 0.3, y: cy + h * 0.08 },
    { type: 'L', x: cx - w * 0.3, y: cy + h * 0.08 },
    { type: 'Z', x: cx - w * 0.28, y: cy - h * 0.05 },
  ]

  // Frosting swirl
  const frosting: PathCommand[] = [
    { type: 'M', x: cx - w * 0.3, y: cy - h * 0.05 },
    {
      type: 'C',
      x: cx - w * 0.2,
      y: cy - h * 0.2,
      cp1: { x: cx - w * 0.35, y: cy - h * 0.15 },
      cp2: { x: cx - w * 0.25, y: cy - h * 0.22 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.15,
      cp1: { x: cx - w * 0.15, y: cy - h * 0.18 },
      cp2: { x: cx - w * 0.08, y: cy - h * 0.15 },
    },
    {
      type: 'C',
      x: cx + w * 0.2,
      y: cy - h * 0.2,
      cp1: { x: cx + w * 0.08, y: cy - h * 0.15 },
      cp2: { x: cx + w * 0.15, y: cy - h * 0.22 },
    },
    {
      type: 'C',
      x: cx + w * 0.3,
      y: cy - h * 0.05,
      cp1: { x: cx + w * 0.25, y: cy - h * 0.18 },
      cp2: { x: cx + w * 0.35, y: cy - h * 0.1 },
    },
    { type: 'L', x: cx - w * 0.3, y: cy - h * 0.05 },
    { type: 'Z', x: cx - w * 0.3, y: cy - h * 0.05 },
  ]

  // Frosting peak
  const frostingPeak: PathCommand[] = [
    { type: 'M', x: cx - w * 0.15, y: cy - h * 0.2 },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.4,
      cp1: { x: cx - w * 0.1, y: cy - h * 0.3 },
      cp2: { x: cx - w * 0.05, y: cy - h * 0.38 },
    },
    {
      type: 'C',
      x: cx + w * 0.15,
      y: cy - h * 0.2,
      cp1: { x: cx + w * 0.05, y: cy - h * 0.38 },
      cp2: { x: cx + w * 0.1, y: cy - h * 0.3 },
    },
    { type: 'L', x: cx - w * 0.15, y: cy - h * 0.2 },
    { type: 'Z', x: cx - w * 0.15, y: cy - h * 0.2 },
  ]

  // Cherry on top
  const cherryR = w * 0.08
  const cherryY = cy - h * 0.42
  const cherry: PathCommand[] = [
    { type: 'M', x: cx, y: cherryY - cherryR },
    {
      type: 'C',
      x: cx + cherryR,
      y: cherryY,
      cp1: { x: cx + cherryR * K, y: cherryY - cherryR },
      cp2: { x: cx + cherryR, y: cherryY - cherryR * K },
    },
    {
      type: 'C',
      x: cx,
      y: cherryY + cherryR,
      cp1: { x: cx + cherryR, y: cherryY + cherryR * K },
      cp2: { x: cx + cherryR * K, y: cherryY + cherryR },
    },
    {
      type: 'C',
      x: cx - cherryR,
      y: cherryY,
      cp1: { x: cx - cherryR * K, y: cherryY + cherryR },
      cp2: { x: cx - cherryR, y: cherryY + cherryR * K },
    },
    {
      type: 'C',
      x: cx,
      y: cherryY - cherryR,
      cp1: { x: cx - cherryR, y: cherryY - cherryR * K },
      cp2: { x: cx - cherryR * K, y: cherryY - cherryR },
    },
    { type: 'Z', x: cx, y: cherryY - cherryR },
  ]

  return [
    {
      id: 'cupcake-wrapper',
      name: 'Wrapper',
      commands: wrapper,
      fill: colors.wrapper,
      stroke: colors.wrapperStroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'cupcake-ridges',
      name: 'Ridges',
      commands: ridges,
      fill: 'none',
      stroke: colors.wrapperStroke,
      strokeWidth: 0.5,
      zIndex: 1,
    },
    {
      id: 'cupcake-cake',
      name: 'Cake',
      commands: cakeBody,
      fill: colors.cake,
      stroke: colors.cakeStroke,
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'cupcake-frosting',
      name: 'Frosting',
      commands: frosting,
      fill: colors.frosting,
      stroke: colors.frostingStroke,
      strokeWidth: 0.5,
      zIndex: 3,
    },
    {
      id: 'cupcake-peak',
      name: 'Frosting Peak',
      commands: frostingPeak,
      fill: colors.frosting,
      stroke: colors.frostingStroke,
      strokeWidth: 0.5,
      zIndex: 4,
    },
    {
      id: 'cupcake-cherry',
      name: 'Cherry',
      commands: cherry,
      fill: colors.cherry,
      stroke: colors.cherryStroke,
      strokeWidth: 0.5,
      zIndex: 5,
    },
  ]
}
