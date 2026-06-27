/**
 * Virgo (Maiden) Shape Generator - Earth Sign
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { getElementColors } from './helpers'

const _generateVirgoCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const colors = getElementColors('virgo')
  const scale = Math.min(width, height) * 0.4

  // Virgo symbol - M with a loop
  const mCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.4, y: cy + scale * 0.4 },
    { type: 'L', x: cx - scale * 0.4, y: cy - scale * 0.3 },
    {
      type: 'C',
      x: cx - scale * 0.15,
      y: cy - scale * 0.3,
      cp1: { x: cx - scale * 0.4, y: cy - scale * 0.5 },
      cp2: { x: cx - scale * 0.15, y: cy - scale * 0.5 },
    },
    { type: 'L', x: cx - scale * 0.15, y: cy + scale * 0.4 },
    { type: 'M', x: cx - scale * 0.15, y: cy - scale * 0.3 },
    {
      type: 'C',
      x: cx + scale * 0.1,
      y: cy - scale * 0.3,
      cp1: { x: cx - scale * 0.15, y: cy - scale * 0.5 },
      cp2: { x: cx + scale * 0.1, y: cy - scale * 0.5 },
    },
    { type: 'L', x: cx + scale * 0.1, y: cy + scale * 0.1 },
  ]

  // The characteristic loop
  const loopCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.1, y: cy + scale * 0.1 },
    {
      type: 'C',
      x: cx + scale * 0.35,
      y: cy + scale * 0.05,
      cp1: { x: cx + scale * 0.2, y: cy + scale * 0.25 },
      cp2: { x: cx + scale * 0.35, y: cy + scale * 0.2 },
    },
    {
      type: 'C',
      x: cx + scale * 0.25,
      y: cy + scale * 0.45,
      cp1: { x: cx + scale * 0.35, y: cy + scale * 0.25 },
      cp2: { x: cx + scale * 0.35, y: cy + scale * 0.4 },
    },
  ]

  parts.push({
    commands: mCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  parts.push({
    commands: loopCommands,
    fill: 'none',
    stroke: colors.primary,
    strokeWidth: scale * 0.1,
    zIndex: 10,
  })

  return parts
}

export const generateVirgoCartoon = wrapFantasyGenerator(_generateVirgoCartoon, 'virgo')
