/**
 * Jar Shape Generator
 * Creates a mason jar shape with lid and body
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { OBJECT_COLORS } from '../types'

/**
 * Generate jar shape
 */
export function generateJar(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = OBJECT_COLORS.containers.jar
  const w = width / 2
  const h = height / 2

  // Main jar body (slightly curved sides)
  const body: PathCommand[] = [
    { type: 'M', x: cx - w * 0.35, y: cy - h * 0.4 },
    {
      type: 'C',
      x: cx - w * 0.4,
      y: cy + h * 0.9,
      cp1: { x: cx - w * 0.45, y: cy },
      cp2: { x: cx - w * 0.45, y: cy + h * 0.5 },
    },
    {
      type: 'C',
      x: cx + w * 0.4,
      y: cy + h * 0.9,
      cp1: { x: cx - w * 0.4, y: cy + h },
      cp2: { x: cx + w * 0.4, y: cy + h },
    },
    {
      type: 'C',
      x: cx + w * 0.35,
      y: cy - h * 0.4,
      cp1: { x: cx + w * 0.45, y: cy + h * 0.5 },
      cp2: { x: cx + w * 0.45, y: cy },
    },
    { type: 'Z', x: cx - w * 0.35, y: cy - h * 0.4 },
  ]

  // Jar neck/rim
  const rim: PathCommand[] = [
    { type: 'M', x: cx - w * 0.35, y: cy - h * 0.4 },
    { type: 'L', x: cx - w * 0.35, y: cy - h * 0.55 },
    { type: 'L', x: cx - w * 0.4, y: cy - h * 0.55 },
    { type: 'L', x: cx - w * 0.4, y: cy - h * 0.5 },
    { type: 'L', x: cx + w * 0.4, y: cy - h * 0.5 },
    { type: 'L', x: cx + w * 0.4, y: cy - h * 0.55 },
    { type: 'L', x: cx + w * 0.35, y: cy - h * 0.55 },
    { type: 'L', x: cx + w * 0.35, y: cy - h * 0.4 },
    { type: 'Z', x: cx - w * 0.35, y: cy - h * 0.4 },
  ]

  // Jar lid
  const lid: PathCommand[] = [
    { type: 'M', x: cx - w * 0.42, y: cy - h * 0.55 },
    { type: 'L', x: cx - w * 0.42, y: cy - h * 0.75 },
    {
      type: 'C',
      x: cx + w * 0.42,
      y: cy - h * 0.75,
      cp1: { x: cx - w * 0.42, y: cy - h * 0.85 },
      cp2: { x: cx + w * 0.42, y: cy - h * 0.85 },
    },
    { type: 'L', x: cx + w * 0.42, y: cy - h * 0.55 },
    { type: 'Z', x: cx - w * 0.42, y: cy - h * 0.55 },
  ]

  // Lid top
  const lidTop: PathCommand[] = [
    { type: 'M', x: cx - w * 0.35, y: cy - h * 0.75 },
    {
      type: 'C',
      x: cx + w * 0.35,
      y: cy - h * 0.75,
      cp1: { x: cx - w * 0.35, y: cy - h },
      cp2: { x: cx + w * 0.35, y: cy - h },
    },
    {
      type: 'C',
      x: cx - w * 0.35,
      y: cy - h * 0.75,
      cp1: { x: cx + w * 0.35, y: cy - h * 0.85 },
      cp2: { x: cx - w * 0.35, y: cy - h * 0.85 },
    },
    { type: 'Z', x: cx - w * 0.35, y: cy - h * 0.75 },
  ]

  return [
    {
      id: 'jar-body',
      name: 'Body',
      commands: body,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'jar-rim',
      name: 'Rim',
      commands: rim,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 0.5,
      zIndex: 1,
    },
    {
      id: 'jar-lid',
      name: 'Lid',
      commands: lid,
      fill: colors.lid,
      stroke: '#5D4037',
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'jar-lid-top',
      name: 'Lid Top',
      commands: lidTop,
      fill: colors.lid,
      stroke: '#5D4037',
      strokeWidth: 0.5,
      zIndex: 3,
    },
  ]
}
