/**
 * SVG Effect Type Definitions
 *
 * Shared types for SVG gradients, filters, masks, clip paths, and styling.
 * Extracted from VectorEditor for reuse across modules.
 */

// =============================================================================
// Gradient Types
// =============================================================================

export interface GradientStop {
  offset: number // 0-1
  color: string // CSS color value
  opacity?: number // 0-1
}

export type GradientUnits = 'userSpaceOnUse' | 'objectBoundingBox'
export type SpreadMethod = 'pad' | 'reflect' | 'repeat'

export interface LinearGradientDef {
  type: 'linearGradient'
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  gradientUnits?: GradientUnits
  spreadMethod?: SpreadMethod
  gradientTransform?: string
  stops: GradientStop[]
}

export interface RadialGradientDef {
  type: 'radialGradient'
  id: string
  cx: number
  cy: number
  r: number
  fx?: number
  fy?: number
  fr?: number
  gradientUnits?: GradientUnits
  spreadMethod?: SpreadMethod
  gradientTransform?: string
  stops: GradientStop[]
}

export type GradientDef = LinearGradientDef | RadialGradientDef

// =============================================================================
// Filter Primitive Types
// =============================================================================

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity'

export type ColorMatrixType = 'matrix' | 'saturate' | 'hueRotate' | 'luminanceToAlpha'

export type TurbulenceType = 'fractalNoise' | 'turbulence'

export type CompositeOperator = 'over' | 'in' | 'out' | 'atop' | 'xor' | 'arithmetic'

// Base interface for all filter primitives
export interface BaseFilterPrimitive {
  result?: string
  in?: string
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
}

export interface FeGaussianBlur extends BaseFilterPrimitive {
  type: 'feGaussianBlur'
  stdDeviation: number | [number, number]
  edgeMode?: 'duplicate' | 'wrap' | 'none'
}

export interface FeColorMatrix extends BaseFilterPrimitive {
  type: 'feColorMatrix'
  matrixType: ColorMatrixType
  values?: number[] | number // number[] for 'matrix' (20 values), number for saturate/hueRotate
}

export interface FeDropShadow extends BaseFilterPrimitive {
  type: 'feDropShadow'
  dx: number
  dy: number
  stdDeviation: number | [number, number]
  floodColor?: string
  floodOpacity?: number
}

export interface FeBlend extends BaseFilterPrimitive {
  type: 'feBlend'
  mode: BlendMode
  in2?: string
}

export interface FeOffset extends BaseFilterPrimitive {
  type: 'feOffset'
  dx: number
  dy: number
}

export interface FeFlood extends BaseFilterPrimitive {
  type: 'feFlood'
  floodColor: string
  floodOpacity?: number
}

export interface FeComposite extends BaseFilterPrimitive {
  type: 'feComposite'
  operator: CompositeOperator
  in2?: string
  k1?: number
  k2?: number
  k3?: number
  k4?: number
}

export interface FeMergeNode {
  in?: string
}

export interface FeMerge extends BaseFilterPrimitive {
  type: 'feMerge'
  nodes: FeMergeNode[]
}

export interface FeTurbulence extends BaseFilterPrimitive {
  type: 'feTurbulence'
  turbulenceType: TurbulenceType
  baseFrequency: number | [number, number]
  numOctaves?: number
  seed?: number
  stitchTiles?: 'stitch' | 'noStitch'
}

export interface FeDisplacementMap extends BaseFilterPrimitive {
  type: 'feDisplacementMap'
  in2?: string
  scale: number
  xChannelSelector?: 'R' | 'G' | 'B' | 'A'
  yChannelSelector?: 'R' | 'G' | 'B' | 'A'
}

// Light source types for lighting filters
export interface PointLight {
  type: 'pointLight'
  x: number
  y: number
  z: number
}

export interface DistantLight {
  type: 'distantLight'
  azimuth: number
  elevation: number
}

export interface SpotLight {
  type: 'spotLight'
  x: number
  y: number
  z: number
  pointsAtX: number
  pointsAtY: number
  pointsAtZ: number
  specularExponent?: number
  limitingConeAngle?: number
}

export type LightSource = PointLight | DistantLight | SpotLight

export interface FeDiffuseLighting extends BaseFilterPrimitive {
  type: 'feDiffuseLighting'
  surfaceScale?: number
  diffuseConstant?: number
  lightingColor?: string
  lightSource: LightSource
}

export interface FeSpecularLighting extends BaseFilterPrimitive {
  type: 'feSpecularLighting'
  surfaceScale?: number
  specularConstant?: number
  specularExponent?: number
  lightingColor?: string
  lightSource: LightSource
}

// FeComponentTransfer - for threshold/posterization effects
export type ComponentTransferType = 'identity' | 'table' | 'discrete' | 'linear' | 'gamma'

export interface FeComponentTransferFunc {
  type: ComponentTransferType
  tableValues?: number[] // For 'table' and 'discrete' types
  slope?: number // For 'linear' type
  intercept?: number // For 'linear' type
  amplitude?: number // For 'gamma' type
  exponent?: number // For 'gamma' type
  offset?: number // For 'gamma' type
}

export interface FeComponentTransfer extends BaseFilterPrimitive {
  type: 'feComponentTransfer'
  funcR?: FeComponentTransferFunc
  funcG?: FeComponentTransferFunc
  funcB?: FeComponentTransferFunc
  funcA?: FeComponentTransferFunc
}

// FeConvolveMatrix - for edge detection (pencil sketch)
export interface FeConvolveMatrix extends BaseFilterPrimitive {
  type: 'feConvolveMatrix'
  order: number | [number, number] // Default is 3 (3x3 matrix)
  kernelMatrix: number[]
  divisor?: number
  bias?: number
  targetX?: number
  targetY?: number
  edgeMode?: 'duplicate' | 'wrap' | 'none'
  preserveAlpha?: boolean
}

// FeMorphology - for dilate/erode effects (embossing, debossing)
export interface FeMorphology extends BaseFilterPrimitive {
  type: 'feMorphology'
  operator: 'erode' | 'dilate'
  radius: number | [number, number]
}

export type FilterPrimitive =
  | FeGaussianBlur
  | FeColorMatrix
  | FeDropShadow
  | FeBlend
  | FeOffset
  | FeFlood
  | FeComposite
  | FeMerge
  | FeTurbulence
  | FeDisplacementMap
  | FeDiffuseLighting
  | FeSpecularLighting
  | FeComponentTransfer
  | FeConvolveMatrix
  | FeMorphology

export interface FilterDef {
  id: string
  filterUnits?: 'userSpaceOnUse' | 'objectBoundingBox'
  primitiveUnits?: 'userSpaceOnUse' | 'objectBoundingBox'
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  primitives: FilterPrimitive[]
  /** Path filter preset ID (e.g., 'debossing', 'embossing') - used to restore UI state */
  presetId?: string
  /** Path filter preset parameters - used to restore UI state */
  presetParams?: Record<string, number>
}

// =============================================================================
// Mask and ClipPath Types
// =============================================================================

export type MaskType = 'luminance' | 'alpha'

export interface MaskDef {
  id: string
  maskUnits?: 'userSpaceOnUse' | 'objectBoundingBox'
  maskContentUnits?: 'userSpaceOnUse' | 'objectBoundingBox'
  maskType?: MaskType
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  content: string // SVG markup for mask content
}

export interface ClipPathDef {
  id: string
  clipPathUnits?: 'userSpaceOnUse' | 'objectBoundingBox'
  clipRule?: 'nonzero' | 'evenodd'
  pathData: string // SVG path d attribute
}

// =============================================================================
// Paint Types (Fill/Stroke)
// =============================================================================

export interface SolidPaint {
  type: 'color'
  color: string
  opacity?: number
}

export interface GradientPaint {
  type: 'gradient'
  gradientId: string
}

export interface NonePaint {
  type: 'none'
}

export type Paint = SolidPaint | GradientPaint | NonePaint

// =============================================================================
// Color Adjustments (converted to feColorMatrix)
// =============================================================================

export interface ColorAdjustments {
  brightness?: number // -100 to 100 (0 = no change)
  contrast?: number // -100 to 100 (0 = no change)
  saturation?: number // -100 to 100 (0 = no change)
  hueRotate?: number // 0-360 degrees
  opacity?: number // 0-1
  invert?: number // 0-1
  sepia?: number // 0-1
  grayscale?: number // 0-1
}

// =============================================================================
// Extended Path Style
// =============================================================================

export interface PathStyle {
  fill: Paint
  fillRule?: 'nonzero' | 'evenodd'
  fillOpacity?: number
  stroke?: Paint
  strokeWidth?: number
  strokeOpacity?: number
  strokeLinecap?: 'butt' | 'round' | 'square'
  strokeLinejoin?: 'miter' | 'round' | 'bevel'
  strokeMiterlimit?: number
  strokeDasharray?: number[]
  strokeDashoffset?: number
  opacity?: number
  mixBlendMode?: BlendMode
  filterId?: string
  maskId?: string
  clipPathId?: string
  colorAdjustments?: ColorAdjustments
}

// =============================================================================
// Subpath Style Types (for per-subpath styling)
// =============================================================================

/**
 * Style overrides for a specific subpath within a path
 * All properties are optional - undefined means "inherit from parent path"
 * null means "explicitly no value" (e.g., no filter vs inherited filter)
 */
export interface SubpathStyleOverride {
  fill?: Paint
  fillOpacity?: number
  stroke?: Paint
  strokeWidth?: number
  strokeOpacity?: number
  strokeLinecap?: 'butt' | 'round' | 'square'
  strokeLinejoin?: 'miter' | 'round' | 'bevel'
  opacity?: number
  mixBlendMode?: BlendMode
  filterId?: string | null // null = explicitly no filter (not inherited)
  colorAdjustments?: ColorAdjustments | null // null = explicitly no adjustments
}

/**
 * Key for identifying a subpath within a path
 * Uses segment startIndex as the unique identifier
 */
export type SubpathKey = number

/**
 * Map of subpath styles for a single path
 * Key: segment startIndex, Value: style overrides for that segment
 */
export type SubpathStylesMap = Map<SubpathKey, SubpathStyleOverride>

/**
 * Extended PathStyle that includes subpath-level style overrides
 */
export interface PathStyleWithSubpaths extends PathStyle {
  /** Per-subpath style overrides. Key is segment startIndex */
  subpathStyles?: SubpathStylesMap
}
