/**
 * Camera Shape Generator
 * Creates a DSLR camera shape with body, lens, and flash
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { OBJECT_COLORS } from '../types'

/**
 * Generate camera shape
 */
export function generateCamera(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = OBJECT_COLORS.electronics.camera
  const w = width / 2
  const h = height / 2

  // Camera body
  const body: PathCommand[] = [
    { type: 'M', x: cx - w * 0.7, y: cy - h * 0.3 },
    { type: 'L', x: cx + w * 0.7, y: cy - h * 0.3 },
    { type: 'L', x: cx + w * 0.7, y: cy + h * 0.5 },
    { type: 'L', x: cx - w * 0.7, y: cy + h * 0.5 },
    { type: 'Z', x: cx - w * 0.7, y: cy - h * 0.3 },
  ]

  // Viewfinder bump
  const viewfinder: PathCommand[] = [
    { type: 'M', x: cx - w * 0.2, y: cy - h * 0.3 },
    { type: 'L', x: cx - w * 0.2, y: cy - h * 0.5 },
    { type: 'L', x: cx + w * 0.3, y: cy - h * 0.5 },
    { type: 'L', x: cx + w * 0.3, y: cy - h * 0.3 },
    { type: 'Z', x: cx - w * 0.2, y: cy - h * 0.3 },
  ]

  // Flash
  const flash: PathCommand[] = [
    { type: 'M', x: cx - w * 0.6, y: cy - h * 0.5 },
    { type: 'L', x: cx - w * 0.6, y: cy - h * 0.7 },
    { type: 'L', x: cx - w * 0.3, y: cy - h * 0.7 },
    { type: 'L', x: cx - w * 0.3, y: cy - h * 0.5 },
    { type: 'Z', x: cx - w * 0.6, y: cy - h * 0.5 },
  ]

  // Lens outer ring
  const lensOuter: PathCommand[] = [
    { type: 'M', x: cx - w * 0.35, y: cy + h * 0.1 },
    {
      type: 'C',
      x: cx - w * 0.35,
      y: cy + h * 0.1,
      cp1: { x: cx - w * 0.35, y: cy - h * 0.3 },
      cp2: { x: cx + w * 0.35, y: cy - h * 0.3 },
    },
    {
      type: 'C',
      x: cx + w * 0.35,
      y: cy + h * 0.1,
      cp1: { x: cx + w * 0.35, y: cy - h * 0.3 },
      cp2: { x: cx + w * 0.35, y: cy + h * 0.5 },
    },
    {
      type: 'C',
      x: cx - w * 0.35,
      y: cy + h * 0.1,
      cp1: { x: cx + w * 0.35, y: cy + h * 0.5 },
      cp2: { x: cx - w * 0.35, y: cy + h * 0.5 },
    },
    { type: 'Z', x: cx - w * 0.35, y: cy + h * 0.1 },
  ]

  // Lens inner (simplified circle using bezier curves)
  const lensInner: PathCommand[] = [
    { type: 'M', x: cx - w * 0.25, y: cy + h * 0.1 },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.15,
      cp1: { x: cx - w * 0.25, y: cy - h * 0.05 },
      cp2: { x: cx - w * 0.15, y: cy - h * 0.15 },
    },
    {
      type: 'C',
      x: cx + w * 0.25,
      y: cy + h * 0.1,
      cp1: { x: cx + w * 0.15, y: cy - h * 0.15 },
      cp2: { x: cx + w * 0.25, y: cy - h * 0.05 },
    },
    {
      type: 'C',
      x: cx,
      y: cy + h * 0.35,
      cp1: { x: cx + w * 0.25, y: cy + h * 0.25 },
      cp2: { x: cx + w * 0.15, y: cy + h * 0.35 },
    },
    {
      type: 'C',
      x: cx - w * 0.25,
      y: cy + h * 0.1,
      cp1: { x: cx - w * 0.15, y: cy + h * 0.35 },
      cp2: { x: cx - w * 0.25, y: cy + h * 0.25 },
    },
    { type: 'Z', x: cx - w * 0.25, y: cy + h * 0.1 },
  ]

  // Lens glass (center)
  const lensGlass: PathCommand[] = [
    { type: 'M', x: cx - w * 0.15, y: cy + h * 0.1 },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.05,
      cp1: { x: cx - w * 0.15, y: cy },
      cp2: { x: cx - w * 0.08, y: cy - h * 0.05 },
    },
    {
      type: 'C',
      x: cx + w * 0.15,
      y: cy + h * 0.1,
      cp1: { x: cx + w * 0.08, y: cy - h * 0.05 },
      cp2: { x: cx + w * 0.15, y: cy },
    },
    {
      type: 'C',
      x: cx,
      y: cy + h * 0.25,
      cp1: { x: cx + w * 0.15, y: cy + h * 0.2 },
      cp2: { x: cx + w * 0.08, y: cy + h * 0.25 },
    },
    {
      type: 'C',
      x: cx - w * 0.15,
      y: cy + h * 0.1,
      cp1: { x: cx - w * 0.08, y: cy + h * 0.25 },
      cp2: { x: cx - w * 0.15, y: cy + h * 0.2 },
    },
    { type: 'Z', x: cx - w * 0.15, y: cy + h * 0.1 },
  ]

  // Shutter button
  const shutter: PathCommand[] = [
    { type: 'M', x: cx + w * 0.4, y: cy - h * 0.5 },
    { type: 'L', x: cx + w * 0.55, y: cy - h * 0.5 },
    { type: 'L', x: cx + w * 0.55, y: cy - h * 0.35 },
    { type: 'L', x: cx + w * 0.4, y: cy - h * 0.35 },
    { type: 'Z', x: cx + w * 0.4, y: cy - h * 0.5 },
  ]

  return [
    {
      id: 'camera-body',
      name: 'Body',
      commands: body,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'camera-viewfinder',
      name: 'Viewfinder',
      commands: viewfinder,
      fill: colors.fill,
      stroke: colors.stroke,
      strokeWidth: 0.5,
      zIndex: 1,
    },
    {
      id: 'camera-flash',
      name: 'Flash',
      commands: flash,
      fill: '#ECEFF1',
      stroke: '#B0BEC5',
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'camera-lens-outer',
      name: 'Lens Outer',
      commands: lensOuter,
      fill: '#37474F',
      stroke: '#263238',
      strokeWidth: 1,
      zIndex: 3,
    },
    {
      id: 'camera-lens-inner',
      name: 'Lens Inner',
      commands: lensInner,
      fill: '#455A64',
      stroke: '#37474F',
      strokeWidth: 0.5,
      zIndex: 4,
    },
    {
      id: 'camera-lens-glass',
      name: 'Lens Glass',
      commands: lensGlass,
      fill: '#1A237E',
      stroke: '#0D47A1',
      strokeWidth: 0.3,
      zIndex: 5,
    },
    {
      id: 'camera-shutter',
      name: 'Shutter',
      commands: shutter,
      fill: '#424242',
      stroke: '#212121',
      strokeWidth: 0.3,
      zIndex: 6,
    },
  ]
}
