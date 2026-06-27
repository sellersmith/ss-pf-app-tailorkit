/**
 * SVG Envelope Boundary Utilities
 *
 * Provides utilities for working with closed SVG paths for envelope distortion.
 */

import { parseSvgPath, serializePathCommands } from './svg-path-utils'

/**
 * Auto-close an SVG path if it's not already closed
 */
export function autoClosePath(pathData: string): string {
  const commands = parseSvgPath(pathData)

  if (commands.length === 0) return pathData

  // Check if path already has a Z command
  const hasZ = commands.some(cmd => cmd.type.toUpperCase() === 'Z')

  if (!hasZ) {
    // Find the first M command to get the start point
    const firstM = commands.find(cmd => cmd.type.toUpperCase() === 'M')
    if (firstM) {
      commands.push({ type: 'Z', x: firstM.x, y: firstM.y })
    }
  }

  return serializePathCommands(commands)
}

/**
 * Check if a path is closed (has Z command or endpoints meet)
 */
export function isPathClosed(pathData: string): boolean {
  const commands = parseSvgPath(pathData)

  if (commands.length === 0) return false

  // Check for explicit Z command
  const hasZ = commands.some(cmd => cmd.type.toUpperCase() === 'Z')
  if (hasZ) return true

  // Check if first and last points are the same
  const firstCmd = commands.find(cmd => cmd.type.toUpperCase() === 'M')
  const lastCmd = commands.filter(cmd => cmd.type.toUpperCase() !== 'Z').pop()

  if (firstCmd && lastCmd) {
    const tolerance = 0.5
    return Math.abs(firstCmd.x - lastCmd.x) < tolerance && Math.abs(firstCmd.y - lastCmd.y) < tolerance
  }

  return false
}

/**
 * Default parameter values for all shapes
 */
export const DEFAULT_FILL_SHAPE_VALUES = {
  verticalOffset: 0,
  verticalScale: 1.0,
  horizontalOffset: 0,
  horizontalScale: 1.0,
  characterSpacing: 0,
} as const

/**
 * Detect if a path contains curved lines (bezier curves)
 *
 * This is a general detector for any shape that contains:
 * - Cubic bezier curves (C commands)
 * - Quadratic bezier curves (Q commands)
 * - Smooth curves (S, T commands)
 *
 * Shapes with curves need special height sampling because the bucket-based
 * lookup can have gaps or discontinuities along curved boundaries.
 *
 * Note: This excludes elliptical shapes (which use arc commands A) as they
 * are handled separately with their own optimized algorithm.
 */
export function isCurvedShape(pathData: string): boolean {
  const commands = parseSvgPath(pathData)

  if (commands.length === 0) return false

  // Check for bezier curve commands
  const curveCommands = commands.filter(cmd => {
    const type = cmd.type.toUpperCase()
    return type === 'C' || type === 'Q' || type === 'S' || type === 'T'
  })

  // Shape has curves if it contains at least one curve command
  return curveCommands.length > 0 && isPathClosed(pathData)
}

/**
 * Detect if a path represents an elliptical shape (circles and ellipses)
 *
 * Detection criteria:
 * 1. Path contains arc commands (A)
 * 2. Arcs have reasonable aspect ratio (up to 3.0)
 * 3. Path is closed
 * 4. Only has M, A, and Z commands (typical ellipse/circle pattern)
 *
 * This function detects both circles (rx ≈ ry) and ellipses (rx ≠ ry).
 * Ellipses with aspect ratio > 3.0 are rejected as too elongated.
 */
export function isEllipticalShape(pathData: string): boolean {
  const commands = parseSvgPath(pathData)

  if (commands.length === 0) return false

  // Get all arc commands
  const arcCommands = commands.filter(cmd => cmd.type.toUpperCase() === 'A')

  // Ellipse/circle paths typically have 2 arc commands forming a full shape
  if (arcCommands.length < 1 || arcCommands.length > 4) return false

  // Check if path only contains M, A, Z commands (typical ellipse/circle pattern)
  const validCommands = ['M', 'A', 'Z']
  const hasOnlyEllipticalCommands = commands.every(cmd => validCommands.includes(cmd.type.toUpperCase()))

  if (!hasOnlyEllipticalCommands) return false

  // Check arc aspect ratios
  // We accept circles (rx ≈ ry) and ellipses with reasonable aspect ratio (up to 3.0)
  for (const arc of arcCommands) {
    const rx = arc.rx || 0
    const ry = arc.ry || 0

    // Skip invalid arcs
    if (rx < 1 || ry < 1) continue

    // Reject very elongated ellipses (aspect ratio > 3.0)
    const aspectRatio = Math.max(rx, ry) / Math.min(rx, ry)
    if (aspectRatio > 3.0) return false
  }

  // Ensure path is closed
  return isPathClosed(pathData)
}
