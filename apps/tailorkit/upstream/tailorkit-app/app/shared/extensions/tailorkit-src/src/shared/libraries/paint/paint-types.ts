/**
 * Paint Types - Shared across server and client
 *
 * These types define the Paint system without database dependencies.
 * Inspired by Figma's unified Paint model for consistent fill handling.
 *
 * Used in:
 * - React components
 * - SVG rendering
 * - Canvas rendering
 * - Storefront extensions
 *
 * @module shared/libraries/paint
 */

// ============================================
// Enums & Constants
// ============================================

export const PAINT_TYPES = {
  SOLID: 'SOLID',
  IMAGE: 'IMAGE',
  GRADIENT_LINEAR: 'GRADIENT_LINEAR',
  GRADIENT_RADIAL: 'GRADIENT_RADIAL',
  GRADIENT_ANGULAR: 'GRADIENT_ANGULAR',
  GRADIENT_DIAMOND: 'GRADIENT_DIAMOND',
} as const

export const IMAGE_SCALE_MODES = {
  FILL: 'FILL', // Cover, may crop
  FIT: 'FIT', // Contain, may letterbox
  CROP: 'CROP', // User-controlled crop
  TILE: 'TILE', // Repeat pattern
} as const

export const BLEND_MODES = {
  NORMAL: 'NORMAL',
  MULTIPLY: 'MULTIPLY',
  SCREEN: 'SCREEN',
  OVERLAY: 'OVERLAY',
  DARKEN: 'DARKEN',
  LIGHTEN: 'LIGHTEN',
  COLOR_DODGE: 'COLOR_DODGE',
  COLOR_BURN: 'COLOR_BURN',
  HARD_LIGHT: 'HARD_LIGHT',
  SOFT_LIGHT: 'SOFT_LIGHT',
  DIFFERENCE: 'DIFFERENCE',
  EXCLUSION: 'EXCLUSION',
  HUE: 'HUE',
  SATURATION: 'SATURATION',
  COLOR: 'COLOR',
  LUMINOSITY: 'LUMINOSITY',
} as const

// ============================================
// Type Definitions
// ============================================

export type ImageScaleMode = keyof typeof IMAGE_SCALE_MODES
export type GradientType = 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND'
export type PaintType = keyof typeof PAINT_TYPES
export type BlendMode = keyof typeof BLEND_MODES

/**
 * Pattern size options for image fills (user-facing property)
 *
 * - 'stretch': Fill entire bounds (maps to scaleMode: FILL)
 * - 'stretch-x': Stretch horizontally, tile vertically
 * - 'stretch-y': Stretch vertically, tile horizontally
 * - number (10-100): Tile at percentage of original image size
 *
 * Default: 100 (tile at original size)
 */
export type PatternSize = 'stretch' | 'stretch-x' | 'stretch-y' | number

/**
 * Common properties for all paint types
 */
export interface BasePaint {
  /** Paint type discriminator */
  type: PaintType
  /** Paint visibility (default: true) */
  visible?: boolean
  /** Paint opacity 0-1 (default: 1) */
  opacity?: number
  /** Blend mode for compositing */
  blendMode?: BlendMode
}

/**
 * Solid color paint
 */
export interface SolidPaint extends BasePaint {
  type: 'SOLID'
  /** Color in any CSS format (rgb, rgba, hex, hsl) */
  color: string
}

/**
 * Image transform properties
 */
export interface ImageTransform {
  /** Horizontal position 0-1 normalized (0.5 = center) */
  x?: number
  /** Vertical position 0-1 normalized (0.5 = center) */
  y?: number
  /** Scale factor (1 = 100%) */
  scale?: number
  /** Rotation angle in degrees */
  rotation?: number
}

/**
 * Image filter/adjustment properties
 * Most values range from -1 to 1, except sharpness (0 to 1)
 */
export interface ImageFilters {
  /** Brightness - simple linear offset (-1 to 1) */
  brightness?: number
  /** Exposure - photographic stops adjustment (-1 to 1) */
  exposure?: number
  /** Contrast adjustment (-1 to 1) */
  contrast?: number
  /** Saturation adjustment (-1 to 1) */
  saturation?: number
  /** Color temperature adjustment (-1 to 1) */
  temperature?: number
  /** Tint adjustment (-1 to 1) */
  tint?: number
  /** Highlights adjustment (-1 to 1) */
  highlights?: number
  /** Shadows adjustment (-1 to 1) */
  shadows?: number
  /** Sharpness - edge enhancement (0 to 1, positive only) */
  sharpness?: number
  /** Blur - gaussian blur (0 to 1, positive only) */
  blur?: number
}

/**
 * Image paint
 */
export interface ImagePaint extends BasePaint {
  type: 'IMAGE'
  /** Image source - URL or Asset reference ID */
  imageRef: string
  /** How image fills the bounds (internal/standard property) */
  scaleMode: ImageScaleMode
  /**
   * User-facing pattern size control
   * - 'stretch': Fill entire bounds
   * - 'stretch-x': Stretch horizontally, tile vertically
   * - 'stretch-y': Stretch vertically, tile horizontally
   * - number (10-100): Tile at percentage of original image size
   * Default: 100 (tile at original size)
   */
  patternSize?: PatternSize
  /** Image positioning transform */
  transform?: ImageTransform
  /** Image color adjustments */
  filters?: ImageFilters
}

/**
 * Color stop for gradients
 */
export interface ColorStop {
  /** Position along gradient 0-1 */
  position: number
  /** Color at this stop (any CSS color format) */
  color: string
}

/**
 * Gradient transform properties
 */
export interface GradientTransform {
  /** Gradient start point (0-1 normalized) */
  start?: { x: number; y: number }
  /** Gradient end point (0-1 normalized) */
  end?: { x: number; y: number }
  /** Rotation angle in degrees (for angular/diamond) */
  angle?: number
}

/**
 * Gradient paint
 */
export interface GradientPaint extends BasePaint {
  type: GradientType
  /** Gradient color stops (minimum 2) */
  stops: ColorStop[]
  /** Gradient transform (position, angle, scale) */
  transform?: GradientTransform
}

/**
 * Union of all paint types
 */
export type Paint = SolidPaint | ImagePaint | GradientPaint

// ============================================
// Type Guards
// ============================================

/**
 * Check if paint is a SolidPaint
 */
export function isSolidPaint(paint: Paint | string | undefined | null): paint is SolidPaint {
  return typeof paint === 'object' && paint !== null && paint.type === 'SOLID'
}

/**
 * Check if paint is an ImagePaint
 */
export function isImagePaint(paint: Paint | string | undefined | null): paint is ImagePaint {
  return typeof paint === 'object' && paint !== null && paint.type === 'IMAGE'
}

/**
 * Check if paint is a GradientPaint
 */
export function isGradientPaint(paint: Paint | string | undefined | null): paint is GradientPaint {
  return typeof paint === 'object' && paint !== null && paint.type?.startsWith('GRADIENT_')
}

/**
 * Check if paint is a linear gradient
 */
export function isLinearGradient(paint: Paint | undefined | null): paint is GradientPaint {
  return isGradientPaint(paint) && paint.type === 'GRADIENT_LINEAR'
}

/**
 * Check if paint is a radial gradient
 */
export function isRadialGradient(paint: Paint | undefined | null): paint is GradientPaint {
  return isGradientPaint(paint) && paint.type === 'GRADIENT_RADIAL'
}

// ============================================
// Utility Functions
// ============================================

/**
 * Convert legacy color string to SolidPaint
 */
export function colorToSolidPaint(color: string, opacity?: number): SolidPaint {
  return {
    type: 'SOLID',
    color,
    opacity: opacity ?? 1,
    visible: true,
  }
}

/**
 * Create a default ImagePaint
 */
export function createImagePaint(
  imageRef: string,
  scaleMode: ImageScaleMode = 'TILE',
  patternSize: PatternSize = 100
): ImagePaint {
  return {
    type: 'IMAGE',
    imageRef,
    scaleMode,
    patternSize,
    opacity: 1,
    visible: true,
  }
}

/**
 * Create a default linear gradient
 */
export function createLinearGradient(startColor: string, endColor: string, angle?: number): GradientPaint {
  return {
    type: 'GRADIENT_LINEAR',
    stops: [
      { position: 0, color: startColor },
      { position: 1, color: endColor },
    ],
    transform: angle !== undefined ? { angle } : undefined,
    opacity: 1,
    visible: true,
  }
}

/**
 * Create a default radial gradient
 */
export function createRadialGradient(centerColor: string, edgeColor: string): GradientPaint {
  return {
    type: 'GRADIENT_RADIAL',
    stops: [
      { position: 0, color: centerColor },
      { position: 1, color: edgeColor },
    ],
    opacity: 1,
    visible: true,
  }
}

/**
 * Get effective opacity (paint opacity * visibility)
 */
export function getEffectiveOpacity(paint: Paint): number {
  if (paint.visible === false) return 0
  return paint.opacity ?? 1
}

/**
 * Check if paint is visible and has opacity > 0
 */
export function isPaintVisible(paint: Paint): boolean {
  return paint.visible !== false && getEffectiveOpacity(paint) > 0
}

/**
 * Get the primary color from a paint (for fallback/preview purposes)
 */
export function getPrimaryColor(paint: Paint): string {
  if (isSolidPaint(paint)) {
    return paint.color
  }
  if (isGradientPaint(paint) && paint.stops.length > 0) {
    return paint.stops[0].color
  }
  // For ImagePaint, return a placeholder color
  return '#808080'
}

/**
 * Normalize a paint or color string to a Paint object
 */
export function normalizeToPaint(value: Paint | string | undefined | null): Paint {
  if (typeof value === 'string') {
    return colorToSolidPaint(value)
  }
  if (value && typeof value === 'object') {
    return value
  }
  return colorToSolidPaint('#000000')
}

/**
 * Validate Paint object structure
 */
export function validatePaint(paint: unknown): paint is Paint {
  if (!paint || typeof paint !== 'object') return false
  const p = paint as Partial<Paint>
  if (!p.type) return false

  switch (p.type) {
    case 'SOLID':
      return typeof (p as SolidPaint).color === 'string'
    case 'IMAGE': {
      const imgPaint = p as ImagePaint
      return typeof imgPaint.imageRef === 'string' && typeof imgPaint.scaleMode === 'string'
    }
    case 'GRADIENT_LINEAR':
    case 'GRADIENT_RADIAL':
    case 'GRADIENT_ANGULAR':
    case 'GRADIENT_DIAMOND': {
      const gradPaint = p as GradientPaint
      return Array.isArray(gradPaint.stops) && gradPaint.stops.length >= 2
    }
    default:
      return false
  }
}
