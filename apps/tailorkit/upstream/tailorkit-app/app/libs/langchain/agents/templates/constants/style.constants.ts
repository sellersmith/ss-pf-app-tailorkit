/**
 * Style constants and configuration for template generation.
 * Defines text styling options, caching settings, and design parameters.
 */
import type {
  TextStyleCase,
  TextStyleNeonMode,
  TextStyleShape,
  TextStyleText,
  TextStyleVerticalAlign,
  TextStyleAlign,
} from '~/types/psd'

/** Valid text style options for template generation */
export const TEXT_STYLE_CONSTANTS = {
  TEXT: ['bold', 'italic', 'underline', 'normal'] as const satisfies readonly TextStyleText[],
  ALIGN: ['left', 'center', 'right', 'justify'] as const satisfies readonly TextStyleAlign[],
  VERTICAL_ALIGN: ['top', 'middle', 'bottom'] as const satisfies readonly TextStyleVerticalAlign[],
  NEON_MODE: ['none', 'inverse'] as const satisfies readonly TextStyleNeonMode[],
  CASE: ['none', 'uppercase', 'lowercase', 'title', 'sentence'] as const satisfies readonly TextStyleCase[],
  SHAPE: ['none', 'circle', 'curve'] as const satisfies readonly TextStyleShape[],
} as const

/** Cache size and enable/disable configuration for template agents */
export const CACHE_CONFIG = {
  STYLE_CACHE_SIZE: 20,
  CONTEXT_CACHE_SIZE: 15,
  PRODUCT_CACHE_SIZE: 15,
  // Global toggle to enable/disable caches at runtime (can be wired to env)
  ENABLED: false,
} as const

/** Cache versioning for invalidating cached data when schemas change */
export const CACHE_VERSION = {
  STYLE: 1,
  PRODUCT: 1,
  CONTEXT: 1,
  INTENT: 1,
} as const

/**
 * Confidence thresholds used across template agents to avoid hardcoded field checks
 * and rely on model-provided confidence similar to ProductIntentAnalyzer.
 */
export const CONFIDENCE_THRESHOLDS = {
  CONTEXT_SUFFICIENT: 0.7,
} as const

/** Design intent options for element purpose, positioning, and scaling */
export const DESIGN_INTENT = {
  PURPOSE: ['hero', 'secondary', 'decorative', 'background', 'functional'] as const,
  POSITION: ['center', 'top', 'bottom', 'left', 'right', 'corner', 'edge'] as const,
  SCALING: ['fixed', 'responsive', 'proportional'] as const,
} as const

/** Canvas layer types and blend modes for template elements */
export const CANVAS_PROPERTIES = {
  LAYER_TYPE: ['background', 'content', 'overlay', 'decoration'] as const,
  BLEND_MODE: ['normal', 'multiply', 'screen', 'overlay'] as const,
} as const

/** Base types for element relationship and positioning context */
export type SemanticRole = string
export type RelationshipType = string
export type ProximityLevel = string
export type OrientationType = string
export type PostureType = string
export type EmotionalLevel = string

/** Interface for validating element semantic relationships and spatial positioning */
export interface SemanticContext {
  role: SemanticRole
  relationshipType?: RelationshipType
  connectionTo?: string[]
  spatialHints?: {
    proximityLevel: ProximityLevel
    orientation?: OrientationType
    posture?: PostureType
  }
  interactionCues?: {
    eyeContact?: boolean
    physicalConnection?: boolean
    sharedActivity?: string
    emotionalConnection?: EmotionalLevel
  }
}
