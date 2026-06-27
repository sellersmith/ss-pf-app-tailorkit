/**
 * Shared geometry type definitions
 *
 * Core types for geometric primitives used across modules including:
 * - MockupWizard (mask generation)
 * - TemplateEditor (canvas operations)
 * - VectorEditor (SVG operations)
 */

import type { PathCommand } from '~/modules/VectorEditor/utils/svg'

/**
 * A point in 2D space
 */
export interface Point {
  x: number
  y: number
}

/**
 * A rectangular bounding box
 */
export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Base shape interface with optional rotation
 */
export interface BaseShape extends BoundingBox {
  /** Rotation angle in degrees (0-360), default 0 */
  rotation?: number
}

/**
 * Rectangular shape type
 */
export interface RectangularShape extends BaseShape {
  type: 'rectangle'
}

/**
 * Ellipse shape type
 */
export interface EllipseShape extends BaseShape {
  type: 'ellipse'
}

/**
 * Vector/freeform path shape type
 */
export interface VectorShape extends BaseShape {
  type: 'vector'
  /** Closed path commands defining the shape boundary */
  pathCommands: PathCommand[]
  /** Pre-computed SVG path d-string (cached for Path2D rendering) */
  pathD?: string
}

/**
 * Union type for all shape types
 */
export type Shape = RectangularShape | EllipseShape | VectorShape

/**
 * Detected transparent area in an image
 */
export interface TransparentArea {
  /** Bounding box of the transparent area */
  boundingBox: BoundingBox
  /** Total area in pixels */
  area: number
  /** Center point of the transparent area */
  centroid: Point
  /** Rotation angle in degrees (0-360), inherited from source shape */
  rotation?: number
  /** Original shape dimensions (unrotated) - used for proper template sizing when rotated */
  sourceShapeDimensions?: {
    width: number
    height: number
  }
  /** Largest inscribed rectangle for vector path shapes.
   *  When present, template sizing/placement uses this instead of boundingBox. */
  inscribedRect?: {
    x: number
    y: number
    width: number
    height: number
    rotation: number
    centerX: number
    centerY: number
  }
}

/**
 * Result of validation operations
 */
export interface ValidationResult {
  isValid: boolean
  error?: string
}
