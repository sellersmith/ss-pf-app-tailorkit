/**
 * Constants for image mask processing and performance optimization
 */

// Default configuration for mask rendering
export const DEFAULT_MASK_RENDER_CONFIG = {
  smoothEdges: true,
  smoothingStrength: 0.25,
  useDevicePixelRatio: true,
} as const

// RGB to grayscale conversion coefficients (ITU-R BT.709 standard)
export const GRAYSCALE_COEFFICIENTS = {
  RED: 77, // 0.299 * 256
  GREEN: 151, // 0.587 * 256
  BLUE: 28, // 0.114 * 256
} as const

// Performance thresholds for different image processing strategies
export const IMAGE_SIZE_THRESHOLDS = {
  SMALL: 1e6, // 1MP - immediate processing
  MEDIUM: 5e6, // 5MP - 100ms debounce
  LARGE: 20e6, // 20MP - 200ms debounce
  VERY_LARGE: 50e6, // 50MP - 500ms debounce for ultra-large images
} as const

// Canvas size limits
export const CANVAS_LIMITS = {
  MAX_CANVAS_SIZE: 32767, // Browser limit for canvas dimensions
} as const

// Processing thresholds for mask operations
export const MASK_PROCESSING_THRESHOLDS = {
  MAX_PIXELS_FOR_FULL_PROCESSING: 20 * 1e6, // 20MP
  MAX_PIXELS_FOR_FAST_PROCESSING: 5 * 1e6, // 5MP
  ULTRA_LARGE_THRESHOLD: 50 * 1e6, // 50MP
} as const
