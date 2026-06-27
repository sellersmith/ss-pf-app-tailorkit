/**
 * SVG Filter Types
 *
 * Type definitions for SVG filter configurations.
 *
 * @module shared/libraries/svg
 */

import type { DropShadowConfig, InnerShadowConfig } from '../konva/effects/types'
import type { StrokeConfig as MultiStrokeConfig } from '../paint/stroke-types'

/**
 * @deprecated Use strokes array with StrokeConfig instead
 */
export interface LegacyStrokeConfig {
  color: string
  width: number
}

export interface EffectsFilterConfig {
  dropShadows: DropShadowConfig[]
  innerShadows: InnerShadowConfig[]
  fillOpacity?: number
  textColor?: string
  /**
   * @deprecated Use strokes array instead
   */
  stroke?: LegacyStrokeConfig
  /**
   * Multiple strokes array (TextStudio-style wrapping)
   * Each stroke wraps text + all previous strokes
   * Independent weight per stroke (better than Figma)
   */
  strokes?: MultiStrokeConfig[]
}

// Re-export StrokeConfig from stroke-types for convenience
export type { StrokeConfig } from '../paint/stroke-types'

// Backward compatibility alias
export type { LegacyStrokeConfig as StrokeConfigLegacy }

// Re-export shadow types for convenience
export type { DropShadowConfig, InnerShadowConfig }
