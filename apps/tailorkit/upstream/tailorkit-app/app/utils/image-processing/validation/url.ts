/**
 * Image URL validation utilities
 *
 * Validates image URLs for security and format requirements.
 * Configurable for different use cases with domain whitelisting
 * and extension validation.
 */

import type { ValidationResult } from '~/types/geometry'
import { safeUrlHandler } from '~/utils/safeUrlHandler'

/**
 * Options for URL validation
 */
export interface UrlValidationOptions {
  /** List of allowed domains (e.g., ['cdn.shopify.com', 's3.amazonaws.com']) */
  allowedDomains?: string[]
  /** List of valid file extensions (e.g., ['.jpg', '.png']) */
  validExtensions?: string[]
  /** Whether HTTPS is required (default: true) */
  requireHttps?: boolean
}

/**
 * Default allowed domains for image URLs
 */
export const DEFAULT_ALLOWED_DOMAINS = ['cdn.shopify.com', 'shopify.com', 's3.amazonaws.com']

/**
 * Default valid image file extensions
 */
export const DEFAULT_VALID_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

/**
 * Validates an image URL
 *
 * @param url - The image URL to validate
 * @param options - Validation options
 * @returns Validation result with isValid flag and optional error message
 *
 * @example
 * ```typescript
 * // Use default options
 * const result = validateImageUrl('https://cdn.shopify.com/image.jpg')
 *
 * // Use custom options
 * const result = validateImageUrl('https://example.com/image.png', {
 *   allowedDomains: ['example.com'],
 *   validExtensions: ['.png'],
 * })
 * ```
 */
export function validateImageUrl(url: string, options: UrlValidationOptions = {}): ValidationResult {
  const {
    allowedDomains = DEFAULT_ALLOWED_DOMAINS,
    validExtensions = DEFAULT_VALID_EXTENSIONS,
    requireHttps = true,
  } = options

  // Check if URL is provided
  if (!url || typeof url !== 'string') {
    return {
      isValid: false,
      error: 'URL is required and must be a string',
    }
  }

  // Trim whitespace
  const trimmedUrl = url.trim()

  // Use safeUrlHandler for basic URL parsing and validation
  const isValidUrl = safeUrlHandler(trimmedUrl, urlObj => {
    // Check protocol
    if (requireHttps && urlObj.protocol !== 'https:') {
      return false
    }

    // Check if domain is in whitelist (if domains are specified)
    if (allowedDomains.length > 0) {
      const hostname = urlObj.hostname.toLowerCase()
      const isDomainAllowed = allowedDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))

      if (!isDomainAllowed) {
        return false
      }
    }

    // Check file extension (if extensions are specified)
    if (validExtensions.length > 0) {
      const pathname = urlObj.pathname.toLowerCase()
      const hasValidExtension = validExtensions.some(ext => pathname.endsWith(ext))

      if (!hasValidExtension) {
        return false
      }
    }

    return true
  })

  if (!isValidUrl) {
    // Parse again to provide specific error message
    try {
      const urlObj = new URL(trimmedUrl)

      // Check protocol
      if (requireHttps && urlObj.protocol !== 'https:') {
        return {
          isValid: false,
          error: 'URL must use HTTPS protocol',
        }
      }

      // Check domain
      if (allowedDomains.length > 0) {
        const hostname = urlObj.hostname.toLowerCase()
        const isDomainAllowed = allowedDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))

        if (!isDomainAllowed) {
          return {
            isValid: false,
            error: `URL domain not allowed. Allowed domains: ${allowedDomains.join(', ')}`,
          }
        }
      }

      // Check extension
      if (validExtensions.length > 0) {
        const pathname = urlObj.pathname.toLowerCase()
        const hasValidExtension = validExtensions.some(ext => pathname.endsWith(ext))

        if (!hasValidExtension) {
          return {
            isValid: false,
            error: `URL must point to an image file. Valid extensions: ${validExtensions.join(', ')}`,
          }
        }
      }
    } catch {
      return {
        isValid: false,
        error: 'Invalid URL format',
      }
    }

    return {
      isValid: false,
      error: 'URL validation failed',
    }
  }

  return { isValid: true }
}

/**
 * Check if a URL is valid (simpler version that just returns boolean)
 */
export function isValidImageUrl(url: string, options: UrlValidationOptions = {}): boolean {
  return validateImageUrl(url, options).isValid
}
