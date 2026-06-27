/**
 * Square Grid Generator
 * Generates composite shapes with square tiles (all tiles have 4 equal edges)
 */

import type { CompositePathResult, UnifiedGridResult } from '../../compositeTypes'
import type { GridConfiguration } from '../types'
import type { PathCommand } from '../../../svg/pathParsing'
import { parseGridConfiguration } from '../gridLayout'
import { generateRectangle } from '../../shapeGenerators'

/** Default colors for square tiles */
const SQUARE_FILL = '#CCCCCC'
const SQUARE_STROKE = '#999999'
const SQUARE_STROKE_WIDTH = 1

/** Default visual gap between adjacent tiles */
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
 * Generate a grid of square tiles with equal horizontal and vertical gaps
 * Uses square cells to ensure all tiles have 4 equal edges
 * @param gap - Optional gap between tiles (defaults to 24px for canvas, use 1px for icons)
 */
export function generateSquareGrid(
  cx: number,
  cy: number,
  width: number,
  height: number,
  configuration: GridConfiguration,
  gap: number = DEFAULT_GAP
): CompositePathResult[] {
  const { rows, cols } = parseGridConfiguration(configuration)

  // Calculate tile dimensions for both directions
  const totalGapWidth = (cols - 1) * gap
  const totalGapHeight = (rows - 1) * gap
  const tileWidth = (width - totalGapWidth) / cols
  const tileHeight = (height - totalGapHeight) / rows

  // Use square tiles based on the smaller dimension for equal edges
  const tileSize = Math.min(tileWidth, tileHeight)

  // Calculate actual grid dimensions with square tiles
  const actualWidth = cols * tileSize + totalGapWidth
  const actualHeight = rows * tileSize + totalGapHeight

  // Center the square-tile grid within the available space
  const startX = (width - actualWidth) / 2
  const startY = (height - actualHeight) / 2

  // Offset to center the grid at (cx, cy)
  const offsetX = cx - width / 2 + startX
  const offsetY = cy - height / 2 + startY

  const results: CompositePathResult[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tileCx = offsetX + col * (tileSize + gap) + tileSize / 2
      const tileCy = offsetY + row * (tileSize + gap) + tileSize / 2

      results.push({
        id: `square-${row}-${col}`,
        name: `Tile ${row + 1}-${col + 1}`,
        commands: generateRectangle(tileCx, tileCy, tileSize, tileSize),
        fill: SQUARE_FILL,
        stroke: SQUARE_STROKE,
        strokeWidth: SQUARE_STROKE_WIDTH,
        zIndex: row * cols + col,
      })
    }
  }

  return results
}

/**
 * Generate a unified grid of square tiles as a single path with multiple subpaths
 * Each tile is a subpath (starts with M command)
 * Gap is automatically scaled based on viewbox size for proper icon rendering
 */
export function generateSquareGridUnified(
  cx: number,
  cy: number,
  width: number,
  height: number,
  configuration: GridConfiguration
): UnifiedGridResult {
  // Use proportional gap for proper scaling at any size
  const gap = calculateProportionalGap(width, height)
  const { rows, cols } = parseGridConfiguration(configuration)

  // Calculate tile dimensions for both directions
  const totalGapWidth = (cols - 1) * gap
  const totalGapHeight = (rows - 1) * gap
  const tileWidth = (width - totalGapWidth) / cols
  const tileHeight = (height - totalGapHeight) / rows

  // Use square tiles based on the smaller dimension for equal edges
  const tileSize = Math.min(tileWidth, tileHeight)

  // Calculate actual grid dimensions with square tiles
  const actualWidth = cols * tileSize + totalGapWidth
  const actualHeight = rows * tileSize + totalGapHeight

  // Center the square-tile grid within the available space
  const startX = (width - actualWidth) / 2
  const startY = (height - actualHeight) / 2

  // Offset to center the grid at (cx, cy)
  const offsetX = cx - width / 2 + startX
  const offsetY = cy - height / 2 + startY

  // Combine all tile commands into a single path with multiple subpaths
  const allCommands: PathCommand[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tileCx = offsetX + col * (tileSize + gap) + tileSize / 2
      const tileCy = offsetY + row * (tileSize + gap) + tileSize / 2

      // Each tile's commands form a subpath (starts with M, ends with Z)
      const tileCommands = generateRectangle(tileCx, tileCy, tileSize, tileSize)
      allCommands.push(...tileCommands)
    }
  }

  return {
    commands: allCommands,
    fill: SQUARE_FILL,
    stroke: SQUARE_STROKE,
    strokeWidth: SQUARE_STROKE_WIDTH,
  }
}

// Create canvas generators (24px gap) for each configuration
export const generateSquareGrid2x2 = (cx: number, cy: number, w: number, h: number) =>
  generateSquareGrid(cx, cy, w, h, '2x2')
export const generateSquareGrid2x3 = (cx: number, cy: number, w: number, h: number) =>
  generateSquareGrid(cx, cy, w, h, '2x3')
export const generateSquareGrid3x3 = (cx: number, cy: number, w: number, h: number) =>
  generateSquareGrid(cx, cy, w, h, '3x3')
export const generateSquareGrid3x4 = (cx: number, cy: number, w: number, h: number) =>
  generateSquareGrid(cx, cy, w, h, '3x4')
export const generateSquareGrid4x4 = (cx: number, cy: number, w: number, h: number) =>
  generateSquareGrid(cx, cy, w, h, '4x4')

// Create icon generators (1px gap) for each configuration
export const generateSquareGridIcon2x2 = (cx: number, cy: number, w: number, h: number) =>
  generateSquareGrid(cx, cy, w, h, '2x2', ICON_GAP)
export const generateSquareGridIcon2x3 = (cx: number, cy: number, w: number, h: number) =>
  generateSquareGrid(cx, cy, w, h, '2x3', ICON_GAP)
export const generateSquareGridIcon3x3 = (cx: number, cy: number, w: number, h: number) =>
  generateSquareGrid(cx, cy, w, h, '3x3', ICON_GAP)
export const generateSquareGridIcon3x4 = (cx: number, cy: number, w: number, h: number) =>
  generateSquareGrid(cx, cy, w, h, '3x4', ICON_GAP)
export const generateSquareGridIcon4x4 = (cx: number, cy: number, w: number, h: number) =>
  generateSquareGrid(cx, cy, w, h, '4x4', ICON_GAP)

// Create unified canvas generators (24px gap) - single path with multiple subpaths
export const generateSquareGridUnified2x2 = (cx: number, cy: number, w: number, h: number) =>
  generateSquareGridUnified(cx, cy, w, h, '2x2')
export const generateSquareGridUnified2x3 = (cx: number, cy: number, w: number, h: number) =>
  generateSquareGridUnified(cx, cy, w, h, '2x3')
export const generateSquareGridUnified3x3 = (cx: number, cy: number, w: number, h: number) =>
  generateSquareGridUnified(cx, cy, w, h, '3x3')
export const generateSquareGridUnified3x4 = (cx: number, cy: number, w: number, h: number) =>
  generateSquareGridUnified(cx, cy, w, h, '3x4')
export const generateSquareGridUnified4x4 = (cx: number, cy: number, w: number, h: number) =>
  generateSquareGridUnified(cx, cy, w, h, '4x4')
