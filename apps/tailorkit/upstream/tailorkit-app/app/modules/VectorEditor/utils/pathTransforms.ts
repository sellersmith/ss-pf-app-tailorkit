/**
 * Path Transform Utilities
 * Functions to apply geometric transformations to path commands
 */

import type { PathCommand, Point } from './svg/pathParsing'

/**
 * Rotate a point around a center by a given angle in degrees
 */
export function rotatePoint(x: number, y: number, center: Point, angleDeg: number): Point {
  const angleRad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  const dx = x - center.x
  const dy = y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

/**
 * Apply rotation transform directly to path commands (bake rotation into coordinates)
 * After calling this, pathRotation should be cleared since rotation is now in the coordinates
 */
export function bakeRotationIntoCommands(commands: PathCommand[], angleDeg: number, center: Point): PathCommand[] {
  // No rotation needed
  if (angleDeg === 0) return commands

  return commands.map(cmd => {
    const newCmd = { ...cmd }
    const cmdType = cmd.type.toUpperCase()

    // Convert H and V commands to L commands since they can't represent
    // non-horizontal/vertical lines after rotation
    if (cmdType === 'H' || cmdType === 'V') {
      newCmd.type = cmd.type === cmd.type.toUpperCase() ? 'L' : 'l'
    }

    // Rotate main point (skip Z commands which have no coordinates)
    if (cmdType !== 'Z' && cmd.x !== undefined && cmd.y !== undefined) {
      const rotated = rotatePoint(cmd.x, cmd.y, center, angleDeg)
      newCmd.x = rotated.x
      newCmd.y = rotated.y
    }

    // Rotate control point 1 (for cubic bezier)
    if (cmd.cp1) {
      newCmd.cp1 = rotatePoint(cmd.cp1.x, cmd.cp1.y, center, angleDeg)
    }

    // Rotate control point 2 (for cubic bezier)
    if (cmd.cp2) {
      newCmd.cp2 = rotatePoint(cmd.cp2.x, cmd.cp2.y, center, angleDeg)
    }

    // Rotate single control point (for quadratic bezier)
    if (cmd.cp) {
      newCmd.cp = rotatePoint(cmd.cp.x, cmd.cp.y, center, angleDeg)
    }

    // Handle arc commands (A, a) - update the x-axis rotation parameter
    if (cmdType === 'A' && cmd.rotation !== undefined) {
      // Add the path rotation to the arc's x-axis rotation
      // Normalize to 0-360 range
      newCmd.rotation = (((cmd.rotation + angleDeg) % 360) + 360) % 360
    }

    return newCmd
  })
}

/**
 * Scale path commands around a center point
 * Used for resize functionality with 8-point handles
 */
export function scalePathCommands(
  commands: PathCommand[],
  scaleX: number,
  scaleY: number,
  center: Point
): PathCommand[] {
  // Check if this is non-uniform scaling (different X and Y scales)
  const isNonUniform = Math.abs(scaleX - scaleY) > 0.0001

  return commands.map(cmd => {
    const newCmd = { ...cmd }
    const cmdType = cmd.type.toUpperCase()

    // Convert H commands to L when non-uniform scaling would make them non-horizontal
    // Convert V commands to L when non-uniform scaling would make them non-vertical
    // (H stays H if scaleY doesn't change Y relative to center, similar for V)
    if (isNonUniform && (cmdType === 'H' || cmdType === 'V')) {
      newCmd.type = cmd.type === cmd.type.toUpperCase() ? 'L' : 'l'
    }

    // Scale main point relative to center (skip Z commands which have no coordinates)
    if (cmdType !== 'Z' && cmd.x !== undefined && cmd.y !== undefined) {
      newCmd.x = center.x + (cmd.x - center.x) * scaleX
      newCmd.y = center.y + (cmd.y - center.y) * scaleY
    }

    // Scale control point 1 (for cubic bezier)
    if (cmd.cp1) {
      newCmd.cp1 = {
        x: center.x + (cmd.cp1.x - center.x) * scaleX,
        y: center.y + (cmd.cp1.y - center.y) * scaleY,
      }
    }

    // Scale control point 2 (for cubic bezier)
    if (cmd.cp2) {
      newCmd.cp2 = {
        x: center.x + (cmd.cp2.x - center.x) * scaleX,
        y: center.y + (cmd.cp2.y - center.y) * scaleY,
      }
    }

    // Scale single control point (for quadratic bezier)
    if (cmd.cp) {
      newCmd.cp = {
        x: center.x + (cmd.cp.x - center.x) * scaleX,
        y: center.y + (cmd.cp.y - center.y) * scaleY,
      }
    }

    // Scale arc radii
    if (cmdType === 'A') {
      if (cmd.rx !== undefined) {
        newCmd.rx = cmd.rx * Math.abs(scaleX)
      }
      if (cmd.ry !== undefined) {
        newCmd.ry = cmd.ry * Math.abs(scaleY)
      }
      // If non-uniform scaling and arc has rotation, we'd need to adjust the rotation
      // but for simplicity we skip that as it's complex and rarely needed
    }

    return newCmd
  })
}
