import type { EffectConfig, DropShadowConfig, InnerShadowConfig } from './types'
import type { EffectStyleType } from '../components/Text/Styling/Effects/EffectPresets'
import {
  EMBROIDERY_DEFAULT_DISTANCES,
  EMBROIDERY_DEFAULT_BLUR_PERCENTS,
  EMBROIDERY_DEFAULT_OPACITIES,
  EMBROIDERY_DEFAULTS,
} from './presets'

/**
 * Utility functions for getting and updating preset parameters.
 * These map user-friendly slider values to internal effect configurations.
 */

// ============================================================================
// Edge Style Types and Constants
// ============================================================================

export type EdgeStyleType = 'soft' | 'standard' | 'crisp'

/**
 * Blur multipliers for edge styles.
 * Soft = more blur (for paper, leather), Crisp = less blur (for metal, wood)
 */
export const EDGE_STYLE_MULTIPLIERS: Record<EdgeStyleType, number> = {
  soft: 1.8,
  standard: 1.0,
  crisp: 0.4,
}

/**
 * Default blur percentages for emboss preset shadows
 * Order: [innerShadow, dropShadow1, dropShadow2, dropShadow3]
 */
export const EMBOSS_DEFAULT_BLUR_PERCENTS = [2.5, 1.5, 1.5, 1.25]

/**
 * Default blur percentages for deboss preset shadows
 * Order: [innerShadow1 (highlight), innerShadow2, innerShadow3]
 */
export const DEBOSS_DEFAULT_BLUR_PERCENTS = [0.5, 2, 1.5]

// Type guards for shadow effects (which have relative property)
function isDropShadow(effect: EffectConfig): effect is DropShadowConfig {
  return effect.type === 'DROP_SHADOW'
}

function isInnerShadow(effect: EffectConfig): effect is InnerShadowConfig {
  return effect.type === 'INNER_SHADOW'
}

function isShadowWithRelative(
  effect: EffectConfig
): effect is (DropShadowConfig | InnerShadowConfig) & { relative: NonNullable<DropShadowConfig['relative']> } {
  return (isDropShadow(effect) || isInnerShadow(effect)) && !!effect.relative
}

// ============================================================================
// Neon Preset Utilities
// ============================================================================

/**
 * Get Neon intensity from effects (0-100)
 * Maps internal radiusPercent (2-20%) to slider value (0-100)
 */
export function getNeonIntensity(effects: EffectConfig[]): number {
  const dropShadow = effects.find((e): e is DropShadowConfig => isDropShadow(e) && !!e.relative)
  if (!dropShadow?.relative) return 50 // Default

  // First drop shadow has nearPercent = radiusPercent * 0.6
  // So actual radiusPercent = nearPercent / 0.6
  const nearPercent = dropShadow.relative.radiusPercent
  const radiusPercent = nearPercent / 0.6

  // Map 2-20% → 0-100
  return Math.round(Math.max(0, Math.min(100, ((radiusPercent - 2) / 18) * 100)))
}

/**
 * Update Neon intensity (0-100)
 * Maps slider value to internal radiusPercent values
 */
export function updateNeonIntensity(effects: EffectConfig[], intensity: number): EffectConfig[] {
  // Map 0-100 → 2-20%
  const radiusPercent = 2 + (intensity / 100) * 18
  const nearPercent = Math.max(2, Math.round(radiusPercent * 0.6))
  const farPercent = Math.max(4, Math.round(radiusPercent * 1.6))

  return effects.map((effect, index) => {
    if (!isShadowWithRelative(effect)) return effect

    if (isInnerShadow(effect)) {
      // Inner shadow keeps large blur for highlight
      return effect
    }

    // Update drop shadows with scaled radiusPercent
    return {
      ...effect,
      relative: {
        ...effect.relative,
        radiusPercent: index === 0 ? nearPercent : farPercent,
      },
    }
  })
}

// ============================================================================
// Emboss/Deboss Preset Utilities
// ============================================================================

/**
 * Default direction values for emboss preset (used as reference)
 */
const EMBOSS_DEFAULT_DIRECTIONS = [270, 18, 39, 101]
const DEBOSS_DEFAULT_DIRECTIONS = [240, 39, 30]

/**
 * Get Emboss/Deboss direction from effects (0-360°)
 * Returns the base light direction
 */
export function getEmbossDirection(effects: EffectConfig[]): number {
  // Use first inner shadow direction as base reference
  const innerShadow = effects.find((e): e is InnerShadowConfig => isInnerShadow(e) && !!e.relative)
  if (innerShadow?.relative) {
    return innerShadow.relative.direction
  }

  // Fallback to first drop shadow
  const dropShadow = effects.find((e): e is DropShadowConfig => isDropShadow(e) && !!e.relative)
  return dropShadow?.relative?.direction ?? 135
}

/**
 * Update Emboss/Deboss direction (0-360°)
 * Rotates all shadow directions relative to new base
 */
export function updateEmbossDirection(
  effects: EffectConfig[],
  direction: number,
  effectStyle: EffectStyleType
): EffectConfig[] {
  const defaultDirs = effectStyle === 'deboss' ? DEBOSS_DEFAULT_DIRECTIONS : EMBOSS_DEFAULT_DIRECTIONS
  const baseDefault = defaultDirs[0]
  const rotation = direction - baseDefault

  return effects.map((effect, index) => {
    if (!isShadowWithRelative(effect)) return effect

    const defaultDir = defaultDirs[index] ?? 0
    const newDirection = (defaultDir + rotation + 360) % 360

    return {
      ...effect,
      relative: {
        ...effect.relative,
        direction: newDirection,
      },
    }
  })
}

/**
 * Default distance values for emboss preset
 */
const EMBOSS_DEFAULT_DISTANCES = [2.5, 1.6, 3.2, 1.3]
const DEBOSS_DEFAULT_DISTANCES = [0.75, 3.2, 4]

/**
 * Get Emboss/Deboss depth from effects (0-100%)
 * Maps internal distancePercent to user-friendly percentage
 */
export function getEmbossDepth(effects: EffectConfig[], effectStyle: EffectStyleType): number {
  const defaultDists = effectStyle === 'deboss' ? DEBOSS_DEFAULT_DISTANCES : EMBOSS_DEFAULT_DISTANCES

  // For deboss, use inner shadow; for emboss, use drop shadow
  let targetShadow: DropShadowConfig | InnerShadowConfig | undefined
  if (effectStyle === 'deboss') {
    targetShadow = effects.find((e): e is InnerShadowConfig => isInnerShadow(e) && !!e.relative)
  } else {
    targetShadow = effects.find((e): e is DropShadowConfig => isDropShadow(e) && !!e.relative)
  }

  if (!targetShadow?.relative) return 50 // Default

  // Calculate multiplier based on current vs default distance
  const shadowIndex = effects.indexOf(targetShadow)
  const defaultDist = defaultDists[shadowIndex] ?? 1.6

  if (defaultDist === 0) return 50

  const multiplier = targetShadow.relative.distancePercent / defaultDist

  // Map multiplier (0-2) → (0-100)
  return Math.round(Math.max(0, Math.min(100, multiplier * 50)))
}

/**
 * Update Emboss/Deboss depth (0-100%)
 * Scales all shadow distances proportionally
 */
export function updateEmbossDepth(
  effects: EffectConfig[],
  depth: number,
  effectStyle: EffectStyleType
): EffectConfig[] {
  const defaultDists = effectStyle === 'deboss' ? DEBOSS_DEFAULT_DISTANCES : EMBOSS_DEFAULT_DISTANCES

  // Map 0-100 → 0-2 multiplier
  const multiplier = depth / 50

  return effects.map((effect, index) => {
    if (!isShadowWithRelative(effect)) return effect

    const defaultDist = defaultDists[index] ?? 1.6
    const newDistance = defaultDist * multiplier

    return {
      ...effect,
      relative: {
        ...effect.relative,
        distancePercent: newDistance,
      },
    }
  })
}

// ============================================================================
// Edge Style Utilities
// ============================================================================

/**
 * Get current edge style from effects blur values.
 * Compares current radiusPercent to defaults and determines style.
 */
export function getEdgeStyle(effects: EffectConfig[], effectStyle: EffectStyleType): EdgeStyleType {
  if (effectStyle !== 'emboss' && effectStyle !== 'deboss') {
    return 'standard'
  }

  const defaultBlurs = effectStyle === 'deboss' ? DEBOSS_DEFAULT_BLUR_PERCENTS : EMBOSS_DEFAULT_BLUR_PERCENTS
  const shadowEffects = effects.filter(isShadowWithRelative)

  if (shadowEffects.length === 0) {
    return 'standard'
  }

  // Calculate average ratio of current blur to default blur
  let totalRatio = 0
  let count = 0

  shadowEffects.forEach((effect, index) => {
    const defaultBlur = defaultBlurs[index] ?? 1
    if (defaultBlur > 0 && effect.relative.radiusPercent > 0) {
      totalRatio += effect.relative.radiusPercent / defaultBlur
      count++
    }
  })

  if (count === 0) {
    return 'standard'
  }

  const avgRatio = totalRatio / count

  // Determine edge style based on average ratio
  if (avgRatio < 0.7) {
    return 'crisp'
  }
  if (avgRatio > 1.4) {
    return 'soft'
  }
  return 'standard'
}

/**
 * Update edge style by scaling all shadow radiusPercent values.
 * Multiplies default blur values by the edge style multiplier.
 */
export function updateEdgeStyle(
  effects: EffectConfig[],
  edgeStyle: EdgeStyleType,
  effectStyle: EffectStyleType
): EffectConfig[] {
  if (effectStyle !== 'emboss' && effectStyle !== 'deboss') {
    return effects
  }

  const defaultBlurs = effectStyle === 'deboss' ? DEBOSS_DEFAULT_BLUR_PERCENTS : EMBOSS_DEFAULT_BLUR_PERCENTS
  const multiplier = EDGE_STYLE_MULTIPLIERS[edgeStyle]

  return effects.map((effect, index) => {
    if (!isShadowWithRelative(effect)) return effect

    const defaultBlur = defaultBlurs[index] ?? 1
    const newRadiusPercent = defaultBlur * multiplier

    return {
      ...effect,
      relative: {
        ...effect.relative,
        radiusPercent: newRadiusPercent,
      },
    }
  })
}

// ============================================================================
// Embroidery Preset Utilities
// ============================================================================

/**
 * Default direction for embroidery (light source direction)
 */
const EMBROIDERY_DEFAULT_DIRECTION = EMBROIDERY_DEFAULTS.direction

/**
 * Get embroidery depth from effects (0-100)
 * Depth controls how raised/3D the embroidery appears
 */
export function getEmbroideryDepth(effects: EffectConfig[]): number {
  const dropShadow = effects.find((e): e is DropShadowConfig => isDropShadow(e) && !!e.relative)
  if (!dropShadow?.relative) return EMBROIDERY_DEFAULTS.depth

  // Calculate ratio of current distance to default
  const defaultDist = EMBROIDERY_DEFAULT_DISTANCES[0]
  if (defaultDist === 0) return EMBROIDERY_DEFAULTS.depth

  const ratio = dropShadow.relative.distancePercent / defaultDist
  // Map ratio (0-2) → (0-100)
  return Math.round(Math.max(0, Math.min(100, ratio * 50)))
}

/**
 * Update embroidery depth (0-100)
 * Scales all shadow distances proportionally
 */
export function updateEmbroideryDepth(effects: EffectConfig[], depth: number): EffectConfig[] {
  // Map 0-100 → 0-2 multiplier
  const multiplier = depth / 50

  return effects.map((effect, index) => {
    if (!isShadowWithRelative(effect)) return effect

    const defaultDist = EMBROIDERY_DEFAULT_DISTANCES[index] ?? 2
    const newDistance = defaultDist * multiplier

    // Also scale blur slightly with depth for more realistic effect
    const defaultBlur = EMBROIDERY_DEFAULT_BLUR_PERCENTS[index] ?? 3
    const blurMultiplier = 0.7 + multiplier * 0.3 // Range: 0.7x to 1.3x
    const newBlur = defaultBlur * blurMultiplier

    return {
      ...effect,
      relative: {
        ...effect.relative,
        distancePercent: newDistance,
        radiusPercent: newBlur,
      },
    }
  })
}

/**
 * Get embroidery sheen from effects (0-100)
 * Sheen controls how glossy vs matte the thread appears
 */
export function getEmbroiderySheen(effects: EffectConfig[]): number {
  // Find the highlight inner shadow (last one with light color)
  const highlightShadow = effects.find(
    (e): e is InnerShadowConfig => isInnerShadow(e) && !!e.relative && e.color.includes('255')
  )

  if (!highlightShadow) return EMBROIDERY_DEFAULTS.sheen

  // Parse the opacity from rgba color
  const match = highlightShadow.color.match(/[\d.]+(?=\))/)
  const currentOpacity = match ? parseFloat(match[0]) : EMBROIDERY_DEFAULT_OPACITIES[2]
  const defaultOpacity = EMBROIDERY_DEFAULT_OPACITIES[2]

  if (defaultOpacity === 0) return EMBROIDERY_DEFAULTS.sheen

  // Map opacity ratio to 0-100 (0.5x to 1.5x range)
  const ratio = currentOpacity / defaultOpacity
  return Math.round(Math.max(0, Math.min(100, (ratio - 0.5) * 100)))
}

/**
 * Update embroidery sheen (0-100)
 * Adjusts the highlight inner shadow opacity
 */
export function updateEmbroiderySheen(effects: EffectConfig[], sheen: number): EffectConfig[] {
  // Map 0-100 → 0.5x to 1.5x multiplier for highlight opacity
  const multiplier = 0.5 + sheen / 100

  return effects.map((effect, index) => {
    if (!isInnerShadow(effect)) return effect

    // Check if this is the highlight shadow (has white/light color)
    if (!effect.color.includes('255')) return effect

    const defaultOpacity = EMBROIDERY_DEFAULT_OPACITIES[2]
    const newOpacity = Math.max(0, Math.min(1, defaultOpacity * multiplier))

    // Update the alpha in the color
    const newColor = effect.color.replace(
      /rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/,
      `rgba($1, $2, $3, ${newOpacity.toFixed(2)})`
    )

    return {
      ...effect,
      color: newColor,
    }
  })
}

/**
 * Get embroidery direction from effects (0-360°)
 */
export function getEmbroideryDirection(effects: EffectConfig[]): number {
  const dropShadow = effects.find((e): e is DropShadowConfig => isDropShadow(e) && !!e.relative)
  return dropShadow?.relative?.direction ?? EMBROIDERY_DEFAULT_DIRECTION
}

/**
 * Update embroidery direction (0-360°)
 * Rotates all shadow directions relative to new light angle
 */
export function updateEmbroideryDirection(effects: EffectConfig[], direction: number): EffectConfig[] {
  const rotation = direction - EMBROIDERY_DEFAULT_DIRECTION

  return effects.map((effect, index) => {
    if (!isShadowWithRelative(effect)) return effect

    // Highlight shadow is opposite direction from drop shadow
    const isHighlight = isInnerShadow(effect) && effect.color.includes('255')
    const baseDirection = isHighlight ? (EMBROIDERY_DEFAULT_DIRECTION + 180) % 360 : EMBROIDERY_DEFAULT_DIRECTION

    const newDirection = (baseDirection + rotation + 360) % 360

    return {
      ...effect,
      relative: {
        ...effect.relative,
        direction: newDirection,
      },
    }
  })
}

// ============================================================================
// Combined Update Function
// ============================================================================

/**
 * Update preset parameters based on effect style
 */
export function updatePresetParameter(
  effects: EffectConfig[],
  effectStyle: EffectStyleType,
  param: 'intensity' | 'direction' | 'depth' | 'sheen',
  value: number
): EffectConfig[] {
  switch (param) {
    case 'intensity':
      return updateNeonIntensity(effects, value)
    case 'direction':
      if (effectStyle === 'embroidery') {
        return updateEmbroideryDirection(effects, value)
      }
      return updateEmbossDirection(effects, value, effectStyle)
    case 'depth':
      if (effectStyle === 'embroidery') {
        return updateEmbroideryDepth(effects, value)
      }
      return updateEmbossDepth(effects, value, effectStyle)
    case 'sheen':
      return updateEmbroiderySheen(effects, value)
    default:
      return effects
  }
}
