/**
 * Grid Shapes Type Definitions
 * Types for grid layout configurations and tile generation
 */

/** Grid configuration sizes (rows x columns) */
export type GridConfiguration = '2x2' | '2x3' | '3x3' | '3x4' | '4x4'

/** Tile types for grid cells */
export type TileType = 'square' | 'circle' | 'heart' | 'honeycomb'

/** Individual grid tile with position and dimensions */
export interface GridTile {
  /** Row index (0-based) */
  row: number
  /** Column index (0-based) */
  col: number
  /** Center X coordinate */
  cx: number
  /** Center Y coordinate */
  cy: number
  /** Tile width */
  width: number
  /** Tile height */
  height: number
}

/** Grid layout result containing all tile positions */
export interface GridLayout {
  /** Array of tiles with their positions */
  tiles: GridTile[]
  /** Number of rows */
  rows: number
  /** Number of columns */
  cols: number
  /** Gap between tiles in pixels */
  gap: number
  /** Total grid width */
  totalWidth: number
  /** Total grid height */
  totalHeight: number
}

/** Options for grid layout calculation */
export interface GridLayoutOptions {
  /** Grid configuration (e.g., '2x2', '3x3') */
  configuration: GridConfiguration
  /** Target bounding box width */
  width: number
  /** Target bounding box height */
  height: number
  /** Gap between tiles in pixels (default: 3) */
  gap?: number
}

/** Options for honeycomb grid layout */
export interface HoneycombLayoutOptions extends Omit<GridLayoutOptions, 'configuration'> {
  /** Number of rows */
  rows: number
  /** Number of columns */
  cols: number
  /** Gap between hexagons (default: 2) */
  gap?: number
}
