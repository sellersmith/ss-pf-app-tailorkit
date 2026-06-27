/**
 * Shape handle type definitions
 *
 * Types for shape manipulation handles used in canvas-based editors.
 */

/**
 * Handle position type (corner and edge handles)
 */
export type HandleType = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'

/**
 * Individual handle position with its type
 */
export interface HandlePosition {
  x: number
  y: number
  type: HandleType
}

/**
 * All handle positions for a shape
 */
export interface HandlePositions {
  nw: HandlePosition
  ne: HandlePosition
  sw: HandlePosition
  se: HandlePosition
  n: HandlePosition
  s: HandlePosition
  e: HandlePosition
  w: HandlePosition
}

/**
 * Options for handle calculations
 */
export interface HandleOptions {
  /** Zoom scale factor */
  scale?: number
  /** Whether device is mobile (uses larger handles) */
  isMobile?: boolean
  /** Override handle size in pixels */
  handleSize?: number
  /** Override hover handle size in pixels */
  hoverSize?: number
  /** Multiplier for detection area */
  detectionMultiplier?: number
}

/**
 * State for shape manipulation interactions
 */
export interface ShapeManipulationState {
  selectedShapeIndex: number | null
  manipulationMode: 'none' | 'move' | 'resize'
  manipulationHandle: HandleType | null
  dragStartPos: { x: number; y: number } | null
  originalShape: {
    x: number
    y: number
    width: number
    height: number
    type?: 'rectangle' | 'ellipse'
  } | null
}
