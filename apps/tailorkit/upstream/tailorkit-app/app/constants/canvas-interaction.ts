/**
 * Canvas Interaction Constants
 *
 * Shared constants for canvas-based editors including shape manipulation,
 * handle sizing, and touch interaction parameters.
 */

/**
 * Constants for canvas interaction behavior
 */
export const CANVAS_INTERACTION = {
  /**
   * Size of resize handles in pixels (at 1x zoom)
   */
  HANDLE_SIZE: 12,

  /**
   * Size of resize handles when hovered (at 1x zoom)
   */
  HANDLE_HOVER_SIZE: 14,

  /**
   * Threshold in pixels for edge detection (at 1x zoom)
   * Used to determine if a point is near a shape's edge
   */
  EDGE_THRESHOLD: 5,

  /**
   * Minimum size for shapes (width/height) in pixels
   */
  MIN_SHAPE_SIZE: 20,

  /**
   * Detection multiplier for handle hit areas
   * Increases the clickable area around handles for easier interaction
   */
  HANDLE_DETECTION_MULTIPLIER: 2.0,

  /**
   * Size of delete button in pixels
   */
  DELETE_BUTTON_SIZE: 20,

  /**
   * Offset of delete button from shape corner
   */
  DELETE_BUTTON_OFFSET: 25,

  /**
   * Mobile-specific constants for better touch interaction
   */
  MOBILE_HANDLE_SIZE: 20,
  MOBILE_HANDLE_HOVER_SIZE: 24,
  MOBILE_HANDLE_DETECTION_MULTIPLIER: 3.0,
  MOBILE_EDGE_THRESHOLD: 15,
} as const

/**
 * Canvas drawing style constants
 */
export const CANVAS_DRAW_STYLES = {
  /**
   * Colors for shape selections
   */
  SELECTION: {
    STROKE: '#4444ff',
    FILL: 'rgba(68, 68, 255, 0.2)',
    LINE_WIDTH: 2,
  },

  /**
   * Colors for detected shapes
   */
  DETECTED: {
    STROKE: '#ff6600',
    STROKE_HOVERED: '#0066ff',
    FILL: 'rgba(255, 102, 0, 0.15)',
    FILL_HOVERED: 'rgba(0, 102, 255, 0.2)',
    LINE_WIDTH: 2,
    LINE_WIDTH_HOVERED: 3,
    OPACITY: 0.7,
    OPACITY_HOVERED: 0.9,
  },

  /**
   * Colors for current drawing
   */
  CURRENT_DRAWING: {
    STROKE: '#0088ff',
    FILL: 'rgba(0, 136, 255, 0.1)',
    LINE_WIDTH: 2,
    LINE_DASH: [5, 5],
  },

  /**
   * Colors for handles
   */
  HANDLE: {
    FILL: '#ffffff',
    STROKE: '#0066ff',
    LINE_WIDTH: 2,
    SHADOW_COLOR: 'rgba(0, 0, 0, 0.3)',
    SHADOW_BLUR: 2,
  },
} as const

export type CanvasInteractionConstants = typeof CANVAS_INTERACTION
export type CanvasDrawStyles = typeof CANVAS_DRAW_STYLES
