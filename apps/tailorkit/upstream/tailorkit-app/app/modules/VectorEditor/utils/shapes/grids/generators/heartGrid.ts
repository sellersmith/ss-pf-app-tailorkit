/**
 * Heart Grid Generator
 * Generates composite shapes with heart tiles
 *
 * Heart shape bounds (from generateHeart with tileSize x tileSize):
 * - Left edge: cx - tileSize/2
 * - Right edge: cx + tileSize/2
 * - Bottom tip: cy + tileSize/2
 * - Top lobes: cy - tileSize/2 * 0.3 = cy - tileSize * 0.15 (based on topOffset = hh * 0.3)
 *
 * So hearts fill their full horizontal width but only ~65% of vertical height
 * Visual height = (cy + tileSize/2) - (cy - tileSize * 0.15) = tileSize * 0.65
 */

import type { CompositePathResult, UnifiedGridResult } from '../../compositeTypes'
import type { GridConfiguration } from '../types'
import type { PathCommand } from '../../../svg/pathParsing'
import { parseGridConfiguration } from '../gridLayout'
import { generateHeart } from '../../shapeGenerators'

/** Default colors for heart tiles */
const HEART_FILL = '#FFCDD2'
const HEART_STROKE = '#EF5350'
const HEART_STROKE_WIDTH = 1

/** Default visual gap between adjacent hearts (edge to edge) */
const DEFAULT_GAP = 24

/** Small gap for icon generation */
const ICON_GAP = 1

/** Heart visual height as fraction of tileSize (bottom tip to top lobes) */
const HEART_VISUAL_HEIGHT_FACTOR = 0.65

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
 * Generate a grid of heart tiles with visual gaps
 * Uses square bounding boxes for hearts, positioned to achieve visual gaps
 * @param gap - Optional gap between tiles (defaults to 24px for canvas, use 1px for icons)
 */
export function generateHeartGrid(
  cx: number,
  cy: number,
  width: number,
  height: number,
  configuration: GridConfiguration,
  gap: number = DEFAULT_GAP
): CompositePathResult[] {
  const { rows, cols } = parseGridConfiguration(configuration)

  // Hearts fill full horizontal width, so horizontal gap is straightforward
  // cols * tileSize + (cols - 1) * gap = width
  const tileFromWidth = (width - (cols - 1) * gap) / cols

  // For vertical: hearts only use ~65% of their bounding box height
  // rows * (tileSize * 0.65) + (rows - 1) * gap = height
  const tileFromHeight = (height - (rows - 1) * gap) / (rows * HEART_VISUAL_HEIGHT_FACTOR)

  // Use the smaller to fit in both dimensions
  const tileSize = Math.min(tileFromWidth, tileFromHeight)
  const hh = tileSize / 2

  // Actual visual dimensions
  const heartVisualHeight = tileSize * HEART_VISUAL_HEIGHT_FACTOR
  const actualGridWidth = cols * tileSize + (cols - 1) * gap
  const actualGridHeight = rows * heartVisualHeight + (rows - 1) * gap

  // Center the grid in the available space
  const gridStartX = cx - actualGridWidth / 2
  const gridStartY = cy - actualGridHeight / 2

  // Heart positioning:
  // - Horizontal: heart center = gridStartX + col * (tileSize + gap) + tileSize/2
  // - Vertical: heart's visual top should be at gridStartY + row * (heartVisualHeight + gap)
  //   Heart visual top = heartCy - hh * 0.3, so heartCy = visualTop + hh * 0.3

  const results: CompositePathResult[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Horizontal: center of heart's bounding box
      const heartCx = gridStartX + col * (tileSize + gap) + hh

      // Vertical: position so visual tops align with grid rows
      const visualTop = gridStartY + row * (heartVisualHeight + gap)
      const heartCy = visualTop + hh * 0.3 // Adjust for heart's visual top offset

      results.push({
        id: `heart-${row}-${col}`,
        name: `Heart ${row + 1}-${col + 1}`,
        commands: generateHeart(heartCx, heartCy, tileSize, tileSize),
        fill: HEART_FILL,
        stroke: HEART_STROKE,
        strokeWidth: HEART_STROKE_WIDTH,
        zIndex: row * cols + col,
      })
    }
  }

  return results
}

/**
 * Generate a unified grid of heart tiles as a single path with multiple subpaths
 * Each tile is a subpath (starts with M command)
 * Gap is automatically scaled based on viewbox size for proper icon rendering
 */
export function generateHeartGridUnified(
  cx: number,
  cy: number,
  width: number,
  height: number,
  configuration: GridConfiguration
): UnifiedGridResult {
  // Use proportional gap for proper scaling at any size
  const gap = calculateProportionalGap(width, height)
  const { rows, cols } = parseGridConfiguration(configuration)

  // Hearts fill full horizontal width, so horizontal gap is straightforward
  const tileFromWidth = (width - (cols - 1) * gap) / cols

  // For vertical: hearts only use ~65% of their bounding box height
  const tileFromHeight = (height - (rows - 1) * gap) / (rows * HEART_VISUAL_HEIGHT_FACTOR)

  // Use the smaller to fit in both dimensions
  const tileSize = Math.min(tileFromWidth, tileFromHeight)
  const hh = tileSize / 2

  // Actual visual dimensions
  const heartVisualHeight = tileSize * HEART_VISUAL_HEIGHT_FACTOR
  const actualGridWidth = cols * tileSize + (cols - 1) * gap
  const actualGridHeight = rows * heartVisualHeight + (rows - 1) * gap

  // Center the grid in the available space
  const gridStartX = cx - actualGridWidth / 2
  const gridStartY = cy - actualGridHeight / 2

  // Combine all tile commands into a single path with multiple subpaths
  const allCommands: PathCommand[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Horizontal: center of heart's bounding box
      const heartCx = gridStartX + col * (tileSize + gap) + hh

      // Vertical: position so visual tops align with grid rows
      const visualTop = gridStartY + row * (heartVisualHeight + gap)
      const heartCy = visualTop + hh * 0.3 // Adjust for heart's visual top offset

      // Each tile's commands form a subpath (starts with M, ends with Z)
      const tileCommands = generateHeart(heartCx, heartCy, tileSize, tileSize)
      allCommands.push(...tileCommands)
    }
  }

  return {
    commands: allCommands,
    fill: HEART_FILL,
    stroke: HEART_STROKE,
    strokeWidth: HEART_STROKE_WIDTH,
  }
}

// Create canvas generators (24px gap) for each configuration
export const generateHeartGrid2x2 = (cx: number, cy: number, w: number, h: number) =>
  generateHeartGrid(cx, cy, w, h, '2x2')
export const generateHeartGrid2x3 = (cx: number, cy: number, w: number, h: number) =>
  generateHeartGrid(cx, cy, w, h, '2x3')
export const generateHeartGrid3x3 = (cx: number, cy: number, w: number, h: number) =>
  generateHeartGrid(cx, cy, w, h, '3x3')
export const generateHeartGrid3x4 = (cx: number, cy: number, w: number, h: number) =>
  generateHeartGrid(cx, cy, w, h, '3x4')
export const generateHeartGrid4x4 = (cx: number, cy: number, w: number, h: number) =>
  generateHeartGrid(cx, cy, w, h, '4x4')

// Create icon generators (1px gap) for each configuration
export const generateHeartGridIcon2x2 = (cx: number, cy: number, w: number, h: number) =>
  generateHeartGrid(cx, cy, w, h, '2x2', ICON_GAP)
export const generateHeartGridIcon2x3 = (cx: number, cy: number, w: number, h: number) =>
  generateHeartGrid(cx, cy, w, h, '2x3', ICON_GAP)
export const generateHeartGridIcon3x3 = (cx: number, cy: number, w: number, h: number) =>
  generateHeartGrid(cx, cy, w, h, '3x3', ICON_GAP)
export const generateHeartGridIcon3x4 = (cx: number, cy: number, w: number, h: number) =>
  generateHeartGrid(cx, cy, w, h, '3x4', ICON_GAP)
export const generateHeartGridIcon4x4 = (cx: number, cy: number, w: number, h: number) =>
  generateHeartGrid(cx, cy, w, h, '4x4', ICON_GAP)

// Create unified canvas generators (24px gap) - single path with multiple subpaths
export const generateHeartGridUnified2x2 = (cx: number, cy: number, w: number, h: number) =>
  generateHeartGridUnified(cx, cy, w, h, '2x2')
export const generateHeartGridUnified2x3 = (cx: number, cy: number, w: number, h: number) =>
  generateHeartGridUnified(cx, cy, w, h, '2x3')
export const generateHeartGridUnified3x3 = (cx: number, cy: number, w: number, h: number) =>
  generateHeartGridUnified(cx, cy, w, h, '3x3')
export const generateHeartGridUnified3x4 = (cx: number, cy: number, w: number, h: number) =>
  generateHeartGridUnified(cx, cy, w, h, '3x4')
export const generateHeartGridUnified4x4 = (cx: number, cy: number, w: number, h: number) =>
  generateHeartGridUnified(cx, cy, w, h, '4x4')
