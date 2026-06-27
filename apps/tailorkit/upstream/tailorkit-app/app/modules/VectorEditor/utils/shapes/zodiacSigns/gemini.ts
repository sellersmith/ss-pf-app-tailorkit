/**
 * Gemini (Twins) Shape Generator - Air Sign
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { getElementColors } from './helpers'

const _generateGeminiCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const colors = getElementColors('gemini')
  const scale = Math.min(width, height) * 0.4

  // Two vertical pillars (twins symbol)
  const leftPillarCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.25, y: cy - scale * 0.5 },
    { type: 'L', x: cx - scale * 0.25, y: cy + scale * 0.5 },
  ]

  const rightPillarCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.25, y: cy - scale * 0.5 },
    { type: 'L', x: cx + scale * 0.25, y: cy + scale * 0.5 },
  ]

  // Top connecting bar
  const topBarCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.4, y: cy - scale * 0.5 },
    { type: 'L', x: cx + scale * 0.4, y: cy - scale * 0.5 },
  ]

  // Bottom connecting bar
  const bottomBarCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.4, y: cy + scale * 0.5 },
    { type: 'L', x: cx + scale * 0.4, y: cy + scale * 0.5 },
  ]

  parts.push({
    commands: leftPillarCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  parts.push({
    commands: rightPillarCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  parts.push({
    commands: topBarCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.08,
    zIndex: 10,
  })

  parts.push({
    commands: bottomBarCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.08,
    zIndex: 10,
  })

  return parts
}

export const generateGeminiCartoon = wrapFantasyGenerator(_generateGeminiCartoon, 'gemini')
