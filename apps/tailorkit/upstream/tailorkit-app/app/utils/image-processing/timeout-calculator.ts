/**
 * Dynamic timeout calculator for image processing operations
 *
 * Calculates appropriate timeouts based on image dimensions to ensure
 * adequate processing time for large images while keeping small images fast.
 */

import { SERVER_TIMEOUT_CONFIG } from './constants'
import { calculateMegapixels } from './validation/dimensions'

// Re-export for convenience
export { calculateMegapixels }

/**
 * Processing mode for timeout calculation
 */
export type ProcessingMode = 'server'

/**
 * Timeout configuration for a processing mode
 */
export interface TimeoutConfig {
  /** Base timeout in milliseconds */
  base: number
  /** Additional milliseconds per megapixel */
  perMP: number
  /** Maximum timeout in milliseconds */
  max: number
}

/**
 * Default timeout configurations for different processing modes
 */
const TIMEOUT_CONFIGS: Record<ProcessingMode, TimeoutConfig> = {
  server: {
    base: SERVER_TIMEOUT_CONFIG.BASE,
    perMP: SERVER_TIMEOUT_CONFIG.PER_MEGAPIXEL,
    max: SERVER_TIMEOUT_CONFIG.MAX,
  },
}

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
 *
 * @example
 * ```typescript
 * // Calculate timeout for a 4000x3000 image (12MP)
 * const timeout = calculateProcessingTimeout(4000, 3000)
 * // Result: 10000 + (12 * 6000) = 82000ms
 * ```
 */
export function calculateProcessingTimeout(width: number, height: number, mode: ProcessingMode = 'server'): number {
  // Calculate megapixels
  const megapixels = (width * height) / 1_000_000

  // Get configuration for this mode
  const config = TIMEOUT_CONFIGS[mode]

  // Calculate timeout
  const calculated = config.base + megapixels * config.perMP

  // Cap at maximum
  return Math.min(calculated, config.max)
}

/**
 * Get timeout config for a processing mode
 */
export function getTimeoutConfig(mode: ProcessingMode = 'server'): TimeoutConfig {
  return { ...TIMEOUT_CONFIGS[mode] }
}
