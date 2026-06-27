/**
 * Re-export relative shadow utilities from the shared extension library
 * This ensures a single source of truth for both admin and storefront
 *
 * @module TemplateEditor/elements/effects
 */

export type { RelativeShadowPosition } from 'extensions/tailorkit-src/src/shared/libraries/konva/effects/types'

export {
  directionToOffsets,
  offsetsToDirection,
  radiusPercentToPixels,
  radiusToPercent,
  resolveToAbsolute,
  resolveEffectsToAbsolute,
  initializeRelativeFromAbsolute,
  createRelativeShadow,
  // Stroke utilities
  strokePercentToPixels,
} from 'extensions/tailorkit-src/src/shared/libraries/konva/effects/relative-shadow-utils'
