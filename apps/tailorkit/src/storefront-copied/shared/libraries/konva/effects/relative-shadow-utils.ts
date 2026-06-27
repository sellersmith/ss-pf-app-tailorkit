/**
 * Utilities for converting between relative (font-size-based) and absolute shadow values
 *
 * Relative values make effects scale-independent, so presets look good at any font size.
 * Direction (degrees) + Distance (% of fontSize) is more intuitive than offsetX/offsetY.
 *
 * @module shared/libraries/konva/effects
 */

import type { DropShadowConfig, InnerShadowConfig, EffectConfig, RelativeShadowPosition } from './types'

/**
 * Convert direction (degrees) and distance (percent of fontSize) to offsetX/offsetY
 *
 * Direction convention:
 * - 0° = right (positive X)
 * - 90° = down (positive Y)
 * - 180° = left (negative X)
 * - 270° = up (negative Y)
 *
 * @param direction - Angle in degrees (0-360)
 * @param distancePercent - Distance as percentage of fontSize (0-200%)
 * @param fontSize - Font size in pixels
 * @returns Object with offsetX and offsetY in pixels
 */
export function directionToOffsets(
  direction: number,
  distancePercent: number,
  fontSize: number
): { offsetX: number; offsetY: number } {
  const distance = (distancePercent / 100) * fontSize
  const radians = (direction * Math.PI) / 180
  return {
    offsetX: Math.round(distance * Math.cos(radians) * 100) / 100,
    offsetY: Math.round(distance * Math.sin(radians) * 100) / 100,
  }
}

/**
 * Convert offsetX/offsetY to direction (degrees) and distance (percent of fontSize)
 *
 * @param offsetX - X offset in pixels
 * @param offsetY - Y offset in pixels
 * @param fontSize - Font size in pixels
 * @returns Object with direction (0-360°) and distancePercent (% of fontSize)
 */
export function offsetsToDirection(
  offsetX: number,
  offsetY: number,
  fontSize: number
): { direction: number; distancePercent: number } {
  const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY)
  const distancePercent = fontSize > 0 ? (distance / fontSize) * 100 : 0

  // Calculate angle in degrees (0 = right, 90 = down)
  let direction = Math.atan2(offsetY, offsetX) * (180 / Math.PI)
  if (direction < 0) direction += 360

  return {
    direction: Math.round(direction),
    distancePercent: Math.round(distancePercent * 10) / 10,
  }
}

/**
 * Convert relative radius percent to absolute pixels
 *
 * @param radiusPercent - Blur radius as percentage of fontSize (0-100%)
 * @param fontSize - Font size in pixels
 * @returns Blur radius in pixels
 */
export function radiusPercentToPixels(radiusPercent: number, fontSize: number): number {
  return Math.round((radiusPercent / 100) * fontSize * 100) / 100
}

/**
 * Convert absolute radius to percent of fontSize
 *
 * @param radius - Blur radius in pixels
 * @param fontSize - Font size in pixels
 * @returns Radius as percentage of fontSize
 */
export function radiusToPercent(radius: number, fontSize: number): number {
  return fontSize > 0 ? Math.round((radius / fontSize) * 100 * 10) / 10 : 0
}

/**
 * Resolve a shadow config to absolute values
 * If relative is defined, converts relative values to absolute; otherwise returns unchanged
 *
 * @param config - Shadow config (DropShadowConfig or InnerShadowConfig)
 * @param fontSize - Font size in pixels for conversion
 * @returns Config with resolved absolute offsetX/offsetY/radius values
 */
export function resolveToAbsolute<T extends DropShadowConfig | InnerShadowConfig>(config: T, fontSize: number): T {
  if (!config.relative) {
    return config
  }

  const { direction, distancePercent, radiusPercent } = config.relative
  const { offsetX, offsetY } = directionToOffsets(direction, distancePercent, fontSize)
  const radius = radiusPercentToPixels(radiusPercent, fontSize)

  return {
    ...config,
    offsetX,
    offsetY,
    radius,
  }
}

/**
 * Resolve all effects in an array to absolute values
 *
 * @param effects - Array of effect configs
 * @param fontSize - Font size in pixels for conversion
 * @returns Array with all shadow effects resolved to absolute values
 */
export function resolveEffectsToAbsolute(effects: EffectConfig[], fontSize: number): EffectConfig[] {
  return effects.map(effect => {
    if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
      return resolveToAbsolute(effect, fontSize)
    }
    return effect
  })
}

/**
 * Initialize relative values from absolute values
 * Used when switching an existing effect from absolute to relative mode
 *
 * @param config - Shadow config with absolute values
 * @param fontSize - Font size in pixels for conversion
 * @returns Config with relative object containing computed relative values
 */
export function initializeRelativeFromAbsolute<T extends DropShadowConfig | InnerShadowConfig>(
  config: T,
  fontSize: number
): T {
  const { direction, distancePercent } = offsetsToDirection(config.offsetX, config.offsetY, fontSize)
  const radiusPercent = radiusToPercent(config.radius, fontSize)

  return {
    ...config,
    relative: {
      direction,
      distancePercent,
      radiusPercent,
    },
  }
}

/**
 * Create a new shadow config with relative positioning
 * Useful for creating new effects in relative mode
 *
 * @param type - 'DROP_SHADOW' or 'INNER_SHADOW'
 * @param color - Shadow color
 * @param relative - Relative positioning (direction, distancePercent, radiusPercent)
 * @returns Shadow config with relative positioning and default absolute values
 */
export function createRelativeShadow(
  type: 'DROP_SHADOW' | 'INNER_SHADOW',
  color: string,
  relative: RelativeShadowPosition
): DropShadowConfig | InnerShadowConfig {
  const base = {
    type,
    color,
    relative,
    // Default absolute values (will be overwritten at render time)
    offsetX: 0,
    offsetY: 0,
    radius: 0,
    visible: true,
  }

  return base as DropShadowConfig | InnerShadowConfig
}

// ============================================
// Stroke Relative Utilities
// ============================================

/**
 * Convert stroke weight percentage to absolute pixels
 *
 * strokeWeight is stored as 0-100 (percentage of fontSize).
 * This function converts it to actual pixel values at render time.
 *
 * @param strokeWeightPercent - Stroke weight as percentage of fontSize (0-100%)
 * @param fontSize - Font size in pixels
 * @returns Stroke width in pixels
 *
 * @example
 * strokePercentToPixels(5, 100)  // Returns 5  (5% of 100px)
 * strokePercentToPixels(5, 200)  // Returns 10 (5% of 200px)
 * strokePercentToPixels(10, 50)  // Returns 5  (10% of 50px)
 */
export function strokePercentToPixels(strokeWeightPercent: number, fontSize: number): number {
  return Math.round((strokeWeightPercent / 100) * fontSize * 100) / 100
}
