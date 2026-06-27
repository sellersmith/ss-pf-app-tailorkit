/**
 * Image processing constants
 *
 * Centralized constants for image processing operations including
 * dimension thresholds, quality settings, and timeout values.
 */

/**
 * Dimension thresholds for image processing routing and downscaling
 *
 * These values determine when images are routed to server-side processing
 * and what maximum dimensions are used for client-side processing.
 */
export const IMAGE_PROCESSING_THRESHOLDS = {
  /** Server-side: Downscale images larger than this */
  SERVER_DOWNSCALE: 1536,
  /** Desktop: Route to server if larger than this */
  DESKTOP_FORCE_SERVER: 1536,
  /** Desktop: Downscale to this for client processing */
  DESKTOP_DOWNSCALE: 1024,
  /** Mobile: Route to server if larger than this */
  MOBILE_FORCE_SERVER: 1024,
  /** Mobile: Downscale to this for client processing */
  MOBILE_DOWNSCALE: 768,
} as const

/**
 * PNG output quality settings
 */
export const PNG_QUALITY = {
  /** Compression level (0-9, 9 = maximum compression) */
  COMPRESSION_LEVEL: 9,
  /** Enable adaptive filtering for better gradient compression */
  ADAPTIVE_FILTERING: true,
  /** Use palette mode (false = keep full RGBA) */
  PALETTE: false,
} as const

/**
 * Processing timeout values in milliseconds
 */
export const PROCESSING_TIMEOUTS = {
  /** Client-side processing timeout before falling back to server */
  CLIENT: 5000,
  /** Debounce delay for reprocessing when parameters change */
  DEBOUNCE: 800,
  /** Network timeout for image downloads */
  DOWNLOAD: 15000,
} as const

/**
 * Server-side timeout calculation configuration
 */
export const SERVER_TIMEOUT_CONFIG = {
  /** Base timeout in milliseconds */
  BASE: 10000,
  /** Additional milliseconds per megapixel */
  PER_MEGAPIXEL: 6000,
  /** Maximum timeout in milliseconds */
  MAX: 180000,
} as const
