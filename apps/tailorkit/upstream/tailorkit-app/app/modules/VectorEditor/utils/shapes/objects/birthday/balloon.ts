/**
 * Balloon Shape Generator
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { K, BIRTHDAY_COLORS } from './colors'

/**
 * Generate balloon shape
 */
export function generateBalloon(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = BIRTHDAY_COLORS.balloon
  const w = width
  const h = height

  // Main balloon body (oval)
  const balloonBody: PathCommand[] = [
    { type: 'M', x: cx, y: cy - h * 0.4 },
    {
      type: 'C',
      x: cx + w * 0.4,
      y: cy - h * 0.1,
      cp1: { x: cx + w * 0.35, y: cy - h * 0.4 },
      cp2: { x: cx + w * 0.45, y: cy - h * 0.25 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + h * 0.25,
      cp1: { x: cx + w * 0.35, y: cy + h * 0.15 },
      cp2: { x: cx + w * 0.15, y: cy + h * 0.25 },
    },
    {
      type: 'C',
      x: cx - w * 0.4,
      y: cy - h * 0.1,
      cp1: { x: cx - w * 0.15, y: cy + h * 0.25 },
      cp2: { x: cx - w * 0.35, y: cy + h * 0.15 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.4,
      cp1: { x: cx - w * 0.45, y: cy - h * 0.25 },
      cp2: { x: cx - w * 0.35, y: cy - h * 0.4 },
    },
    { type: 'Z', x: cx, y: cy - h * 0.4 },
  ]

  // Balloon knot (triangle)
  const knot: PathCommand[] = [
    { type: 'M', x: cx, y: cy + h * 0.25 },
    { type: 'L', x: cx + w * 0.05, y: cy + h * 0.32 },
    { type: 'L', x: cx - w * 0.05, y: cy + h * 0.32 },
    { type: 'Z', x: cx, y: cy + h * 0.25 },
  ]

  // String
  const string: PathCommand[] = [
    { type: 'M', x: cx, y: cy + h * 0.32 },
    {
      type: 'C',
      x: cx - w * 0.1,
      y: cy + h * 0.5,
      cp1: { x: cx + w * 0.1, y: cy + h * 0.4 },
      cp2: { x: cx - w * 0.15, y: cy + h * 0.45 },
    },
  ]

  // Highlight
  const highlightR = w * 0.08
  const highlightCx = cx - w * 0.15
  const highlightCy = cy - h * 0.2
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
      id: 'balloon-body',
      name: 'Balloon',
      commands: balloonBody,
      fill: colors.body,
      stroke: colors.bodyStroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'balloon-highlight',
      name: 'Highlight',
      commands: highlight,
      fill: colors.highlight,
      stroke: 'none',
      strokeWidth: 0,
      zIndex: 1,
    },
    {
      id: 'balloon-knot',
      name: 'Knot',
      commands: knot,
      fill: colors.body,
      stroke: colors.bodyStroke,
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'balloon-string',
      name: 'String',
      commands: string,
      fill: 'none',
      stroke: colors.string,
      strokeWidth: 1,
      zIndex: 3,
    },
  ]
}
