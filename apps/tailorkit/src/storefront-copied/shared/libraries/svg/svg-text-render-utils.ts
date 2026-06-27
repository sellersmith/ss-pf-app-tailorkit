/**
 * SVG Text Render Utilities
 *
 * Shared functions for preparing SVG text configurations.
 * Used by both React (admin editor) and Native JS (storefront).
 *
 * This module ensures consistent color/opacity handling across platforms:
 * - Extracts RGB color (without alpha) when effects are present
 * - Combines fillOpacity prop with embedded color alpha
 * - Separates effects into drop shadows and inner shadows
 *
 * @module shared/libraries/svg
 */

import type { DropShadowConfig, InnerShadowConfig, EffectConfig } from '../konva/effects/types'
import type { EffectsFilterConfig } from './svg-filter-builder'
import type { StrokeConfig } from '../paint/stroke-types'
import { extractRgbColor, extractAlpha } from './svg-color-utils'

/**
 * Result of separating effects by type
 */
export interface SeparatedEffects {
  /** Visible drop shadow effects */
  dropShadows: DropShadowConfig[]
  /** Visible inner shadow effects */
  innerShadows: InnerShadowConfig[]
  /** Whether there are any visible shadow effects */
  hasEffects: boolean
}

/**
 * Result of calculating combined fill opacity
 */
export interface CombinedOpacityResult {
  /** RGB color without alpha (e.g., '#ff0000') */
  rgbColor: string
  /** Alpha value extracted from original color (0-1) */
  colorAlpha: number
  /** Combined fill opacity (fillOpacity * colorAlpha) */
  combinedFillOpacity: number
}

/**
 * Separate effects array into drop shadows and inner shadows
 *
 * Only includes effects that are visible (visible !== false).
 * This is the single source of truth for effect separation logic.
 *
 * @param effects - Array of effect configurations
 * @returns Separated effects with drop shadows, inner shadows, and hasEffects flag
 */
export function separateEffects(effects: EffectConfig[]): SeparatedEffects {
  const dropShadows = effects.filter((e): e is DropShadowConfig => e.type === 'DROP_SHADOW' && e.visible !== false)
  const innerShadows = effects.filter((e): e is InnerShadowConfig => e.type === 'INNER_SHADOW' && e.visible !== false)
  return {
    dropShadows,
    innerShadows,
    hasEffects: dropShadows.length > 0 || innerShadows.length > 0,
  }
}

/**
 * Calculate combined fill opacity from fillOpacity prop and color alpha
 *
 * CRITICAL: When SVG filters are active, the filter's feComponentTransfer handles
 * opacity independently from shadows. We must:
 * 1. Extract pure RGB color (no alpha) for the text fill
 * 2. Combine fillOpacity prop with embedded color alpha
 * 3. Pass the combined opacity to the filter config
 *
 * @param color - Original text color (can include alpha, e.g., 'rgba(255, 0, 0, 0.5)')
 * @param fillOpacity - Fill opacity prop (0-1), defaults to 1
 * @returns RGB color, color alpha, and combined fill opacity
 */
export function calculateCombinedFillOpacity(color: string, fillOpacity: number = 1): CombinedOpacityResult {
  const rgbColor = extractRgbColor(color)
  const colorAlpha = extractAlpha(color)
  return {
    rgbColor,
    colorAlpha,
    combinedFillOpacity: fillOpacity * colorAlpha,
  }
}

/**
 * Prepare text color for SVG rendering
 *
 * When effects exist, use solid RGB color (filter handles opacity separately).
 * When no effects, use original color with embedded alpha.
 *
 * @param color - Original text color
 * @param hasEffects - Whether the text has visible effects
 * @returns Color to use for SVG text fill
 */
export function prepareTextColor(color: string, hasEffects: boolean): string {
  if (hasEffects) {
    return extractRgbColor(color)
  }
  return color
}

/**
 * Prepare effects filter config with proper opacity handling
 *
 * This is the single source of truth for creating EffectsFilterConfig.
 * It correctly calculates combined fill opacity from fillOpacity prop and color alpha.
 *
 * @param dropShadows - Array of visible drop shadow configs
 * @param innerShadows - Array of visible inner shadow configs
 * @param color - Original text color (for textColor field)
 * @param fillOpacity - Fill opacity prop (0-1), defaults to 1
 * @param strokes - Optional multi-stroke array (TextStudio-style wrapping)
 * @returns EffectsFilterConfig with properly calculated fillOpacity
 */
export function prepareEffectsConfig(
  dropShadows: DropShadowConfig[],
  innerShadows: InnerShadowConfig[],
  color: string,
  fillOpacity: number = 1,
  strokes?: StrokeConfig[]
): EffectsFilterConfig {
  const { combinedFillOpacity } = calculateCombinedFillOpacity(color, fillOpacity)
  return {
    dropShadows,
    innerShadows,
    fillOpacity: combinedFillOpacity,
    textColor: color,
    strokes,
  }
}
