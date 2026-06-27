/* eslint-disable max-lines */
/**
 * Path Filter Presets
 * SVG filter definitions for printing technique visualization on vector paths
 * Simulates leather and jewelry finishing effects using lighting filters
 */

import type { FilterPrimitive, DistantLight } from '../svg/types/effects'

// =============================================================================
// Types
// =============================================================================

/**
 * Definition for a single adjustable parameter within a path filter preset
 */
export interface PathFilterParameter {
  key: string
  labelKey: string
  type?: 'slider' | 'toggle'
  min: number
  max: number
  step: number
  defaultValue: number
  unit?: '%' | 'px' | '°' | ''
}

/**
 * Map of parameter values keyed by parameter key
 */
export type PathFilterPresetParams = Record<string, number>

/**
 * Options for building path filter primitives
 */
export type PathFilterBuildOptions = Record<string, never>

/**
 * Category of printing technique
 */
export type PathFilterCategory = 'leather' | 'jewelry'

/**
 * Definition for a complete path filter preset
 */
export interface PathFilterPreset {
  id: string
  name: string
  nameKey: string
  category: PathFilterCategory
  cssPreview: string
  primitives: FilterPrimitive[]
  parameters?: PathFilterParameter[]
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a distant light source
 */
function createDistantLight(azimuth: number, elevation: number): DistantLight {
  return { type: 'distantLight', azimuth, elevation }
}

// =============================================================================
// Leather Technique Presets
// =============================================================================

/**
 * Debossing - Pressed-in effect with realistic inner shadows
 * Simulates leather compression with:
 * - Inner shadow along top-left edges (light source from top-left)
 * - Subtle highlight along bottom-right edges
 * - Overall darkening to simulate compressed leather texture
 */
const debossingPreset: PathFilterPreset = {
  id: 'debossing',
  name: 'Debossing',
  nameKey: 'Debossing',
  category: 'leather',
  cssPreview: 'brightness(0.92) contrast(1.02)',
  parameters: [
    {
      key: 'depth',
      labelKey: 'Depth',
      min: 1,
      max: 12,
      step: 0.5,
      defaultValue: 3,
      unit: 'px',
    },
    {
      key: 'lightAngle',
      labelKey: 'Light Angle',
      min: 0,
      max: 360,
      step: 15,
      defaultValue: 315,
      unit: '°',
    },
    {
      key: 'softness',
      labelKey: 'Softness',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 40,
      unit: '%',
    },
    {
      key: 'edgeDistortion',
      labelKey: 'Edge distortion',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 10,
      unit: '%',
    },
  ],
  primitives: [], // Built dynamically
}

/**
 * Embossing - Raised effect with highlight and shadow
 * Creates realistic leather embossing with:
 * - Bright highlight on the edge facing the light
 * - Dark shadow on the edge away from light
 * - Subtle outer shadow cast onto surrounding leather
 * - Semi-transparent shape to reveal leather texture
 */
const embossingPreset: PathFilterPreset = {
  id: 'embossing',
  name: 'Embossing',
  nameKey: 'Embossing',
  category: 'leather',
  cssPreview: 'brightness(1.1) contrast(1.2)',
  parameters: [
    {
      key: 'height',
      labelKey: 'Height',
      min: 1,
      max: 12,
      step: 0.5,
      defaultValue: 3,
      unit: 'px',
    },
    {
      key: 'lightAngle',
      labelKey: 'Light Angle',
      min: 0,
      max: 360,
      step: 15,
      defaultValue: 315,
      unit: '°',
    },
    {
      key: 'softness',
      labelKey: 'Softness',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 40,
      unit: '%',
    },
    {
      key: 'edgeDistortion',
      labelKey: 'Edge distortion',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 10,
      unit: '%',
    },
  ],
  primitives: [], // Built dynamically
}

/**
 * Foil color options for hot foil stamping
 * Based on most common industry colors for leather and paper stamping
 * Each color has: base (dark/shadow), mid (main color), highlight (bright)
 *
 * @see https://www.hotstampjax.com/metallic-foil-color-chart/
 * @see https://printpeppermint.com/products/hot-foil-stamping-colors-samples
 */
export const FOIL_COLORS = {
  // Classic metallics (most popular)
  0: { name: 'Gold', base: '#B8860B', mid: '#DAA520', highlight: '#FFD700' },
  1: { name: 'Silver', base: '#808080', mid: '#C0C0C0', highlight: '#E8E8E8' },
  2: { name: 'Rose Gold', base: '#B76E79', mid: '#E0A8AD', highlight: '#F5D0C5' },
  // Warm metallics
  3: { name: 'Copper', base: '#8B4513', mid: '#B87333', highlight: '#DA8A67' },
  4: { name: 'Bronze', base: '#5C4033', mid: '#CD7F32', highlight: '#E6BE8A' },
  // Non-metallic pigment foils
  5: { name: 'Black', base: '#000000', mid: '#1A1A1A', highlight: '#4A4A4A' },
  6: { name: 'White', base: '#D0D0D0', mid: '#F5F5F5', highlight: '#FFFFFF' },
} as const

export type FoilColorId = keyof typeof FOIL_COLORS

/**
 * Metal surface colors for jewelry techniques (Diamond Drag, etc.)
 * These represent the actual metal surface that the engraving sits on.
 * The engraving effect brightens/modifies these colors to simulate cut facets.
 *
 * Color values based on real jewelry photography:
 * - base: Darkest shade (shadows, groove interior)
 * - mid: Main surface color
 * - highlight: Brightest reflection points
 */
export const METAL_SURFACE_COLORS = {
  0: { name: 'Gold', base: '#B8860B', mid: '#DAA520', highlight: '#FFD700' },
  1: { name: 'Silver', base: '#808080', mid: '#C0C0C0', highlight: '#E8E8E8' },
  2: { name: 'Rose Gold', base: '#B76E79', mid: '#E0A8AD', highlight: '#F5D0C5' },
  3: { name: 'Platinum', base: '#A0A0A0', mid: '#D4D4D4', highlight: '#F0F0F0' },
  4: { name: 'Brass', base: '#8B7355', mid: '#C9A961', highlight: '#E6D7A3' },
  5: { name: 'Copper', base: '#8B4513', mid: '#B87333', highlight: '#DA8A67' },
} as const

export type MetalSurfaceColorId = keyof typeof METAL_SURFACE_COLORS

/**
 * Hot Foil Stamping - Metallic foil with pressed-in deboss effect
 *
 * Based on real-world reference images, hot foil stamping combines:
 * 1. PRESSED-IN DEPTH - foil is stamped INTO the leather creating a depression
 * 2. SOLID METALLIC FILL - flat, opaque metallic color
 * 3. INNER EDGE SHADOWS - shadow on edge away from light (inside the depression)
 * 4. INNER EDGE HIGHLIGHTS - light catching edge toward light source
 * 5. OUTER RIM EFFECTS - leather lip catching light around the stamped area
 */
const hotFoilStampingPreset: PathFilterPreset = {
  id: 'hot-foil-stamping',
  name: 'Hot Foil Stamping',
  nameKey: 'Hot Foil Stamping',
  category: 'leather',
  cssPreview: 'brightness(1.3) sepia(0.3) saturate(1.5)',
  parameters: [
    // Filter-specific parameter
    {
      key: 'foilColor',
      labelKey: 'Foil Color',
      type: 'slider',
      min: 0,
      max: 6,
      step: 1,
      defaultValue: 0, // 0 = Gold (default)
      unit: '',
    },
    // Common parameters (synchronized with Debossing/Embossing)
    {
      key: 'depth',
      labelKey: 'Depth',
      min: 1,
      max: 12,
      step: 0.5,
      defaultValue: 3,
      unit: 'px',
    },
    {
      key: 'lightAngle',
      labelKey: 'Light Angle',
      min: 0,
      max: 360,
      step: 15,
      defaultValue: 315,
      unit: '°',
    },
    {
      key: 'softness',
      labelKey: 'Softness',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 40,
      unit: '%',
    },
    {
      key: 'metallicShine',
      labelKey: 'Metallic Shine',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 50,
      unit: '%',
    },
    {
      key: 'edgeDistortion',
      labelKey: 'Edge distortion',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 10,
      unit: '%',
    },
  ],
  primitives: [], // Built dynamically
}

/**
 * Laser Engraving - Burned/etched appearance on leather
 *
 * Based on real-world laser engraving reference images analysis:
 * - FLAT COLOR CHANGE: Laser engraving is primarily a color change, NOT a physical depression
 * - RAZOR-SHARP EDGES: Clean, crisp boundaries with no blur or feathering
 * - BURNT BROWN COLOR: Ranges from medium brown (light burn) to near-black (intense burn)
 * - CUT-OUT ILLUSION: At high intensity, appears like a stencil/void due to extreme contrast
 * - MATTE FINISH: No glossy highlights, contrasts with leather's natural sheen
 * - UNIFORM COLORING: Solid, consistent color within engraved areas
 *
 * Key insight: The "razor-sharp edge similar to a cut-out" effect comes from
 * extreme COLOR CONTRAST against the base leather, not from shadow/depth effects.
 */
const laserEngravingPreset: PathFilterPreset = {
  id: 'laser-engraving',
  name: 'Laser Engraving',
  nameKey: 'Laser Engraving',
  category: 'leather',
  cssPreview: 'sepia(0.6) brightness(0.4) contrast(1.2) saturate(0.9)',
  parameters: [
    {
      key: 'burnIntensity',
      labelKey: 'Burn Intensity',
      min: 20,
      max: 100,
      step: 5,
      defaultValue: 40,
      unit: '%',
    },
    {
      key: 'depth',
      labelKey: 'Depth',
      min: 0,
      max: 12,
      step: 0.5,
      defaultValue: 3, // Increased for more visible cut-in effect
      unit: 'px',
    },
  ],
  primitives: [], // Built dynamically
}

// =============================================================================
// Jewelry/Metal Technique Presets
// =============================================================================

/**
 * Diamond Drag - Sharp V-groove engraving on metal surfaces
 *
 * Based on analysis of 11 real-world reference images:
 *
 * Key visual characteristics:
 * 1. BRIGHT REFLECTIVE LINES - Engraved V-groove cuts appear significantly
 *    brighter than surrounding metal due to facets catching/reflecting light
 * 2. SHARP CRISP EDGES - Very precise line boundaries with minimal blur
 * 3. THIN PRECISE LINES - Real diamond drag creates fine V-groove scratches
 * 4. PARALLEL HATCHING - Often used to fill areas (not solid fills)
 * 5. HIGH SPECULARITY - The polished V-groove facets create bright sparkle
 *
 * Reference observations by metal type:
 * - Gold/Brass (images 1-3): Warm golden highlights, high contrast
 * - Silver/Platinum (images 5, 9): Cool bright lines, subtle depth
 * - Coated metals (image 7): Engraving reveals bright metal under coating
 * - Rose Gold (image 10): Can appear slightly matte on polished surfaces
 *
 * The filter simulates the V-groove by:
 * - Creating a bright base from the selected metal highlight color
 * - Adding directional inner bevel (highlight + shadow) for V-groove effect
 * - Using feMorphology erode to thin strokes to realistic widths
 */
/**
 * Diamond Drag - Realistic V-groove scratch engraving on metal jewelry
 *
 * Diamond drag engraving creates fine scratches by dragging a diamond-tipped
 * tool across the metal surface. The result is bright, reflective V-grooves.
 *
 * Key visual characteristics:
 * 1. BRIGHT REFLECTIVE LINES - V-grooves catch and reflect light
 * 2. SLIGHT LINE WOBBLE - Natural hand-guided or machine vibration artifacts
 * 3. V-GROOVE DEPTH - Creates shadow on one side, highlight on other
 * 4. PRESERVES STROKE COLOR - User picks color to match their jewelry metal
 */
const diamondDragPreset: PathFilterPreset = {
  id: 'diamond-drag',
  name: 'Diamond Drag',
  nameKey: 'Diamond Drag',
  category: 'jewelry',
  cssPreview: 'brightness(1.6) contrast(1.5)',
  parameters: [
    {
      key: 'lineWidth',
      labelKey: 'Line width',
      min: 0,
      max: 3,
      step: 0.5,
      defaultValue: 3, // Default: preserve original stroke width (no erosion)
      unit: 'px',
    },
    {
      key: 'depth',
      labelKey: 'Depth',
      min: 0,
      max: 2,
      step: 0.1,
      defaultValue: 0.4, // V-groove depth effect
      unit: 'px',
    },
    {
      key: 'lightAngle',
      labelKey: 'Light angle',
      min: 0,
      max: 360,
      step: 15,
      defaultValue: 315,
      unit: '°',
    },
    {
      key: 'lineWobble',
      labelKey: 'Line wobble',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 10,
      unit: '%',
    },
  ],
  primitives: [], // Built dynamically
}

/**
 * Laser Annealing - Dark matte oxidation mark on metal
 *
 * Based on real-world reference images analysis:
 *
 * Key visual characteristics:
 * 1. FLAT SURFACE - No depth or depression, oxide layer sits flush on metal
 * 2. MATTE FINISH - No glossy or reflective qualities, contrasts with shiny metal
 * 3. DARK GRAY/CHARCOAL COLOR - Ranges from medium gray to near-black
 * 4. WARM OR COOL TONES - Can be neutral gray, warm charcoal, or cool blue-gray
 * 5. SHARP CRISP EDGES - Clean boundaries from precision laser heating
 * 6. UNIFORM COLOR - Consistent within marked areas (no gradients)
 *
 * Reference observations:
 * - Heat mark on stainless (ref 1): Flat dark gray, very matte
 * - WYSS COOKING (ref 4): Dark charcoal on brushed steel, completely flat
 * - Memorial plaque (ref 5-6): Dark brown-black to charcoal, crisp edges
 * - Titanium rings (ref 2): Can reveal lighter metal under dark coating
 * - Gold rings (ref 3): Very dark/black marks on polished gold
 *
 * Implementation approach:
 * - Solid flat color fill (no 3D lighting effects)
 * - Color ranges from medium gray to near-black based on darkness
 * - Warmth parameter adds brown/charcoal tones vs cool gray
 * - No shadows or highlights (perfectly flat on surface)
 */
/**
 * Laser Annealing - Realistic heat-oxidized surface marking on metal
 *
 * Based on real-world laser annealing process:
 * - Creates oxidized discoloration through controlled heating
 * - Surface texture from oxide formation (marble-like patterns)
 * - Subtle heat distortion/waviness from thermal effects
 * - Dark oxide coloring with warm/cool temperature variations
 *
 * Key visual characteristics:
 * 1. OXIDE TEXTURE - Subtle noisy, marble-like surface oxidation patterns
 * 2. HEAT DISTORTION - Slight waviness/ripple from thermal effects
 * 3. DARK OXIDE COLOR - Ranges from cool gray to warm charcoal/brown
 * 4. HEAT GLOW - Subtle blur effect simulating residual heat
 * 5. NON-UNIFORM - Slight color variations, not perfectly flat
 */
const laserAnnealingPreset: PathFilterPreset = {
  id: 'laser-annealing',
  name: 'Laser Annealing',
  nameKey: 'Laser Annealing',
  category: 'jewelry',
  cssPreview: 'brightness(0.25) contrast(1.1) saturate(0.3)',
  parameters: [
    {
      key: 'darkness',
      labelKey: 'Darkness',
      min: 20,
      max: 100,
      step: 5,
      defaultValue: 50,
      unit: '%',
    },
    {
      key: 'warmth',
      labelKey: 'Warmth',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 50,
      unit: '%',
    },
    {
      key: 'oxideTexture',
      labelKey: 'Oxide texture',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 40,
      unit: '%',
    },
    {
      key: 'heatDistortion',
      labelKey: 'Heat distortion',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 10,
      unit: '%',
    },
  ],
  primitives: [], // Built dynamically
}

/**
 * Deep Laser Engraving - Realistic engraved appearance on metal jewelry
 *
 * Based on real-world reference images analysis:
 *
 * Key visual characteristics:
 * 1. SOLID FILL COLOR - Engraved areas are filled with darker oxidized metal color
 * 2. COLOR VARIES BY METAL - Gold shows bronze/brown, silver shows gray tones
 * 3. SHARP CLEAN EDGES - Precise boundaries from laser precision
 * 4. MATTE FINISH - Engraved areas are matte vs. polished surrounding metal
 * 5. SUBTLE DEPTH - Minimal shadow effect, depth shown through color contrast
 * 6. NO HARSH BLACK - Color is dark but relates to underlying metal tone
 *
 * Reference observations:
 * - Gold coins (ref 1): Dark bronze/brown fill (#4A3728 to #6B5344)
 * - Gold rings (ref 2, 5): Darker golden-brown, not pure black
 * - Signet rings (ref 3): Dark charcoal for detailed designs
 * - Silver/gold rings (ref 4): Gray on silver, brown on gold
 * - Silver pendant (ref 6): Medium-dark gray on silver
 *
 * Implementation:
 * - User adjusts `darkness` and `warmth` to match their jewelry metal
 * - Warmth 0% = cool gray (for silver/stainless)
 * - Warmth 100% = warm bronze (for gold/brass)
 * - Works for both stroked and filled shapes
 */
const deepLaserEngravingPreset: PathFilterPreset = {
  id: 'deep-laser-engraving',
  name: 'Deep Laser Engraving',
  nameKey: 'Deep Laser Engraving',
  category: 'jewelry',
  cssPreview: 'brightness(0.35) contrast(1.2) sepia(0.15)',
  parameters: [
    {
      key: 'darkness',
      labelKey: 'Darkness',
      min: 40,
      max: 100,
      step: 5,
      defaultValue: 50,
      unit: '%',
    },
    {
      key: 'warmth',
      labelKey: 'Warmth',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 50,
      unit: '%',
    },
    {
      key: 'depth',
      labelKey: 'Depth',
      min: 0,
      max: 3,
      step: 0.25,
      defaultValue: 1, // Similar scale to Diamond Drag
      unit: 'px',
    },
    {
      key: 'depthGradient',
      labelKey: 'Depth gradient',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 30,
      unit: '%',
    },
    {
      key: 'burnTexture',
      labelKey: 'Burn texture',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 40,
      unit: '%',
    },
    {
      key: 'edgeDistortion',
      labelKey: 'Edge distortion',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 10,
      unit: '%',
    },
  ],
  primitives: [], // Built dynamically
}

/**
 * Enamel Fill - Glossy, glass-like colored fill simulating jewelry enamel
 *
 * Based on real-world enamel characteristics:
 * - Preserves original shape fill color (vibrant, saturated)
 * - Glass-like glossy surface with soft spread reflections
 * - Slightly recessed appearance with subtle edge darkening (champlevé effect)
 * - Smooth, uniform color with optional saturation boost
 */
const enamelFillPreset: PathFilterPreset = {
  id: 'enamel-fill',
  name: 'Enamel Fill',
  nameKey: 'Enamel Fill',
  category: 'jewelry',
  cssPreview: 'brightness(1.1) saturate(1.3)',
  parameters: [
    {
      key: 'gloss',
      labelKey: 'Gloss',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 60,
      unit: '%',
    },
    {
      key: 'saturation',
      labelKey: 'Saturation',
      min: 80,
      max: 150,
      step: 5,
      defaultValue: 120,
      unit: '%',
    },
    {
      key: 'recess',
      labelKey: 'Recess',
      min: 0,
      max: 100,
      step: 5,
      defaultValue: 30,
      unit: '%',
    },
  ],
  primitives: [], // Built dynamically
}

// =============================================================================
// Preset Collections
// =============================================================================

/**
 * All available path filter presets
 */
export const PATH_FILTER_PRESETS: PathFilterPreset[] = [
  // Leather techniques
  debossingPreset,
  embossingPreset,
  hotFoilStampingPreset,
  laserEngravingPreset,
  // Jewelry techniques
  diamondDragPreset,
  laserAnnealingPreset,
  deepLaserEngravingPreset,
  enamelFillPreset,
]

/**
 * Presets grouped by category
 */
export const PATH_FILTER_PRESETS_BY_CATEGORY: Record<PathFilterCategory, PathFilterPreset[]> = {
  leather: PATH_FILTER_PRESETS.filter(p => p.category === 'leather'),
  jewelry: PATH_FILTER_PRESETS.filter(p => p.category === 'jewelry'),
}

/**
 * Filter presets that always override the target shape's fill/stroke colors
 * with computed colors (e.g., metallic foil colors, burnt leather tones).
 *
 * When these filters are applied, the user can no longer change the shape's
 * fill/stroke colors - the filter controls the appearance instead.
 */
export const COLOR_OVERRIDING_FILTER_IDS = [
  'hot-foil-stamping', // Uses FOIL_COLORS lookup (Gold, Silver, etc.)
  'laser-engraving', // Computes burnt brown color from burnIntensity
  'laser-annealing', // Computes oxide color from darkness + warmth
  'deep-laser-engraving', // Computes engraving color from darkness + warmth
] as const

/**
 * Get a path filter preset by ID
 */
export function getPathFilterPresetById(id: string): PathFilterPreset | undefined {
  return PATH_FILTER_PRESETS.find(p => p.id === id)
}

/**
 * Get default parameter values for a preset
 */
export function getPathFilterDefaultParams(preset: PathFilterPreset): PathFilterPresetParams {
  const params: PathFilterPresetParams = {}
  if (preset.parameters) {
    for (const param of preset.parameters) {
      params[param.key] = param.defaultValue
    }
  }
  return params
}

/**
 * Build filter primitives with custom parameter values
 * @param preset - The filter preset to build
 * @param params - Optional parameter values
 */
export function buildPathFilterPrimitives(
  preset: PathFilterPreset,
  params?: PathFilterPresetParams
): FilterPrimitive[] {
  const effectiveParams = params ?? getPathFilterDefaultParams(preset)

  switch (preset.id) {
    case 'debossing':
      return buildDebossingPrimitives(effectiveParams)
    case 'embossing':
      return buildEmbossingPrimitives(effectiveParams)
    case 'hot-foil-stamping':
      return buildHotFoilStampingPrimitives(effectiveParams)
    case 'laser-engraving':
      return buildLaserEngravingPrimitives(effectiveParams)
    case 'diamond-drag':
      return buildDiamondDragPrimitives(effectiveParams)
    case 'laser-annealing':
      return buildLaserAnnealingPrimitives(effectiveParams)
    case 'deep-laser-engraving':
      return buildDeepLaserEngravingPrimitives(effectiveParams)
    case 'enamel-fill':
      return buildEnamelFillPrimitives(effectiveParams)
    default:
      return preset.primitives
  }
}

/**
 * Build CSS preview filter string with custom parameter values
 */
export function buildPathFilterCssPreview(preset: PathFilterPreset, params?: PathFilterPresetParams): string {
  const effectiveParams = params ?? getPathFilterDefaultParams(preset)

  switch (preset.id) {
    case 'debossing': {
      const depth = effectiveParams.depth ?? 5
      // Simulate darkening and subtle brownish tint of compressed leather
      const brightness = 0.88 - depth * 0.015
      return `brightness(${brightness.toFixed(2)}) contrast(1.05) sepia(0.1)`
    }
    case 'embossing': {
      const height = effectiveParams.height ?? 4
      const brightness = 1 + height * 0.02
      return `brightness(${brightness}) contrast(1.2)`
    }
    case 'hot-foil-stamping': {
      const foilColorId = (effectiveParams.foilColor ?? 0) as FoilColorId
      const isGold = foilColorId === 0
      const sepia = isGold ? 0.3 : 0 // Gold has sepia tint
      return `brightness(1.2) sepia(${sepia}) saturate(${isGold ? 1.5 : 1.0})`
    }
    case 'laser-engraving': {
      // CSS preview for laser engraving - flat burnt brown appearance
      // At high burn intensity, approaches near-black for cut-out effect
      const burn = (effectiveParams.burnIntensity ?? 60) / 100
      // Darker brightness at higher burn, slight sepia for brown tone
      return `sepia(${0.7 - burn * 0.3}) brightness(${0.5 - burn * 0.35}) contrast(${1.15 + burn * 0.15}) saturate(${0.9 - burn * 0.2})`
    }
    case 'diamond-drag':
      // CSS preview for diamond drag - bright, high contrast metallic appearance
      return 'brightness(1.6) contrast(1.5)'
    case 'laser-annealing': {
      const darkness = (effectiveParams.darkness ?? 80) / 100
      const warmth = (effectiveParams.warmth ?? 20) / 100
      const oxideTexture = (effectiveParams.oxideTexture ?? 40) / 100
      // Darker with higher darkness, slight sepia for warmth
      const brightness = 0.6 - darkness * 0.45 // 0.6 -> 0.15
      const sepia = warmth * 0.3 // 0 -> 0.3 for warm tones
      const saturate = 0.2 + warmth * 0.3 // Low saturation, slightly more when warm
      // Add slight contrast boost for texture visibility
      const contrast = 1.1 + oxideTexture * 0.15 // 1.1 -> 1.25
      return `brightness(${brightness.toFixed(2)}) contrast(${contrast.toFixed(2)}) sepia(${sepia.toFixed(2)}) saturate(${saturate.toFixed(2)})`
    }
    case 'deep-laser-engraving': {
      // CSS preview for deep laser engraving
      // Simulates the dark engraved appearance with warmth-based color shift
      const darkness = (effectiveParams.darkness ?? 75) / 100
      const warmth = (effectiveParams.warmth ?? 50) / 100
      // Darker brightness at higher darkness
      const brightness = 0.55 - darkness * 0.35 // 0.55 -> 0.2
      // Sepia adds warmth (bronze tones for gold), less sepia for silver
      const sepia = warmth * 0.4 // 0 -> 0.4
      // Slightly desaturate for matte appearance
      const saturate = 0.6 + warmth * 0.3 // 0.6 -> 0.9
      return `brightness(${brightness.toFixed(2)}) contrast(1.15) sepia(${sepia.toFixed(2)}) saturate(${saturate.toFixed(2)})`
    }
    case 'enamel-fill': {
      const gloss = (effectiveParams.gloss ?? 70) / 100
      return `brightness(${1 + gloss * 0.15}) saturate(${1.1 + gloss * 0.3})`
    }
    default:
      return preset.cssPreview
  }
}

// =============================================================================
// Dynamic Primitive Builders
// =============================================================================

function buildDebossingPrimitives(params: PathFilterPresetParams): FilterPrimitive[] {
  const depth = params.depth ?? 5
  const lightAngle = params.lightAngle ?? 315
  const softness = (params.softness ?? 50) / 100 // 0-1 range
  const edgeDistortion = (params.edgeDistortion ?? 0) / 100 // 0-1 range
  // Internal parameter: 1 = fill-only shape, 0 = has stroke (default behavior)
  const isFillOnly = params._isFillOnly === 1

  // For fill-only shapes, use a completely different approach that:
  // 1. Makes interior nearly transparent (shows leather background through)
  // 2. Places shadow on light-facing INNER edge (looking INTO the depression)
  // 3. Places highlight on shadow-facing INNER edge (reflected light from depression bottom)
  if (isFillOnly) {
    return buildDebossingPrimitivesForFill(depth, lightAngle, softness, edgeDistortion)
  }

  // === STROKE-ONLY / DEFAULT PATH ===
  // Realistic leather debossing based on real-world reference images:
  // Key characteristics observed:
  // 1. FLAT interior - uniformly darkened, not bowl-shaped
  // 2. DEFINED edges - abrupt transition at boundary (vertical sidewalls)
  // 3. DIRECTIONAL shadow - concentrated on ONE edge (shadow side only)
  // 4. CRISP highlight - thin bright line on light-facing lip
  // 5. Subtle outer shadow cast onto surrounding leather
  // 6. EDGE DISTORTION - subtle organic edge variation (optional)

  const angleRad = (lightAngle * Math.PI) / 180

  // === SHADOW CALCULATIONS ===
  // Main edge shadow - concentrated on shadow-side edge only
  // This creates the "wall" illusion of the pressed area
  const edgeShadowDx = -Math.cos(angleRad) * depth * 0.7
  const edgeShadowDy = Math.sin(angleRad) * depth * 0.7
  // Softness controls blur: 0% = crisp/sharp edges, 100% = soft/diffused edges
  const edgeShadowBlur = Math.max(depth * 0.2, 0.5) + softness * depth * 0.5

  // Secondary softer shadow for depth gradation on shadow side
  const softShadowDx = -Math.cos(angleRad) * depth * 0.4
  const softShadowDy = Math.sin(angleRad) * depth * 0.4
  const softShadowBlur = Math.max(depth * 0.3, 0.8) + softness * depth * 0.6

  // === OUTER SHADOW (cast onto surrounding leather) ===
  const outerShadowDx = -Math.cos(angleRad) * depth * 0.3
  const outerShadowDy = Math.sin(angleRad) * depth * 0.3
  const outerShadowBlur = Math.max(depth * 0.3, 0.8) + softness * depth * 0.5

  // === HIGHLIGHT CALCULATIONS ===
  // Crisp rim highlight - thin line on light-facing edge
  const rimHighlightDx = Math.cos(angleRad) * depth * 0.4
  const rimHighlightDy = -Math.sin(angleRad) * depth * 0.4
  const rimHighlightBlur = Math.max(depth * 0.15, 0.4) + softness * depth * 0.4

  // Inner edge highlight - subtle light catching inner lip
  const innerHighlightDx = Math.cos(angleRad) * depth * 0.25
  const innerHighlightDy = -Math.sin(angleRad) * depth * 0.25
  const innerHighlightBlur = Math.max(depth * 0.1, 0.3) + softness * depth * 0.35

  const primitives: FilterPrimitive[] = []

  // === EDGE DISTORTION (organic edge variation using feDisplacementMap) ===
  if (edgeDistortion > 0) {
    const displacementFrequency = 0.05 + edgeDistortion * 0.1

    primitives.push(
      {
        type: 'feTurbulence',
        turbulenceType: 'turbulence',
        baseFrequency: displacementFrequency,
        numOctaves: 1,
        seed: 123,
        result: 'edgeNoise',
      },
      {
        type: 'feDisplacementMap',
        in: 'SourceGraphic',
        in2: 'edgeNoise',
        scale: edgeDistortion * 4,
        xChannelSelector: 'R',
        yChannelSelector: 'G',
        result: 'distortedSource',
      },
      {
        type: 'feDisplacementMap',
        in: 'SourceAlpha',
        in2: 'edgeNoise',
        scale: edgeDistortion * 4,
        xChannelSelector: 'R',
        yChannelSelector: 'G',
        result: 'distortedAlpha',
      }
    )
  }

  const alphaInput = edgeDistortion > 0 ? 'distortedAlpha' : 'SourceAlpha'

  // === OUTER SHADOW (cast onto surrounding leather) ===
  primitives.push(
    { type: 'feOffset', in: alphaInput, dx: outerShadowDx, dy: outerShadowDy, result: 'outerShadowOffset' },
    { type: 'feGaussianBlur', in: 'outerShadowOffset', stdDeviation: outerShadowBlur, result: 'outerShadowBlur' },
    { type: 'feComposite', in: 'outerShadowBlur', in2: alphaInput, operator: 'out', result: 'outerShadowClipped' },
    { type: 'feFlood', floodColor: '#000000', floodOpacity: 0.12 + depth * 0.015, result: 'outerShadowColor' },
    { type: 'feComposite', in: 'outerShadowColor', in2: 'outerShadowClipped', operator: 'in', result: 'outerShadow' }
  )

  // === MAIN EDGE SHADOW ===
  primitives.push(
    { type: 'feOffset', in: alphaInput, dx: edgeShadowDx, dy: edgeShadowDy, result: 'edgeOffset' },
    { type: 'feGaussianBlur', in: 'edgeOffset', stdDeviation: edgeShadowBlur, result: 'edgeBlur' },
    { type: 'feComposite', in: 'edgeBlur', in2: alphaInput, operator: 'in', result: 'edgeClipped' },
    { type: 'feFlood', floodColor: '#000000', floodOpacity: 0.35 + depth * 0.03, result: 'edgeColor' },
    { type: 'feComposite', in: 'edgeColor', in2: 'edgeClipped', operator: 'in', result: 'edgeShadow' }
  )

  // === SOFT SHADOW ===
  primitives.push(
    { type: 'feOffset', in: alphaInput, dx: softShadowDx, dy: softShadowDy, result: 'softOffset' },
    { type: 'feGaussianBlur', in: 'softOffset', stdDeviation: softShadowBlur, result: 'softBlur' },
    { type: 'feComposite', in: 'softBlur', in2: alphaInput, operator: 'in', result: 'softClipped' },
    { type: 'feFlood', floodColor: '#000000', floodOpacity: 0.18 + depth * 0.02, result: 'softColor' },
    { type: 'feComposite', in: 'softColor', in2: 'softClipped', operator: 'in', result: 'softShadow' }
  )

  // === CRISP RIM HIGHLIGHT ===
  primitives.push(
    { type: 'feOffset', in: alphaInput, dx: rimHighlightDx, dy: rimHighlightDy, result: 'rimOffset' },
    { type: 'feGaussianBlur', in: 'rimOffset', stdDeviation: rimHighlightBlur, result: 'rimBlur' },
    { type: 'feComposite', in: 'rimBlur', in2: alphaInput, operator: 'out', result: 'rimOuter' },
    { type: 'feFlood', floodColor: '#ffffff', floodOpacity: 0.28 + depth * 0.03, result: 'rimColor' },
    { type: 'feComposite', in: 'rimColor', in2: 'rimOuter', operator: 'in', result: 'rimHighlight' }
  )

  // === INNER HIGHLIGHT ===
  primitives.push(
    { type: 'feOffset', in: alphaInput, dx: innerHighlightDx, dy: innerHighlightDy, result: 'innerHighlightOffset' },
    {
      type: 'feGaussianBlur',
      in: 'innerHighlightOffset',
      stdDeviation: innerHighlightBlur,
      result: 'innerHighlightBlur',
    },
    { type: 'feComposite', in: 'innerHighlightBlur', in2: alphaInput, operator: 'in', result: 'innerHighlightClipped' },
    { type: 'feFlood', floodColor: '#ffffff', floodOpacity: 0.15, result: 'innerHighlightColor' },
    {
      type: 'feComposite',
      in: 'innerHighlightColor',
      in2: 'innerHighlightClipped',
      operator: 'in',
      result: 'innerHighlight',
    }
  )

  // === COMBINE ALL LAYERS ===
  // Layer order (bottom to top):
  // 1. outerShadow - shadow cast on surrounding leather
  // 2. rimHighlight - bright highlight on outer rim (light-facing edge)
  // 3. SourceGraphic - the stroke with user's color (should match leather for best effect)
  // 4. softShadow + edgeShadow - shadows on inner edges
  // 5. innerHighlight - subtle highlight on inner edge
  primitives.push({
    type: 'feMerge',
    nodes: [
      { in: 'outerShadow' },
      { in: 'rimHighlight' },
      { in: edgeDistortion > 0 ? 'distortedSource' : 'SourceGraphic' },
      { in: 'softShadow' },
      { in: 'edgeShadow' },
      { in: 'innerHighlight' },
    ],
  })

  return primitives
}

/**
 * Build debossing primitives specifically for fill-only shapes.
 * Creates a "pressed-in" effect that shows the leather background through the shape
 * with proper inset shadows on the light-facing edge.
 */
function buildDebossingPrimitivesForFill(
  depth: number,
  lightAngle: number,
  softness: number,
  edgeDistortion: number
): FilterPrimitive[] {
  const angleRad = (lightAngle * Math.PI) / 180

  // For fill-only shapes, the fill is set to 'none' by FiltersSection.tsx
  // so the leather background shows through naturally. This filter only adds
  // edge shadows and highlights to create the pressed-in illusion.
  //
  // Shadow appears on the LIGHT-FACING inner edge (top-left at 315°)
  // because the "cliff" edge blocks light and casts shadow into the depression.
  // Highlight appears on the SHADOW-FACING inner edge (bottom-right)
  // from ambient light hitting the far wall of the depression.

  // Softness adds blur but shouldn't dilute the shadow intensity too much
  // Keep blur moderate so the pressed-in effect remains visible
  const blurMultiplier = 1 + softness * 0.6

  // === INSET SHADOW (light-facing inner edge) ===
  // Strong offset towards light source creates visible shadow on that edge
  const insetShadowDx = -Math.cos(angleRad) * depth * 1.3
  const insetShadowDy = Math.sin(angleRad) * depth * 1.3
  const insetShadowBlur = Math.max(depth * 0.35, 0.8) * blurMultiplier

  // Secondary softer shadow for depth gradation (wider spread)
  const softInsetDx = -Math.cos(angleRad) * depth * 0.8
  const softInsetDy = Math.sin(angleRad) * depth * 0.8
  const softInsetBlur = Math.max(depth * 0.6, 1.2) * blurMultiplier

  // === INNER HIGHLIGHT (shadow-facing inner edge) ===
  // Offset away from light source, creates highlight on opposite edge
  const innerHighlightDx = Math.cos(angleRad) * depth * 0.8
  const innerHighlightDy = -Math.sin(angleRad) * depth * 0.8
  const innerHighlightBlur = Math.max(depth * 0.3, 0.6) * blurMultiplier

  // === OUTER RIM SHADOW (subtle shadow cast on surrounding leather) ===
  const outerShadowDx = -Math.cos(angleRad) * depth * 0.25
  const outerShadowDy = Math.sin(angleRad) * depth * 0.25
  const outerShadowBlur = Math.max(depth * 0.35, 0.8) * blurMultiplier

  const primitives: FilterPrimitive[] = []

  // === EDGE DISTORTION (organic leather edge variation) ===
  if (edgeDistortion > 0) {
    const displacementFrequency = 0.04 + edgeDistortion * 0.08
    primitives.push(
      {
        type: 'feTurbulence',
        turbulenceType: 'turbulence',
        baseFrequency: displacementFrequency,
        numOctaves: 2,
        seed: 123,
        result: 'edgeNoise',
      },
      {
        type: 'feDisplacementMap',
        in: 'SourceAlpha',
        in2: 'edgeNoise',
        scale: edgeDistortion * 3,
        xChannelSelector: 'R',
        yChannelSelector: 'G',
        result: 'distortedAlpha',
      }
    )
  }

  const alphaInput = edgeDistortion > 0 ? 'distortedAlpha' : 'SourceAlpha'

  // === MAIN INSET SHADOW (dark shadow on light-facing edge) ===
  primitives.push(
    { type: 'feOffset', in: alphaInput, dx: insetShadowDx, dy: insetShadowDy, result: 'insetOffset' },
    { type: 'feGaussianBlur', in: 'insetOffset', stdDeviation: insetShadowBlur, result: 'insetBlur' },
    { type: 'feComposite', in: 'insetBlur', in2: alphaInput, operator: 'in', result: 'insetClipped' },
    { type: 'feFlood', floodColor: '#000000', floodOpacity: 0.55 + depth * 0.04, result: 'insetColor' },
    { type: 'feComposite', in: 'insetColor', in2: 'insetClipped', operator: 'in', result: 'insetShadow' }
  )

  // === SOFT INSET SHADOW (depth gradation - wider, softer) ===
  primitives.push(
    { type: 'feOffset', in: alphaInput, dx: softInsetDx, dy: softInsetDy, result: 'softInsetOffset' },
    { type: 'feGaussianBlur', in: 'softInsetOffset', stdDeviation: softInsetBlur, result: 'softInsetBlur' },
    { type: 'feComposite', in: 'softInsetBlur', in2: alphaInput, operator: 'in', result: 'softInsetClipped' },
    { type: 'feFlood', floodColor: '#000000', floodOpacity: 0.3 + depth * 0.025, result: 'softInsetColor' },
    { type: 'feComposite', in: 'softInsetColor', in2: 'softInsetClipped', operator: 'in', result: 'softInsetShadow' }
  )

  // === INNER HIGHLIGHT (reflected light on opposite edge) ===
  primitives.push(
    { type: 'feOffset', in: alphaInput, dx: innerHighlightDx, dy: innerHighlightDy, result: 'innerHLOffset' },
    { type: 'feGaussianBlur', in: 'innerHLOffset', stdDeviation: innerHighlightBlur, result: 'innerHLBlur' },
    { type: 'feComposite', in: 'innerHLBlur', in2: alphaInput, operator: 'in', result: 'innerHLClipped' },
    { type: 'feFlood', floodColor: '#ffffff', floodOpacity: 0.18 + depth * 0.02, result: 'innerHLColor' },
    { type: 'feComposite', in: 'innerHLColor', in2: 'innerHLClipped', operator: 'in', result: 'innerHL' }
  )

  // === OUTER SHADOW (cast on surrounding leather) ===
  primitives.push(
    { type: 'feOffset', in: alphaInput, dx: outerShadowDx, dy: outerShadowDy, result: 'outerShadowOffset' },
    { type: 'feGaussianBlur', in: 'outerShadowOffset', stdDeviation: outerShadowBlur, result: 'outerShadowBlur' },
    { type: 'feComposite', in: 'outerShadowBlur', in2: alphaInput, operator: 'out', result: 'outerShadowClipped' },
    { type: 'feFlood', floodColor: '#000000', floodOpacity: 0.12 + depth * 0.015, result: 'outerShadowColor' },
    { type: 'feComposite', in: 'outerShadowColor', in2: 'outerShadowClipped', operator: 'in', result: 'outerShadow' }
  )

  // === COMBINE ALL LAYERS ===
  // Layer order (bottom to top):
  // 1. outerShadow - subtle shadow cast on surrounding leather
  // 2. SourceGraphic - the shape with user's fill color (should match leather)
  // 3. softInsetShadow + insetShadow - shadows on light-facing inner edge
  // 4. innerHL - highlight on shadow-facing inner edge
  primitives.push({
    type: 'feMerge',
    nodes: [
      { in: 'outerShadow' },
      { in: 'SourceGraphic' },
      { in: 'softInsetShadow' },
      { in: 'insetShadow' },
      { in: 'innerHL' },
    ],
  })

  return primitives
}

function buildEmbossingPrimitives(params: PathFilterPresetParams): FilterPrimitive[] {
  const height = params.height ?? 5
  const lightAngle = params.lightAngle ?? 315
  const softness = (params.softness ?? 40) / 100 // 0-1 range
  const edgeDistortion = (params.edgeDistortion ?? 0) / 100 // 0-1 range

  // Realistic leather embossing based on real-world reference images:
  // Key characteristics observed:
  // 1. RAISED surface - shape appears to pop out from leather
  // 2. STRONG highlight - bright edge on light-facing side (top-right at 315°)
  // 3. DARK shadow - cast shadow on opposite side (bottom-left)
  // 4. DEFINED bevel - clear edge transition creating 3D illusion
  // 5. Interior shows leather color (user picks color matching leather surface)
  // 6. Drop shadow cast onto surrounding leather
  // 7. EDGE DISTORTION - subtle organic edge variation (optional)

  const angleRad = (lightAngle * Math.PI) / 180

  // === HIGHLIGHT CALCULATIONS (light-facing raised edge) ===
  // Softness controls blur: 0% = crisp/sharp edges, 100% = soft/diffused edges
  // Primary highlight - strong, crisp edge catching light
  const primaryHighlightDx = -Math.cos(angleRad) * height * 0.6
  const primaryHighlightDy = Math.sin(angleRad) * height * 0.6
  const primaryHighlightBlur = Math.max(height * 0.15, 0.4) + softness * height * 0.4

  // Secondary highlight - softer glow for rounded edge feel
  const secondaryHighlightDx = -Math.cos(angleRad) * height * 0.35
  const secondaryHighlightDy = Math.sin(angleRad) * height * 0.35
  const secondaryHighlightBlur = Math.max(height * 0.25, 0.6) + softness * height * 0.5

  // === SHADOW CALCULATIONS (shadow-side edge + drop shadow) ===
  // Edge shadow - defines the vertical wall on shadow side
  const edgeShadowDx = Math.cos(angleRad) * height * 0.7
  const edgeShadowDy = -Math.sin(angleRad) * height * 0.7
  const edgeShadowBlur = Math.max(height * 0.2, 0.5) + softness * height * 0.5

  // Drop shadow - cast onto surrounding leather (further offset, more blur)
  const dropShadowDx = Math.cos(angleRad) * height * 1.0
  const dropShadowDy = -Math.sin(angleRad) * height * 1.0
  const dropShadowBlur = Math.max(height * 0.3, 0.8) + softness * height * 0.6

  // Inner edge shadow - subtle shadow inside shape on shadow side
  const innerShadowDx = Math.cos(angleRad) * height * 0.25
  const innerShadowDy = -Math.sin(angleRad) * height * 0.25
  const innerShadowBlur = Math.max(height * 0.1, 0.3) + softness * height * 0.35

  // Highlight and shadow strength scale with height for realistic depth perception
  const highlightStrength = 0.55 + height * 0.035 // Stronger highlights for taller emboss
  const shadowStrength = 0.5 + height * 0.03 // Stronger shadows for taller emboss

  const primitives: FilterPrimitive[] = []

  // === EDGE DISTORTION (organic edge variation using feDisplacementMap) ===
  // Creates subtle organic edge imperfections when edgeDistortion > 0
  // Makes edges look hand-pressed rather than machine-perfect
  if (edgeDistortion > 0) {
    const displacementFrequency = 0.05 + edgeDistortion * 0.1

    primitives.push(
      {
        type: 'feTurbulence',
        turbulenceType: 'turbulence',
        baseFrequency: displacementFrequency,
        numOctaves: 1,
        seed: 123,
        result: 'edgeNoise',
      },
      {
        type: 'feDisplacementMap',
        in: 'SourceGraphic',
        in2: 'edgeNoise',
        scale: edgeDistortion * 4,
        xChannelSelector: 'R',
        yChannelSelector: 'G',
        result: 'distortedSource',
      },
      {
        type: 'feDisplacementMap',
        in: 'SourceAlpha',
        in2: 'edgeNoise',
        scale: edgeDistortion * 4,
        xChannelSelector: 'R',
        yChannelSelector: 'G',
        result: 'distortedAlpha',
      }
    )
  }

  // Determine which input to use for subsequent operations
  const alphaInput = edgeDistortion > 0 ? 'distortedAlpha' : 'SourceAlpha'

  // === DROP SHADOW (cast onto surrounding leather) ===
  primitives.push(
    {
      type: 'feOffset',
      in: alphaInput,
      dx: dropShadowDx,
      dy: dropShadowDy,
      result: 'dropShadowOffset',
    },
    {
      type: 'feGaussianBlur',
      in: 'dropShadowOffset',
      stdDeviation: dropShadowBlur,
      result: 'dropShadowBlur',
    },
    {
      type: 'feComposite',
      in: 'dropShadowBlur',
      in2: alphaInput,
      operator: 'out',
      result: 'dropShadowClipped',
    },
    {
      type: 'feFlood',
      floodColor: '#000000',
      floodOpacity: 0.25 + height * 0.025,
      result: 'dropShadowColor',
    },
    {
      type: 'feComposite',
      in: 'dropShadowColor',
      in2: 'dropShadowClipped',
      operator: 'in',
      result: 'dropShadow',
    }
  )

  // === EDGE SHADOW (defines raised edge on shadow side - OUTSIDE) ===
  primitives.push(
    {
      type: 'feOffset',
      in: alphaInput,
      dx: edgeShadowDx,
      dy: edgeShadowDy,
      result: 'edgeShadowOffset',
    },
    {
      type: 'feGaussianBlur',
      in: 'edgeShadowOffset',
      stdDeviation: edgeShadowBlur,
      result: 'edgeShadowBlur',
    },
    {
      type: 'feComposite',
      in: 'edgeShadowBlur',
      in2: alphaInput,
      operator: 'out',
      result: 'edgeShadowClipped',
    },
    {
      type: 'feFlood',
      floodColor: '#000000',
      floodOpacity: shadowStrength * 0.7,
      result: 'edgeShadowColor',
    },
    {
      type: 'feComposite',
      in: 'edgeShadowColor',
      in2: 'edgeShadowClipped',
      operator: 'in',
      result: 'edgeShadow',
    }
  )

  // === INNER SHADOW (subtle shadow inside on shadow side) ===
  primitives.push(
    {
      type: 'feOffset',
      in: alphaInput,
      dx: innerShadowDx,
      dy: innerShadowDy,
      result: 'innerShadowOffset',
    },
    {
      type: 'feGaussianBlur',
      in: 'innerShadowOffset',
      stdDeviation: innerShadowBlur,
      result: 'innerShadowBlur',
    },
    {
      type: 'feComposite',
      in: 'innerShadowBlur',
      in2: alphaInput,
      operator: 'in',
      result: 'innerShadowClipped',
    },
    {
      type: 'feFlood',
      floodColor: '#000000',
      floodOpacity: shadowStrength * 0.25,
      result: 'innerShadowColor',
    },
    {
      type: 'feComposite',
      in: 'innerShadowColor',
      in2: 'innerShadowClipped',
      operator: 'in',
      result: 'innerShadow',
    }
  )

  // === PRIMARY HIGHLIGHT (crisp bright edge on light-facing side - OUTSIDE) ===
  primitives.push(
    {
      type: 'feOffset',
      in: alphaInput,
      dx: primaryHighlightDx,
      dy: primaryHighlightDy,
      result: 'primaryHighlightOffset',
    },
    {
      type: 'feGaussianBlur',
      in: 'primaryHighlightOffset',
      stdDeviation: primaryHighlightBlur,
      result: 'primaryHighlightBlur',
    },
    {
      type: 'feComposite',
      in: 'primaryHighlightBlur',
      in2: alphaInput,
      operator: 'out',
      result: 'primaryHighlightClipped',
    },
    {
      type: 'feFlood',
      floodColor: '#ffffff',
      floodOpacity: highlightStrength * 0.85,
      result: 'primaryHighlightColor',
    },
    {
      type: 'feComposite',
      in: 'primaryHighlightColor',
      in2: 'primaryHighlightClipped',
      operator: 'in',
      result: 'primaryHighlight',
    }
  )

  // === SECONDARY HIGHLIGHT (softer glow for roundness) ===
  primitives.push(
    {
      type: 'feOffset',
      in: alphaInput,
      dx: secondaryHighlightDx,
      dy: secondaryHighlightDy,
      result: 'secondaryHighlightOffset',
    },
    {
      type: 'feGaussianBlur',
      in: 'secondaryHighlightOffset',
      stdDeviation: secondaryHighlightBlur,
      result: 'secondaryHighlightBlur',
    },
    {
      type: 'feComposite',
      in: 'secondaryHighlightBlur',
      in2: alphaInput,
      operator: 'out',
      result: 'secondaryHighlightClipped',
    },
    {
      type: 'feFlood',
      floodColor: '#ffffff',
      floodOpacity: highlightStrength * 0.4,
      result: 'secondaryHighlightColor',
    },
    {
      type: 'feComposite',
      in: 'secondaryHighlightColor',
      in2: 'secondaryHighlightClipped',
      operator: 'in',
      result: 'secondaryHighlight',
    }
  )

  // === INNER HIGHLIGHT (light catching inside on light-facing edge) ===
  const innerHighlightBlur = Math.max(height * 0.1, 0.3) + softness * height * 0.3
  primitives.push(
    {
      type: 'feOffset',
      in: alphaInput,
      dx: -Math.cos(angleRad) * height * 0.2,
      dy: Math.sin(angleRad) * height * 0.2,
      result: 'innerHighlightOffset',
    },
    {
      type: 'feGaussianBlur',
      in: 'innerHighlightOffset',
      stdDeviation: innerHighlightBlur,
      result: 'innerHighlightBlur',
    },
    {
      type: 'feComposite',
      in: 'innerHighlightBlur',
      in2: alphaInput,
      operator: 'in',
      result: 'innerHighlightClipped',
    },
    {
      type: 'feFlood',
      floodColor: '#ffffff',
      floodOpacity: highlightStrength * 0.2,
      result: 'innerHighlightColor',
    },
    {
      type: 'feComposite',
      in: 'innerHighlightColor',
      in2: 'innerHighlightClipped',
      operator: 'in',
      result: 'innerHighlight',
    }
  )

  // === COMBINE ALL LAYERS ===
  // Layer order (bottom to top):
  // 1. dropShadow - shadow cast on surrounding leather
  // 2. edgeShadow - dark edge on shadow side (outside shape)
  // 3. secondaryHighlight + primaryHighlight - bright edge on light-facing side (outside shape)
  // 4. SourceGraphic - the shape with user's fill/stroke color (should match leather)
  // 5. innerShadow + innerHighlight - subtle inner edge effects
  primitives.push({
    type: 'feMerge',
    nodes: [
      { in: 'dropShadow' }, // Cast shadow on surrounding leather (furthest back)
      { in: 'edgeShadow' }, // Dark edge on shadow side
      { in: 'secondaryHighlight' }, // Soft highlight glow
      { in: 'primaryHighlight' }, // Crisp bright highlight edge
      { in: edgeDistortion > 0 ? 'distortedSource' : 'SourceGraphic' }, // Raised leather surface with user's color
      { in: 'innerShadow' }, // Subtle inner shadow
      { in: 'innerHighlight' }, // Inner light catch
    ],
  })

  return primitives
}

/**
 * Build Hot Foil Stamping filter primitives.
 *
 * Based on real-world reference images, hot foil stamping combines:
 * 1. PRESSED-IN DEPTH - similar to debossing, the foil is stamped INTO the leather
 * 2. SOLID METALLIC FILL - flat, opaque metallic color fills the depression
 * 3. INNER EDGE SHADOWS - dark shadow on inside edge away from light
 * 4. INNER EDGE HIGHLIGHTS - bright highlight on inside edge toward light
 * 5. OUTER RIM HIGHLIGHT - leather lip around the depression catches light
 * 6. OUTER SHADOW - subtle shadow cast onto surrounding leather
 * 7. SPECULAR HIGHLIGHTS - dynamic metallic shine based on light position
 * 8. EDGE DISTORTION - organic imperfections for realistic hand-stamped look
 *
 * The key insight is that hot foil stamping creates a DEPRESSION filled with foil,
 * not just a flat colored surface. The depth effect comes from the same shadow/highlight
 * principles as debossing, but the interior is filled with metallic color with
 * specular highlights that respond to light direction.
 */
function buildHotFoilStampingPrimitives(params: PathFilterPresetParams): FilterPrimitive[] {
  const depth = params.depth ?? 3
  const lightAngle = params.lightAngle ?? 315
  const softness = (params.softness ?? 40) / 100 // 0-1 range
  const foilColorId = (params.foilColor ?? 0) as FoilColorId
  const metallicShine = (params.metallicShine ?? 50) / 100 // 0-1 range
  const edgeDistortion = (params.edgeDistortion ?? 20) / 100 // 0-1 range

  // Get colors from FOIL_COLORS lookup
  const foilColors = FOIL_COLORS[foilColorId] ?? FOIL_COLORS[0]
  const midColor = foilColors.mid
  const baseColor = foilColors.base
  const highlightColor = foilColors.highlight

  // Calculate angle-based offsets (same math as debossing)
  const angleRad = (lightAngle * Math.PI) / 180

  const primitives: FilterPrimitive[] = []

  // ==========================================================================
  // STEP 0: EDGE DISTORTION (optional organic imperfections)
  // ==========================================================================
  // Adds subtle edge irregularity for a more realistic hand-stamped look
  if (edgeDistortion > 0) {
    primitives.push(
      {
        type: 'feTurbulence',
        turbulenceType: 'turbulence',
        baseFrequency: 0.05 + edgeDistortion * 0.1,
        numOctaves: 1,
        seed: 123,
        result: 'edgeNoise',
      },
      {
        type: 'feDisplacementMap',
        in: 'SourceGraphic',
        in2: 'edgeNoise',
        scale: edgeDistortion * 4,
        xChannelSelector: 'R',
        yChannelSelector: 'G',
        result: 'distortedSource',
      },
      {
        type: 'feDisplacementMap',
        in: 'SourceAlpha',
        in2: 'edgeNoise',
        scale: edgeDistortion * 4,
        xChannelSelector: 'R',
        yChannelSelector: 'G',
        result: 'distortedAlpha',
      }
    )
  }

  // Use distorted or original source based on edgeDistortion setting
  const alphaInput = edgeDistortion > 0 ? 'distortedAlpha' : 'SourceAlpha'

  // ==========================================================================
  // STEP 1: OUTER SHADOW (cast onto surrounding leather)
  // ==========================================================================
  // The pressed-in area casts a subtle shadow on the leather around it
  // Using same values as Debossing for consistent pressed-in effect
  const outerShadowDx = -Math.cos(angleRad) * depth * 0.3
  const outerShadowDy = Math.sin(angleRad) * depth * 0.3
  const outerShadowBlur = Math.max(depth * 0.3, 0.8) + softness * depth * 0.5

  primitives.push(
    {
      type: 'feOffset',
      in: alphaInput,
      dx: outerShadowDx,
      dy: outerShadowDy,
      result: 'outerShadowOffset',
    },
    {
      type: 'feGaussianBlur',
      in: 'outerShadowOffset',
      stdDeviation: outerShadowBlur,
      result: 'outerShadowBlur',
    },
    {
      type: 'feComposite',
      in: 'outerShadowBlur',
      in2: alphaInput,
      operator: 'out',
      result: 'outerShadowClipped',
    },
    {
      type: 'feFlood',
      floodColor: '#000000',
      floodOpacity: 0.12 + depth * 0.015,
      result: 'outerShadowColor',
    },
    {
      type: 'feComposite',
      in: 'outerShadowColor',
      in2: 'outerShadowClipped',
      operator: 'in',
      result: 'outerShadow',
    }
  )

  // ==========================================================================
  // STEP 2: OUTER RIM HIGHLIGHT (leather lip catching light)
  // ==========================================================================
  // The raised leather edge around the depression catches light on the light-facing side
  // Using same values as Debossing for consistent pressed-in effect
  const rimHighlightDx = Math.cos(angleRad) * depth * 0.4
  const rimHighlightDy = -Math.sin(angleRad) * depth * 0.4
  const rimHighlightBlur = Math.max(depth * 0.15, 0.4) + softness * depth * 0.4

  primitives.push(
    {
      type: 'feOffset',
      in: alphaInput,
      dx: rimHighlightDx,
      dy: rimHighlightDy,
      result: 'rimHighlightOffset',
    },
    {
      type: 'feGaussianBlur',
      in: 'rimHighlightOffset',
      stdDeviation: rimHighlightBlur,
      result: 'rimHighlightBlur',
    },
    {
      type: 'feComposite',
      in: 'rimHighlightBlur',
      in2: alphaInput,
      operator: 'out',
      result: 'rimHighlightClipped',
    },
    {
      type: 'feFlood',
      floodColor: '#ffffff',
      floodOpacity: 0.28 + depth * 0.03, // Same as Debossing
      result: 'rimHighlightColor',
    },
    {
      type: 'feComposite',
      in: 'rimHighlightColor',
      in2: 'rimHighlightClipped',
      operator: 'in',
      result: 'rimHighlight',
    }
  )

  // ==========================================================================
  // STEP 3: SOLID METALLIC FOIL BASE
  // ==========================================================================
  primitives.push(
    {
      type: 'feFlood',
      floodColor: midColor,
      floodOpacity: 1,
      result: 'metalBase',
    },
    {
      type: 'feComposite',
      in: 'metalBase',
      in2: alphaInput,
      operator: 'in',
      result: 'foilBase',
    }
  )

  // ==========================================================================
  // STEP 4: METALLIC SHINE (gradient-based highlight effect)
  // ==========================================================================
  // Creates metallic shine using offset highlights that simulate light reflection
  // This approach works better than feSpecularLighting for flat shapes
  if (metallicShine > 0) {
    // Create a bright highlight band on the light-facing side
    // This simulates how metallic foil catches and reflects light
    const shineHighlightDx = Math.cos(angleRad) * depth * 0.15
    const shineHighlightDy = -Math.sin(angleRad) * depth * 0.15
    const shineBlur = Math.max(depth * 0.4, 1.0) + softness * depth * 0.3

    primitives.push(
      // Primary metallic highlight - bright reflection on light-facing interior
      {
        type: 'feOffset',
        in: alphaInput,
        dx: shineHighlightDx,
        dy: shineHighlightDy,
        result: 'shineOffset',
      },
      {
        type: 'feGaussianBlur',
        in: 'shineOffset',
        stdDeviation: shineBlur,
        result: 'shineBlur',
      },
      {
        type: 'feComposite',
        in: 'shineBlur',
        in2: alphaInput,
        operator: 'in',
        result: 'shineClipped',
      },
      {
        type: 'feFlood',
        floodColor: highlightColor,
        floodOpacity: metallicShine * 0.5,
        result: 'shineColor',
      },
      {
        type: 'feComposite',
        in: 'shineColor',
        in2: 'shineClipped',
        operator: 'in',
        result: 'metallicShine',
      }
    )
  }

  // ==========================================================================
  // STEP 5: MAIN INNER EDGE SHADOW (sharp shadow on shadow-side wall)
  // ==========================================================================
  // The wall of the depression on the shadow side appears darker
  // This is the key deboss-like effect that creates the pressed-in feeling
  const innerShadowDx = -Math.cos(angleRad) * depth * 0.7
  const innerShadowDy = Math.sin(angleRad) * depth * 0.7
  // Fixed softness formula: use additive pattern for noticeable effect
  const innerShadowBlur = Math.max(depth * 0.2, 0.5) + softness * depth * 0.5

  primitives.push(
    {
      type: 'feOffset',
      in: alphaInput,
      dx: innerShadowDx,
      dy: innerShadowDy,
      result: 'innerShadowOffset',
    },
    {
      type: 'feGaussianBlur',
      in: 'innerShadowOffset',
      stdDeviation: innerShadowBlur,
      result: 'innerShadowBlur',
    },
    {
      type: 'feComposite',
      in: 'innerShadowBlur',
      in2: alphaInput,
      operator: 'in',
      result: 'innerShadowClipped',
    },
    {
      type: 'feFlood',
      floodColor: baseColor, // Use foil's darker shade for shadow
      floodOpacity: 0.35 + depth * 0.03,
      result: 'innerShadowColor',
    },
    {
      type: 'feComposite',
      in: 'innerShadowColor',
      in2: 'innerShadowClipped',
      operator: 'in',
      result: 'innerShadow',
    }
  )

  // ==========================================================================
  // STEP 6: SOFT INNER SHADOW (broader shadow for depth gradation)
  // ==========================================================================
  // Using same values as Debossing for consistent pressed-in effect
  const softShadowDx = -Math.cos(angleRad) * depth * 0.4
  const softShadowDy = Math.sin(angleRad) * depth * 0.4
  const softShadowBlur = Math.max(depth * 0.3, 0.8) + softness * depth * 0.6

  primitives.push(
    {
      type: 'feOffset',
      in: alphaInput,
      dx: softShadowDx,
      dy: softShadowDy,
      result: 'softShadowOffset',
    },
    {
      type: 'feGaussianBlur',
      in: 'softShadowOffset',
      stdDeviation: softShadowBlur,
      result: 'softShadowBlur',
    },
    {
      type: 'feComposite',
      in: 'softShadowBlur',
      in2: alphaInput,
      operator: 'in',
      result: 'softShadowClipped',
    },
    {
      type: 'feFlood',
      floodColor: '#000000',
      floodOpacity: 0.18 + depth * 0.02,
      result: 'softShadowColor',
    },
    {
      type: 'feComposite',
      in: 'softShadowColor',
      in2: 'softShadowClipped',
      operator: 'in',
      result: 'softShadow',
    }
  )

  // ==========================================================================
  // STEP 7: INNER EDGE HIGHLIGHT (light catching inside on light-facing wall)
  // ==========================================================================
  // The wall of the depression on the light side catches light
  // Using same values as Debossing for consistent pressed-in effect
  const innerHighlightDx = Math.cos(angleRad) * depth * 0.25
  const innerHighlightDy = -Math.sin(angleRad) * depth * 0.25
  const innerHighlightBlur = Math.max(depth * 0.1, 0.3) + softness * depth * 0.35

  primitives.push(
    {
      type: 'feOffset',
      in: alphaInput,
      dx: innerHighlightDx,
      dy: innerHighlightDy,
      result: 'innerHighlightOffset',
    },
    {
      type: 'feGaussianBlur',
      in: 'innerHighlightOffset',
      stdDeviation: innerHighlightBlur,
      result: 'innerHighlightBlur',
    },
    {
      type: 'feComposite',
      in: 'innerHighlightBlur',
      in2: alphaInput,
      operator: 'in',
      result: 'innerHighlightClipped',
    },
    {
      type: 'feFlood',
      floodColor: highlightColor, // Use foil's brighter shade for highlight
      floodOpacity: 0.15, // Same as Debossing (fixed value)
      result: 'innerHighlightColor',
    },
    {
      type: 'feComposite',
      in: 'innerHighlightColor',
      in2: 'innerHighlightClipped',
      operator: 'in',
      result: 'innerHighlight',
    }
  )

  // ==========================================================================
  // STEP 8: COMBINE ALL LAYERS
  // ==========================================================================
  // Layer order from back to front:
  // 1. Outer shadow (on leather, behind everything)
  // 2. Outer rim highlight (leather lip catching light)
  // 3. Foil base (solid metallic fill)
  // 4. Soft inner shadow (broader depth shadow)
  // 5. Inner edge shadow (sharp depression wall shadow)
  // 6. Inner edge highlight (depression wall catching light)
  // 7. Metallic shine (bright highlight on top)
  const mergeNodes = [
    { in: 'outerShadow' },
    { in: 'rimHighlight' },
    { in: 'foilBase' },
    { in: 'softShadow' },
    { in: 'innerShadow' },
    { in: 'innerHighlight' },
  ]

  // Add metallic shine layer if enabled
  if (metallicShine > 0) {
    mergeNodes.push({ in: 'metallicShine' })
  }

  primitives.push({
    type: 'feMerge',
    nodes: mergeNodes,
  })

  return primitives
}

/**
 * Build realistic diamond drag primitives based on real-world reference images.
 *
 * Diamond drag engraving creates V-shaped grooves cut INTO the metal surface.
 * The key visual effect is that the engraved lines appear RECESSED, not raised.
 *
 * Analysis of 11 reference images revealed these key characteristics:
 *
 * 1. ENGRAVED/RECESSED APPEARANCE - Lines are cut into the metal, creating shadows
 *    on the side away from light and a bright "lip" outside on the light side
 *
 * 2. THIN PRECISE LINES - Real diamond drag creates fine V-groove scratches
 *    (Uses feMorphology erode to thin strokes)
 *
 * 3. BRIGHT REFLECTIVE QUALITY - The polished V-groove facets reflect light,
 *    but this comes from the stroke color itself, not from inner highlights
 *
 * 4. NO INNER HIGHLIGHT on light side - Unlike embossing, engraving should NOT
 *    have a bright edge inside the shape on the light-facing side (that looks raised)
 *
 * Implementation approach:
 * - Use shape's own stroke color (user matches to jewelry)
 * - Outer shadow on shadow side (the groove casts shadow onto surrounding metal)
 * - Outer rim highlight on light side (the metal lip catches light)
 * - Inner shadow ONLY on shadow side (the groove interior is darker there)
 * - NO inner highlight (would make it look raised/embossed)
 */
function buildDiamondDragPrimitives(params: PathFilterPresetParams): FilterPrimitive[] {
  const lineWidth = params.lineWidth ?? 3 // Default to 3 = no erosion (preserve original stroke)
  const depth = params.depth ?? 0.4 // V-groove depth in px (0-2px range)
  const lightAngle = params.lightAngle ?? 315
  const lineWobble = (params.lineWobble ?? 15) / 100 // 0 to 1.0

  // Calculate angle-based offsets
  const angleRad = (lightAngle * Math.PI) / 180

  const primitives: FilterPrimitive[] = []

  // === STEP 0: OPTIONAL LINE WIDTH CONTROL VIA EROSION ===
  const maxLineWidth = 3
  const erodeRadius = Math.max(0, (maxLineWidth - lineWidth) / 2)
  let currentAlpha = erodeRadius > 0 ? 'erodedAlpha' : 'SourceAlpha'
  let currentGraphic = erodeRadius > 0 ? 'erodedGraphic' : 'SourceGraphic'

  if (erodeRadius > 0) {
    primitives.push(
      {
        type: 'feMorphology',
        in: 'SourceAlpha',
        operator: 'erode',
        radius: erodeRadius,
        result: 'erodedAlpha',
      },
      {
        type: 'feMorphology',
        in: 'SourceGraphic',
        operator: 'erode',
        radius: erodeRadius,
        result: 'erodedGraphic',
      }
    )
  }

  // === STEP 0.5: LINE WOBBLE (feDisplacementMap) ===
  // Creates subtle edge irregularity simulating hand-guided or machine vibration
  // Only apply if lineWobble > 0
  if (lineWobble > 0) {
    // Generate noise for displacement
    // Higher frequency for fine wobble (0.02-0.06)
    const wobbleFrequency = 0.02 + lineWobble * 0.04

    primitives.push(
      {
        type: 'feTurbulence',
        turbulenceType: 'turbulence',
        baseFrequency: wobbleFrequency,
        numOctaves: 2,
        seed: 77, // Different seed for wobble
        result: 'wobbleNoise',
      },
      // Apply displacement to alpha (affects shape edges)
      // Scale kept low (max 1.5px) to preserve fine line integrity
      {
        type: 'feDisplacementMap',
        in: currentAlpha,
        in2: 'wobbleNoise',
        scale: lineWobble * 1.5, // Max 1.5px displacement
        xChannelSelector: 'R',
        yChannelSelector: 'G',
        result: 'wobbledAlpha',
      },
      // Also wobble the graphic
      {
        type: 'feDisplacementMap',
        in: currentGraphic,
        in2: 'wobbleNoise',
        scale: lineWobble * 1.5,
        xChannelSelector: 'R',
        yChannelSelector: 'G',
        result: 'wobbledGraphic',
      }
    )

    currentAlpha = 'wobbledAlpha'
    currentGraphic = 'wobbledGraphic'
  }

  // Store final shape references for depth effects
  const shapeAlpha = currentAlpha
  const shapeGraphic = currentGraphic

  // === STEP 1: USE SHAPE'S OWN COLOR AS BASE ===
  // The stroke color IS the engraving color - user sets it to match their jewelry
  // Pass through unchanged (identity matrix)
  primitives.push({
    type: 'feColorMatrix',
    in: shapeGraphic,
    matrixType: 'matrix',
    values: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
    result: 'base',
  })

  // === STEP 2: DEPTH EFFECTS (ENGRAVED/RECESSED) ===
  // Diamond drag on metal creates fine V-groove scratches with subtle depth
  // The effect should be sharp and precise, not heavy shadows
  if (depth > 0) {
    // Use depth directly - range is 0-2px which is appropriate for fine engraving
    // No aggressive scaling needed - diamond drag is subtle
    const effectiveDepth = depth

    // === OUTER SHADOW (subtle shadow on shadow side of groove) ===
    // Shadow direction: dx = -cos, dy = +sin
    // Metal engraving has SHARP edges - use minimal blur and offset
    const outerShadowDx = -Math.cos(angleRad) * effectiveDepth * 0.6
    const outerShadowDy = Math.sin(angleRad) * effectiveDepth * 0.6
    const outerShadowBlur = Math.max(effectiveDepth * 0.25, 0.3) // Sharp edges for metal

    primitives.push(
      {
        type: 'feOffset',
        in: shapeAlpha,
        dx: outerShadowDx,
        dy: outerShadowDy,
        result: 'outerShadowOffset',
      },
      {
        type: 'feGaussianBlur',
        in: 'outerShadowOffset',
        stdDeviation: outerShadowBlur,
        result: 'outerShadowBlur',
      },
      {
        type: 'feComposite',
        in: 'outerShadowBlur',
        in2: shapeAlpha,
        operator: 'out', // OUTSIDE the shape
        result: 'outerShadowClipped',
      },
      {
        type: 'feFlood',
        floodColor: '#000000',
        floodOpacity: 0.1 + depth * 0.1, // Subtle shadow for fine engraving
        result: 'outerShadowColor',
      },
      {
        type: 'feComposite',
        in: 'outerShadowColor',
        in2: 'outerShadowClipped',
        operator: 'in',
        result: 'outerShadow',
      }
    )

    // === RIM HIGHLIGHT (bright edge on light side of groove) ===
    // Highlight direction: dx = +cos, dy = -sin
    // Metal has crisp reflective highlights but subtle for fine engraving
    const rimHighlightDx = Math.cos(angleRad) * effectiveDepth * 0.5
    const rimHighlightDy = -Math.sin(angleRad) * effectiveDepth * 0.5
    const rimHighlightBlur = Math.max(effectiveDepth * 0.2, 0.25) // Very sharp for metal

    primitives.push(
      {
        type: 'feOffset',
        in: shapeAlpha,
        dx: rimHighlightDx,
        dy: rimHighlightDy,
        result: 'rimHighlightOffset',
      },
      {
        type: 'feGaussianBlur',
        in: 'rimHighlightOffset',
        stdDeviation: rimHighlightBlur,
        result: 'rimHighlightBlur',
      },
      {
        type: 'feComposite',
        in: 'rimHighlightBlur',
        in2: shapeAlpha,
        operator: 'out', // OUTSIDE the shape - the metal lip
        result: 'rimHighlightClipped',
      },
      {
        type: 'feFlood',
        floodColor: '#ffffff',
        floodOpacity: 0.15 + depth * 0.15, // Subtle highlight for fine engraving
        result: 'rimHighlightColor',
      },
      {
        type: 'feComposite',
        in: 'rimHighlightColor',
        in2: 'rimHighlightClipped',
        operator: 'in',
        result: 'rimHighlight',
      }
    )

    // === INNER SHADOW (subtle depth inside the groove) ===
    // Inner shadow direction: dx = -cos, dy = +sin
    // Fine V-groove has subtle inner shadow
    const innerShadowDx = -Math.cos(angleRad) * effectiveDepth * 0.4
    const innerShadowDy = Math.sin(angleRad) * effectiveDepth * 0.4
    const innerShadowBlur = Math.max(effectiveDepth * 0.2, 0.25) // Sharp for metal

    primitives.push(
      {
        type: 'feOffset',
        in: shapeAlpha,
        dx: innerShadowDx,
        dy: innerShadowDy,
        result: 'innerShadowOffset',
      },
      {
        type: 'feGaussianBlur',
        in: 'innerShadowOffset',
        stdDeviation: innerShadowBlur,
        result: 'innerShadowBlur',
      },
      {
        type: 'feComposite',
        in: 'innerShadowBlur',
        in2: shapeAlpha,
        operator: 'in', // INSIDE the shape
        result: 'innerShadowClipped',
      },
      {
        type: 'feFlood',
        floodColor: '#000000',
        floodOpacity: 0.15 + depth * 0.15, // Subtle shadow for fine engraving
        result: 'innerShadowColor',
      },
      {
        type: 'feComposite',
        in: 'innerShadowColor',
        in2: 'innerShadowClipped',
        operator: 'in',
        result: 'innerShadow',
      }
    )

    // === NO INNER HIGHLIGHT ===
    // IMPORTANT: We intentionally do NOT add an inner highlight on the light side
    // Adding brightness inside on the light-facing edge makes it look RAISED/EMBOSSED
    // For engraved effect, the light side should just show the base color

    // === COMBINE ALL LAYERS ===
    // Order: outer shadow (back), rim highlight (back), base, inner shadow (front)
    primitives.push({
      type: 'feMerge',
      nodes: [
        { in: 'outerShadow' }, // Shadow cast on surrounding metal (shadow side)
        { in: 'rimHighlight' }, // Bright lip outside shape (light side)
        { in: 'base' }, // The engraved stroke itself
        { in: 'innerShadow' }, // Dark shadow inside (shadow side) - creates depth
      ],
      result: 'depthMerged',
    })
  }

  // If no depth effects were applied, the filter still needs to output something
  // The 'base' result from step 1 will be used as the final output

  return primitives
}

/**
 * Build realistic laser engraving primitives based on real-world reference images.
 *
 * REFINED IMPLEMENTATION - Balances flat color with subtle depth feeling:
 *
 * Key insight from reference analysis (Images 2, 4, 6, 11):
 * Real laser engraving is primarily a COLOR CHANGE, but shows subtle depth through:
 * 1. Slightly darker edges where the laser has burned deeper
 * 2. A very subtle "pressed-in" appearance from the material removal
 * 3. The razor-sharp boundary creates a visual contrast that suggests depth
 *
 * Visual characteristics to achieve:
 * 1. BURNT COLOR: Warm brown tones (not gray/black)
 * 2. SHARP EDGES: Crisp boundaries from the SVG shape
 * 3. SUBTLE DEPTH: Very slight inner shadow to suggest pressed-in effect
 * 4. MATTE FINISH: No glossy or reflective effects
 *
 * Color progression based on real-world reference images:
 * - 20% burn: Light brown (#9B6B3D) - subtle, barely visible
 * - 40% burn: Medium brown (#7A4A28) - clearly visible
 * - 60% burn: Dark brown (#5A3218) - strong contrast
 * - 80% burn: Very dark brown (#3A1A0A) - high contrast
 * - 100% burn: Near-black (#1A0A04) - maximum "cut-out" effect
 */
function buildLaserEngravingPrimitives(params: PathFilterPresetParams): FilterPrimitive[] {
  const burnIntensity = (params.burnIntensity ?? 40) / 100
  const depth = params.depth ?? 3 // 0-12px range, controls inner shadow intensity

  // Light angle for shadow direction (315° = light from top-left)
  const lightAngle = 315
  const angleRad = (lightAngle * Math.PI) / 180

  const primitives: FilterPrimitive[] = []

  // Create burnt color based on intensity
  // Color progression: light brown → dark brown → near-black
  //
  // At 20% (min): rgb(155, 107, 61) - #9B6B3D - light brown
  // At 60% (default): rgb(90, 50, 24) - #5A3218 - dark brown
  // At 100% (max): rgb(26, 10, 4) - #1A0A04 - near-black (cut-out effect)
  const r = Math.round(155 - burnIntensity * 129) // 155 -> 26
  const g = Math.round(107 - burnIntensity * 97) // 107 -> 10
  const b = Math.round(61 - burnIntensity * 57) // 61 -> 4
  const burntColor = `rgb(${r}, ${g}, ${b})`

  // ==========================================================================
  // STEP 1: OUTER SHADOW (cast onto surrounding leather)
  // ==========================================================================
  // The burnt-in area creates a depression, casting shadow on surrounding leather
  // Using same values as Debossing for consistent pressed-in effect
  if (depth > 0) {
    const outerShadowDx = -Math.cos(angleRad) * depth * 0.3
    const outerShadowDy = Math.sin(angleRad) * depth * 0.3
    const outerShadowBlur = Math.max(depth * 0.3, 0.8)

    primitives.push(
      {
        type: 'feOffset',
        in: 'SourceAlpha',
        dx: outerShadowDx,
        dy: outerShadowDy,
        result: 'outerShadowOffset',
      },
      {
        type: 'feGaussianBlur',
        in: 'outerShadowOffset',
        stdDeviation: outerShadowBlur,
        result: 'outerShadowBlur',
      },
      {
        type: 'feComposite',
        in: 'outerShadowBlur',
        in2: 'SourceAlpha',
        operator: 'out', // Outside the shape
        result: 'outerShadowClipped',
      },
      {
        type: 'feFlood',
        floodColor: '#000000',
        floodOpacity: 0.12 + depth * 0.015, // Same as Debossing
        result: 'outerShadowColor',
      },
      {
        type: 'feComposite',
        in: 'outerShadowColor',
        in2: 'outerShadowClipped',
        operator: 'in',
        result: 'outerShadow',
      }
    )
  }

  // ==========================================================================
  // STEP 2: OUTER RIM HIGHLIGHT (leather edge catching light)
  // ==========================================================================
  // The raised leather edge around the engraving catches light on the light-facing side
  // Using same values as Debossing for consistent pressed-in effect
  if (depth > 0) {
    const rimHighlightDx = Math.cos(angleRad) * depth * 0.4
    const rimHighlightDy = -Math.sin(angleRad) * depth * 0.4
    const rimHighlightBlur = Math.max(depth * 0.15, 0.4)

    primitives.push(
      {
        type: 'feOffset',
        in: 'SourceAlpha',
        dx: rimHighlightDx,
        dy: rimHighlightDy,
        result: 'rimHighlightOffset',
      },
      {
        type: 'feGaussianBlur',
        in: 'rimHighlightOffset',
        stdDeviation: rimHighlightBlur,
        result: 'rimHighlightBlur',
      },
      {
        type: 'feComposite',
        in: 'rimHighlightBlur',
        in2: 'SourceAlpha',
        operator: 'out', // Outside the shape
        result: 'rimHighlightClipped',
      },
      {
        type: 'feFlood',
        floodColor: '#ffffff',
        floodOpacity: 0.28 + depth * 0.03, // Same as Debossing
        result: 'rimHighlightColor',
      },
      {
        type: 'feComposite',
        in: 'rimHighlightColor',
        in2: 'rimHighlightClipped',
        operator: 'in',
        result: 'rimHighlight',
      }
    )
  }

  // ==========================================================================
  // STEP 3: SOLID BURNT COLOR BASE
  // ==========================================================================
  primitives.push(
    {
      type: 'feFlood',
      floodColor: burntColor,
      floodOpacity: 1,
      result: 'burntBase',
    },
    {
      type: 'feComposite',
      in: 'burntBase',
      in2: 'SourceAlpha',
      operator: 'in',
      result: 'burnt',
    }
  )

  // ==========================================================================
  // STEP 4: MAIN INNER EDGE SHADOW (sharp shadow on shadow-side wall)
  // ==========================================================================
  // Using same values as Debossing for consistent pressed-in effect
  if (depth > 0) {
    const edgeShadowDx = -Math.cos(angleRad) * depth * 0.7
    const edgeShadowDy = Math.sin(angleRad) * depth * 0.7
    const edgeShadowBlur = Math.max(depth * 0.2, 0.5)

    primitives.push(
      {
        type: 'feOffset',
        in: 'SourceAlpha',
        dx: edgeShadowDx,
        dy: edgeShadowDy,
        result: 'edgeShadowOffset',
      },
      {
        type: 'feGaussianBlur',
        in: 'edgeShadowOffset',
        stdDeviation: edgeShadowBlur,
        result: 'edgeShadowBlur',
      },
      {
        type: 'feComposite',
        in: 'edgeShadowBlur',
        in2: 'SourceAlpha',
        operator: 'in', // Inside the shape
        result: 'edgeShadowClipped',
      },
      {
        type: 'feFlood',
        floodColor: '#000000',
        floodOpacity: 0.35 + depth * 0.03, // Same as Debossing
        result: 'edgeShadowColor',
      },
      {
        type: 'feComposite',
        in: 'edgeShadowColor',
        in2: 'edgeShadowClipped',
        operator: 'in',
        result: 'edgeShadow',
      }
    )

    // ==========================================================================
    // STEP 5: SOFT INNER SHADOW (broader shadow for depth gradation)
    // ==========================================================================
    // Using same values as Debossing for consistent pressed-in effect
    const softShadowDx = -Math.cos(angleRad) * depth * 0.4
    const softShadowDy = Math.sin(angleRad) * depth * 0.4
    const softShadowBlur = Math.max(depth * 0.3, 0.8)

    primitives.push(
      {
        type: 'feOffset',
        in: 'SourceAlpha',
        dx: softShadowDx,
        dy: softShadowDy,
        result: 'softShadowOffset',
      },
      {
        type: 'feGaussianBlur',
        in: 'softShadowOffset',
        stdDeviation: softShadowBlur,
        result: 'softShadowBlur',
      },
      {
        type: 'feComposite',
        in: 'softShadowBlur',
        in2: 'SourceAlpha',
        operator: 'in',
        result: 'softShadowClipped',
      },
      {
        type: 'feFlood',
        floodColor: '#000000',
        floodOpacity: 0.18 + depth * 0.02, // Same as Debossing
        result: 'softShadowColor',
      },
      {
        type: 'feComposite',
        in: 'softShadowColor',
        in2: 'softShadowClipped',
        operator: 'in',
        result: 'softShadow',
      }
    )

    // ==========================================================================
    // STEP 6: INNER HIGHLIGHT (light catching inner edge)
    // ==========================================================================
    // Using same values as Debossing for consistent pressed-in effect
    const innerHighlightDx = Math.cos(angleRad) * depth * 0.25
    const innerHighlightDy = -Math.sin(angleRad) * depth * 0.25
    const innerHighlightBlur = Math.max(depth * 0.1, 0.3)

    primitives.push(
      {
        type: 'feOffset',
        in: 'SourceAlpha',
        dx: innerHighlightDx,
        dy: innerHighlightDy,
        result: 'innerHighlightOffset',
      },
      {
        type: 'feGaussianBlur',
        in: 'innerHighlightOffset',
        stdDeviation: innerHighlightBlur,
        result: 'innerHighlightBlur',
      },
      {
        type: 'feComposite',
        in: 'innerHighlightBlur',
        in2: 'SourceAlpha',
        operator: 'in',
        result: 'innerHighlightClipped',
      },
      {
        type: 'feFlood',
        floodColor: '#ffffff',
        floodOpacity: 0.15, // Same as Debossing
        result: 'innerHighlightColor',
      },
      {
        type: 'feComposite',
        in: 'innerHighlightColor',
        in2: 'innerHighlightClipped',
        operator: 'in',
        result: 'innerHighlight',
      }
    )

    // Combine all layers - same order as Debossing
    primitives.push({
      type: 'feMerge',
      nodes: [
        { in: 'outerShadow' },
        { in: 'rimHighlight' },
        { in: 'burnt' },
        { in: 'softShadow' },
        { in: 'edgeShadow' },
        { in: 'innerHighlight' },
      ],
    })
  }
  // depth = 0: just show the burnt base (flat, no depth effects)
  // No merge needed - burnt is already the last primitive

  return primitives
}

/**
 * Build realistic laser annealing primitives based on real-world laser annealing process.
 *
 * Laser annealing creates an oxide layer on metal through controlled heating.
 * Unlike engraving, it does NOT remove material - the mark sits on the surface.
 *
 * Key visual characteristics (based on reference analysis):
 * 1. OXIDE TEXTURE - Subtle noisy, marble-like surface oxidation patterns (feTurbulence)
 * 2. HEAT DISTORTION - Slight waviness/ripple from thermal effects (feDisplacementMap)
 * 3. DARK OXIDE COLOR - Ranges from cool gray to warm charcoal/brown (feColorMatrix)
 * 4. HEAT GLOW - Subtle blur effect simulating residual heat (feGaussianBlur)
 * 5. MATTE FINISH - Non-reflective oxidized surface appearance
 *
 * Color science:
 * - Cool gray (warmth=0): Pure gray tones, slightly blue undertone
 * - Neutral (warmth=50): Balanced gray
 * - Warm charcoal (warmth=100): Brown-black, like burnt wood
 *
 * Darkness controls the overall lightness:
 * - 20% darkness: Medium gray (~rgb(130, 130, 130))
 * - 50% darkness: Dark gray (~rgb(70, 70, 70))
 * - 80% darkness: Very dark (~rgb(35, 35, 35))
 * - 100% darkness: Near black (~rgb(15, 15, 15))
 *
 * Filter chain architecture:
 * 1. feTurbulence generates fractal noise for oxide texture
 * 2. feDisplacementMap applies subtle heat distortion to edges
 * 3. feFlood creates the base oxide color
 * 4. feColorMatrix darkens and shifts colors to oxide tones
 * 5. feGaussianBlur + feMerge creates subtle heat glow effect
 */
function buildLaserAnnealingPrimitives(params: PathFilterPresetParams): FilterPrimitive[] {
  const darkness = (params.darkness ?? 50) / 100 // 0.2 to 1.0
  const warmth = (params.warmth ?? 50) / 100 // 0 to 1.0
  const oxideTexture = (params.oxideTexture ?? 40) / 100 // 0 to 1.0
  const heatDistortion = (params.heatDistortion ?? 10) / 100 // 0 to 1.0

  // Calculate base gray value from darkness
  // At 20% darkness (min): ~130 (medium gray)
  // At 100% darkness (max): ~15 (near black)
  const baseGray = Math.round(150 - darkness * 135) // 150 -> 15

  // Apply warmth adjustment
  // Warmth shifts the color from cool gray toward warm charcoal/brown
  // Cool (warmth=0): Slightly blue tint (r-5, g-2, b+5)
  // Warm (warmth=100): Brown/charcoal tint (r+15, g-5, b-15)
  const coolShift = 1 - warmth // How much cool tint to apply
  const warmShift = warmth // How much warm tint to apply

  // Red channel: slightly lower when cool, higher when warm
  const r = Math.round(Math.max(0, Math.min(255, baseGray - coolShift * 5 + warmShift * 15)))

  // Green channel: slightly lower when cool, even lower when warm (creates brown)
  const g = Math.round(Math.max(0, Math.min(255, baseGray - coolShift * 2 - warmShift * 8)))

  // Blue channel: higher when cool, lower when warm
  const b = Math.round(Math.max(0, Math.min(255, baseGray + coolShift * 8 - warmShift * 15)))

  const annealingColor = `rgb(${r}, ${g}, ${b})`

  const primitives: FilterPrimitive[] = []

  // Track which alpha source to use (may be distorted or original)
  let currentAlpha = 'SourceAlpha'

  // === STEP 1: HEAT DISTORTION (feDisplacementMap) ===
  // Creates subtle waviness/ripple from thermal effects
  // Only apply if heatDistortion > 0
  // NOTE: Using conservative scale to preserve thin strokes (1px lines)
  if (heatDistortion > 0) {
    // Generate noise for displacement
    // Lower frequency for larger-scale thermal distortion (0.01-0.03)
    const distortionFrequency = 0.01 + heatDistortion * 0.02

    primitives.push(
      {
        type: 'feTurbulence',
        turbulenceType: 'turbulence',
        baseFrequency: distortionFrequency,
        numOctaves: 2,
        seed: 42,
        result: 'heatNoise',
      },
      // Distort alpha for proper masking with heat warp effect
      // Scale kept low (max 2px) to preserve thin stroke visibility
      {
        type: 'feDisplacementMap',
        in: 'SourceAlpha',
        in2: 'heatNoise',
        scale: heatDistortion * 2, // Max 2px displacement (was 4px)
        xChannelSelector: 'R',
        yChannelSelector: 'G',
        result: 'distortedAlpha',
      }
    )

    currentAlpha = 'distortedAlpha'
  }

  // === STEP 2: BASE OXIDE COLOR ===
  // Solid fill with calculated annealing color
  primitives.push(
    {
      type: 'feFlood',
      floodColor: annealingColor,
      floodOpacity: 1,
      result: 'annealColor',
    },
    {
      type: 'feComposite',
      in: 'annealColor',
      in2: currentAlpha,
      operator: 'in',
      result: 'baseAnnealed',
    }
  )

  // === STEP 3: OXIDE TEXTURE (feTurbulence) ===
  // Creates subtle marble-like surface oxidation patterns
  // Only apply if oxideTexture > 0
  // IMPORTANT: feTurbulence fills the ENTIRE filter region, so we must:
  // 1. Generate the textured result
  // 2. Composite it back to the shape's alpha to avoid filling the bounding box
  if (oxideTexture > 0) {
    // Generate fractal noise for oxide texture
    // Higher baseFrequency (0.03-0.08) for finer grain visible on thin strokes
    const textureFrequency = 0.03 + oxideTexture * 0.05

    primitives.push(
      {
        type: 'feTurbulence',
        turbulenceType: 'fractalNoise', // fractalNoise for smoother, marble-like patterns
        baseFrequency: textureFrequency,
        numOctaves: 2, // Reduced octaves for cleaner look on thin strokes
        seed: 123, // Different seed from distortion
        result: 'oxideNoise',
      },
      // Convert noise to neutral gray with subtle variation
      // Values centered around 0.5 (neutral for overlay blend)
      {
        type: 'feColorMatrix',
        matrixType: 'matrix',
        values: [
          0.15 * oxideTexture,
          0,
          0,
          0,
          0.5 - 0.075 * oxideTexture, // R: subtle variation
          0.15 * oxideTexture,
          0,
          0,
          0,
          0.5 - 0.075 * oxideTexture, // G: subtle variation
          0.15 * oxideTexture,
          0,
          0,
          0,
          0.5 - 0.075 * oxideTexture, // B: subtle variation
          0,
          0,
          0,
          1,
          0, // A -> preserve
        ],
        in: 'oxideNoise',
        result: 'oxideGray',
      },
      // Blend oxide texture with base annealed color
      // Using overlay for balanced light/dark texture that preserves thin strokes
      {
        type: 'feBlend',
        mode: 'overlay',
        in: 'baseAnnealed',
        in2: 'oxideGray',
        result: 'texturedBlend',
      },
      // CRITICAL: Clip the blended result to the original shape's alpha
      // Without this, feTurbulence fills the entire filter bounding box
      {
        type: 'feComposite',
        in: 'texturedBlend',
        in2: currentAlpha,
        operator: 'in',
        result: 'texturedAnnealed',
      }
    )
  }

  const annealedResult = oxideTexture > 0 ? 'texturedAnnealed' : 'baseAnnealed'

  // === STEP 4: HEAT GLOW EFFECT (feGaussianBlur + feMerge) ===
  // Subtle blur creates residual heat glow appearance
  // Only apply if heatDistortion > 0 (glow correlates with heat)
  // NOTE: Glow intensity reduced to avoid overwhelming thin strokes
  if (heatDistortion > 0) {
    const glowIntensity = heatDistortion * 0.8 // Max 0.8px blur (was 1.5px)

    primitives.push(
      // Create glow from annealed result
      {
        type: 'feGaussianBlur',
        stdDeviation: glowIntensity,
        in: annealedResult,
        result: 'heatGlow',
      },
      // Merge glow behind the main annealed result
      {
        type: 'feMerge',
        nodes: [{ in: 'heatGlow' }, { in: annealedResult }],
        result: 'annealedWithGlow',
      }
    )
  }

  // Final result - no additional color matrix needed
  // The base annealing color already accounts for darkness
  // Adding another darkening step would make thin strokes invisible

  return primitives
}

/**
 * Build realistic deep laser engraving primitives based on real-world reference images.
 *
 * Deep laser engraving on jewelry creates a visible recessed mark filled with
 * oxidized/ablated metal. Unlike surface marking (laser annealing), deep engraving
 * physically removes material, creating actual depth.
 *
 * KEY DIFFERENCE FROM LASER ANNEALING:
 * - Laser Annealing = FLAT surface oxide mark (no depth)
 * - Deep Laser Engraving = RECESSED groove carved into metal (visible depth)
 *
 * IMPORTANT: Following the Diamond Drag pattern for ENGRAVED (not raised) appearance:
 * - Outer shadow on SHADOW SIDE (away from light) - groove casts shadow on metal
 * - Rim highlight on LIGHT SIDE (toward light) - metal lip catches light
 * - Inner shadow on SHADOW SIDE ONLY - creates depth feeling
 * - NO INNER HIGHLIGHT - adding inner highlight makes it look RAISED/EMBOSSED
 *
 * Color calculation:
 * - `darkness` (40-100%): Controls how dark the engraving appears
 * - `warmth` (0-100%): Controls color temperature
 *   - 0% = Cool gray (for silver/stainless steel)
 *   - 50% = Neutral (default)
 *   - 100% = Warm bronze (for gold/brass)
 */
function buildDeepLaserEngravingPrimitives(params: PathFilterPresetParams): FilterPrimitive[] {
  const darkness = (params.darkness ?? 50) / 100 // 0.4 to 1.0
  const warmth = (params.warmth ?? 50) / 100 // 0 to 1.0
  const depth = params.depth ?? 1 // 0-3px range
  const depthGradient = (params.depthGradient ?? 30) / 100 // 0 to 1.0
  const burnTexture = (params.burnTexture ?? 40) / 100 // 0 to 1.0
  const edgeDistortion = (params.edgeDistortion ?? 10) / 100 // 0 to 1.0

  // Light angle for shadow direction (315° = light from top-left)
  const lightAngle = 315
  const angleRad = (lightAngle * Math.PI) / 180

  const primitives: FilterPrimitive[] = []

  // Track which alpha source to use (may be distorted or original)
  let currentAlpha = 'SourceAlpha'

  // ==========================================================================
  // STEP 0: EDGE DISTORTION (feDisplacementMap)
  // ==========================================================================
  // Creates subtle edge irregularity from laser power variation
  // Only apply if edgeDistortion > 0
  if (edgeDistortion > 0) {
    // Generate noise for displacement
    // Lower frequency for larger-scale edge variation (0.01-0.03)
    const distortionFrequency = 0.01 + edgeDistortion * 0.02

    primitives.push(
      {
        type: 'feTurbulence',
        turbulenceType: 'turbulence',
        baseFrequency: distortionFrequency,
        numOctaves: 2,
        seed: 77, // Different seed for unique pattern
        result: 'edgeNoise',
      },
      // Distort alpha for irregular edges from laser variation
      // Scale kept low (max 2px) to preserve thin stroke visibility
      {
        type: 'feDisplacementMap',
        in: 'SourceAlpha',
        in2: 'edgeNoise',
        scale: edgeDistortion * 2, // Max 2px displacement
        xChannelSelector: 'R',
        yChannelSelector: 'G',
        result: 'distortedAlpha',
      }
    )

    currentAlpha = 'distortedAlpha'
  }

  // ==========================================================================
  // COLOR CALCULATION
  // ==========================================================================
  // Calculate engraving color based on darkness and warmth parameters
  // Deep laser engraving produces dark colors but should be distinguishable
  //
  // At darkness 40% (min): baseValue ~100 (medium gray)
  // At darkness 100% (max): baseValue ~25 (dark, but not black)
  const baseValue = Math.round(100 - darkness * 75) // Range: 100 -> 25

  // Apply warmth adjustment for color tint
  const coolShift = 1 - warmth
  const warmShift = warmth

  // Red channel: higher when warm (creates bronze/brown tint)
  const r = Math.round(Math.max(0, Math.min(255, baseValue + warmShift * 30)))
  // Green channel: slightly lower for warmer tones
  const g = Math.round(Math.max(0, Math.min(255, baseValue - warmShift * 10)))
  // Blue channel: higher when cool (gray-blue), lower when warm
  const b = Math.round(Math.max(0, Math.min(255, baseValue + coolShift * 15 - warmShift * 25)))

  const engravingColor = `rgb(${r}, ${g}, ${b})`

  // Calculate darker center color for depth gradient (center is deeper = darker)
  const centerDarkness = Math.min(1, darkness + depthGradient * 0.4)
  const centerBaseValue = Math.round(100 - centerDarkness * 75)
  const centerR = Math.round(Math.max(0, Math.min(255, centerBaseValue + warmShift * 20)))
  const centerG = Math.round(Math.max(0, Math.min(255, centerBaseValue - warmShift * 15)))
  const centerB = Math.round(Math.max(0, Math.min(255, centerBaseValue + coolShift * 10 - warmShift * 20)))
  const centerColor = `rgb(${centerR}, ${centerG}, ${centerB})`

  // Scale depth for visible but subtle effect
  // Use gentler scaling to avoid exaggerated shadows at higher values
  const effectiveDepth = Math.max(depth * 1.5, 0.5)

  // ==========================================================================
  // STEP 1: OUTER SHADOW (matching Debossing formula for pressed-in effect)
  // ==========================================================================
  // Shadow direction: dx = -cos, dy = +sin (same as Debossing)
  // Metal engraving has SHARP edges - use minimal blur
  // Use capped offset/opacity to prevent exaggerated effects at high depth values
  if (depth > 0) {
    // Cap the offset multiplier to prevent shadows from separating too far
    const outerShadowDx = -Math.cos(angleRad) * effectiveDepth * 0.35
    const outerShadowDy = Math.sin(angleRad) * effectiveDepth * 0.35
    const outerShadowBlur = Math.min(effectiveDepth * 0.2, 0.8) // Sharp edges, capped blur

    primitives.push(
      {
        type: 'feOffset',
        in: currentAlpha,
        dx: outerShadowDx,
        dy: outerShadowDy,
        result: 'outerShadowOffset',
      },
      {
        type: 'feGaussianBlur',
        in: 'outerShadowOffset',
        stdDeviation: outerShadowBlur,
        result: 'outerShadowBlur',
      },
      {
        type: 'feComposite',
        in: 'outerShadowBlur',
        in2: currentAlpha,
        operator: 'out',
        result: 'outerShadowClipped',
      },
      {
        type: 'feFlood',
        floodColor: '#000000',
        // Gentler opacity scaling: 0.1 base + max 0.2 from depth
        floodOpacity: Math.min(0.1 + depth * 0.07, 0.3),
        result: 'outerShadowColor',
      },
      {
        type: 'feComposite',
        in: 'outerShadowColor',
        in2: 'outerShadowClipped',
        operator: 'in',
        result: 'outerShadow',
      }
    )
  }

  // ==========================================================================
  // STEP 2: RIM HIGHLIGHT (matching Debossing formula for pressed-in effect)
  // ==========================================================================
  // Highlight direction: dx = +cos, dy = -sin (same as Debossing)
  // Metal has crisp reflective highlights
  if (depth > 0) {
    // Cap the offset multiplier to prevent highlights from separating too far
    const rimHighlightDx = Math.cos(angleRad) * effectiveDepth * 0.25
    const rimHighlightDy = -Math.sin(angleRad) * effectiveDepth * 0.25
    const rimHighlightBlur = Math.min(effectiveDepth * 0.15, 0.6) // Very sharp, capped

    primitives.push(
      {
        type: 'feOffset',
        in: currentAlpha,
        dx: rimHighlightDx,
        dy: rimHighlightDy,
        result: 'rimHighlightOffset',
      },
      {
        type: 'feGaussianBlur',
        in: 'rimHighlightOffset',
        stdDeviation: rimHighlightBlur,
        result: 'rimHighlightBlur',
      },
      {
        type: 'feComposite',
        in: 'rimHighlightBlur',
        in2: currentAlpha,
        operator: 'out', // OUTSIDE the shape - the metal lip
        result: 'rimHighlightClipped',
      },
      {
        type: 'feFlood',
        floodColor: '#ffffff',
        // Gentler opacity scaling: 0.1 base + max 0.15 from depth
        floodOpacity: Math.min(0.1 + depth * 0.05, 0.25),
        result: 'rimHighlightColor',
      },
      {
        type: 'feComposite',
        in: 'rimHighlightColor',
        in2: 'rimHighlightClipped',
        operator: 'in',
        result: 'rimHighlight',
      }
    )
  }

  // ==========================================================================
  // STEP 3: ENGRAVING COLOR WITH DEPTH GRADIENT
  // ==========================================================================
  // Create edge-to-center darkness gradient simulating concave engraving depth
  // Center appears deeper (darker), edges appear shallower (lighter)
  if (depthGradient > 0) {
    // Erode radius determines how much of the center gets the darker color
    // Larger shapes get more visible gradient, thin strokes get subtle effect
    const erodeRadius = Math.max(0.5, depthGradient * 2)

    primitives.push(
      // Create eroded (shrunk) version for the darker center
      {
        type: 'feMorphology',
        in: currentAlpha,
        operator: 'erode',
        radius: erodeRadius,
        result: 'erodedAlpha',
      },
      // Blur the eroded shape to create smooth transition
      {
        type: 'feGaussianBlur',
        in: 'erodedAlpha',
        stdDeviation: erodeRadius * 0.8,
        result: 'erodedBlurred',
      },
      // Clip blurred center to original shape bounds
      {
        type: 'feComposite',
        in: 'erodedBlurred',
        in2: currentAlpha,
        operator: 'in',
        result: 'centerMask',
      },
      // Edge color (lighter) - fills entire shape
      {
        type: 'feFlood',
        floodColor: engravingColor,
        floodOpacity: 1,
        result: 'edgeColor',
      },
      {
        type: 'feComposite',
        in: 'edgeColor',
        in2: currentAlpha,
        operator: 'in',
        result: 'edgeFill',
      },
      // Center color (darker) - fills eroded/blurred center
      {
        type: 'feFlood',
        floodColor: centerColor,
        floodOpacity: 1,
        result: 'centerColorFlood',
      },
      {
        type: 'feComposite',
        in: 'centerColorFlood',
        in2: 'centerMask',
        operator: 'in',
        result: 'centerFill',
      },
      // Blend center over edge using 'over' to layer darker center on lighter edge
      {
        type: 'feComposite',
        in: 'centerFill',
        in2: 'edgeFill',
        operator: 'over',
        result: 'engraved',
      }
    )
  } else {
    // No depth gradient - use solid fill
    primitives.push(
      {
        type: 'feFlood',
        floodColor: engravingColor,
        floodOpacity: 1,
        result: 'engravingBase',
      },
      {
        type: 'feComposite',
        in: 'engravingBase',
        in2: currentAlpha,
        operator: 'in',
        result: 'engraved',
      }
    )
  }

  // ==========================================================================
  // STEP 3.5: BURN TEXTURE (feTurbulence)
  // ==========================================================================
  // Creates subtle charred/scorched texture patterns from laser heat
  // Only apply if burnTexture > 0
  // IMPORTANT: feTurbulence fills the ENTIRE filter region, so we must
  // composite it back to the shape's alpha to avoid filling the bounding box
  if (burnTexture > 0) {
    // Generate fractal noise for burn texture
    // Higher baseFrequency (0.04-0.10) for finer grain visible on thin strokes
    const textureFrequency = 0.04 + burnTexture * 0.06

    primitives.push(
      {
        type: 'feTurbulence',
        turbulenceType: 'fractalNoise', // fractalNoise for smoother, burn-like patterns
        baseFrequency: textureFrequency,
        numOctaves: 3, // More octaves for richer charred texture
        seed: 88, // Different seed from distortion
        result: 'burnNoise',
      },
      // Convert noise to neutral gray with subtle variation
      // Values centered around 0.5 (neutral for overlay blend)
      {
        type: 'feColorMatrix',
        matrixType: 'matrix',
        values: [
          0.2 * burnTexture,
          0,
          0,
          0,
          0.5 - 0.1 * burnTexture, // R: subtle variation
          0.2 * burnTexture,
          0,
          0,
          0,
          0.5 - 0.1 * burnTexture, // G: subtle variation
          0.2 * burnTexture,
          0,
          0,
          0,
          0.5 - 0.1 * burnTexture, // B: subtle variation
          0,
          0,
          0,
          1,
          0, // A -> preserve
        ],
        in: 'burnNoise',
        result: 'burnGray',
      },
      // Blend burn texture with base engraved color
      // Using overlay for balanced light/dark texture that preserves thin strokes
      {
        type: 'feBlend',
        mode: 'overlay',
        in: 'engraved',
        in2: 'burnGray',
        result: 'texturedBlend',
      },
      // CRITICAL: Clip the blended result to the original shape's alpha
      // Without this, feTurbulence fills the entire filter bounding box
      {
        type: 'feComposite',
        in: 'texturedBlend',
        in2: currentAlpha,
        operator: 'in',
        result: 'texturedEngraved',
      }
    )
  }

  const engravedResult = burnTexture > 0 ? 'texturedEngraved' : 'engraved'

  // ==========================================================================
  // STEP 4: INNER SHADOW (matching Debossing formula for pressed-in effect)
  // ==========================================================================
  // Inner shadow direction: dx = -cos, dy = +sin (same as Debossing edge shadow)
  // Metal grooves have sharp shadow edges
  // Use gentler scaling to prevent exaggerated inner shadows at high depth values
  if (depth > 0) {
    // Cap offset multiplier to keep shadow close to edge
    const innerShadowDx = -Math.cos(angleRad) * effectiveDepth * 0.4
    const innerShadowDy = Math.sin(angleRad) * effectiveDepth * 0.4
    const innerShadowBlur = Math.min(effectiveDepth * 0.2, 0.7) // Sharp, capped blur

    primitives.push(
      {
        type: 'feOffset',
        in: currentAlpha,
        dx: innerShadowDx,
        dy: innerShadowDy,
        result: 'innerShadowOffset',
      },
      {
        type: 'feGaussianBlur',
        in: 'innerShadowOffset',
        stdDeviation: innerShadowBlur,
        result: 'innerShadowBlur',
      },
      {
        type: 'feComposite',
        in: 'innerShadowBlur',
        in2: currentAlpha,
        operator: 'in', // INSIDE the shape
        result: 'innerShadowClipped',
      },
      {
        type: 'feFlood',
        floodColor: '#000000',
        // Gentler opacity: 0.15 base + max 0.2 from depth
        floodOpacity: Math.min(0.15 + depth * 0.07, 0.35),
        result: 'innerShadowColor',
      },
      {
        type: 'feComposite',
        in: 'innerShadowColor',
        in2: 'innerShadowClipped',
        operator: 'in',
        result: 'innerShadow',
      }
    )

    // ==========================================================================
    // NO INNER HIGHLIGHT
    // ==========================================================================
    // IMPORTANT: We intentionally do NOT add an inner highlight on the light side
    // Adding brightness inside on the light-facing edge makes it look RAISED/EMBOSSED
    // For engraved effect, the light side should just show the base color

    // ==========================================================================
    // COMBINE ALL LAYERS
    // ==========================================================================
    // Order from back to front:
    // 1. Outer shadow (on metal surface, shadow side)
    // 2. Rim highlight (on metal lip, light side)
    // 3. Engraved fill (the groove color, with optional burn texture)
    // 4. Inner shadow (inside groove, shadow side) - creates depth
    primitives.push({
      type: 'feMerge',
      nodes: [
        { in: 'outerShadow' }, // Shadow cast on metal (shadow side)
        { in: 'rimHighlight' }, // Bright lip outside shape (light side)
        { in: engravedResult }, // Base engraving color (with optional burn texture)
        { in: 'innerShadow' }, // Dark shadow inside (shadow side) - creates depth
      ],
    })
  }
  // If depth = 0, just return the flat engraved color (with optional texture)

  return primitives
}

/**
 * Builds Enamel Fill filter primitives
 *
 * Creates a realistic enamel effect - simplified to preserve colors:
 * 1. Saturation boost for vibrant enamel appearance
 * 2. Edge darkening for recessed/champlevé effect
 * 3. Single subtle specular highlight
 */
function buildEnamelFillPrimitives(params: PathFilterPresetParams): FilterPrimitive[] {
  const gloss = (params.gloss ?? 60) / 100
  const saturation = (params.saturation ?? 120) / 100
  const recess = (params.recess ?? 30) / 100

  const primitives: FilterPrimitive[] = []

  // ==========================================================================
  // STEP 1: SATURATED BASE COLOR
  // ==========================================================================
  primitives.push({
    type: 'feColorMatrix',
    in: 'SourceGraphic',
    matrixType: 'saturate',
    values: saturation,
    result: 'saturatedBase',
  })

  let currentResult = 'saturatedBase'

  // ==========================================================================
  // STEP 2: DEPTH SHADING (recessed enamel effect)
  // ==========================================================================
  // Simple approach: slightly darken overall based on recess parameter
  // This simulates the depth without creating visible outlines
  if (recess > 0) {
    const darkenAmount = 1 - recess * 0.08 // At 100% recess: 0.92 (8% darker)

    primitives.push({
      type: 'feColorMatrix',
      in: currentResult,
      matrixType: 'matrix',
      values: [darkenAmount, 0, 0, 0, 0, 0, darkenAmount, 0, 0, 0, 0, 0, darkenAmount, 0, 0, 0, 0, 0, 1, 0],
      result: 'withRecess',
    })
    currentResult = 'withRecess'
  }

  // ==========================================================================
  // STEP 3: SPECULAR HIGHLIGHT (glass-like surface)
  // ==========================================================================
  // Use high blur to avoid edge highlights, erode mask to keep highlight away from edges
  if (gloss > 0) {
    const blurAmount = 4 + gloss * 2 // Much higher blur to smooth out edges
    const specExponent = 20 + gloss * 30 // Higher = more focused highlight

    primitives.push(
      // High blur to create smooth surface without edge artifacts
      {
        type: 'feGaussianBlur',
        in: 'SourceAlpha',
        stdDeviation: blurAmount,
        result: 'glossBlur',
      },
      {
        type: 'feSpecularLighting',
        in: 'glossBlur',
        surfaceScale: 3 + gloss * 3,
        specularConstant: 0.5 + gloss * 0.5,
        specularExponent: specExponent,
        lightingColor: '#ffffff',
        lightSource: createDistantLight(220, 55),
        result: 'specularRaw',
      },
      // Erode mask to keep highlight away from edges
      {
        type: 'feMorphology',
        in: 'SourceAlpha',
        operator: 'erode',
        radius: 2,
        result: 'erodedMask',
      },
      {
        type: 'feGaussianBlur',
        in: 'erodedMask',
        stdDeviation: 1,
        result: 'erodedMaskBlur',
      },
      {
        type: 'feComposite',
        in: 'specularRaw',
        in2: 'erodedMaskBlur',
        operator: 'in',
        result: 'specularClipped',
      },
      // Control intensity
      {
        type: 'feColorMatrix',
        in: 'specularClipped',
        matrixType: 'matrix',
        values: [
          0.1 + gloss * 0.2,
          0,
          0,
          0,
          0,
          0,
          0.1 + gloss * 0.2,
          0,
          0,
          0,
          0,
          0,
          0.1 + gloss * 0.2,
          0,
          0,
          0,
          0,
          0,
          0.2 + gloss * 0.3,
          0,
        ],
        result: 'glossHighlight',
      },
      {
        type: 'feBlend',
        in: 'glossHighlight',
        in2: currentResult,
        mode: 'screen',
        result: 'withGloss',
      }
    )
    currentResult = 'withGloss'
  }

  // ==========================================================================
  // STEP 4: SUBTLE LUMINOSITY BOOST
  // ==========================================================================
  primitives.push({
    type: 'feColorMatrix',
    in: currentResult,
    matrixType: 'matrix',
    values: [1.03, 0, 0, 0, 0.01, 0, 1.03, 0, 0, 0.01, 0, 0, 1.03, 0, 0.01, 0, 0, 0, 1, 0],
    result: 'final',
  })

  return primitives
}
