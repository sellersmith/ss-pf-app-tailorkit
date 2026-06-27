/**
 * Party Hat Shape Generator
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { K, BIRTHDAY_COLORS } from './colors'

/**
 * Generate party hat shape
 */
export function generatePartyHat(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = BIRTHDAY_COLORS.partyHat
  const w = width
  const h = height

  // Cone dimensions
  const coneTop = cy - h * 0.45
  const coneBottom = cy + h * 0.4
  const coneHeight = coneBottom - coneTop

  // Helper function to calculate cone width at a given y position
  const getConeWidthAtY = (y: number): number => {
    const progress = (y - coneTop) / coneHeight
    return w * 0.4 * progress
  }

  // Main cone body
  const cone: PathCommand[] = [
    { type: 'M', x: cx, y: coneTop },
    { type: 'L', x: cx + w * 0.4, y: coneBottom },
    {
      type: 'C',
      x: cx - w * 0.4,
      y: coneBottom,
      cp1: { x: cx + w * 0.15, y: coneBottom + h * 0.1 },
      cp2: { x: cx - w * 0.15, y: coneBottom + h * 0.1 },
    },
    { type: 'Z', x: cx, y: coneTop },
  ]

  // Stripe 1 (upper stripe) - horizontal band that follows the cone slope
  const stripe1Top = coneTop + coneHeight * 0.25
  const stripe1Bottom = coneTop + coneHeight * 0.4
  const stripe1TopWidth = getConeWidthAtY(stripe1Top)
  const stripe1BottomWidth = getConeWidthAtY(stripe1Bottom)
  const stripe1: PathCommand[] = [
    { type: 'M', x: cx - stripe1TopWidth, y: stripe1Top },
    { type: 'L', x: cx + stripe1TopWidth, y: stripe1Top },
    { type: 'L', x: cx + stripe1BottomWidth, y: stripe1Bottom },
    { type: 'L', x: cx - stripe1BottomWidth, y: stripe1Bottom },
    { type: 'Z', x: cx - stripe1TopWidth, y: stripe1Top },
  ]

  // Stripe 2 (lower stripe) - horizontal band that follows the cone slope
  const stripe2Top = coneTop + coneHeight * 0.55
  const stripe2Bottom = coneTop + coneHeight * 0.7
  const stripe2TopWidth = getConeWidthAtY(stripe2Top)
  const stripe2BottomWidth = getConeWidthAtY(stripe2Bottom)
  const stripe2: PathCommand[] = [
    { type: 'M', x: cx - stripe2TopWidth, y: stripe2Top },
    { type: 'L', x: cx + stripe2TopWidth, y: stripe2Top },
    { type: 'L', x: cx + stripe2BottomWidth, y: stripe2Bottom },
    { type: 'L', x: cx - stripe2BottomWidth, y: stripe2Bottom },
    { type: 'Z', x: cx - stripe2TopWidth, y: stripe2Top },
  ]

  // Pompom at top
  const pompomR = w * 0.1
  const pompomY = coneTop - pompomR * 0.5
  const pompom: PathCommand[] = [
    { type: 'M', x: cx, y: pompomY - pompomR },
    {
      type: 'C',
      x: cx + pompomR,
      y: pompomY,
      cp1: { x: cx + pompomR * K, y: pompomY - pompomR },
      cp2: { x: cx + pompomR, y: pompomY - pompomR * K },
    },
    {
      type: 'C',
      x: cx,
      y: pompomY + pompomR,
      cp1: { x: cx + pompomR, y: pompomY + pompomR * K },
      cp2: { x: cx + pompomR * K, y: pompomY + pompomR },
    },
    {
      type: 'C',
      x: cx - pompomR,
      y: pompomY,
      cp1: { x: cx - pompomR * K, y: pompomY + pompomR },
      cp2: { x: cx - pompomR, y: pompomY + pompomR * K },
    },
    {
      type: 'C',
      x: cx,
      y: pompomY - pompomR,
      cp1: { x: cx - pompomR, y: pompomY - pompomR * K },
      cp2: { x: cx - pompomR * K, y: pompomY - pompomR },
    },
    { type: 'Z', x: cx, y: pompomY - pompomR },
  ]

  return [
    {
      id: 'hat-cone',
      name: 'Cone',
      commands: cone,
      fill: colors.body,
      stroke: colors.bodyStroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'hat-stripe1',
      name: 'Stripe 1',
      commands: stripe1,
      fill: colors.stripe,
      stroke: 'none',
      strokeWidth: 0,
      zIndex: 1,
    },
    {
      id: 'hat-stripe2',
      name: 'Stripe 2',
      commands: stripe2,
      fill: colors.stripe,
      stroke: 'none',
      strokeWidth: 0,
      zIndex: 1,
    },
    {
      id: 'hat-pompom',
      name: 'Pompom',
      commands: pompom,
      fill: colors.pompom,
      stroke: colors.pompomStroke,
      strokeWidth: 0.5,
      zIndex: 2,
    },
  ]
}
