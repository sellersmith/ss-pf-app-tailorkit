/**
 * Pattern System Types
 * Types for scatter patterns and distributed effects
 */

import type { PathCommand } from '../../svg'

/**
 * Result of a pattern element
 */
export interface PatternElement {
  id: string
  name: string
  commands: PathCommand[]
  fill: string
  stroke: string
  strokeWidth: number
  zIndex: number
  // Transform properties for each element
  x: number
  y: number
  rotation: number
  scale: number
}

/**
 * Pattern configuration options
 */
export interface PatternConfig {
  seed?: number // Random seed for reproducibility
  count?: number // Number of scattered instances (default: 10)
  density?: number // Distribution density 0-1 (default: 0.5)
  rotation?: { min: number; max: number } // Rotation range in degrees
  scale?: { min: number; max: number } // Scale variation (default: 0.5-1.5)
  colors?: readonly string[] | string[] // Color palette for variation
  distribution?: 'random' | 'grid' | 'radial' | 'spiral' // Distribution type
}

/**
 * Pattern generator function type
 */
export type PatternGenerator = (
  cx: number,
  cy: number,
  width: number,
  height: number,
  config?: PatternConfig
) => PatternElement[]

/**
 * Default pattern configuration
 */
export const DEFAULT_PATTERN_CONFIG: Required<PatternConfig> = {
  seed: 12345,
  count: 10,
  density: 0.5,
  rotation: { min: 0, max: 360 },
  scale: { min: 0.5, max: 1.5 },
  colors: [],
  distribution: 'random',
}

/**
 * Pattern color presets for common patterns
 */
export const PATTERN_COLORS = {
  petals: {
    pink: ['#FFCDD2', '#F8BBD9', '#F48FB1', '#F06292', '#EC407A'],
    red: ['#FFCDD2', '#EF9A9A', '#E57373', '#EF5350', '#F44336'],
    purple: ['#E1BEE7', '#CE93D8', '#BA68C8', '#AB47BC', '#9C27B0'],
    white: ['#FFFFFF', '#FAFAFA', '#F5F5F5', '#EEEEEE', '#E0E0E0'],
  },
  leaves: {
    green: ['#C8E6C9', '#A5D6A7', '#81C784', '#66BB6A', '#4CAF50'],
    autumn: ['#FFCC80', '#FFB74D', '#FFA726', '#FF9800', '#F57C00'],
    mixed: ['#8BC34A', '#FFC107', '#FF9800', '#F44336', '#795548'],
  },
  confetti: {
    rainbow: ['#F44336', '#FF9800', '#FFEB3B', '#4CAF50', '#2196F3', '#9C27B0'],
    pastel: ['#FFCDD2', '#FFE0B2', '#FFF9C4', '#C8E6C9', '#BBDEFB', '#E1BEE7'],
    monochrome: ['#FFFFFF', '#E0E0E0', '#BDBDBD', '#9E9E9E', '#757575'],
  },
  fireworks: {
    gold: ['#FFF59D', '#FFEE58', '#FFEB3B', '#FDD835', '#FBC02D'],
    silver: ['#FFFFFF', '#F5F5F5', '#E0E0E0', '#BDBDBD', '#9E9E9E'],
    colorful: ['#F44336', '#E91E63', '#9C27B0', '#2196F3', '#00BCD4', '#4CAF50', '#FFEB3B', '#FF9800'],
  },
} as const
