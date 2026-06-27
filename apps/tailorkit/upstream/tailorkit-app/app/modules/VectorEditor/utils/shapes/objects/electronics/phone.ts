/**
 * Phone Shape Generator
 * Creates smartphone shape
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { OBJECT_COLORS } from '../types'

const K = 0.5522847498 // Bezier approximation for rounded corners

/**
 * Generate smartphone shape
 */
export function generatePhone(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = OBJECT_COLORS.electronics
  const w = width / 2
  const h = height / 2
  const cornerR = w * 0.2

  // Phone body with rounded corners
  const body: PathCommand[] = [
    { type: 'M', x: cx - w + cornerR, y: cy - h },
    { type: 'L', x: cx + w - cornerR, y: cy - h },
    // Top right corner
    {
      type: 'C',
      x: cx + w,
      y: cy - h + cornerR,
      cp1: { x: cx + w - cornerR + cornerR * K, y: cy - h },
      cp2: { x: cx + w, y: cy - h + cornerR - cornerR * K },
    },
    { type: 'L', x: cx + w, y: cy + h - cornerR },
    // Bottom right corner
    {
      type: 'C',
      x: cx + w - cornerR,
      y: cy + h,
      cp1: { x: cx + w, y: cy + h - cornerR + cornerR * K },
      cp2: { x: cx + w - cornerR + cornerR * K, y: cy + h },
    },
    { type: 'L', x: cx - w + cornerR, y: cy + h },
    // Bottom left corner
    {
      type: 'C',
      x: cx - w,
      y: cy + h - cornerR,
      cp1: { x: cx - w + cornerR - cornerR * K, y: cy + h },
      cp2: { x: cx - w, y: cy + h - cornerR + cornerR * K },
    },
    { type: 'L', x: cx - w, y: cy - h + cornerR },
    // Top left corner
    {
      type: 'C',
      x: cx - w + cornerR,
      y: cy - h,
      cp1: { x: cx - w, y: cy - h + cornerR - cornerR * K },
      cp2: { x: cx - w + cornerR - cornerR * K, y: cy - h },
    },
    { type: 'Z', x: cx - w + cornerR, y: cy - h },
  ]

  // Screen
  const screenW = w * 0.85
  const screenH = h * 0.9
  const screenCornerR = cornerR * 0.5

  const screen: PathCommand[] = [
    { type: 'M', x: cx - screenW + screenCornerR, y: cy - screenH },
    { type: 'L', x: cx + screenW - screenCornerR, y: cy - screenH },
    {
      type: 'C',
      x: cx + screenW,
      y: cy - screenH + screenCornerR,
      cp1: { x: cx + screenW - screenCornerR + screenCornerR * K, y: cy - screenH },
      cp2: { x: cx + screenW, y: cy - screenH + screenCornerR - screenCornerR * K },
    },
    { type: 'L', x: cx + screenW, y: cy + screenH - screenCornerR },
    {
      type: 'C',
      x: cx + screenW - screenCornerR,
      y: cy + screenH,
      cp1: { x: cx + screenW, y: cy + screenH - screenCornerR + screenCornerR * K },
      cp2: { x: cx + screenW - screenCornerR + screenCornerR * K, y: cy + screenH },
    },
    { type: 'L', x: cx - screenW + screenCornerR, y: cy + screenH },
    {
      type: 'C',
      x: cx - screenW,
      y: cy + screenH - screenCornerR,
      cp1: { x: cx - screenW + screenCornerR - screenCornerR * K, y: cy + screenH },
      cp2: { x: cx - screenW, y: cy + screenH - screenCornerR + screenCornerR * K },
    },
    { type: 'L', x: cx - screenW, y: cy - screenH + screenCornerR },
    {
      type: 'C',
      x: cx - screenW + screenCornerR,
      y: cy - screenH,
      cp1: { x: cx - screenW, y: cy - screenH + screenCornerR - screenCornerR * K },
      cp2: { x: cx - screenW + screenCornerR - screenCornerR * K, y: cy - screenH },
    },
    { type: 'Z', x: cx - screenW + screenCornerR, y: cy - screenH },
  ]

  // Camera notch (top center)
  const notchW = w * 0.15
  const notchH = h * 0.03
  const notch: PathCommand[] = [
    { type: 'M', x: cx - notchW, y: cy - h },
    {
      type: 'C',
      x: cx - notchW,
      y: cy - h + notchH,
      cp1: { x: cx - notchW, y: cy - h + notchH * 0.5 },
      cp2: { x: cx - notchW, y: cy - h + notchH },
    },
    { type: 'L', x: cx + notchW, y: cy - h + notchH },
    {
      type: 'C',
      x: cx + notchW,
      y: cy - h,
      cp1: { x: cx + notchW, y: cy - h + notchH },
      cp2: { x: cx + notchW, y: cy - h + notchH * 0.5 },
    },
    { type: 'Z', x: cx - notchW, y: cy - h },
  ]

  // Home button/indicator line (bottom)
  const indicator: PathCommand[] = [
    { type: 'M', x: cx - w * 0.3, y: cy + h * 0.95 },
    { type: 'L', x: cx + w * 0.3, y: cy + h * 0.95 },
  ]

  return [
    {
      id: 'phone-body',
      name: 'Body',
      commands: body,
      fill: colors.body.fill,
      stroke: colors.body.stroke,
      strokeWidth: 1.5,
      zIndex: 0,
    },
    {
      id: 'phone-screen',
      name: 'Screen',
      commands: screen,
      fill: colors.screen.fill,
      stroke: colors.screen.stroke,
      strokeWidth: 0.5,
      zIndex: 1,
    },
    {
      id: 'phone-notch',
      name: 'Notch',
      commands: notch,
      fill: colors.body.fill,
      stroke: 'none',
      strokeWidth: 0,
      zIndex: 2,
    },
    {
      id: 'phone-indicator',
      name: 'Indicator',
      commands: indicator,
      fill: 'none',
      stroke: colors.body.stroke,
      strokeWidth: 3,
      zIndex: 2,
    },
  ]
}
