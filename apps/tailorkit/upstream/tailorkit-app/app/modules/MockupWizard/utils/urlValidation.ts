// Import from shared validation utilities
import {
  validateImageUrl as sharedValidateImageUrl,
  DEFAULT_ALLOWED_DOMAINS,
  DEFAULT_VALID_EXTENSIONS,
  type UrlValidationOptions,
} from '~/utils/image-processing/validation/url'

// Re-export types for backward compatibility
export type { UrlValidationOptions }

/**
 * URL validation result
 */
export interface UrlValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Allowed domains for image URLs in MockupWizard
 * Using default domains from shared utilities
 */
const ALLOWED_DOMAINS = DEFAULT_ALLOWED_DOMAINS

/**
 * Valid image file extensions
 * Using defaults from shared utilities
 */
const VALID_IMAGE_EXTENSIONS = DEFAULT_VALID_EXTENSIONS

/**
 * Validates an image URL for MockupWizard processing
 * Uses shared validation utilities with MockupWizard-specific defaults
 *
 * @param url - The image URL to validate
 * @returns Validation result with isValid flag and optional error message
 *
 * @example
 * ```typescript
 * const result = validateImageUrl('https://cdn.shopify.com/image.jpg')
 * if (!result.isValid) {
 *   console.error(result.error)
 * }
 * ```
 */
export function validateImageUrl(url: string): UrlValidationResult {
  return sharedValidateImageUrl(url, {
    allowedDomains: ALLOWED_DOMAINS,
    validExtensions: VALID_IMAGE_EXTENSIONS,
    requireHttps: true,
  })
}
