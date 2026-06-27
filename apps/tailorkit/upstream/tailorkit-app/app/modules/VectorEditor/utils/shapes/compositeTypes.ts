/**
 * Composite Shape Types
 * Shared type definitions for multi-path shape generation
 */

import type { PathCommand } from '../svg/pathParsing'

/**
 * Result of generating a single part of a composite shape
 */
export interface CompositePathResult {
  /** Unique identifier for this part (e.g., 'head', 'left-eye', 'body') */
  id: string
  /** Display name for the part (shown in layer list) */
  name: string
  /** Path commands for this part */
  commands: PathCommand[]
  /** Default fill color */
  fill?: string
  /** Default stroke color */
  stroke?: string
  /** Default stroke width */
  strokeWidth?: number
  /** Layer order (higher = on top, lower = behind) */
  zIndex?: number
}

/**
 * Generator function type for composite shapes
 * Returns multiple paths that together form a complete figure
 */
export type CompositeShapeGenerator = (cx: number, cy: number, width: number, height: number) => CompositePathResult[]

/**
 * Result of generating a unified grid shape
 * Contains a single path with multiple subpaths (each tile is a subpath)
 */
export interface UnifiedGridResult {
  /** Combined path commands from all tiles (each tile starts with M command) */
  commands: PathCommand[]
  /** Default fill color for the entire grid */
  fill: string
  /** Default stroke color for the entire grid */
  stroke: string
  /** Default stroke width for the entire grid */
  strokeWidth: number
}

/**
 * Generator function type for unified grid shapes
 * Returns a single path containing all tiles as subpaths
 */
export type UnifiedGridGenerator = (cx: number, cy: number, width: number, height: number) => UnifiedGridResult
