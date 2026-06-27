/**
 * Input sanitization utilities for XSS prevention and data validation.
 * Used throughout the AI template generation system for secure data handling.
 */
import DOMPurify from 'dompurify'

/** Sanitization configuration for different contexts */
const SANITIZATION_CONFIG = {
  // For error messages - no HTML allowed
  errorMessage: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
    FORBID_CONTENTS: ['script', 'style', 'iframe', 'object', 'embed'],
  },
}

/**
 * Sanitize error messages to prevent information leakage.
 * @param error - Raw error message to sanitize
 * @returns Sanitized error message safe for user display
 */
export function sanitizeErrorMessage(error: string): string {
  if (!error || typeof error !== 'string') {
    return 'An error occurred'
  }

  // Remove file paths, stack traces, and internal details
  const sanitized = error
    .replace(/\/[^\s]+/g, '[path]') // Remove file paths
    .replace(/at\s+[^\s]+.*$/gm, '') // Remove stack trace lines
    .replace(/Error:\s*/g, '') // Remove error prefixes
    .replace(/TypeError:\s*/g, '')
    .replace(/ReferenceError:\s*/g, '')
    .trim()

  // Sanitize HTML and limit length
  const htmlSanitized = DOMPurify.sanitize(sanitized, SANITIZATION_CONFIG.errorMessage)

  return htmlSanitized.substring(0, 200) || 'An error occurred'
}
