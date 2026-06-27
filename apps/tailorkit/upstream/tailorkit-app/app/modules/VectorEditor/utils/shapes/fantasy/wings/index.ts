/**
 * Angel Wings Shape Generators
 * Generates angel wing shapes
 */

import type { PathCommand } from '../../../svg'
import type { FantasyPathPart } from '../types'
import { wrapFantasyGenerator, WING_COLORS } from '../types'

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a single feather path
 */
function generateFeather(
  baseX: number,
  baseY: number,
  length: number,
  width: number,
  angle: number,
  curvature: number = 0.3
): PathCommand[] {
  const rad = (angle * Math.PI) / 180
  const tipX = baseX + Math.cos(rad) * length
  const tipY = baseY + Math.sin(rad) * length

  // Control points for the curved feather
  const perpRad = rad + Math.PI / 2
  const cp1X = baseX + Math.cos(rad) * length * 0.4 + Math.cos(perpRad) * width * curvature
  const cp1Y = baseY + Math.sin(rad) * length * 0.4 + Math.sin(perpRad) * width * curvature
  const cp2X = baseX + Math.cos(rad) * length * 0.7 + Math.cos(perpRad) * width * 0.5
  const cp2Y = baseY + Math.sin(rad) * length * 0.7 + Math.sin(perpRad) * width * 0.5

  // Return side
  const cp3X = baseX + Math.cos(rad) * length * 0.7 - Math.cos(perpRad) * width * 0.5
  const cp3Y = baseY + Math.sin(rad) * length * 0.7 - Math.sin(perpRad) * width * 0.5
  const cp4X = baseX + Math.cos(rad) * length * 0.4 - Math.cos(perpRad) * width * curvature
  const cp4Y = baseY + Math.sin(rad) * length * 0.4 - Math.sin(perpRad) * width * curvature

  return [
    { type: 'M', x: baseX, y: baseY },
    { type: 'C', x: tipX, y: tipY, cp1: { x: cp1X, y: cp1Y }, cp2: { x: cp2X, y: cp2Y } },
    { type: 'C', x: baseX, y: baseY, cp1: { x: cp3X, y: cp3Y }, cp2: { x: cp4X, y: cp4Y } },
    { type: 'Z', x: baseX, y: baseY },
  ]
}

// =============================================================================
// Left Wing Generators
// =============================================================================

/**
 * Generate left angel wing - cartoon style
 * More detailed with multiple feather layers
 */
const _generateAngelWingLeftCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const wingWidth = width * 0.9
  const wingHeight = height * 0.85

  // Wing base (left side, pointing left)
  const baseX = cx + wingWidth * 0.4

  // Generate primary feathers (longest, at the bottom/outer edge)
  const primaryCount = 5
  for (let i = 0; i < primaryCount; i++) {
    const t = i / (primaryCount - 1)
    const featherLength = wingHeight * (0.6 + t * 0.15)
    const featherWidth = wingWidth * 0.08
    const angle = 180 + 30 + t * 40 // Spread from ~210 to ~250 degrees
    const startX = baseX - t * wingWidth * 0.6
    const startY = cy + t * wingHeight * 0.3

    parts.push({
      id: `primary-feather-${i}`,
      name: `Primary Feather ${i + 1}`,
      commands: generateFeather(startX, startY, featherLength, featherWidth, angle),
      fill: WING_COLORS.primary,
      stroke: WING_COLORS.featherOutline,
      strokeWidth: 1,
      zIndex: 10 + i,
    })
  }

  // Generate secondary feathers (medium length, middle layer)
  const secondaryCount = 6
  for (let i = 0; i < secondaryCount; i++) {
    const t = i / (secondaryCount - 1)
    const featherLength = wingHeight * (0.35 + t * 0.1)
    const featherWidth = wingWidth * 0.06
    const angle = 180 + 20 + t * 50
    const startX = baseX - t * wingWidth * 0.5
    const startY = cy - wingHeight * 0.1 + t * wingHeight * 0.2

    parts.push({
      id: `secondary-feather-${i}`,
      name: `Secondary Feather ${i + 1}`,
      commands: generateFeather(startX, startY, featherLength, featherWidth, angle, 0.4),
      fill: WING_COLORS.secondary,
      stroke: WING_COLORS.featherOutline,
      strokeWidth: 0.8,
      zIndex: 20 + i,
    })
  }

  // Generate coverts (small feathers near the wing base)
  const covertCount = 8
  for (let i = 0; i < covertCount; i++) {
    const t = i / (covertCount - 1)
    const featherLength = wingHeight * (0.15 + t * 0.05)
    const featherWidth = wingWidth * 0.04
    const angle = 180 + 10 + t * 40
    const startX = baseX - t * wingWidth * 0.35
    const startY = cy - wingHeight * 0.2 + t * wingHeight * 0.15

    parts.push({
      id: `covert-feather-${i}`,
      name: `Covert Feather ${i + 1}`,
      commands: generateFeather(startX, startY, featherLength, featherWidth, angle, 0.5),
      fill: WING_COLORS.featherHighlight,
      stroke: WING_COLORS.featherOutline,
      strokeWidth: 0.5,
      zIndex: 30 + i,
    })
  }

  return parts
}

export const generateAngelWingLeftCartoon = wrapFantasyGenerator(_generateAngelWingLeftCartoon, 'angel-wing-left')

// =============================================================================
// Right Wing Generators (mirrored)
// =============================================================================

/**
 * Generate right angel wing - cartoon style
 */
const _generateAngelWingRightCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  // Mirror the left wing
  const leftParts = generateAngelWingLeftCartoon(cx, cy, width, height)
  return leftParts.map(part => ({
    ...part,
    id: part.id.replace('left', 'right'),
    name: part.name.replace('Left', 'Right'),
    commands: part.commands.map(cmd => {
      const newCmd = { ...cmd }
      // Mirror X coordinates around center
      newCmd.x = cx + (cx - cmd.x)
      if (cmd.cp1) newCmd.cp1 = { x: cx + (cx - cmd.cp1.x), y: cmd.cp1.y }
      if (cmd.cp2) newCmd.cp2 = { x: cx + (cx - cmd.cp2.x), y: cmd.cp2.y }
      if (cmd.cp) newCmd.cp = { x: cx + (cx - cmd.cp.x), y: cmd.cp.y }
      return newCmd
    }),
  }))
}

export const generateAngelWingRightCartoon = wrapFantasyGenerator(_generateAngelWingRightCartoon, 'angel-wing-right')

// =============================================================================
// Wing Pair Generators
// =============================================================================

/**
 * Generate angel wing pair - cartoon style
 */
const _generateAngelWingPairCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const halfWidth = width * 0.48
  const leftWing = generateAngelWingLeftCartoon(cx - halfWidth * 0.5, cy, halfWidth, height)
  const rightWing = generateAngelWingRightCartoon(cx + halfWidth * 0.5, cy, halfWidth, height)
  return [
    ...leftWing.map(p => ({ ...p, id: `left-${p.id}`, name: `Left ${p.name}` })),
    ...rightWing.map(p => ({ ...p, id: `right-${p.id}`, name: `Right ${p.name}` })),
  ]
}

export const generateAngelWingPairCartoon = wrapFantasyGenerator(_generateAngelWingPairCartoon, 'angel-wing-pair')
