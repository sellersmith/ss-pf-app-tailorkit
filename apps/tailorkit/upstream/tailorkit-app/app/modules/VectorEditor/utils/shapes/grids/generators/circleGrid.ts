/**
 * Circle Grid Generator
 * Generates composite shapes with circle tiles
 */

import type { CompositePathResult, UnifiedGridResult } from '../../compositeTypes'
import type { GridConfiguration } from '../types'
import type { PathCommand } from '../../../svg/pathParsing'
import { parseGridConfiguration } from '../gridLayout'
import { generateCircle } from '../../shapeGenerators'

/** Default colors for circle tiles */
const CIRCLE_FILL = '#90CAF9'
const CIRCLE_STROKE = '#42A5F5'
const CIRCLE_STROKE_WIDTH = 1

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
 * Generate a grid of circle tiles with equal horizontal and vertical gaps
 * Uses square cells to ensure circles have equal spacing in both directions
 * @param gap - Optional gap between tiles (defaults to 24px for canvas, use 1px for icons)
 */
export function generateCircleGrid(
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

  // Use square tiles based on the smaller dimension for equal visual gaps
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
        id: `circle-${row}-${col}`,
        name: `Circle ${row + 1}-${col + 1}`,
        commands: generateCircle(tileCx, tileCy, tileSize, tileSize),
        fill: CIRCLE_FILL,
        stroke: CIRCLE_STROKE,
        strokeWidth: CIRCLE_STROKE_WIDTH,
        zIndex: row * cols + col,
      })
    }
  }

  return results
}

/**
 * Generate a unified grid of circle tiles as a single path with multiple subpaths
 * Each tile is a subpath (starts with M command)
 * Gap is automatically scaled based on viewbox size for proper icon rendering
 */
export function generateCircleGridUnified(
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

  // Use square tiles based on the smaller dimension for equal visual gaps
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
      const tileCommands = generateCircle(tileCx, tileCy, tileSize, tileSize)
      allCommands.push(...tileCommands)
    }
  }

  return {
    commands: allCommands,
    fill: CIRCLE_FILL,
    stroke: CIRCLE_STROKE,
    strokeWidth: CIRCLE_STROKE_WIDTH,
  }
}

// Create canvas generators (24px gap) for each configuration
export const generateCircleGrid2x2 = (cx: number, cy: number, w: number, h: number) =>
  generateCircleGrid(cx, cy, w, h, '2x2')
export const generateCircleGrid2x3 = (cx: number, cy: number, w: number, h: number) =>
  generateCircleGrid(cx, cy, w, h, '2x3')
export const generateCircleGrid3x3 = (cx: number, cy: number, w: number, h: number) =>
  generateCircleGrid(cx, cy, w, h, '3x3')
export const generateCircleGrid3x4 = (cx: number, cy: number, w: number, h: number) =>
  generateCircleGrid(cx, cy, w, h, '3x4')
export const generateCircleGrid4x4 = (cx: number, cy: number, w: number, h: number) =>
  generateCircleGrid(cx, cy, w, h, '4x4')

// Create icon generators (1px gap) for each configuration
export const generateCircleGridIcon2x2 = (cx: number, cy: number, w: number, h: number) =>
  generateCircleGrid(cx, cy, w, h, '2x2', ICON_GAP)
export const generateCircleGridIcon2x3 = (cx: number, cy: number, w: number, h: number) =>
  generateCircleGrid(cx, cy, w, h, '2x3', ICON_GAP)
export const generateCircleGridIcon3x3 = (cx: number, cy: number, w: number, h: number) =>
  generateCircleGrid(cx, cy, w, h, '3x3', ICON_GAP)
export const generateCircleGridIcon3x4 = (cx: number, cy: number, w: number, h: number) =>
  generateCircleGrid(cx, cy, w, h, '3x4', ICON_GAP)
export const generateCircleGridIcon4x4 = (cx: number, cy: number, w: number, h: number) =>
  generateCircleGrid(cx, cy, w, h, '4x4', ICON_GAP)

// Create unified canvas generators (24px gap) - single path with multiple subpaths
export const generateCircleGridUnified2x2 = (cx: number, cy: number, w: number, h: number) =>
  generateCircleGridUnified(cx, cy, w, h, '2x2')
export const generateCircleGridUnified2x3 = (cx: number, cy: number, w: number, h: number) =>
  generateCircleGridUnified(cx, cy, w, h, '2x3')
export const generateCircleGridUnified3x3 = (cx: number, cy: number, w: number, h: number) =>
  generateCircleGridUnified(cx, cy, w, h, '3x3')
export const generateCircleGridUnified3x4 = (cx: number, cy: number, w: number, h: number) =>
  generateCircleGridUnified(cx, cy, w, h, '3x4')
export const generateCircleGridUnified4x4 = (cx: number, cy: number, w: number, h: number) =>
  generateCircleGridUnified(cx, cy, w, h, '4x4')
