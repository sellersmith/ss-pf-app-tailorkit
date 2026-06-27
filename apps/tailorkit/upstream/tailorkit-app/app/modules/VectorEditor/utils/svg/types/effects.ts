/**
 * SVG Effect Type Definitions
 *
 * Re-exports types from shared ~/types/svg-effects.ts and provides
 * VectorEditor-specific helper functions.
 *
 * @see ~/types/svg-effects.ts for type definitions
 */

// Re-export all types from shared
// Import types for local use in helper functions
import type {
  GradientStop,
  LinearGradientDef,
  RadialGradientDef,
  SolidPaint,
  GradientPaint,
  NonePaint,
  FilterDef,
  PathStyle,
} from '~/types/svg-effects'

export type {
  // Gradient Types
  GradientStop,
  GradientUnits,
  SpreadMethod,
  LinearGradientDef,
  RadialGradientDef,
  GradientDef,
  // Filter Types
  BlendMode,
  ColorMatrixType,
  TurbulenceType,
  CompositeOperator,
  BaseFilterPrimitive,
  FeGaussianBlur,
  FeColorMatrix,
  FeDropShadow,
  FeBlend,
  FeOffset,
  FeFlood,
  FeComposite,
  FeMergeNode,
  FeMerge,
  FeTurbulence,
  FeDisplacementMap,
  PointLight,
  DistantLight,
  SpotLight,
  LightSource,
  FeDiffuseLighting,
  FeSpecularLighting,
  ComponentTransferType,
  FeComponentTransferFunc,
  FeComponentTransfer,
  FeConvolveMatrix,
  FeMorphology,
  FilterPrimitive,
  FilterDef,
  // Mask and ClipPath Types
  MaskType,
  MaskDef,
  ClipPathDef,
  // Paint Types
  SolidPaint,
  GradientPaint,
  NonePaint,
  Paint,
  // Color Adjustments
  ColorAdjustments,
  // Path Style
  PathStyle,
  SubpathStyleOverride,
  SubpathKey,
  SubpathStylesMap,
  PathStyleWithSubpaths,
} from '~/types/svg-effects'

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a default solid paint
 */
export function createSolidPaint(color: string, opacity?: number): SolidPaint {
  return { type: 'color', color, opacity }
}

/**
 * Create a gradient paint reference
 */
export function createGradientPaint(gradientId: string): GradientPaint {
  return { type: 'gradient', gradientId }
}

/**
 * Create a "none" paint (transparent)
 */
export function createNonePaint(): NonePaint {
  return { type: 'none' }
}

/**
 * Create default path style
 */
export function createDefaultPathStyle(fill: string = '#000000'): PathStyle {
  return {
    fill: createSolidPaint(fill),
  }
}

/**
 * Create a linear gradient with coordinates
 */
export function createLinearGradient(
  id: string,
  stops: GradientStop[],
  x1: number = 0,
  y1: number = 0,
  x2: number = 1,
  y2: number = 0
): LinearGradientDef {
  return {
    type: 'linearGradient',
    id,
    x1,
    y1,
    x2,
    y2,
    stops,
  }
}

/**
 * Create a linear gradient from an angle
 */
export function createLinearGradientFromAngle(id: string, stops: GradientStop[], angle: number = 0): LinearGradientDef {
  // Convert angle to x1,y1,x2,y2 coordinates
  // 0 = left to right, 90 = top to bottom
  const radians = ((angle - 90) * Math.PI) / 180
  const x1 = 0.5 - Math.cos(radians) * 0.5
  const y1 = 0.5 - Math.sin(radians) * 0.5
  const x2 = 0.5 + Math.cos(radians) * 0.5
  const y2 = 0.5 + Math.sin(radians) * 0.5

  return {
    type: 'linearGradient',
    id,
    x1,
    y1,
    x2,
    y2,
    stops,
  }
}

/**
 * Create a radial gradient with default values
 */
export function createRadialGradient(
  id: string,
  stops: GradientStop[],
  cx: number = 0.5,
  cy: number = 0.5,
  r: number = 0.5
): RadialGradientDef {
  return {
    type: 'radialGradient',
    id,
    cx,
    cy,
    r,
    stops,
  }
}

/**
 * Create a Gaussian blur filter
 */
export function createBlurFilter(id: string, stdDeviation: number): FilterDef {
  return {
    id,
    primitives: [
      {
        type: 'feGaussianBlur',
        stdDeviation,
      },
    ],
  }
}

/**
 * Create a drop shadow filter
 */
export function createDropShadowFilter(
  id: string,
  dx: number,
  dy: number,
  stdDeviation: number,
  color: string = 'rgba(0,0,0,0.5)',
  opacity: number = 1
): FilterDef {
  return {
    id,
    primitives: [
      {
        type: 'feDropShadow',
        dx,
        dy,
        stdDeviation,
        floodColor: color,
        floodOpacity: opacity,
      },
    ],
  }
}

/**
 * Create a color matrix filter for saturation adjustment
 */
export function createSaturationFilter(id: string, saturation: number): FilterDef {
  return {
    id,
    primitives: [
      {
        type: 'feColorMatrix',
        matrixType: 'saturate',
        values: saturation,
      },
    ],
  }
}

/**
 * Create a color matrix filter for hue rotation
 */
export function createHueRotateFilter(id: string, degrees: number): FilterDef {
  return {
    id,
    primitives: [
      {
        type: 'feColorMatrix',
        matrixType: 'hueRotate',
        values: degrees,
      },
    ],
  }
}
