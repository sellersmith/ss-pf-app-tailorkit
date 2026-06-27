/**
 * Stroke Types - Multiple strokes with independent properties
 *
 * Enhanced over Figma's stroke system: Each stroke has its own weight property,
 * allowing for TextStudio-style "wrapping" where outer strokes wrap inner ones.
 *
 * Used in:
 * - Text element stroke rendering
 * - SVG filter stroke primitives
 * - Stroke UI components
 *
 * @module shared/libraries/paint
 */

import type { Paint, SolidPaint } from './paint-types'

// ============================================
// Constants
// ============================================

/**
 * Maximum number of strokes allowed per element
 */
export const MAX_STROKES = 5

/**
 * Stroke vertex/corner style options
 * - 'miter': Sharp/pointed corners (default)
 * - 'round': Rounded corners
 * - 'bevel': Flat/cut corners
 */
export type StrokeVertices = 'miter' | 'round' | 'bevel'

// ============================================
// Type Definitions
// ============================================

/**
 * Individual stroke configuration
 *
 * Each stroke has independent properties (unlike Figma where all strokes share weight).
 * This enables TextStudio-style "wrapping" where each outer stroke wraps the text
 * plus all inner strokes.
 */
export interface StrokeConfig {
  /** Unique ID for tracking in lists */
  _id: string
  /** Paint (solid color, image, or gradient) */
  paint: Paint
  /** Stroke weight as percentage of fontSize (0-100) */
  weight: number
  /** Stroke opacity (0-1), multiplied with paint opacity */
  opacity: number
  /** Whether this stroke is visible */
  visible: boolean
  /**
   * Vertex/corner style for stroke (optional, defaults to 'miter')
   * - 'miter': Sharp/pointed corners
   * - 'round': Rounded corners
   * - 'bevel': Flat/cut corners
   * @future This field is reserved for future implementation
   */
  vertices?: StrokeVertices
}

/**
 * Default stroke configuration (without _id)
 */
export const DEFAULT_STROKE: Omit<StrokeConfig, '_id'> = {
  paint: {
    type: 'SOLID',
    color: '#000000',
    opacity: 1,
    visible: true,
  } as SolidPaint,
  weight: 2,
  opacity: 1,
  visible: true,
}

// ============================================
// Type Guards
// ============================================

/**
 * Check if value is a valid StrokeConfig
 */
export function isStrokeConfig(value: unknown): value is StrokeConfig {
  if (!value || typeof value !== 'object') return false
  const stroke = value as Partial<StrokeConfig>
  return (
    typeof stroke._id === 'string'
    && stroke.paint !== undefined
    && typeof stroke.weight === 'number'
    && typeof stroke.opacity === 'number'
    && typeof stroke.visible === 'boolean'
  )
}

/**
 * Check if strokes array is valid
 */
export function isStrokesArray(value: unknown): value is StrokeConfig[] {
  return Array.isArray(value) && value.every(isStrokeConfig)
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get effective opacity for a stroke (stroke.opacity * paint.opacity)
 */
export function getStrokeEffectiveOpacity(stroke: StrokeConfig): number {
  if (!stroke.visible) return 0
  const paintOpacity = stroke.paint.opacity ?? 1
  return stroke.opacity * paintOpacity
}

/**
 * Check if stroke is visible and has opacity > 0
 */
export function isStrokeVisible(stroke: StrokeConfig): boolean {
  return stroke.visible && getStrokeEffectiveOpacity(stroke) > 0
}
