/**
 * Image dimension validation utilities
 *
 * Validates image dimensions against configurable limits to prevent
 * memory issues and ensure processing feasibility.
 */

import type { ValidationResult } from '~/types/geometry'

/**
 * Dimension information for an image
 */
export interface ImageDimensions {
  width: number
  height: number
  megapixels: number
}

/**
 * Default maximum image dimension limits
 */
export const IMAGE_DIMENSION_LIMITS = {
  MAX_WIDTH: 10000,
  MAX_HEIGHT: 10000,
  MAX_MEGAPIXELS: 100,
} as const

/**
 * Calculate megapixels from width and height
 */
export function calculateMegapixels(width: number, height: number): number {
  return (width * height) / 1_000_000
}

/**
 * Get full dimension info for an image
 */
export function getImageDimensions(width: number, height: number): ImageDimensions {
  return {
    width,
    height,
    megapixels: calculateMegapixels(width, height),
  }
}

/**
 * Validate image dimensions against maximum limits
 *
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param limits - Optional custom limits (defaults to IMAGE_DIMENSION_LIMITS)
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
export function validateImageDimensions(
  width: number,
  height: number,
  limits: Partial<typeof IMAGE_DIMENSION_LIMITS> = {}
): ValidationResult {
  const maxWidth = limits.MAX_WIDTH ?? IMAGE_DIMENSION_LIMITS.MAX_WIDTH
  const maxHeight = limits.MAX_HEIGHT ?? IMAGE_DIMENSION_LIMITS.MAX_HEIGHT
  const maxMegapixels = limits.MAX_MEGAPIXELS ?? IMAGE_DIMENSION_LIMITS.MAX_MEGAPIXELS

  if (width <= 0 || height <= 0) {
    return {
      isValid: false,
      error: 'Invalid image dimensions',
    }
  }

  if (width > maxWidth || height > maxHeight) {
    return {
      isValid: false,
      error: `Image dimensions exceed maximum size. Maximum: ${maxWidth}×${maxHeight} pixels`,
    }
  }

  const megapixels = calculateMegapixels(width, height)
  if (megapixels > maxMegapixels) {
    return {
      isValid: false,
      error: `Image size exceeds maximum ${maxMegapixels}MP (${megapixels.toFixed(1)}MP)`,
    }
  }

  return { isValid: true }
}

/**
 * Check if dimensions are within processing limits
 * (simpler version that just returns boolean)
 */
export function areDimensionsValid(
  width: number,
  height: number,
  limits: Partial<typeof IMAGE_DIMENSION_LIMITS> = {}
): boolean {
  return validateImageDimensions(width, height, limits).isValid
}
