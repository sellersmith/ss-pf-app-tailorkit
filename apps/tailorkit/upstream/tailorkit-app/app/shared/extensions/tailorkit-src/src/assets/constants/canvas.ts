/**
 * Canvas constants for safe pixel limits
 *
 * These are used by init-canvas.ts to determine safe canvas sizes
 * that won't exceed memory limits on different devices.
 */

/**
 * Safe canvas pixel limit for iOS devices
 * iOS Safari has stricter WebGL texture limits
 */
export const SAFE_CANVAS_PIXELS_IOS = 16_000_000

/**
 * Safe canvas pixel limit for non-iOS devices
 * Desktop browsers typically support much larger canvases
 */
export const SAFE_CANVAS_PIXELS_DEFAULT = 26_843_545_600
