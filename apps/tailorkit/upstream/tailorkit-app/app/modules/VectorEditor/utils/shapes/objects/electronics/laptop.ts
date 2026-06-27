/**
 * Laptop Shape Generator
 * Creates a laptop shape with screen and keyboard base
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { OBJECT_COLORS } from '../types'

/**
 * Generate laptop shape
 */
export function generateLaptop(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = OBJECT_COLORS.electronics.laptop
  const w = width / 2
  const h = height / 2

  // Screen (lid)
  const screen: PathCommand[] = [
    { type: 'M', x: cx - w * 0.7, y: cy - h * 0.8 },
    { type: 'L', x: cx + w * 0.7, y: cy - h * 0.8 },
    { type: 'L', x: cx + w * 0.7, y: cy + h * 0.1 },
    { type: 'L', x: cx - w * 0.7, y: cy + h * 0.1 },
    { type: 'Z', x: cx - w * 0.7, y: cy - h * 0.8 },
  ]

  // Screen display area
  const display: PathCommand[] = [
    { type: 'M', x: cx - w * 0.6, y: cy - h * 0.7 },
    { type: 'L', x: cx + w * 0.6, y: cy - h * 0.7 },
    { type: 'L', x: cx + w * 0.6, y: cy },
    { type: 'L', x: cx - w * 0.6, y: cy },
    { type: 'Z', x: cx - w * 0.6, y: cy - h * 0.7 },
  ]

  // Base (keyboard area)
  const base: PathCommand[] = [
    { type: 'M', x: cx - w * 0.8, y: cy + h * 0.1 },
    { type: 'L', x: cx + w * 0.8, y: cy + h * 0.1 },
    { type: 'L', x: cx + w * 0.9, y: cy + h * 0.3 },
    { type: 'L', x: cx - w * 0.9, y: cy + h * 0.3 },
    { type: 'Z', x: cx - w * 0.8, y: cy + h * 0.1 },
  ]

  // Keyboard keys area
  const keyboard: PathCommand[] = [
    { type: 'M', x: cx - w * 0.7, y: cy + h * 0.15 },
    { type: 'L', x: cx + w * 0.7, y: cy + h * 0.15 },
    { type: 'L', x: cx + w * 0.75, y: cy + h * 0.25 },
    { type: 'L', x: cx - w * 0.75, y: cy + h * 0.25 },
    { type: 'Z', x: cx - w * 0.7, y: cy + h * 0.15 },
  ]

  // Trackpad
  const trackpad: PathCommand[] = [
    { type: 'M', x: cx - w * 0.2, y: cy + h * 0.18 },
    { type: 'L', x: cx + w * 0.2, y: cy + h * 0.18 },
    { type: 'L', x: cx + w * 0.22, y: cy + h * 0.28 },
    { type: 'L', x: cx - w * 0.22, y: cy + h * 0.28 },
    { type: 'Z', x: cx - w * 0.2, y: cy + h * 0.18 },
  ]

  // Camera dot
  const camera: PathCommand[] = [
    { type: 'M', x: cx, y: cy - h * 0.75 },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.75,
      cp1: { x: cx - w * 0.03, y: cy - h * 0.78 },
      cp2: { x: cx + w * 0.03, y: cy - h * 0.78 },
    },
  ]

  return [
    {
      id: 'laptop-screen',
      name: 'Screen',
      commands: screen,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'laptop-display',
      name: 'Display',
      commands: display,
      fill: '#263238',
      stroke: '#1A1A1A',
      strokeWidth: 0.5,
      zIndex: 1,
    },
    {
      id: 'laptop-base',
      name: 'Base',
      commands: base,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 1,
      zIndex: 2,
    },
    {
      id: 'laptop-keyboard',
      name: 'Keyboard',
      commands: keyboard,
      fill: '#37474F',
      stroke: '#263238',
      strokeWidth: 0.3,
      zIndex: 3,
    },
    {
      id: 'laptop-trackpad',
      name: 'Trackpad',
      commands: trackpad,
      fill: '#546E7A',
      stroke: '#455A64',
      strokeWidth: 0.3,
      zIndex: 4,
    },
    {
      id: 'laptop-camera',
      name: 'Camera',
      commands: camera,
      fill: '#1A1A1A',
      stroke: '#1A1A1A',
      strokeWidth: 2,
      zIndex: 5,
    },
  ]
}
