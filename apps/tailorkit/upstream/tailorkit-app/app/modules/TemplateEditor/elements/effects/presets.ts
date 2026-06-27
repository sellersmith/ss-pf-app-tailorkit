import type { EffectPreset, EffectConfig, DropShadowConfig, InnerShadowConfig } from './types'

/**
 * Alpha values for emboss/deboss presets.
 * Default values show material underneath, overlay values add color.
 */
export const EMBOSS_ALPHA_DEFAULT = 0.35 // Low alpha to see material
export const EMBOSS_ALPHA_OVERLAY = 0.75 // Higher alpha with color overlay
export const DEBOSS_ALPHA_DEFAULT = 0.15
export const DEBOSS_ALPHA_OVERLAY = 0.7

/**
 * Presets use relative positioning so effects scale with font size.
 * Values are percentages of fontSize:
 * - direction: 0-360° (0=right, 90=down, 180=left, 270=up)
 * - distancePercent: shadow offset distance as % of fontSize
 * - radiusPercent: blur radius as % of fontSize
 *
 * Absolute values (offsetX, offsetY, radius) are included as defaults
 * and will be overwritten at render time based on fontSize.
 */

/**
 * Neon preset - Glowing neon sign effect
 * Uses currentColor for dynamic glow matching text color
 *
 * @param radiusPercent - Base blur radius as % of fontSize (default 6%)
 */
export function createNeonPreset(radiusPercent = 6): EffectPreset {
  const nearPercent = Math.max(2, Math.round(radiusPercent * 0.6))
  const farPercent = Math.max(4, Math.round(radiusPercent * 1.6))

  const effects: EffectConfig[] = [
    {
      type: 'DROP_SHADOW',
      visible: true,
      color: 'currentColor',
      offsetX: 0,
      offsetY: 0,
      radius: 7,
      relative: {
        direction: 0,
        distancePercent: 0, // Centered glow
        radiusPercent: nearPercent,
      },
    },
    {
      type: 'DROP_SHADOW',
      visible: true,
      color: 'currentColor',
      offsetX: 0,
      offsetY: 0,
      radius: 19,
      relative: {
        direction: 0,
        distancePercent: 0, // Centered glow
        radiusPercent: farPercent,
      },
    },
    {
      type: 'INNER_SHADOW',
      visible: true,
      color: 'rgba(255,255,255,0.8)',
      offsetX: 0,
      offsetY: 0,
      radius: 100,
      relative: {
        direction: 0,
        distancePercent: 0,
        radiusPercent: 50, // Large inner glow
      },
    },
  ]
  return { id: 'neon', textColorAlpha: 1, label: 'Neon', effects }
}

/**
 * Emboss preset - Raised 3D effect where text appears to pop out
 * Light source from top-left (135 degrees)
 * Semi-transparent fill to show material underneath
 */
export function createEmbossPreset(): EffectPreset {
  return {
    id: 'emboss',
    label: 'Emboss',
    textColorAlpha: 0.15,
    effects: [
      {
        type: 'INNER_SHADOW',
        visible: true,
        color: 'rgba(0, 0, 0, 0.92)',
        offsetX: 0,
        offsetY: -5,
        radius: 5,
        relative: {
          direction: 270, // Up
          distancePercent: 2.5,
          radiusPercent: 2.5,
        },
      } as InnerShadowConfig,
      {
        type: 'DROP_SHADOW',
        visible: true,
        color: 'rgb(0, 0, 0)',
        offsetX: 3,
        offsetY: 1,
        radius: 3,
        relative: {
          direction: 18, // Slightly down-right
          distancePercent: 1.6,
          radiusPercent: 1.5,
        },
      } as DropShadowConfig,
      {
        type: 'DROP_SHADOW',
        visible: true,
        color: 'rgba(0, 0, 0, 0.99)',
        offsetX: 5,
        offsetY: 4,
        radius: 3,
        relative: {
          direction: 39, // Down-right
          distancePercent: 3.2,
          radiusPercent: 1.5,
        },
      } as DropShadowConfig,
      {
        type: 'DROP_SHADOW',
        visible: true,
        color: 'rgba(0, 0, 0, 0.99)',
        offsetX: -0.5,
        offsetY: 2.5,
        radius: 2.5,
        relative: {
          direction: 101, // Slightly down-left
          distancePercent: 1.3,
          radiusPercent: 1.25,
        },
      } as DropShadowConfig,
    ],
  }
}

/**
 * Deboss/Letterpress preset - Pressed-in effect where text appears sunken
 * Classic "pressed into paper" look
 * Very transparent fill to see material underneath
 */
export function createDebossPreset(): EffectPreset {
  return {
    id: 'deboss',
    label: 'Deboss',
    textColorAlpha: 0.3,
    effects: [
      {
        type: 'INNER_SHADOW',
        visible: true,
        color: 'rgba(235, 234, 234, 0.50)',
        offsetX: 0,
        offsetY: 1.5,
        radius: 2,
        relative: {
          direction: 240, // Down
          distancePercent: 0.75,
          radiusPercent: 0.5,
        },
      },
      {
        type: 'INNER_SHADOW',
        visible: true,
        color: 'rgba(0,0,0,1)',
        offsetX: 5,
        offsetY: 4,
        radius: 4,
        relative: {
          direction: 39, // Down-right
          distancePercent: 3.2,
          radiusPercent: 2,
        },
      } as InnerShadowConfig,
      {
        type: 'INNER_SHADOW',
        visible: true,
        color: 'rgba(0,0,0,1)',
        offsetX: 7,
        offsetY: 4,
        radius: 3,
        relative: {
          direction: 30, // Down-right
          distancePercent: 4,
          radiusPercent: 1.5,
        },
      } as InnerShadowConfig,
    ],
  }
}

// Note: Outline preset uses TextStroke (strokeWeight/strokeColor) instead of shadow effects.
// See EffectsStack.handleSelectPreset for outline implementation.

// ============================================================================
// Embroidery Preset
// ============================================================================

/**
 * Default values for embroidery preset parameters.
 * These serve as the "50%" baseline that users adjust from.
 */
export const EMBROIDERY_DEFAULTS = {
  /** Default depth (how raised the embroidery looks) - 50% baseline */
  depth: 50,
  /** Default sheen (how glossy vs matte) - 40% baseline for satin look */
  sheen: 40,
  /** Default light direction in degrees */
  direction: 135,
}

/**
 * Default blur percentages for embroidery preset shadows
 * Order: [dropShadow, innerShadowDark, innerShadowLight (highlight)]
 */
export const EMBROIDERY_DEFAULT_BLUR_PERCENTS = [3, 2.5, 4]

/**
 * Default distance percentages for embroidery preset shadows
 * Order: [dropShadow, innerShadowDark, innerShadowLight (highlight)]
 */
export const EMBROIDERY_DEFAULT_DISTANCES = [2.5, 2, 1.5]

/**
 * Default opacity values for embroidery preset shadows
 * Order: [dropShadow, innerShadowDark, innerShadowLight (highlight)]
 */
export const EMBROIDERY_DEFAULT_OPACITIES = [0.35, 0.4, 0.35]

/**
 * Embroidery preset - Machine embroidery stitch effect
 *
 * Simulates the raised, textured appearance of machine embroidery:
 * - Drop shadow: Thread raised above fabric surface
 * - Inner shadow (dark): Depth in thread valleys
 * - Inner shadow (light): Highlight from light catching raised threads
 *
 * Adjustable parameters:
 * - Depth: How raised/3D (0-100%, affects shadow distances)
 * - Sheen: How glossy/matte (0-100%, affects highlight intensity)
 * - Direction: Light source angle (0-360°)
 *
 * Designed to work with image fills for thread texture patterns.
 */
export function createEmbroideryPreset(): EffectPreset {
  return {
    id: 'embroidery',
    label: 'Embroidery',
    textColorAlpha: 1,
    effects: [
      // Drop shadow - thread sits raised above fabric
      {
        type: 'DROP_SHADOW',
        visible: true,
        color: 'rgba(0, 0, 0, 0.35)',
        offsetX: 2,
        offsetY: 3,
        radius: 4,
        relative: {
          direction: EMBROIDERY_DEFAULTS.direction,
          distancePercent: EMBROIDERY_DEFAULT_DISTANCES[0],
          radiusPercent: EMBROIDERY_DEFAULT_BLUR_PERCENTS[0],
        },
      } as DropShadowConfig,
      // Inner shadow (dark) - creates depth in thread valleys
      {
        type: 'INNER_SHADOW',
        visible: true,
        color: 'rgba(0, 0, 0, 0.4)',
        offsetX: 1,
        offsetY: 2,
        radius: 3,
        relative: {
          direction: EMBROIDERY_DEFAULTS.direction,
          distancePercent: EMBROIDERY_DEFAULT_DISTANCES[1],
          radiusPercent: EMBROIDERY_DEFAULT_BLUR_PERCENTS[1],
        },
      } as InnerShadowConfig,
      // Inner shadow (light) - highlight from raised thread catching light
      {
        type: 'INNER_SHADOW',
        visible: true,
        color: 'rgba(255, 255, 255, 0.35)',
        offsetX: -1,
        offsetY: -1.5,
        radius: 3,
        relative: {
          direction: (EMBROIDERY_DEFAULTS.direction + 180) % 360, // Opposite of shadow
          distancePercent: EMBROIDERY_DEFAULT_DISTANCES[2],
          radiusPercent: EMBROIDERY_DEFAULT_BLUR_PERCENTS[2],
        },
      } as InnerShadowConfig,
    ],
  }
}
