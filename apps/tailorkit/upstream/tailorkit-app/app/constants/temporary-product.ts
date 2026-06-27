/**
 * Constants for temporary product flow (clipart deferred import)
 */

// ID prefixes for temporary products
export const TEMP_VARIANT_PREFIX = 'temp-variant-' as const
export const TEMP_PRODUCT_PREFIX = 'temp-product-' as const

// Helper functions to create temporary IDs
export const createTempVariantId = (integrationId: string): string => `${TEMP_VARIANT_PREFIX}${integrationId}`

export const createTempProductId = (integrationId: string): string => `${TEMP_PRODUCT_PREFIX}${integrationId}`

// Tooltip translation keys for UI protection
export const TEMP_PRODUCT_TOOLTIPS = {
  SAVE_TO_PUBLISH: 'this-is-a-preview-please-save-first-to-enable-publish',
  SAVE_TO_CHANGE_VARIANTS: 'please-save-first-to-change-product-variants',
  SAVE_TO_APPLY_MOCKUPS: 'please-save-first-to-apply-mockups',
  SAVE_TO_ACTIVATE: 'please-save-first-to-activate-product',
} as const
