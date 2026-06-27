/**
 * Church/Chapel Shape Generator
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { K, WEDDING_COLORS } from './colors'

/**
 * Generate church/chapel shape
 */
export function generateChurch(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = WEDDING_COLORS.church
  const w = width
  const h = height

  // Main building body
  const body: PathCommand[] = [
    { type: 'M', x: cx - w * 0.35, y: cy - h * 0.1 },
    { type: 'L', x: cx + w * 0.35, y: cy - h * 0.1 },
    { type: 'L', x: cx + w * 0.35, y: cy + h * 0.45 },
    { type: 'L', x: cx - w * 0.35, y: cy + h * 0.45 },
    { type: 'Z', x: cx - w * 0.35, y: cy - h * 0.1 },
  ]

  // Main roof (triangular)
  const mainRoof: PathCommand[] = [
    { type: 'M', x: cx - w * 0.4, y: cy - h * 0.1 },
    { type: 'L', x: cx, y: cy - h * 0.35 },
    { type: 'L', x: cx + w * 0.4, y: cy - h * 0.1 },
    { type: 'Z', x: cx - w * 0.4, y: cy - h * 0.1 },
  ]

  // Steeple/tower
  const steeple: PathCommand[] = [
    { type: 'M', x: cx - w * 0.08, y: cy - h * 0.35 },
    { type: 'L', x: cx + w * 0.08, y: cy - h * 0.35 },
    { type: 'L', x: cx, y: cy - h * 0.5 },
    { type: 'Z', x: cx - w * 0.08, y: cy - h * 0.35 },
  ]

  // Cross on top
  const cross: PathCommand[] = [
    // Vertical part
    { type: 'M', x: cx - w * 0.02, y: cy - h * 0.5 },
    { type: 'L', x: cx + w * 0.02, y: cy - h * 0.5 },
    { type: 'L', x: cx + w * 0.02, y: cy - h * 0.38 },
    { type: 'L', x: cx - w * 0.02, y: cy - h * 0.38 },
    { type: 'Z', x: cx - w * 0.02, y: cy - h * 0.5 },
  ]

  const crossHoriz: PathCommand[] = [
    { type: 'M', x: cx - w * 0.06, y: cy - h * 0.48 },
    { type: 'L', x: cx + w * 0.06, y: cy - h * 0.48 },
    { type: 'L', x: cx + w * 0.06, y: cy - h * 0.44 },
    { type: 'L', x: cx - w * 0.06, y: cy - h * 0.44 },
    { type: 'Z', x: cx - w * 0.06, y: cy - h * 0.48 },
  ]

  // Door
  const door: PathCommand[] = [
    { type: 'M', x: cx - w * 0.1, y: cy + h * 0.1 },
    { type: 'L', x: cx + w * 0.1, y: cy + h * 0.1 },
    { type: 'L', x: cx + w * 0.1, y: cy + h * 0.45 },
    { type: 'L', x: cx - w * 0.1, y: cy + h * 0.45 },
    {
      type: 'C',
      x: cx - w * 0.1,
      y: cy + h * 0.1,
      cp1: { x: cx - w * 0.1, y: cy + h * 0.2 },
      cp2: { x: cx - w * 0.1, y: cy + h * 0.15 },
    },
  ]

  // Door arch
  const doorArch: PathCommand[] = [
    { type: 'M', x: cx - w * 0.1, y: cy + h * 0.15 },
    {
      type: 'C',
      x: cx + w * 0.1,
      y: cy + h * 0.15,
      cp1: { x: cx - w * 0.1, y: cy + h * 0.02 },
      cp2: { x: cx + w * 0.1, y: cy + h * 0.02 },
    },
  ]

  // Window (circular)
  const windowR = w * 0.08
  const windowCy = cy - h * 0.2
  const windowPath: PathCommand[] = [
    { type: 'M', x: cx, y: windowCy - windowR },
    {
      type: 'C',
      x: cx + windowR,
      y: windowCy,
      cp1: { x: cx + windowR * K, y: windowCy - windowR },
      cp2: { x: cx + windowR, y: windowCy - windowR * K },
    },
    {
      type: 'C',
      x: cx,
      y: windowCy + windowR,
      cp1: { x: cx + windowR, y: windowCy + windowR * K },
      cp2: { x: cx + windowR * K, y: windowCy + windowR },
    },
    {
      type: 'C',
      x: cx - windowR,
      y: windowCy,
      cp1: { x: cx - windowR * K, y: windowCy + windowR },
      cp2: { x: cx - windowR, y: windowCy + windowR * K },
    },
    {
      type: 'C',
      x: cx,
      y: windowCy - windowR,
      cp1: { x: cx - windowR, y: windowCy - windowR * K },
      cp2: { x: cx - windowR * K, y: windowCy - windowR },
    },
    { type: 'Z', x: cx, y: windowCy - windowR },
  ]

  return [
    {
      id: 'church-body',
      name: 'Building',
      commands: body,
      fill: colors.body,
      stroke: colors.bodyStroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'church-roof',
      name: 'Roof',
      commands: mainRoof,
      fill: colors.roof,
      stroke: colors.roofStroke,
      strokeWidth: 1,
      zIndex: 1,
    },
    {
      id: 'church-steeple',
      name: 'Steeple',
      commands: steeple,
      fill: colors.roof,
      stroke: colors.roofStroke,
      strokeWidth: 0.8,
      zIndex: 2,
    },
    {
      id: 'church-cross-v',
      name: 'Cross Vertical',
      commands: cross,
      fill: colors.cross,
      stroke: colors.crossStroke,
      strokeWidth: 0.5,
      zIndex: 3,
    },
    {
      id: 'church-cross-h',
      name: 'Cross Horizontal',
      commands: crossHoriz,
      fill: colors.cross,
      stroke: colors.crossStroke,
      strokeWidth: 0.5,
      zIndex: 3,
    },
    {
      id: 'church-window',
      name: 'Window',
      commands: windowPath,
      fill: colors.window,
      stroke: colors.windowStroke,
      strokeWidth: 0.5,
      zIndex: 4,
    },
    {
      id: 'church-door',
      name: 'Door',
      commands: door,
      fill: colors.door,
      stroke: colors.doorStroke,
      strokeWidth: 0.8,
      zIndex: 4,
    },
    {
      id: 'church-door-arch',
      name: 'Door Arch',
      commands: doorArch,
      fill: 'none',
      stroke: colors.doorStroke,
      strokeWidth: 1,
      zIndex: 5,
    },
  ]
}
