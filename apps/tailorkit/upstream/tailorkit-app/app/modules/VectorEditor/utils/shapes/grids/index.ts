/**
 * Grid Shapes Module
 * Exports all grid types, utilities, and generators
 */

// Types
export type {
  GridConfiguration,
  TileType,
  GridTile,
  GridLayout,
  GridLayoutOptions,
  HoneycombLayoutOptions,
} from './types'

// Layout utilities
export { calculateGridLayout, calculateHoneycombLayout, parseGridConfiguration } from './gridLayout'

// Generators
export * from './generators'
