/**
 * Constellation Shape Generators
 * Generates zodiac constellation patterns (star patterns connected by lines)
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator, CONSTELLATION_COLORS } from '../fantasy/types'

// =============================================================================
// Helper Functions
// =============================================================================

const colors = CONSTELLATION_COLORS

/**
 * Generate a star shape at given position
 */
function generateStar(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  points: number = 4
): PathCommand[] {
  const commands: PathCommand[] = []
  const angleStep = Math.PI / points

  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    const angle = i * angleStep - Math.PI / 2
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius

    if (i === 0) {
      commands.push({ type: 'M', x, y })
    } else {
      commands.push({ type: 'L', x, y })
    }
  }

  commands.push({ type: 'Z', x: commands[0].x, y: commands[0].y })
  return commands
}

/**
 * Generate a simple circle for smaller stars
 */
function generateCircle(cx: number, cy: number, r: number): PathCommand[] {
  const kappa = 0.5522847498
  const o = r * kappa

  return [
    { type: 'M', x: cx - r, y: cy },
    { type: 'C', x: cx, y: cy - r, cp1: { x: cx - r, y: cy - o }, cp2: { x: cx - o, y: cy - r } },
    { type: 'C', x: cx + r, y: cy, cp1: { x: cx + o, y: cy - r }, cp2: { x: cx + r, y: cy - o } },
    { type: 'C', x: cx, y: cy + r, cp1: { x: cx + r, y: cy + o }, cp2: { x: cx + o, y: cy + r } },
    { type: 'C', x: cx - r, y: cy, cp1: { x: cx - o, y: cy + r }, cp2: { x: cx - r, y: cy + o } },
    { type: 'Z', x: cx - r, y: cy },
  ]
}

/**
 * Interface for star position with optional major star flag
 */
interface StarPosition {
  x: number
  y: number
  major?: boolean
}

/**
 * Generate a constellation from star positions and connections
 */
function generateConstellation(
  cx: number,
  cy: number,
  width: number,
  height: number,
  stars: StarPosition[],
  connections: [number, number][]
): FantasyPathPart[] {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.45

  // Transform star positions from normalized (-1 to 1) to actual coordinates
  const transformedStars = stars.map(star => ({
    x: cx + star.x * scale,
    y: cy + star.y * scale,
    major: star.major,
  }))

  // Draw connection lines first (lower z-index)
  connections.forEach(([fromIdx, toIdx], i) => {
    const from = transformedStars[fromIdx]
    const to = transformedStars[toIdx]

    const lineCommands: PathCommand[] = [
      { type: 'M', x: from.x, y: from.y },
      { type: 'L', x: to.x, y: to.y },
    ]

    parts.push({
      commands: lineCommands,
      fill: 'none',
      stroke: colors.line,
      strokeWidth: scale * 0.02,
      zIndex: 5 + i,
      opacity: 0.7,
    })
  })

  // Draw stars
  transformedStars.forEach((star, i) => {
    const isMajor = star.major
    const starSize = isMajor ? scale * 0.08 : scale * 0.05

    if (isMajor) {
      // Major stars get a 4-point star shape
      parts.push({
        commands: generateStar(star.x, star.y, starSize, starSize * 0.4, 4),
        fill: colors.majorStar,
        stroke: 'none',
        strokeWidth: 0,
        zIndex: 20 + i,
      })

      // Glow effect for major stars
      parts.push({
        commands: generateCircle(star.x, star.y, starSize * 1.5),
        fill: colors.starGlow,
        stroke: 'none',
        strokeWidth: 0,
        zIndex: 19,
        opacity: 0.3,
      })
    } else {
      // Minor stars are simple circles
      parts.push({
        commands: generateCircle(star.x, star.y, starSize),
        fill: colors.star,
        stroke: 'none',
        strokeWidth: 0,
        zIndex: 20 + i,
      })
    }
  })

  return parts
}

// =============================================================================
// Aries Constellation
// =============================================================================

const _generateAriesConstellation = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  // Aries - simple curved line of stars
  const stars: StarPosition[] = [
    { x: -0.6, y: 0.2, major: true }, // Hamal
    { x: -0.2, y: 0, major: true }, // Sheratan
    { x: 0.2, y: -0.1 },
    { x: 0.5, y: 0.1 },
  ]

  const connections: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
  ]

  return generateConstellation(cx, cy, width, height, stars, connections)
}

// =============================================================================
// Taurus Constellation
// =============================================================================

const _generateTaurusConstellation = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  // Taurus - V-shape for bull's face with Hyades cluster
  const stars: StarPosition[] = [
    { x: 0.5, y: -0.3, major: true }, // Aldebaran
    { x: 0.2, y: -0.1 },
    { x: -0.1, y: 0.1 },
    { x: -0.4, y: 0.3 }, // Left horn tip
    { x: 0.3, y: 0.2 },
    { x: 0.5, y: 0.4 }, // Right horn tip
    { x: -0.6, y: -0.4, major: true }, // Elnath (shared with Auriga)
  ]

  const connections: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [1, 4],
    [4, 5],
    [2, 6],
  ]

  return generateConstellation(cx, cy, width, height, stars, connections)
}

// =============================================================================
// Gemini Constellation
// =============================================================================

const _generateGeminiConstellation = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  // Gemini - two parallel figures (twins)
  const stars: StarPosition[] = [
    { x: -0.3, y: -0.5, major: true }, // Castor
    { x: 0.2, y: -0.4, major: true }, // Pollux
    { x: -0.35, y: -0.2 },
    { x: 0.15, y: -0.15 },
    { x: -0.4, y: 0.1 },
    { x: 0.1, y: 0.15 },
    { x: -0.5, y: 0.4 },
    { x: 0, y: 0.45 },
  ]

  const connections: [number, number][] = [
    [0, 2],
    [2, 4],
    [4, 6],
    [1, 3],
    [3, 5],
    [5, 7],
    [0, 1], // Connect the twins
    [4, 5],
  ]

  return generateConstellation(cx, cy, width, height, stars, connections)
}

// =============================================================================
// Cancer Constellation
// =============================================================================

const _generateCancerConstellation = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  // Cancer - inverted Y shape (faint constellation)
  const stars: StarPosition[] = [
    { x: 0, y: -0.3, major: true }, // Acubens area
    { x: -0.3, y: 0 },
    { x: 0.3, y: 0.1 },
    { x: -0.2, y: 0.4 },
    { x: 0.2, y: 0.35 },
    { x: 0, y: 0.1 }, // Beehive cluster area
  ]

  const connections: [number, number][] = [
    [0, 5],
    [5, 1],
    [5, 2],
    [1, 3],
    [2, 4],
  ]

  return generateConstellation(cx, cy, width, height, stars, connections)
}

// =============================================================================
// Leo Constellation
// =============================================================================

const _generateLeoConstellation = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  // Leo - sickle (head) and triangle (body)
  const stars: StarPosition[] = [
    { x: -0.5, y: -0.3, major: true }, // Regulus
    { x: -0.35, y: -0.5 },
    { x: -0.15, y: -0.45 },
    { x: 0.05, y: -0.3 },
    { x: 0.15, y: -0.1 },
    { x: 0.4, y: 0.1, major: true }, // Denebola
    { x: 0.2, y: 0.25 },
    { x: -0.1, y: 0.15 },
  ]

  const connections: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 0], // Sickle
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4], // Body triangle
  ]

  return generateConstellation(cx, cy, width, height, stars, connections)
}

// =============================================================================
// Virgo Constellation
// =============================================================================

const _generateVirgoConstellation = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  // Virgo - Y-shaped with extended arms
  const stars: StarPosition[] = [
    { x: -0.1, y: -0.5, major: true }, // Spica
    { x: -0.2, y: -0.2 },
    { x: 0, y: 0 },
    { x: -0.4, y: 0.2 },
    { x: 0.3, y: 0.15 },
    { x: -0.5, y: 0.45 },
    { x: 0.5, y: 0.4 },
    { x: 0.1, y: 0.35 },
  ]

  const connections: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [2, 4],
    [3, 5],
    [4, 6],
    [2, 7],
  ]

  return generateConstellation(cx, cy, width, height, stars, connections)
}

// =============================================================================
// Libra Constellation
// =============================================================================

const _generateLibraConstellation = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  // Libra - scales shape
  const stars: StarPosition[] = [
    { x: 0, y: -0.1, major: true }, // Zubenelgenubi area
    { x: -0.4, y: -0.3 },
    { x: 0.4, y: -0.25 },
    { x: -0.3, y: 0.2 },
    { x: 0.35, y: 0.25, major: true }, // Zubeneschamali
  ]

  const connections: [number, number][] = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 3],
    [2, 4],
  ]

  return generateConstellation(cx, cy, width, height, stars, connections)
}

// =============================================================================
// Scorpio Constellation
// =============================================================================

const _generateScorpioConstellation = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  // Scorpio - curved scorpion shape with stinger
  const stars: StarPosition[] = [
    { x: -0.5, y: -0.4, major: true }, // Antares
    { x: -0.35, y: -0.2 },
    { x: -0.25, y: 0 },
    { x: -0.1, y: 0.15 },
    { x: 0.1, y: 0.25 },
    { x: 0.3, y: 0.3 },
    { x: 0.45, y: 0.2 },
    { x: 0.55, y: 0.05 }, // Stinger
    { x: 0.5, y: 0.35 }, // Other stinger point
  ]

  const connections: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [6, 8],
  ]

  return generateConstellation(cx, cy, width, height, stars, connections)
}

// =============================================================================
// Sagittarius Constellation
// =============================================================================

const _generateSagittariusConstellation = (
  cx: number,
  cy: number,
  width: number,
  height: number
): FantasyPathPart[] => {
  // Sagittarius - teapot asterism
  const stars: StarPosition[] = [
    { x: -0.3, y: -0.2 }, // Lid
    { x: 0, y: -0.3 },
    { x: 0.25, y: -0.15, major: true }, // Kaus Australis area
    { x: 0.35, y: 0.1 },
    { x: 0.15, y: 0.25 },
    { x: -0.15, y: 0.2 },
    { x: -0.35, y: 0.05 },
    { x: -0.5, y: -0.15 }, // Spout
    { x: 0.5, y: -0.1 }, // Handle
  ]

  const connections: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 0],
    [6, 7], // Spout
    [2, 8], // Handle
    [3, 8],
  ]

  return generateConstellation(cx, cy, width, height, stars, connections)
}

// =============================================================================
// Capricorn Constellation
// =============================================================================

const _generateCapricornConstellation = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  // Capricorn - triangular goat shape
  const stars: StarPosition[] = [
    { x: -0.4, y: -0.25, major: true }, // Deneb Algedi area
    { x: -0.1, y: -0.35 },
    { x: 0.25, y: -0.2 },
    { x: 0.45, y: 0 },
    { x: 0.3, y: 0.25 },
    { x: -0.05, y: 0.3 },
    { x: -0.35, y: 0.15 },
  ]

  const connections: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 0],
  ]

  return generateConstellation(cx, cy, width, height, stars, connections)
}

// =============================================================================
// Aquarius Constellation
// =============================================================================

const _generateAquariusConstellation = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  // Aquarius - water bearer with water stream
  const stars: StarPosition[] = [
    { x: -0.3, y: -0.4, major: true }, // Sadalsuud area
    { x: 0, y: -0.3 },
    { x: 0.2, y: -0.15 },
    { x: -0.1, y: 0 },
    { x: 0.15, y: 0.15 },
    { x: -0.2, y: 0.3 },
    { x: 0.3, y: 0.35 },
    { x: 0.5, y: 0.45 }, // Water stream end
  ]

  const connections: [number, number][] = [
    [0, 1],
    [1, 2],
    [1, 3],
    [3, 4],
    [3, 5],
    [4, 6],
    [6, 7],
  ]

  return generateConstellation(cx, cy, width, height, stars, connections)
}

// =============================================================================
// Pisces Constellation
// =============================================================================

const _generatePiscesConstellation = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  // Pisces - two fish connected by a cord
  const stars: StarPosition[] = [
    { x: -0.5, y: -0.3, major: true }, // Western fish
    { x: -0.3, y: -0.2 },
    { x: -0.1, y: -0.1 },
    { x: 0.1, y: 0 }, // Junction
    { x: 0.3, y: 0.15 },
    { x: 0.5, y: 0.3, major: true }, // Eastern fish
    { x: 0.2, y: -0.2 },
    { x: 0.35, y: -0.35 },
  ]

  const connections: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3], // To junction
    [3, 4],
    [4, 5], // To eastern fish
    [3, 6],
    [6, 7], // Northern branch
  ]

  return generateConstellation(cx, cy, width, height, stars, connections)
}

// =============================================================================
// Export all generators as a map
// =============================================================================

// Wrapped exports
export const generateAriesConstellation = wrapFantasyGenerator(_generateAriesConstellation, 'aries-constellation')
export const generateTaurusConstellation = wrapFantasyGenerator(_generateTaurusConstellation, 'taurus-constellation')
export const generateGeminiConstellation = wrapFantasyGenerator(_generateGeminiConstellation, 'gemini-constellation')
export const generateCancerConstellation = wrapFantasyGenerator(_generateCancerConstellation, 'cancer-constellation')
export const generateLeoConstellation = wrapFantasyGenerator(_generateLeoConstellation, 'leo-constellation')
export const generateVirgoConstellation = wrapFantasyGenerator(_generateVirgoConstellation, 'virgo-constellation')
export const generateLibraConstellation = wrapFantasyGenerator(_generateLibraConstellation, 'libra-constellation')
export const generateScorpioConstellation = wrapFantasyGenerator(_generateScorpioConstellation, 'scorpio-constellation')
export const generateSagittariusConstellation = wrapFantasyGenerator(
  _generateSagittariusConstellation,
  'sagittarius-constellation'
)
export const generateCapricornConstellation = wrapFantasyGenerator(
  _generateCapricornConstellation,
  'capricorn-constellation'
)
export const generateAquariusConstellation = wrapFantasyGenerator(
  _generateAquariusConstellation,
  'aquarius-constellation'
)
export const generatePiscesConstellation = wrapFantasyGenerator(_generatePiscesConstellation, 'pisces-constellation')

export const constellationGenerators = {
  aries: generateAriesConstellation,
  taurus: generateTaurusConstellation,
  gemini: generateGeminiConstellation,
  cancer: generateCancerConstellation,
  leo: generateLeoConstellation,
  virgo: generateVirgoConstellation,
  libra: generateLibraConstellation,
  scorpio: generateScorpioConstellation,
  sagittarius: generateSagittariusConstellation,
  capricorn: generateCapricornConstellation,
  aquarius: generateAquariusConstellation,
  pisces: generatePiscesConstellation,
} as const
