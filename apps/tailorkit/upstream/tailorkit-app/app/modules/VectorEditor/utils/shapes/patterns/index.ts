/**
 * Pattern System - Main Entry Point
 * Exports all types, utilities, and pattern generators
 */

// Types
export type { PatternElement, PatternConfig, PatternGenerator } from './types'

export { DEFAULT_PATTERN_CONFIG, PATTERN_COLORS } from './types'

// Utilities
export { createSeededRandom, type SeededRandom } from './utils/random'

export {
  scatter,
  scatterRandom,
  scatterGrid,
  scatterRadial,
  scatterSpiral,
  transformPoint,
  type ScatterPoint,
} from './utils/scatter'

// Pattern generators
export * from './generators'
