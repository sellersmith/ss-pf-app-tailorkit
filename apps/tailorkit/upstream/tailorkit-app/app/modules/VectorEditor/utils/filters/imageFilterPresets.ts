/**
 * Image Filter Presets
 * SVG filter definitions for high-quality image effects with adjustable parameters
 */

import type { FilterPrimitive } from '../svg/types/effects'

// =============================================================================
// Parameter Types
// =============================================================================

/**
 * Definition for a single adjustable parameter within a filter preset
 */
export interface FilterParameter {
  /** Unique key for this parameter (used in params object) */
  key: string
  /** i18n label key for the parameter name */
  labelKey: string
  /** Parameter type: slider (default) or toggle */
  type?: 'slider' | 'toggle'
  /** Minimum allowed value (for slider type) */
  min: number
  /** Maximum allowed value (for slider type) */
  max: number
  /** Step increment for slider (for slider type) */
  step: number
  /** Default value when preset is first applied (0 or 1 for toggle) */
  defaultValue: number
  /** Unit to display (%, px, or none) - for slider type */
  unit?: '%' | 'px' | ''
}

/**
 * Map of parameter values keyed by parameter key
 */
export type FilterPresetParams = Record<string, number>

/**
 * Definition for a complete filter preset
 */
export interface ImageFilterPreset {
  /** Unique identifier for this preset */
  id: string
  /** Display name (fallback if i18n key not found) */
  name: string
  /** i18n key for the preset name */
  nameKey: string
  /** CSS filter for thumbnail preview (approximation) */
  cssPreview: string
  /** Default SVG filter primitives (used when no custom params) */
  primitives: FilterPrimitive[]
  /** Adjustable parameters for this preset */
  parameters?: FilterParameter[]
}

// =============================================================================
// Filter Primitive Builders
// =============================================================================

/**
 * Build threshold table values for silhouette effect
 * @param threshold - 0 to 1, where 0.5 means 50% brightness is the cutoff
 */
function buildThresholdTable(threshold: number): number[] {
  // Create 8-value table where values below threshold become 0, above become 1
  const table: number[] = []
  for (let i = 0; i < 8; i++) {
    const normalizedValue = i / 7 // 0 to 1
    table.push(normalizedValue < threshold ? 0 : 1)
  }
  return table
}

/**
 * Build sepia matrix with adjustable intensity
 * @param intensity - 0 to 1, where 1 is full sepia
 */
function buildSepiaMatrix(intensity: number): number[] {
  // Sepia matrix coefficients
  const sepiaR = [0.393, 0.769, 0.189]
  const sepiaG = [0.349, 0.686, 0.168]
  const sepiaB = [0.272, 0.534, 0.131]

  // Identity matrix coefficients
  const identityR = [1, 0, 0]
  const identityG = [0, 1, 0]
  const identityB = [0, 0, 1]

  // Interpolate between identity and sepia based on intensity
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  return [
    lerp(identityR[0], sepiaR[0], intensity),
    lerp(identityR[1], sepiaR[1], intensity),
    lerp(identityR[2], sepiaR[2], intensity),
    0,
    0,
    lerp(identityG[0], sepiaG[0], intensity),
    lerp(identityG[1], sepiaG[1], intensity),
    lerp(identityG[2], sepiaG[2], intensity),
    0,
    0,
    lerp(identityB[0], sepiaB[0], intensity),
    lerp(identityB[1], sepiaB[1], intensity),
    lerp(identityB[2], sepiaB[2], intensity),
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ]
}

/**
 * Build posterization table values for given number of levels
 * @param levels - Number of discrete color levels (2-8)
 */
function buildPosterizeTable(levels: number): number[] {
  const table: number[] = []
  for (let i = 0; i < levels; i++) {
    table.push(i / (levels - 1))
  }
  return table
}

/**
 * Build contrast matrix with adjustable contrast multiplier
 * @param contrast - Contrast multiplier (1 = no change, 2 = double contrast)
 */
function buildContrastMatrix(contrast: number): number[] {
  // Contrast adjustment: multiply RGB by contrast factor and offset to center
  const offset = (1 - contrast) / 2
  return [contrast, 0, 0, 0, offset, 0, contrast, 0, 0, offset, 0, 0, contrast, 0, offset, 0, 0, 0, 1, 0]
}

// =============================================================================
// Filter Preset Definitions
// =============================================================================

/**
 * Silhouette preset - converts image to high-contrast black/white silhouette
 */
const silhouettePreset: ImageFilterPreset = {
  id: 'silhouette',
  name: 'Silhouette',
  nameKey: 'Silhouette',
  cssPreview: 'grayscale(1) contrast(1000%)',
  parameters: [
    {
      key: 'invert',
      labelKey: 'Invert colors',
      type: 'toggle',
      min: 0,
      max: 1,
      step: 1,
      defaultValue: 0, // Disabled by default
    },
    {
      key: 'threshold',
      labelKey: 'Threshold',
      min: 0.2,
      max: 0.8,
      step: 0.05,
      defaultValue: 0.5,
      unit: '',
    },
  ],
  primitives: [
    {
      type: 'feColorMatrix',
      in: 'SourceGraphic',
      matrixType: 'saturate',
      values: 0,
      result: 'gray',
    },
    {
      type: 'feComponentTransfer',
      in: 'gray',
      funcR: { type: 'discrete', tableValues: [0, 0, 0, 0, 1, 1, 1, 1] },
      funcG: { type: 'discrete', tableValues: [0, 0, 0, 0, 1, 1, 1, 1] },
      funcB: { type: 'discrete', tableValues: [0, 0, 0, 0, 1, 1, 1, 1] },
    },
  ],
}

/**
 * Vintage preset - warm sepia tones with film grain texture
 */
const vintagePreset: ImageFilterPreset = {
  id: 'vintage',
  name: 'Vintage',
  nameKey: 'Vintage',
  cssPreview: 'sepia(0.6) contrast(0.9) saturate(0.85)',
  parameters: [
    {
      key: 'intensity',
      labelKey: 'Intensity',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 60,
      unit: '%',
    },
    {
      key: 'grain',
      labelKey: 'Grain',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 50,
      unit: '%',
    },
  ],
  primitives: [
    {
      type: 'feColorMatrix',
      in: 'SourceGraphic',
      matrixType: 'matrix',
      values: [0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0],
      result: 'sepia',
    },
    {
      type: 'feTurbulence',
      turbulenceType: 'fractalNoise',
      baseFrequency: 0.7,
      numOctaves: 3,
      seed: 42,
      result: 'grain',
    },
    {
      type: 'feColorMatrix',
      in: 'grain',
      matrixType: 'saturate',
      values: 0,
      result: 'grainBW',
    },
    {
      type: 'feBlend',
      in: 'sepia',
      in2: 'grainBW',
      mode: 'soft-light',
      result: 'blended',
    },
    {
      type: 'feComposite',
      in: 'blended',
      in2: 'SourceGraphic',
      operator: 'in',
    },
  ],
}

/**
 * Pop Art preset - vibrant posterized colors
 */
const popArtPreset: ImageFilterPreset = {
  id: 'pop-art',
  name: 'Pop Art',
  nameKey: 'Pop Art',
  cssPreview: 'saturate(2.5) contrast(1.3)',
  parameters: [
    {
      key: 'saturation',
      labelKey: 'Saturation',
      min: 100,
      max: 400,
      step: 10,
      defaultValue: 250,
      unit: '%',
    },
    {
      key: 'levels',
      labelKey: 'Color levels',
      min: 2,
      max: 8,
      step: 1,
      defaultValue: 5,
      unit: '',
    },
  ],
  primitives: [
    {
      type: 'feColorMatrix',
      in: 'SourceGraphic',
      matrixType: 'saturate',
      values: 2.5,
      result: 'saturated',
    },
    {
      type: 'feComponentTransfer',
      in: 'saturated',
      funcR: { type: 'discrete', tableValues: [0, 0.25, 0.5, 0.75, 1] },
      funcG: { type: 'discrete', tableValues: [0, 0.25, 0.5, 0.75, 1] },
      funcB: { type: 'discrete', tableValues: [0, 0.25, 0.5, 0.75, 1] },
    },
  ],
}

/**
 * Pencil Sketch preset - high contrast grayscale with enhanced edges
 */
const pencilSketchPreset: ImageFilterPreset = {
  id: 'pencil-sketch',
  name: 'Pencil Sketch',
  nameKey: 'Pencil Sketch',
  cssPreview: 'grayscale(1) contrast(1.8)',
  parameters: [
    {
      key: 'contrast',
      labelKey: 'Contrast',
      min: 100,
      max: 400,
      step: 10,
      defaultValue: 200,
      unit: '%',
    },
  ],
  primitives: [
    {
      type: 'feColorMatrix',
      in: 'SourceGraphic',
      matrixType: 'saturate',
      values: 0,
      result: 'gray',
    },
    {
      type: 'feColorMatrix',
      in: 'gray',
      matrixType: 'matrix',
      values: [2, 0, 0, 0, -0.5, 0, 2, 0, 0, -0.5, 0, 0, 2, 0, -0.5, 0, 0, 0, 1, 0],
    },
  ],
}

// =============================================================================
// Preset Collection and Lookup
// =============================================================================

/**
 * All available image filter presets
 */
export const IMAGE_FILTER_PRESETS: ImageFilterPreset[] = [
  silhouettePreset,
  vintagePreset,
  popArtPreset,
  pencilSketchPreset,
]

/**
 * Get a filter preset by ID
 */
export function getFilterPresetById(id: string): ImageFilterPreset | undefined {
  return IMAGE_FILTER_PRESETS.find(preset => preset.id === id)
}

/**
 * Get default parameter values for a preset
 */
export function getDefaultParams(preset: ImageFilterPreset): FilterPresetParams {
  const params: FilterPresetParams = {}
  if (preset.parameters) {
    for (const param of preset.parameters) {
      params[param.key] = param.defaultValue
    }
  }
  return params
}

/**
 * Get default parameters for a preset by ID (for backwards compatibility)
 */
export function getPresetDefaultParams(presetId: string): FilterPresetParams {
  const preset = getFilterPresetById(presetId)
  if (!preset) return {}
  return getDefaultParams(preset)
}

// =============================================================================
// Dynamic Filter Builder
// =============================================================================

/**
 * Build filter primitives with custom parameter values
 * This allows real-time adjustment of filter effects
 */
export function buildFilterPrimitives(preset: ImageFilterPreset, params?: FilterPresetParams): FilterPrimitive[] {
  // If no params provided, use defaults
  const effectiveParams = params ?? getDefaultParams(preset)

  switch (preset.id) {
    case 'silhouette':
      return buildSilhouettePrimitives(effectiveParams)
    case 'vintage':
      return buildVintagePrimitives(effectiveParams)
    case 'pop-art':
      return buildPopArtPrimitives(effectiveParams)
    case 'pencil-sketch':
      return buildPencilSketchPrimitives(effectiveParams)
    default:
      return preset.primitives
  }
}

/**
 * Build CSS preview filter string with custom parameter values
 * CSS filters are limited approximations of the SVG filters
 */
export function buildCssPreview(preset: ImageFilterPreset, params?: FilterPresetParams): string {
  const effectiveParams = params ?? getDefaultParams(preset)

  switch (preset.id) {
    case 'silhouette': {
      // Threshold affects contrast - map 0.2-0.8 to contrast range
      const threshold = effectiveParams.threshold ?? 0.5
      const invert = effectiveParams.invert ?? 0
      const contrast = 500 + (threshold - 0.2) * 1500 // Maps to ~500-1400%
      // Apply invert AFTER grayscale/contrast to match SVG primitive order
      const invertFilter = invert ? ' invert(1)' : ''
      return `grayscale(1) contrast(${contrast}%)${invertFilter}`
    }
    case 'vintage': {
      const intensity = (effectiveParams.intensity ?? 60) / 100
      const grain = (effectiveParams.grain ?? 50) / 100
      // Higher grain = lower contrast for aged film look
      const contrastFactor = 0.95 - grain * 0.1
      return `sepia(${intensity}) contrast(${contrastFactor}) saturate(0.85)`
    }
    case 'pop-art': {
      const saturation = (effectiveParams.saturation ?? 250) / 100
      const levels = effectiveParams.levels ?? 5
      // Fewer levels = higher contrast for posterize effect
      const contrastFactor = 1 + (8 - levels) * 0.1
      return `saturate(${saturation}) contrast(${contrastFactor})`
    }
    case 'pencil-sketch': {
      const contrast = (effectiveParams.contrast ?? 200) / 100
      return `grayscale(1) contrast(${contrast})`
    }
    default:
      return preset.cssPreview
  }
}

function buildSilhouettePrimitives(params: FilterPresetParams): FilterPrimitive[] {
  const threshold = params.threshold ?? 0.5
  const invert = params.invert ?? 0
  const thresholdTable = buildThresholdTable(threshold)

  const primitives: FilterPrimitive[] = [
    {
      type: 'feColorMatrix',
      in: 'SourceGraphic',
      matrixType: 'saturate',
      values: 0,
      result: 'gray',
    },
    {
      type: 'feComponentTransfer',
      in: 'gray',
      funcR: { type: 'discrete', tableValues: thresholdTable },
      funcG: { type: 'discrete', tableValues: thresholdTable },
      funcB: { type: 'discrete', tableValues: thresholdTable },
      result: invert ? 'threshold' : undefined,
    },
  ]

  // Add invert step if enabled
  if (invert) {
    // Invert matrix: multiply by -1 and add 1 (inverts 0->1, 1->0)
    primitives.push({
      type: 'feColorMatrix',
      in: 'threshold',
      matrixType: 'matrix',
      values: [-1, 0, 0, 0, 1, 0, -1, 0, 0, 1, 0, 0, -1, 0, 1, 0, 0, 0, 1, 0],
    })
  }

  return primitives
}

function buildVintagePrimitives(params: FilterPresetParams): FilterPrimitive[] {
  const intensity = (params.intensity ?? 60) / 100 // Convert from 0-100 to 0-1
  const grain = (params.grain ?? 50) / 100 // Convert from 0-100 to 0-1

  // Calculate grain frequency: higher grain value = more visible grain (lower frequency = larger grain)
  // Range: 0.3 (low grain, large pattern) to 1.2 (high grain, fine pattern)
  const baseFrequency = 0.3 + grain * 0.9

  const sepiaMatrix = buildSepiaMatrix(intensity)

  const primitives: FilterPrimitive[] = [
    {
      type: 'feColorMatrix',
      in: 'SourceGraphic',
      matrixType: 'matrix',
      values: sepiaMatrix,
      result: 'sepia',
    },
  ]

  // Only add grain if grain amount > 0
  if (grain > 0) {
    primitives.push(
      {
        type: 'feTurbulence',
        turbulenceType: 'fractalNoise',
        baseFrequency: baseFrequency,
        numOctaves: 3,
        seed: 42,
        result: 'grain',
      },
      {
        type: 'feColorMatrix',
        in: 'grain',
        matrixType: 'saturate',
        values: 0,
        result: 'grainBW',
      },
      {
        type: 'feBlend',
        in: 'sepia',
        in2: 'grainBW',
        mode: 'soft-light',
        result: 'blended',
      },
      {
        type: 'feComposite',
        in: 'blended',
        in2: 'SourceGraphic',
        operator: 'in',
      }
    )
  }

  return primitives
}

function buildPopArtPrimitives(params: FilterPresetParams): FilterPrimitive[] {
  const saturation = (params.saturation ?? 250) / 100 // Convert from 100-400 to 1-4
  const levels = params.levels ?? 5

  const posterizeTable = buildPosterizeTable(levels)

  return [
    {
      type: 'feColorMatrix',
      in: 'SourceGraphic',
      matrixType: 'saturate',
      values: saturation,
      result: 'saturated',
    },
    {
      type: 'feComponentTransfer',
      in: 'saturated',
      funcR: { type: 'discrete', tableValues: posterizeTable },
      funcG: { type: 'discrete', tableValues: posterizeTable },
      funcB: { type: 'discrete', tableValues: posterizeTable },
    },
  ]
}

function buildPencilSketchPrimitives(params: FilterPresetParams): FilterPrimitive[] {
  const contrast = (params.contrast ?? 200) / 100 // Convert from 100-400 to 1-4

  const contrastMatrix = buildContrastMatrix(contrast)

  return [
    {
      type: 'feColorMatrix',
      in: 'SourceGraphic',
      matrixType: 'saturate',
      values: 0,
      result: 'gray',
    },
    {
      type: 'feColorMatrix',
      in: 'gray',
      matrixType: 'matrix',
      values: contrastMatrix,
    },
  ]
}
