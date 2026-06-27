/**
 * Stroke Migration Utilities
 *
 * Provides backward compatibility for migrating legacy stroke properties
 * (strokeColor: string, strokeWeight: number) to the new Paint-based
 * stroke system (strokes: Paint[]).
 *
 * This follows Figma's approach where strokes are an array of Paint objects,
 * allowing for solid colors, images, and gradients.
 *
 * @module shared/libraries/paint
 */

import type { Paint, SolidPaint } from './paint-types'
import { colorToSolidPaint, isSolidPaint } from './paint-types'

/**
 * Legacy stroke properties (pre-migration format)
 */
export interface LegacyStrokeProps {
  /** Legacy stroke color as CSS color string */
  strokeColor?: string
  /** Legacy stroke weight in pixels */
  strokeWeight?: number
}

/**
 * New stroke properties (post-migration format)
 */
export interface NewStrokeProps {
  /** Array of Paint objects for strokes (like Figma) */
  strokes?: Paint[]
  /** Stroke weight in pixels */
  strokeWeight?: number
}

/**
 * Combined properties that may have both legacy and new formats
 * Used during migration period
 */
export interface MixedStrokeProps extends LegacyStrokeProps, NewStrokeProps {}

/**
 * Check if an object has legacy stroke properties
 * Returns true if strokeColor is defined (the key legacy indicator)
 */
export function hasLegacyStroke(props: MixedStrokeProps): boolean {
  return typeof props.strokeColor === 'string' && props.strokeColor.length > 0
}

/**
 * Check if an object has new stroke properties
 * Returns true if strokes array is defined and non-empty
 */
export function hasNewStroke(props: MixedStrokeProps): boolean {
  return Array.isArray(props.strokes) && props.strokes.length > 0
}

/**
 * Migrate legacy stroke properties to new Paint-based format
 *
 * Converts:
 * - { strokeColor: '#ff0000', strokeWeight: 2 }
 * to:
 * - { strokes: [{ type: 'SOLID', color: '#ff0000', opacity: 1, visible: true }], strokeWeight: 2 }
 *
 * @param props - Object containing legacy stroke properties
 * @returns Object with new stroke properties
 */
export function migrateStrokeToStrokes(props: LegacyStrokeProps): NewStrokeProps {
  const { strokeColor, strokeWeight } = props

  // No stroke to migrate
  if (!strokeColor || strokeWeight === undefined || strokeWeight <= 0) {
    return {}
  }

  // Convert color string to SolidPaint
  const strokePaint = colorToSolidPaint(strokeColor)

  return {
    strokes: [strokePaint],
    strokeWeight,
  }
}

/**
 * Get the effective stroke properties from mixed props
 * Prefers new format (strokes) over legacy format (strokeColor)
 *
 * @param props - Object that may have legacy or new stroke properties
 * @returns Normalized stroke properties in new format
 */
export function getEffectiveStroke(props: MixedStrokeProps): NewStrokeProps {
  // Prefer new format
  if (hasNewStroke(props)) {
    return {
      strokes: props.strokes,
      strokeWeight: props.strokeWeight,
    }
  }

  // Fall back to migrating legacy format
  if (hasLegacyStroke(props)) {
    return migrateStrokeToStrokes(props)
  }

  // No stroke
  return {}
}

/**
 * Extract the first visible stroke Paint from strokes array
 * Useful for single-stroke scenarios (most common case)
 *
 * @param strokes - Array of Paint objects
 * @returns First visible Paint or undefined
 */
export function getFirstVisibleStroke(strokes: Paint[] | undefined): Paint | undefined {
  if (!strokes || strokes.length === 0) return undefined
  return strokes.find(paint => paint.visible !== false)
}

/**
 * Convert new stroke format back to legacy for backwards compatibility
 * Only works for simple solid color strokes
 *
 * @param props - Object with new stroke properties
 * @returns Object with legacy stroke properties, or empty if not convertible
 */
export function strokesToLegacy(props: NewStrokeProps): LegacyStrokeProps {
  const { strokes, strokeWeight } = props

  if (!strokes || strokes.length === 0 || !strokeWeight) {
    return {}
  }

  // Get first visible stroke
  const firstStroke = getFirstVisibleStroke(strokes)
  if (!firstStroke) return {}

  // Only solid paints can be converted to legacy format
  if (!isSolidPaint(firstStroke)) {
    return {}
  }

  return {
    strokeColor: firstStroke.color,
    strokeWeight,
  }
}

/**
 * Create a default solid stroke Paint
 * Useful for initializing new strokes
 *
 * @param color - CSS color string (default: '#000000')
 * @param opacity - Opacity 0-1 (default: 1)
 * @returns SolidPaint object
 */
export function createDefaultStroke(color = '#000000', opacity = 1): SolidPaint {
  return {
    type: 'SOLID',
    color,
    opacity,
    visible: true,
  }
}

/**
 * Merge legacy and new stroke properties, preferring new format
 * Removes legacy properties after migration
 *
 * @param props - Mixed stroke properties
 * @returns Clean object with only new format properties
 */
export function normalizeStrokeProps(props: MixedStrokeProps): NewStrokeProps {
  const effective = getEffectiveStroke(props)

  // Return only new format properties
  const result: NewStrokeProps = {}
  if (effective.strokes) result.strokes = effective.strokes
  if (effective.strokeWeight !== undefined) result.strokeWeight = effective.strokeWeight

  return result
}
