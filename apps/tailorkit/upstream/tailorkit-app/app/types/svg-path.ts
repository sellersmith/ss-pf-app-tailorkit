/**
 * SVG Path Type Definitions
 *
 * Shared types for SVG path commands and parsed SVG structures.
 * Extracted from VectorEditor for reuse across modules.
 */

// Path command types
export type PathCommandType =
  | 'M'
  | 'L'
  | 'C'
  | 'Q'
  | 'Z'
  | 'A'
  | 'H'
  | 'V'
  | 'S'
  | 'T'
  | 'm'
  | 'l'
  | 'c'
  | 'q'
  | 'z'
  | 'a'
  | 'h'
  | 'v'
  | 's'
  | 't'

/**
 * SVG path command with coordinates and control points
 */
export interface PathCommand {
  type: PathCommandType
  x: number
  y: number
  // For cubic bezier (C, c, S, s)
  cp1?: { x: number; y: number }
  cp2?: { x: number; y: number }
  // For quadratic bezier (Q, q, T, t)
  cp?: { x: number; y: number }
  // For arc (A, a)
  rx?: number
  ry?: number
  rotation?: number
  largeArc?: boolean
  sweep?: boolean
}

/**
 * Connected segment within a path
 * Represents a continuous sequence of commands between M and Z (or end)
 */
export interface ConnectedSegment {
  startIndex: number
  endIndex: number
  nodeIndices: number[]
  isClosed: boolean
}

/**
 * SVG viewBox dimensions
 */
export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}
