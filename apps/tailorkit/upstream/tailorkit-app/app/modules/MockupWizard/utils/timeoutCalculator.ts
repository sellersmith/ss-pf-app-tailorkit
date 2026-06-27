/**
 * Dynamic timeout calculator for image processing operations
 *
 * Re-exports shared timeout calculator for backward compatibility
 */

// Import from shared utilities
import {
  calculateProcessingTimeout as sharedCalculateProcessingTimeout,
  type ProcessingMode,
  type TimeoutConfig,
} from '~/utils/image-processing/timeout-calculator'

// Re-export types for backward compatibility
export type { ProcessingMode, TimeoutConfig }

/**
 * Calculate appropriate timeout for image processing based on dimensions
 *
 * Formula: timeout = base + (megapixels × timePerMP)
 * Result is capped at the maximum timeout for the processing mode
 *
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param mode - Processing mode (default: 'server')
 * @returns Timeout in milliseconds
 */
export function calculateProcessingTimeout(width: number, height: number, mode: ProcessingMode = 'server'): number {
  return sharedCalculateProcessingTimeout(width, height, mode)
}
