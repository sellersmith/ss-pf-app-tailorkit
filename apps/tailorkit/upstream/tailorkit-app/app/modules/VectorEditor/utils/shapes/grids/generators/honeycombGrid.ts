/**
 * Honeycomb Grid Generator
 * Generates composite shapes with hexagon tiles in an interlocking pattern
 */

import type { CompositePathResult, UnifiedGridResult } from '../../compositeTypes'
import type { GridConfiguration } from '../types'
import type { PathCommand } from '../../../svg/pathParsing'
import { calculateHoneycombLayout, parseGridConfiguration } from '../gridLayout'
import { generateHexagon } from '../../shapeGenerators'

/** Default colors for honeycomb tiles */
const HONEYCOMB_FILL = '#FFD54F'
const HONEYCOMB_STROKE = '#FFA000'
const HONEYCOMB_STROKE_WIDTH = 1

/** Default visual gap between adjacent hexagons */
const DEFAULT_GAP = 24

/** Small gap for icon generation */
const ICON_GAP = 1

/** Reference size for gap scaling - gap is calculated as percentage of this */
const REFERENCE_SIZE = 300

/** Gap percentage relative to reference size (24/300 = 8%) */
const GAP_PERCENTAGE = DEFAULT_GAP / REFERENCE_SIZE

/**
 * Calculate proportional gap based on viewbox size
 * Ensures gap scales appropriately for icons vs canvas
 */
function calculateProportionalGap(width: number, height: number): number {
  const minDimension = Math.min(width, height)
  return Math.max(0.5, minDimension * GAP_PERCENTAGE)
}

/**
 * Generate a grid of hexagon tiles in honeycomb pattern
 * @param gap - Optional gap between tiles (defaults to 24px for canvas, use 1px for icons)
 */
export function generateHoneycombGrid(
  cx: number,
  cy: number,
  width: number,
  height: number,
  configuration: GridConfiguration,
  gap: number = DEFAULT_GAP
): CompositePathResult[] {
  const { rows, cols } = parseGridConfiguration(configuration)

  const layout = calculateHoneycombLayout({
    rows,
    cols,
    width,
    height,
    gap,
  })

  // Offset to center the grid at (cx, cy)
  const offsetX = cx - width / 2
  const offsetY = cy - layout.totalHeight / 2

  return layout.tiles.map((tile, index) => {
    const tileCx = offsetX + tile.cx
    const tileCy = offsetY + tile.cy

    // Use the smaller dimension to ensure hexagons fit
    const size = Math.min(tile.width, tile.height)

    return {
      id: `honeycomb-${tile.row}-${tile.col}`,
      name: `Hex ${tile.row + 1}-${tile.col + 1}`,
      commands: generateHexagon(tileCx, tileCy, size, size),
      fill: HONEYCOMB_FILL,
      stroke: HONEYCOMB_STROKE,
      strokeWidth: HONEYCOMB_STROKE_WIDTH,
      zIndex: index,
    }
  })
}

/**
 * Generate a unified grid of hexagon tiles as a single path with multiple subpaths
 * Each tile is a subpath (starts with M command)
 * Gap is automatically scaled based on viewbox size for proper icon rendering
 */
export function generateHoneycombGridUnified(
  cx: number,
  cy: number,
  width: number,
  height: number,
  configuration: GridConfiguration
): UnifiedGridResult {
  // Use proportional gap for proper scaling at any size
  const gap = calculateProportionalGap(width, height)
  const { rows, cols } = parseGridConfiguration(configuration)

  const layout = calculateHoneycombLayout({
    rows,
    cols,
    width,
    height,
    gap,
  })

  // Offset to center the grid at (cx, cy)
  const offsetX = cx - width / 2
  const offsetY = cy - layout.totalHeight / 2

  // Combine all tile commands into a single path with multiple subpaths
  const allCommands: PathCommand[] = []

  for (const tile of layout.tiles) {
    const tileCx = offsetX + tile.cx
    const tileCy = offsetY + tile.cy

    // Use the smaller dimension to ensure hexagons fit
    const size = Math.min(tile.width, tile.height)

    // Each tile's commands form a subpath (starts with M, ends with Z)
    const tileCommands = generateHexagon(tileCx, tileCy, size, size)
    allCommands.push(...tileCommands)
  }

  return {
    commands: allCommands,
    fill: HONEYCOMB_FILL,
    stroke: HONEYCOMB_STROKE,
    strokeWidth: HONEYCOMB_STROKE_WIDTH,
  }
}

// Create canvas generators (24px gap) for each configuration
export const generateHoneycombGrid2x2 = (cx: number, cy: number, w: number, h: number) =>
  generateHoneycombGrid(cx, cy, w, h, '2x2')
export const generateHoneycombGrid2x3 = (cx: number, cy: number, w: number, h: number) =>
  generateHoneycombGrid(cx, cy, w, h, '2x3')
export const generateHoneycombGrid3x3 = (cx: number, cy: number, w: number, h: number) =>
  generateHoneycombGrid(cx, cy, w, h, '3x3')
export const generateHoneycombGrid3x4 = (cx: number, cy: number, w: number, h: number) =>
  generateHoneycombGrid(cx, cy, w, h, '3x4')
export const generateHoneycombGrid4x4 = (cx: number, cy: number, w: number, h: number) =>
  generateHoneycombGrid(cx, cy, w, h, '4x4')

// Create icon generators (1px gap) for each configuration
export const generateHoneycombGridIcon2x2 = (cx: number, cy: number, w: number, h: number) =>
  generateHoneycombGrid(cx, cy, w, h, '2x2', ICON_GAP)
export const generateHoneycombGridIcon2x3 = (cx: number, cy: number, w: number, h: number) =>
  generateHoneycombGrid(cx, cy, w, h, '2x3', ICON_GAP)
export const generateHoneycombGridIcon3x3 = (cx: number, cy: number, w: number, h: number) =>
  generateHoneycombGrid(cx, cy, w, h, '3x3', ICON_GAP)
export const generateHoneycombGridIcon3x4 = (cx: number, cy: number, w: number, h: number) =>
  generateHoneycombGrid(cx, cy, w, h, '3x4', ICON_GAP)
export const generateHoneycombGridIcon4x4 = (cx: number, cy: number, w: number, h: number) =>
  generateHoneycombGrid(cx, cy, w, h, '4x4', ICON_GAP)

// Create unified canvas generators (24px gap) - single path with multiple subpaths
export const generateHoneycombGridUnified2x2 = (cx: number, cy: number, w: number, h: number) =>
  generateHoneycombGridUnified(cx, cy, w, h, '2x2')
export const generateHoneycombGridUnified2x3 = (cx: number, cy: number, w: number, h: number) =>
  generateHoneycombGridUnified(cx, cy, w, h, '2x3')
export const generateHoneycombGridUnified3x3 = (cx: number, cy: number, w: number, h: number) =>
  generateHoneycombGridUnified(cx, cy, w, h, '3x3')
export const generateHoneycombGridUnified3x4 = (cx: number, cy: number, w: number, h: number) =>
  generateHoneycombGridUnified(cx, cy, w, h, '3x4')
export const generateHoneycombGridUnified4x4 = (cx: number, cy: number, w: number, h: number) =>
  generateHoneycombGridUnified(cx, cy, w, h, '4x4')
