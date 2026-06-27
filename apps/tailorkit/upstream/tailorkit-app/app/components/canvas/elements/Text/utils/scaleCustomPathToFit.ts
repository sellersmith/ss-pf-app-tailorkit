/**
 * Scale custom SVG path data to fit within text layer dimensions
 * Used for custom text-on-path and fill-shape features
 *
 * NOTE: This module re-exports from the shared library to ensure consistency
 * between admin's TemplateEditor and storefront's live preview.
 */

// Re-export all path utilities from shared library for consistency
export {
  scaleCustomPathToFit,
  extractFirstPathData,
  extractViewBoxDimensions,
} from 'extensions/tailorkit-src/src/shared/libraries/konva/text/scale-custom-path'

// Re-export types for convenience
export type {
  CustomPathMetadata,
  ScaleCustomPathOptions,
} from 'extensions/tailorkit-src/src/shared/libraries/konva/text/scale-custom-path'
