/**
 * Path geometry utilities for node insertion and path drawing
 */

import type { PathCommand, ParsedPath, Point } from './pathParsing'
import type { ConnectedSegment } from '../../types'

// Re-export Point from pathParsing for convenience
export type { Point } from './pathParsing'

/**
 * Calculate distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate point on line segment at parameter t (0-1)
 * t=0 returns start point, t=1 returns end point
 */
export function getPointOnLine(start: Point, end: Point, t: number): Point {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  }
}

/**
 * Calculate the closest point on a line segment to a given point
 * Returns the point and the parameter t (0-1) along the segment
 */
export function closestPointOnLineSegment(
  point: Point,
  lineStart: Point,
  lineEnd: Point
): { point: Point; t: number; distance: number } {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  const lengthSquared = dx * dx + dy * dy

  // If line segment is actually a point
  if (lengthSquared === 0) {
    return {
      point: lineStart,
      t: 0,
      distance: distance(point, lineStart),
    }
  }

  // Calculate parameter t (clamped to 0-1 to stay on segment)
  let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared
  t = Math.max(0, Math.min(1, t))

  // Calculate the closest point
  const closestPoint = getPointOnLine(lineStart, lineEnd, t)
  const dist = distance(point, closestPoint)

  return { point: closestPoint, t, distance: dist }
}

/**
 * Check if a point is near a line segment
 */
export function isPointNearLineSegment(
  point: Point,
  lineStart: Point,
  lineEnd: Point,
  tolerance: number = 10
): boolean {
  const { distance: dist } = closestPointOnLineSegment(point, lineStart, lineEnd)
  return dist <= tolerance
}

/**
 * Calculate point on quadratic bezier curve at parameter t (0-1)
 * Formula: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
 */
export function getPointOnQuadraticBezier(p0: Point, p1: Point, p2: Point, t: number): Point {
  const oneMinusT = 1 - t
  const oneMinusTSquared = oneMinusT * oneMinusT
  const tSquared = t * t

  return {
    x: oneMinusTSquared * p0.x + 2 * oneMinusT * t * p1.x + tSquared * p2.x,
    y: oneMinusTSquared * p0.y + 2 * oneMinusT * t * p1.y + tSquared * p2.y,
  }
}

/**
 * Calculate point on cubic bezier curve at parameter t (0-1)
 * Formula: B(t) = (1-t)^3 * P0 + 3(1-t)^2*t * P1 + 3(1-t)*t^2 * P2 + t^3 * P3
 */
export function getPointOnCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const oneMinusT = 1 - t
  const oneMinusTCubed = oneMinusT * oneMinusT * oneMinusT
  const oneMinusTSquared = oneMinusT * oneMinusT
  const tSquared = t * t
  const tCubed = t * t * t

  return {
    x: oneMinusTCubed * p0.x + 3 * oneMinusTSquared * t * p1.x + 3 * oneMinusT * tSquared * p2.x + tCubed * p3.x,
    y: oneMinusTCubed * p0.y + 3 * oneMinusTSquared * t * p1.y + 3 * oneMinusT * tSquared * p2.y + tCubed * p3.y,
  }
}

/**
 * Find closest point on a bezier curve by sampling
 * Samples the curve at multiple points and finds the minimum distance
 */
function closestPointOnBezierCurve(
  point: Point,
  start: Point,
  end: Point,
  cp1?: Point,
  cp2?: Point,
  samples: number = 20
): { point: Point; t: number; distance: number } {
  let minDistance = Infinity
  let bestT = 0
  let bestPoint = start

  // Sample the curve
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    let samplePoint: Point

    if (cp2) {
      // Cubic bezier
      samplePoint = getPointOnCubicBezier(start, cp1!, cp2, end, t)
    } else if (cp1) {
      // Quadratic bezier
      samplePoint = getPointOnQuadraticBezier(start, cp1, end, t)
    } else {
      // Line
      samplePoint = getPointOnLine(start, end, t)
    }

    const dist = distance(point, samplePoint)
    if (dist < minDistance) {
      minDistance = dist
      bestT = t
      bestPoint = samplePoint
    }
  }

  return { point: bestPoint, t: bestT, distance: minDistance }
}

/**
 * Check if a point is near a path segment (line or bezier curve)
 */
export function isPointNearSegment(
  point: Point,
  prevCmd: PathCommand,
  cmd: PathCommand,
  tolerance: number = 10
): boolean {
  const start = { x: prevCmd.x, y: prevCmd.y }
  const end = { x: cmd.x, y: cmd.y }

  let minDistance: number

  if (cmd.type === 'C' || cmd.type === 'c') {
    // Cubic bezier
    const result = closestPointOnBezierCurve(point, start, end, cmd.cp1, cmd.cp2)
    minDistance = result.distance
  } else if (cmd.type === 'Q' || cmd.type === 'q') {
    // Quadratic bezier
    const result = closestPointOnBezierCurve(point, start, end, cmd.cp)
    minDistance = result.distance
  } else if (cmd.type === 'L' || cmd.type === 'l' || cmd.type === 'M' || cmd.type === 'm') {
    // Line or move
    const result = closestPointOnLineSegment(point, start, end)
    minDistance = result.distance
  } else {
    // For other command types (A, H, V, etc.), treat as line for simplicity
    const result = closestPointOnLineSegment(point, start, end)
    minDistance = result.distance
  }

  return minDistance <= tolerance
}

/**
 * Find which segment in a path contains a point
 * Returns segment index and the exact position on that segment
 */
export function findSegmentAtPoint(
  point: Point,
  path: ParsedPath,
  tolerance: number = 10
): { segmentIndex: number; position: Point; t: number } | null {
  const commands = path.commands

  for (let i = 1; i < commands.length; i++) {
    const prevCmd = commands[i - 1]
    const cmd = commands[i]

    // Skip Z (close path) commands
    if (cmd.type === 'Z' || cmd.type === 'z') {
      continue
    }

    const start = { x: prevCmd.x, y: prevCmd.y }
    const end = { x: cmd.x, y: cmd.y }

    let result: { point: Point; t: number; distance: number }

    if (cmd.type === 'C' || cmd.type === 'c') {
      // Cubic bezier
      result = closestPointOnBezierCurve(point, start, end, cmd.cp1, cmd.cp2)
    } else if (cmd.type === 'Q' || cmd.type === 'q') {
      // Quadratic bezier
      result = closestPointOnBezierCurve(point, start, end, cmd.cp)
    } else {
      // Line or other types
      result = closestPointOnLineSegment(point, start, end)
    }

    if (result.distance <= tolerance) {
      return {
        segmentIndex: i,
        position: result.point,
        t: result.t,
      }
    }
  }

  return null
}

/**
 * Insert a node into a path at a specific segment index
 * Splits the segment into two segments at the given position
 */
export function insertNodeIntoPath(path: ParsedPath, segmentIndex: number, position: Point, t: number): ParsedPath {
  const commands = [...path.commands]
  const prevCmd = commands[segmentIndex - 1]
  const cmd = commands[segmentIndex]

  // Create new node at the insertion point
  const newNode: PathCommand = {
    type: 'L',
    x: position.x,
    y: position.y,
  }

  // For bezier curves, we need to split the curve properly
  if (cmd.type === 'C' || cmd.type === 'c') {
    // Split cubic bezier using De Casteljau's algorithm
    const p0 = { x: prevCmd.x, y: prevCmd.y }
    const p1 = cmd.cp1!
    const p2 = cmd.cp2!
    const p3 = { x: cmd.x, y: cmd.y }

    // Calculate intermediate points
    const p01 = getPointOnLine(p0, p1, t)
    const p12 = getPointOnLine(p1, p2, t)
    const p23 = getPointOnLine(p2, p3, t)
    const p012 = getPointOnLine(p01, p12, t)
    const p123 = getPointOnLine(p12, p23, t)
    const p0123 = getPointOnLine(p012, p123, t)

    // First half of the curve
    const firstHalf: PathCommand = {
      type: 'C',
      x: p0123.x,
      y: p0123.y,
      cp1: p01,
      cp2: p012,
    }

    // Second half of the curve
    const secondHalf: PathCommand = {
      type: 'C',
      x: p3.x,
      y: p3.y,
      cp1: p123,
      cp2: p23,
    }

    // Replace the original command with the two new segments
    commands.splice(segmentIndex, 1, firstHalf, secondHalf)
  } else if (cmd.type === 'Q' || cmd.type === 'q') {
    // Split quadratic bezier
    const p0 = { x: prevCmd.x, y: prevCmd.y }
    const p1 = cmd.cp!
    const p2 = { x: cmd.x, y: cmd.y }

    const p01 = getPointOnLine(p0, p1, t)
    const p12 = getPointOnLine(p1, p2, t)
    const p012 = getPointOnLine(p01, p12, t)

    const firstHalf: PathCommand = {
      type: 'Q',
      x: p012.x,
      y: p012.y,
      cp: p01,
    }

    const secondHalf: PathCommand = {
      type: 'Q',
      x: p2.x,
      y: p2.y,
      cp: p12,
    }

    commands.splice(segmentIndex, 1, firstHalf, secondHalf)
  } else {
    // For lines, just insert a new L command
    commands.splice(segmentIndex, 0, newNode)
  }

  return {
    ...path,
    commands,
  }
}

/**
 * Close a path by adding a Z command if not already closed
 */
export function closePath(commands: PathCommand[]): PathCommand[] {
  if (commands.length === 0) {
    return commands
  }

  const lastCmd = commands[commands.length - 1]
  if (lastCmd.type === 'Z' || lastCmd.type === 'z') {
    return commands // Already closed
  }

  return [
    ...commands,
    {
      type: 'Z',
      x: commands[0].x,
      y: commands[0].y,
    },
  ]
}

// =============================================================================
// Connected Segment Detection (for subpath highlighting)
// =============================================================================

/**
 * Find the closest node to a point within a path
 * Returns node index or null if no node is within maxDistance
 */
export function findClosestNodeInPath(point: Point, path: ParsedPath, maxDistance: number = Infinity): number | null {
  let closestIndex: number | null = null
  let minDist = maxDistance

  for (let i = 0; i < path.commands.length; i++) {
    const cmd = path.commands[i]
    if (!cmd || cmd.type.toUpperCase() === 'Z') continue

    const dist = distance(point, { x: cmd.x, y: cmd.y })
    if (dist < minDist) {
      minDist = dist
      closestIndex = i
    }
  }

  return closestIndex
}

/**
 * Find the connected segment containing a given node index
 * Traces in both directions from the node until hitting M, Z, or path boundaries
 * Returns a ConnectedSegment with all connected node indices
 */
export function findConnectedSegment(commands: PathCommand[], nodeIndex: number): ConnectedSegment {
  // Validate inputs - return empty segment if invalid
  if (!commands || commands.length === 0 || nodeIndex < 0 || nodeIndex >= commands.length) {
    return {
      startIndex: 0,
      endIndex: 0,
      nodeIndices: [],
      isClosed: false,
    }
  }

  const nodeIndices: number[] = []
  let startIndex = nodeIndex
  let endIndex = nodeIndex
  let isClosed = false

  // Trace backward from nodeIndex
  for (let i = nodeIndex; i >= 0; i--) {
    const cmd = commands[i]
    if (!cmd) break
    const type = cmd.type.toUpperCase()

    if (type === 'Z') {
      // Hit a close command going backward - stop before it
      break
    }

    if (type === 'M') {
      // Include the M command as the start
      startIndex = i
      nodeIndices.unshift(i)
      break
    }

    startIndex = i
    nodeIndices.unshift(i)
  }

  // Trace forward from nodeIndex + 1
  for (let i = nodeIndex + 1; i < commands.length; i++) {
    const cmd = commands[i]
    if (!cmd) break
    const type = cmd.type.toUpperCase()

    if (type === 'M') {
      // Hit a new move command - stop before it
      break
    }

    if (type === 'Z') {
      // This segment is closed
      isClosed = true
      endIndex = i
      break
    }

    endIndex = i
    nodeIndices.push(i)
  }

  return {
    startIndex,
    endIndex,
    nodeIndices,
    isClosed,
  }
}

/**
 * Parse a path into all its constituent segments (both closed and unclosed)
 * Returns array of ConnectedSegment objects
 */
export function parseAllSegments(commands: PathCommand[]): ConnectedSegment[] {
  if (!commands || commands.length === 0) {
    return []
  }

  const segments: ConnectedSegment[] = []
  let currentStart = -1
  let currentNodes: number[] = []

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i]
    if (!cmd) continue
    const type = cmd.type.toUpperCase()

    if (type === 'M') {
      // Save previous segment if exists
      if (currentStart !== -1 && currentNodes.length > 0) {
        segments.push({
          startIndex: currentStart,
          endIndex: i - 1,
          nodeIndices: currentNodes,
          isClosed: false,
        })
      }
      currentStart = i
      currentNodes = [i]
    } else if (type === 'Z') {
      // Close current segment
      if (currentStart !== -1) {
        segments.push({
          startIndex: currentStart,
          endIndex: i,
          nodeIndices: currentNodes,
          isClosed: true,
        })
        currentStart = -1
        currentNodes = []
      }
    } else {
      currentNodes.push(i)
    }
  }

  // Handle trailing unclosed segment
  if (currentStart !== -1 && currentNodes.length > 0) {
    segments.push({
      startIndex: currentStart,
      endIndex: commands.length - 1,
      nodeIndices: currentNodes,
      isClosed: false,
    })
  }

  return segments
}

/**
 * Build a path d string for a specific segment (for hit testing and rendering)
 * Extracts only the commands belonging to the segment
 */
export function buildSegmentPathD(commands: PathCommand[], segment: ConnectedSegment): string {
  if (!commands || commands.length === 0) {
    return ''
  }

  const segmentCommands: string[] = []

  for (let i = segment.startIndex; i <= segment.endIndex; i++) {
    const cmd = commands[i]
    if (!cmd) continue
    const type = cmd.type.toUpperCase()

    if (type === 'M') {
      segmentCommands.push(`M ${cmd.x} ${cmd.y}`)
    } else if (type === 'L') {
      segmentCommands.push(`L ${cmd.x} ${cmd.y}`)
    } else if (type === 'C') {
      segmentCommands.push(`C ${cmd.cp1!.x} ${cmd.cp1!.y} ${cmd.cp2!.x} ${cmd.cp2!.y} ${cmd.x} ${cmd.y}`)
    } else if (type === 'Q') {
      segmentCommands.push(`Q ${cmd.cp!.x} ${cmd.cp!.y} ${cmd.x} ${cmd.y}`)
    } else if (type === 'Z') {
      segmentCommands.push('Z')
    } else if (type === 'H') {
      segmentCommands.push(`L ${cmd.x} ${commands[i - 1]?.y ?? 0}`)
    } else if (type === 'V') {
      segmentCommands.push(`L ${commands[i - 1]?.x ?? 0} ${cmd.y}`)
    } else if (type === 'A') {
      segmentCommands.push(
        `A ${cmd.rx} ${cmd.ry} ${cmd.rotation} ${cmd.largeArc ? 1 : 0} ${cmd.sweep ? 1 : 0} ${cmd.x} ${cmd.y}`
      )
    } else {
      // Fallback for other types - treat as line
      segmentCommands.push(`L ${cmd.x} ${cmd.y}`)
    }
  }

  return segmentCommands.join(' ')
}
