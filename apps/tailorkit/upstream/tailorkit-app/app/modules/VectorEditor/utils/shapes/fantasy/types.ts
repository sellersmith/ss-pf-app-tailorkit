/**
 * Fantasy Shapes Types
 * Type definitions and color presets for fantasy-themed shapes
 */

import type { PathCommand } from '../../svg'
import type { CompositePathResult } from '../compositeTypes'

/**
 * Internal path result type - doesn't require id/name
 * These will be added by the wrapper function
 */
export interface FantasyPathPart {
  commands: PathCommand[]
  fill?: string
  stroke?: string
  strokeWidth?: number
  zIndex?: number
  /** Optional opacity (0-1) - will be ignored when converting to CompositePathResult */
  opacity?: number
  /** Optional id - will be auto-generated if not provided */
  id?: string
  /** Optional name - will be auto-generated if not provided */
  name?: string
}

/**
 * Wraps a fantasy shape generator to ensure all parts have id and name
 * Note: opacity is stripped as CompositePathResult doesn't support it
 */
export function wrapFantasyGenerator(
  generator: (cx: number, cy: number, width: number, height: number) => FantasyPathPart[],
  baseName: string
): FantasyShapeGenerator {
  return (cx, cy, width, height) => {
    const parts = generator(cx, cy, width, height)
    return parts.map((part, index) => {
      // Destructure to exclude opacity which isn't in CompositePathResult
      const { opacity, ...rest } = part
      return {
        ...rest,
        id: part.id || `${baseName}-part-${index}`,
        name: part.name || `${baseName} Part ${index + 1}`,
      }
    })
  }
}

// Generator function type for fantasy shapes
export type FantasyShapeGenerator = (cx: number, cy: number, width: number, height: number) => CompositePathResult[]

// =============================================================================
// Color Presets for Fantasy Shapes
// =============================================================================

// Wing colors
export const WING_COLORS = {
  // Angel wings (white/cream tones)
  primary: '#FFFFFF',
  secondary: '#F5F5DC', // Beige
  featherOutline: '#E8E8E8',
  featherHighlight: '#FFFAFA',
  // Accent colors for feather tips
  accent: {
    gold: '#FFD700',
    silver: '#C0C0C0',
    rose: '#FFB6C1',
    sky: '#87CEEB',
  },
} as const

// Halo colors
export const HALO_COLORS = {
  primary: '#FFD700', // Gold
  glow: '#FFF8DC', // Cornsilk (soft glow)
  outline: '#DAA520', // Goldenrod
  // Alternative halo colors
  silver: '#C0C0C0',
  divine: '#FFFACD', // Lemon chiffon
  holy: '#F0E68C', // Khaki
} as const

// Zodiac sign colors
export const ZODIAC_SIGN_COLORS = {
  fire: {
    primary: '#FF4500', // Orange-red
    secondary: '#FF6347', // Tomato
    accent: '#FFD700', // Gold
  },
  earth: {
    primary: '#8B4513', // Saddle brown
    secondary: '#D2691E', // Chocolate
    accent: '#228B22', // Forest green
  },
  air: {
    primary: '#87CEEB', // Sky blue
    secondary: '#ADD8E6', // Light blue
    accent: '#E0FFFF', // Light cyan
  },
  water: {
    primary: '#4169E1', // Royal blue
    secondary: '#6495ED', // Cornflower blue
    accent: '#00CED1', // Dark turquoise
  },
} as const

// Zodiac animal colors
export const ZODIAC_ANIMAL_COLORS = {
  outline: '#4A4A4A',
  body: {
    light: '#FFECD2', // Skin/fur base (light)
    medium: '#DEB887', // Burlywood
    dark: '#8B4513', // Saddle brown
  },
  accents: {
    red: '#DC143C', // Crimson
    gold: '#FFD700',
    black: '#2F2F2F',
    white: '#F5F5F5',
  },
  // Additional colors for facial features
  eye: '#2F2F2F',
  eyeHighlight: '#FFFFFF',
  nose: '#FF69B4', // Pink nose
} as const

// Constellation colors
export const CONSTELLATION_COLORS = {
  star: '#FFFFFF',
  starGlow: '#FFFACD',
  line: '#87CEEB', // Light connecting line
  lineGlow: '#ADD8E6',
  majorStar: '#FFD700', // Gold for major stars
} as const

// Pet colors
export const PET_COLORS = {
  // Generic animal parts
  outline: '#4A4A4A',
  eye: '#2F2F2F',
  eyeHighlight: '#FFFFFF',
  nose: '#FF69B4', // Pink nose
  // Fur colors
  fur: {
    white: '#FFFFFF',
    cream: '#FFFDD0',
    tan: '#D2B48C',
    brown: '#8B4513',
    black: '#2F2F2F',
    gray: '#808080',
    orange: '#FF8C00',
    ginger: '#B86B4B',
  },
  // Bird colors
  feathers: {
    yellow: '#FFD700',
    blue: '#4169E1',
    green: '#32CD32',
    red: '#DC143C',
  },
  // Fish colors
  scales: {
    gold: '#FFD700',
    orange: '#FF8C00',
    silver: '#C0C0C0',
    blue: '#4682B4',
  },
} as const

// =============================================================================
// Zodiac Sign Mappings
// =============================================================================

export const WESTERN_ZODIAC_SIGNS = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
] as const

export type WesternZodiacSign = (typeof WESTERN_ZODIAC_SIGNS)[number]

// Element mapping for zodiac signs
export const ZODIAC_SIGN_ELEMENTS: Record<WesternZodiacSign, keyof typeof ZODIAC_SIGN_COLORS> = {
  aries: 'fire',
  taurus: 'earth',
  gemini: 'air',
  cancer: 'water',
  leo: 'fire',
  virgo: 'earth',
  libra: 'air',
  scorpio: 'water',
  sagittarius: 'fire',
  capricorn: 'earth',
  aquarius: 'air',
  pisces: 'water',
}

export const CHINESE_ZODIAC_ANIMALS = [
  'rat',
  'ox',
  'tiger',
  'rabbit',
  'dragon',
  'snake',
  'horse',
  'goat',
  'monkey',
  'rooster',
  'dog',
  'pig',
] as const

export type ChineseZodiacAnimal = (typeof CHINESE_ZODIAC_ANIMALS)[number]

// Common pets
export const COMMON_PETS = ['dog', 'cat', 'rabbit', 'hamster', 'bird', 'fish', 'turtle'] as const

export type CommonPet = (typeof COMMON_PETS)[number]
