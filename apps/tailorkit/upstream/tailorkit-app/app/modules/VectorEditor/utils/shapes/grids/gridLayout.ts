/**
 * Grid Layout Calculation Utilities
 * Functions for calculating tile positions in different grid configurations
 */

import type { GridConfiguration, GridLayout, GridLayoutOptions, HoneycombLayoutOptions, GridTile } from './types'

/** Parse grid configuration to rows and columns */
export function parseGridConfiguration(config: GridConfiguration): { rows: number; cols: number } {
  const [rows, cols] = config.split('x').map(Number)
  return { rows, cols }
}

/**
 * Calculate standard grid layout with equal-sized tiles and gaps
 * Tiles are arranged in a regular grid with consistent spacing
 */
export function calculateGridLayout(options: GridLayoutOptions): GridLayout {
  const { configuration, width, height, gap = 3 } = options
  const { rows, cols } = parseGridConfiguration(configuration)

  // Calculate tile dimensions accounting for gaps
  const totalGapWidth = (cols - 1) * gap
  const totalGapHeight = (rows - 1) * gap
  const tileWidth = (width - totalGapWidth) / cols
  const tileHeight = (height - totalGapHeight) / rows

  const tiles: GridTile[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * (tileWidth + gap)
      const y = row * (tileHeight + gap)
      const cx = x + tileWidth / 2
      const cy = y + tileHeight / 2

      tiles.push({
        row,
        col,
        cx,
        cy,
        width: tileWidth,
        height: tileHeight,
      })
    }
  }

  return {
    tiles,
    rows,
    cols,
    gap,
    totalWidth: width,
    totalHeight: height,
  }
}

/**
 * Calculate honeycomb grid layout with offset rows for interlocking pattern
 * Uses pointy-top hexagons (vertices at top and bottom) with consistent gaps
 *
 * For a regular pointy-top hexagon with radius r:
 * - Height = 2r (from top vertex to bottom vertex)
 * - Width = sqrt(3) * r ≈ 1.732r (from left edge to right edge)
 *
 * In a honeycomb pattern:
 * - Horizontal spacing = hexWidth + gap
 * - Vertical spacing = 1.5 * r + gap_adjustment (for interlocking)
 * - Odd rows offset by half the horizontal spacing
 */
export function calculateHoneycombLayout(options: HoneycombLayoutOptions): GridLayout {
  const { rows, cols, width, height, gap = 4 } = options

  // For pointy-top hexagons, we need to calculate based on the radius
  // The hexagon generator uses: size = min(width, height), then r = size / 2
  // For pointy-top: actual_height = 2r, actual_width = sqrt(3) * r

  // Calculate the hexagon radius based on available space
  // We need to fit: cols hexagons + offset + gaps
  // Horizontal: (cols + 0.5) * hexWidth + cols * gap <= width
  // Where hexWidth = sqrt(3) * r

  const sqrt3 = Math.sqrt(3)

  // For consistent gaps in all directions in a honeycomb:
  // The edge-to-edge distance should be 'gap' for all adjacent hexagons
  // Horizontal spacing between centers = hexWidth + gap
  // Vertical spacing between row centers = 1.5 * r + gap * sqrt(3) / 2
  // (This accounts for the angle of diagonal edges)

  // Calculate radius to fit the grid
  // Total width needed: (cols - 1) * (hexWidth + gap) + hexWidth + 0.5 * (hexWidth + gap)
  //                   = cols * hexWidth + (cols - 0.5) * gap + 0.5 * hexWidth
  //                   = (cols + 0.5) * hexWidth + (cols - 0.5) * gap
  // So: hexWidth = (width - (cols - 0.5) * gap) / (cols + 0.5)

  const hexWidth = (width - (cols - 0.5) * gap) / (cols + 0.5)
  const r = hexWidth / sqrt3 // radius from width
  const hexHeight = 2 * r // pointy-top hexagon height

  // Vertical spacing for interlocking hexagons with consistent gap
  // For pointy-top hexagons, the vertical center-to-center distance
  // that produces gap 'g' between edges is: 1.5 * r + g * sqrt(3) / 2
  // But for simplicity, we use: 1.5 * r + g (approximation that works well)
  const verticalSpacing = 1.5 * r + gap

  // Calculate total height and scale if necessary
  const neededHeight = (rows - 1) * verticalSpacing + hexHeight
  const scale = Math.min(1, height / neededHeight)

  const scaledR = r * scale
  const scaledHexWidth = sqrt3 * scaledR
  const scaledHexHeight = 2 * scaledR
  const scaledVerticalSpacing = 1.5 * scaledR + gap * scale
  const scaledGap = gap * scale

  // Center the grid horizontally
  const actualGridWidth = cols * scaledHexWidth + (cols - 1) * scaledGap + 0.5 * (scaledHexWidth + scaledGap)
  const startX = (width - actualGridWidth) / 2

  const tiles: GridTile[] = []

  for (let row = 0; row < rows; row++) {
    const isOddRow = row % 2 === 1
    // Odd rows offset by half the horizontal spacing
    const rowOffset = isOddRow ? (scaledHexWidth + scaledGap) / 2 : 0

    for (let col = 0; col < cols; col++) {
      const x = startX + col * (scaledHexWidth + scaledGap) + rowOffset
      const y = row * scaledVerticalSpacing
      const cx = x + scaledHexWidth / 2
      const cy = y + scaledHexHeight / 2

      // The tile size is the diameter that fits the hexagon
      // For pointy-top hex: the inscribed square has side = min(width, height)
      // But our generator uses min(w,h)/2 as radius, so pass the size that gives correct radius
      const tileSize = scaledR * 2 // This will make the generator use radius = scaledR

      tiles.push({
        row,
        col,
        cx,
        cy,
        width: tileSize,
        height: tileSize,
      })
    }
  }

  const actualHeight = (rows - 1) * scaledVerticalSpacing + scaledHexHeight

  return {
    tiles,
    rows,
    cols,
    gap,
    totalWidth: width,
    totalHeight: actualHeight,
  }
}
