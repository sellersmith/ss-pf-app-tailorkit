/**
 * Image preprocessing utilities for MockupWizard
 *
 * Re-exports shared validation utilities for backward compatibility
 */

// Import from shared validation utilities
import {
  validateImageDimensions as sharedValidateImageDimensions,
  IMAGE_DIMENSION_LIMITS,
  type ImageDimensions,
} from '~/utils/image-processing/validation/dimensions'

// Re-export types for backward compatibility
export type { ImageDimensions }

/**
 * Maximum supported image dimensions
 * Using values from shared utilities
 */
export const MAX_IMAGE_WIDTH = IMAGE_DIMENSION_LIMITS.MAX_WIDTH
export const MAX_IMAGE_HEIGHT = IMAGE_DIMENSION_LIMITS.MAX_HEIGHT
export const MAX_MEGAPIXELS = IMAGE_DIMENSION_LIMITS.MAX_MEGAPIXELS

/**
 * Validate image dimensions against maximum limits
 *
 * @param width - Image width
 * @param height - Image height
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```typescript
 * const result = validateImageDimensions(4500, 3000)
 * if (!result.isValid) {
 *   console.error(result.error)
 * }
 * ```
 */
export function validateImageDimensions(width: number, height: number): { isValid: boolean; error?: string } {
  return sharedValidateImageDimensions(width, height)
}
