/**
 * Vector path geometry utilities for MockupWizard
 *
 * Provides functions for converting vector path commands to polygons,
 * point-in-polygon testing, bounding box computation, and coordinate transforms.
 * Reuses bezier evaluation from VectorEditor's pathGeometry utilities.
 */

import type { PathCommand, Point } from '~/modules/VectorEditor/utils/svg'
import {
  getPointOnQuadraticBezier,
  getPointOnCubicBezier,
  serializePathCommands,
} from '~/modules/VectorEditor/utils/svg'
import type { BoundingBox } from '~/types/geometry'

/**
 * Convert PathCommand[] to an array of polygon points by linearizing curves.
 * Straight segments (M, L, H, V) are added directly.
 * Bezier curves (Q, C) are sampled at regular intervals.
 * Z commands close back to the last M point.
 */
export function pathCommandsToPolygon(commands: PathCommand[], samplesPerCurve = 20): Point[] {
  const points: Point[] = []
  let currentX = 0
  let currentY = 0
  let moveX = 0
  let moveY = 0

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'M':
        moveX = cmd.x
        moveY = cmd.y
        currentX = cmd.x
        currentY = cmd.y
        points.push({ x: cmd.x, y: cmd.y })
        break

      case 'L':
      case 'H':
      case 'V':
        currentX = cmd.x
        currentY = cmd.y
        points.push({ x: cmd.x, y: cmd.y })
        break

      case 'Q': {
        const start = { x: currentX, y: currentY }
        const cp = cmd.cp ?? { x: currentX, y: currentY }
        const end = { x: cmd.x, y: cmd.y }
        for (let i = 1; i <= samplesPerCurve; i++) {
          const t = i / samplesPerCurve
          points.push(getPointOnQuadraticBezier(start, cp, end, t))
        }
        currentX = cmd.x
        currentY = cmd.y
        break
      }

      case 'C': {
        const start = { x: currentX, y: currentY }
        const cp1 = cmd.cp1 ?? { x: currentX, y: currentY }
        const cp2 = cmd.cp2 ?? { x: cmd.x, y: cmd.y }
        const end = { x: cmd.x, y: cmd.y }
        for (let i = 1; i <= samplesPerCurve; i++) {
          const t = i / samplesPerCurve
          points.push(getPointOnCubicBezier(start, cp1, cp2, end, t))
        }
        currentX = cmd.x
        currentY = cmd.y
        break
      }

      case 'Z':
        // Close path back to the last M command
        currentX = moveX
        currentY = moveY
        break

      default:
        // For unsupported command types (A, S, T), add the endpoint
        currentX = cmd.x
        currentY = cmd.y
        points.push({ x: cmd.x, y: cmd.y })
        break
    }
  }

  return points
}

/**
 * Test if a point is inside a polygon using the ray-casting algorithm.
 * A ray cast rightward from the point counts boundary crossings.
 * An odd number of crossings means the point is inside.
 */
export function isPointInPolygon(px: number, py: number, polygon: Point[]): boolean {
  let inside = false
  const n = polygon.length

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y

    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi

    if (intersect) inside = !inside
  }

  return inside
}

/**
 * Compute the bounding box of a set of path commands.
 * Considers endpoint coordinates and control points for curves.
 */
export function computePathBoundingBox(commands: PathCommand[]): BoundingBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  function expand(x: number, y: number) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }

  for (const cmd of commands) {
    if (cmd.type === 'Z') continue
    expand(cmd.x, cmd.y)
    if (cmd.cp) expand(cmd.cp.x, cmd.cp.y)
    if (cmd.cp1) expand(cmd.cp1.x, cmd.cp1.y)
    if (cmd.cp2) expand(cmd.cp2.x, cmd.cp2.y)
  }

  // Fallback for empty or Z-only commands
  if (minX === Infinity) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * Thin wrapper around VectorEditor's serializePathCommands.
 * Converts PathCommand[] to SVG path d-attribute string.
 */
export function serializePathCommandsToD(commands: PathCommand[]): string {
  return serializePathCommands(commands)
}

/**
 * Translate all coordinates in path commands by a delta.
 */
export function translatePathCommands(commands: PathCommand[], dx: number, dy: number): PathCommand[] {
  return commands.map(cmd => {
    if (cmd.type === 'Z') {
      return { ...cmd, x: cmd.x + dx, y: cmd.y + dy }
    }
    return {
      ...cmd,
      x: cmd.x + dx,
      y: cmd.y + dy,
      ...(cmd.cp ? { cp: { x: cmd.cp.x + dx, y: cmd.cp.y + dy } } : {}),
      ...(cmd.cp1 ? { cp1: { x: cmd.cp1.x + dx, y: cmd.cp1.y + dy } } : {}),
      ...(cmd.cp2 ? { cp2: { x: cmd.cp2.x + dx, y: cmd.cp2.y + dy } } : {}),
    }
  })
}

/**
 * Scale all coordinates in path commands by a factor.
 */
export function scalePathCommands(commands: PathCommand[], scale: number): PathCommand[] {
  return commands.map(cmd => {
    if (cmd.type === 'Z') {
      return { ...cmd, x: Math.round(cmd.x * scale), y: Math.round(cmd.y * scale) }
    }
    return {
      ...cmd,
      x: Math.round(cmd.x * scale),
      y: Math.round(cmd.y * scale),
      ...(cmd.cp ? { cp: { x: Math.round(cmd.cp.x * scale), y: Math.round(cmd.cp.y * scale) } } : {}),
      ...(cmd.cp1 ? { cp1: { x: Math.round(cmd.cp1.x * scale), y: Math.round(cmd.cp1.y * scale) } } : {}),
      ...(cmd.cp2 ? { cp2: { x: Math.round(cmd.cp2.x * scale), y: Math.round(cmd.cp2.y * scale) } } : {}),
    }
  })
}
