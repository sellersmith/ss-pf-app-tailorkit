/**
 * Champagne Glasses Shape Generator
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { K, WEDDING_COLORS } from './colors'

/**
 * Generate champagne glasses shape (toasting)
 */
export function generateChampagneGlasses(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = WEDDING_COLORS.champagne
  const w = width
  const h = height

  // Left glass bowl
  const leftGlassCx = cx - w * 0.18
  const leftGlassBowl: PathCommand[] = [
    { type: 'M', x: leftGlassCx - w * 0.12, y: cy - h * 0.35 },
    {
      type: 'C',
      x: leftGlassCx - w * 0.08,
      y: cy - h * 0.1,
      cp1: { x: leftGlassCx - w * 0.14, y: cy - h * 0.2 },
      cp2: { x: leftGlassCx - w * 0.1, y: cy - h * 0.12 },
    },
    { type: 'L', x: leftGlassCx + w * 0.08, y: cy - h * 0.1 },
    {
      type: 'C',
      x: leftGlassCx + w * 0.12,
      y: cy - h * 0.35,
      cp1: { x: leftGlassCx + w * 0.1, y: cy - h * 0.12 },
      cp2: { x: leftGlassCx + w * 0.14, y: cy - h * 0.2 },
    },
    { type: 'Z', x: leftGlassCx - w * 0.12, y: cy - h * 0.35 },
  ]

  // Left stem
  const leftStem: PathCommand[] = [
    { type: 'M', x: leftGlassCx - w * 0.015, y: cy - h * 0.1 },
    { type: 'L', x: leftGlassCx + w * 0.015, y: cy - h * 0.1 },
    { type: 'L', x: leftGlassCx + w * 0.015, y: cy + h * 0.3 },
    { type: 'L', x: leftGlassCx - w * 0.015, y: cy + h * 0.3 },
    { type: 'Z', x: leftGlassCx - w * 0.015, y: cy - h * 0.1 },
  ]

  // Left base
  const leftBase: PathCommand[] = [
    { type: 'M', x: leftGlassCx - w * 0.08, y: cy + h * 0.3 },
    { type: 'L', x: leftGlassCx + w * 0.08, y: cy + h * 0.3 },
    { type: 'L', x: leftGlassCx + w * 0.1, y: cy + h * 0.35 },
    { type: 'L', x: leftGlassCx - w * 0.1, y: cy + h * 0.35 },
    { type: 'Z', x: leftGlassCx - w * 0.08, y: cy + h * 0.3 },
  ]

  // Left liquid
  const leftLiquid: PathCommand[] = [
    { type: 'M', x: leftGlassCx - w * 0.1, y: cy - h * 0.25 },
    {
      type: 'C',
      x: leftGlassCx - w * 0.075,
      y: cy - h * 0.12,
      cp1: { x: leftGlassCx - w * 0.11, y: cy - h * 0.18 },
      cp2: { x: leftGlassCx - w * 0.09, y: cy - h * 0.13 },
    },
    { type: 'L', x: leftGlassCx + w * 0.075, y: cy - h * 0.12 },
    {
      type: 'C',
      x: leftGlassCx + w * 0.1,
      y: cy - h * 0.25,
      cp1: { x: leftGlassCx + w * 0.09, y: cy - h * 0.13 },
      cp2: { x: leftGlassCx + w * 0.11, y: cy - h * 0.18 },
    },
    { type: 'Z', x: leftGlassCx - w * 0.1, y: cy - h * 0.25 },
  ]

  // Right glass bowl
  const rightGlassCx = cx + w * 0.18
  const rightGlassBowl: PathCommand[] = [
    { type: 'M', x: rightGlassCx - w * 0.12, y: cy - h * 0.35 },
    {
      type: 'C',
      x: rightGlassCx - w * 0.08,
      y: cy - h * 0.1,
      cp1: { x: rightGlassCx - w * 0.14, y: cy - h * 0.2 },
      cp2: { x: rightGlassCx - w * 0.1, y: cy - h * 0.12 },
    },
    { type: 'L', x: rightGlassCx + w * 0.08, y: cy - h * 0.1 },
    {
      type: 'C',
      x: rightGlassCx + w * 0.12,
      y: cy - h * 0.35,
      cp1: { x: rightGlassCx + w * 0.1, y: cy - h * 0.12 },
      cp2: { x: rightGlassCx + w * 0.14, y: cy - h * 0.2 },
    },
    { type: 'Z', x: rightGlassCx - w * 0.12, y: cy - h * 0.35 },
  ]

  // Right stem
  const rightStem: PathCommand[] = [
    { type: 'M', x: rightGlassCx - w * 0.015, y: cy - h * 0.1 },
    { type: 'L', x: rightGlassCx + w * 0.015, y: cy - h * 0.1 },
    { type: 'L', x: rightGlassCx + w * 0.015, y: cy + h * 0.3 },
    { type: 'L', x: rightGlassCx - w * 0.015, y: cy + h * 0.3 },
    { type: 'Z', x: rightGlassCx - w * 0.015, y: cy - h * 0.1 },
  ]

  // Right base
  const rightBase: PathCommand[] = [
    { type: 'M', x: rightGlassCx - w * 0.08, y: cy + h * 0.3 },
    { type: 'L', x: rightGlassCx + w * 0.08, y: cy + h * 0.3 },
    { type: 'L', x: rightGlassCx + w * 0.1, y: cy + h * 0.35 },
    { type: 'L', x: rightGlassCx - w * 0.1, y: cy + h * 0.35 },
    { type: 'Z', x: rightGlassCx - w * 0.08, y: cy + h * 0.3 },
  ]

  // Right liquid
  const rightLiquid: PathCommand[] = [
    { type: 'M', x: rightGlassCx - w * 0.1, y: cy - h * 0.25 },
    {
      type: 'C',
      x: rightGlassCx - w * 0.075,
      y: cy - h * 0.12,
      cp1: { x: rightGlassCx - w * 0.11, y: cy - h * 0.18 },
      cp2: { x: rightGlassCx - w * 0.09, y: cy - h * 0.13 },
    },
    { type: 'L', x: rightGlassCx + w * 0.075, y: cy - h * 0.12 },
    {
      type: 'C',
      x: rightGlassCx + w * 0.1,
      y: cy - h * 0.25,
      cp1: { x: rightGlassCx + w * 0.09, y: cy - h * 0.13 },
      cp2: { x: rightGlassCx + w * 0.11, y: cy - h * 0.18 },
    },
    { type: 'Z', x: rightGlassCx - w * 0.1, y: cy - h * 0.25 },
  ]

  // Bubbles (small circles rising from glasses)
  const bubbles: PathCommand[] = []
  const bubblePositions = [
    { x: leftGlassCx - w * 0.02, y: cy - h * 0.2, r: w * 0.015 },
    { x: leftGlassCx + w * 0.03, y: cy - h * 0.28, r: w * 0.012 },
    { x: leftGlassCx - w * 0.04, y: cy - h * 0.32, r: w * 0.01 },
    { x: rightGlassCx + w * 0.02, y: cy - h * 0.22, r: w * 0.015 },
    { x: rightGlassCx - w * 0.03, y: cy - h * 0.3, r: w * 0.012 },
    { x: rightGlassCx + w * 0.04, y: cy - h * 0.35, r: w * 0.01 },
  ]

  for (const bubble of bubblePositions) {
    const bx = bubble.x
    const by = bubble.y
    const br = bubble.r
    bubbles.push(
      { type: 'M', x: bx, y: by - br },
      {
        type: 'C',
        x: bx + br,
        y: by,
        cp1: { x: bx + br * K, y: by - br },
        cp2: { x: bx + br, y: by - br * K },
      },
      {
        type: 'C',
        x: bx,
        y: by + br,
        cp1: { x: bx + br, y: by + br * K },
        cp2: { x: bx + br * K, y: by + br },
      },
      {
        type: 'C',
        x: bx - br,
        y: by,
        cp1: { x: bx - br * K, y: by + br },
        cp2: { x: bx - br, y: by + br * K },
      },
      {
        type: 'C',
        x: bx,
        y: by - br,
        cp1: { x: bx - br, y: by - br * K },
        cp2: { x: bx - br * K, y: by - br },
      },
      { type: 'Z', x: bx, y: by - br }
    )
  }

  return [
    {
      id: 'champagne-left-bowl',
      name: 'Left Glass',
      commands: leftGlassBowl,
      fill: colors.glass,
      stroke: colors.glassStroke,
      strokeWidth: 0.8,
      zIndex: 0,
    },
    {
      id: 'champagne-left-liquid',
      name: 'Left Liquid',
      commands: leftLiquid,
      fill: colors.liquid,
      stroke: colors.liquidStroke,
      strokeWidth: 0.3,
      zIndex: 1,
    },
    {
      id: 'champagne-left-stem',
      name: 'Left Stem',
      commands: leftStem,
      fill: colors.stem,
      stroke: colors.stemStroke,
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'champagne-left-base',
      name: 'Left Base',
      commands: leftBase,
      fill: colors.stem,
      stroke: colors.stemStroke,
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'champagne-right-bowl',
      name: 'Right Glass',
      commands: rightGlassBowl,
      fill: colors.glass,
      stroke: colors.glassStroke,
      strokeWidth: 0.8,
      zIndex: 3,
    },
    {
      id: 'champagne-right-liquid',
      name: 'Right Liquid',
      commands: rightLiquid,
      fill: colors.liquid,
      stroke: colors.liquidStroke,
      strokeWidth: 0.3,
      zIndex: 4,
    },
    {
      id: 'champagne-right-stem',
      name: 'Right Stem',
      commands: rightStem,
      fill: colors.stem,
      stroke: colors.stemStroke,
      strokeWidth: 0.5,
      zIndex: 5,
    },
    {
      id: 'champagne-right-base',
      name: 'Right Base',
      commands: rightBase,
      fill: colors.stem,
      stroke: colors.stemStroke,
      strokeWidth: 0.5,
      zIndex: 5,
    },
    {
      id: 'champagne-bubbles',
      name: 'Bubbles',
      commands: bubbles,
      fill: colors.bubbles,
      stroke: 'none',
      strokeWidth: 0,
      zIndex: 6,
    },
  ]
}
