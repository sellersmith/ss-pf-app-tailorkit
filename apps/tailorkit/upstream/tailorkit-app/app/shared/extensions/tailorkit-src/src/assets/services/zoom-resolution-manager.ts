/**
 * Zoom Resolution Manager
 *
 * Calculates optimal canvas pixelRatio based on zoom level and device capabilities.
 * Implements iOS-safe memory limits to prevent Safari crashes.
 *
 * @module assets/services
 */

import { isIOS } from '../utils/devices'

// Maximum pixel ratios by device type
const MAX_PIXEL_RATIO_IOS = 2
const MAX_PIXEL_RATIO_DEFAULT = 3

// Canvas memory limits (in pixels)
// iOS Safari has strict limits: ~16MB for older devices, ~256MB for newer
// At 4 bytes per pixel (RGBA), 3M pixels = 12MB (safe for most iOS devices)
const MAX_CANVAS_PIXELS_IOS = 3_000_000
const MAX_CANVAS_PIXELS_DEFAULT = 12_000_000

// Minimum threshold for resolution updates (20% change)
const UPDATE_THRESHOLD = 0.2

/**
 * Calculate the optimal pixelRatio based on zoom level and device
 *
 * @param zoomScale - Current zoom scale from pinch gesture (1-3)
 * @param canvasWidth - Canvas width in logical pixels
 * @param canvasHeight - Canvas height in logical pixels
 * @returns Optimal pixelRatio that stays within device memory limits
 */
export function calculateZoomPixelRatio(
  zoomScale: number,
  canvasWidth: number,
  canvasHeight: number
): number {
  // Get device pixel ratio with fallback
  const baseRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

  // Target ratio = zoom level * device pixel ratio
  // Minimum of 1 to prevent downscaling
  let targetRatio = Math.max(1, zoomScale) * baseRatio

  // Cap by device type to prevent excessive memory usage
  const isIOSDevice = isIOS()
  const maxRatio = isIOSDevice ? MAX_PIXEL_RATIO_IOS : MAX_PIXEL_RATIO_DEFAULT
  targetRatio = Math.min(targetRatio, maxRatio)

  // iOS memory safety check
  // Calculate total pixels at target ratio and scale down if needed
  const maxPixels = isIOSDevice ? MAX_CANVAS_PIXELS_IOS : MAX_CANVAS_PIXELS_DEFAULT
  const targetPixels = canvasWidth * canvasHeight * targetRatio * targetRatio

  if (targetPixels > maxPixels) {
    // Scale down to fit memory limit
    // Formula: newRatio = sqrt(maxPixels / canvasArea)
    targetRatio = Math.sqrt(maxPixels / (canvasWidth * canvasHeight))
  }

  // Ensure minimum ratio of 1
  return Math.max(1, targetRatio)
}

/**
 * Determine if resolution should be updated based on ratio change
 * Prevents excessive re-renders during smooth zoom gestures
 *
 * @param oldRatio - Previous pixelRatio
 * @param newRatio - New calculated pixelRatio
 * @returns true if the change is significant enough to warrant a re-render
 */
export function shouldUpdateResolution(oldRatio: number, newRatio: number): boolean {
  // Prevent division by zero
  if (oldRatio === 0) return newRatio > 0

  // Only update if change exceeds threshold (20%)
  const change = Math.abs(newRatio - oldRatio) / oldRatio
  return change > UPDATE_THRESHOLD
}

/**
 * Get the maximum safe pixelRatio for the current device
 *
 * @returns Maximum pixelRatio that won't cause memory issues
 */
export function getMaxPixelRatio(): number {
  return isIOS() ? MAX_PIXEL_RATIO_IOS : MAX_PIXEL_RATIO_DEFAULT
}

/**
 * Get the maximum canvas pixels for the current device
 *
 * @returns Maximum total pixels (width * height * pixelRatio^2)
 */
export function getMaxCanvasPixels(): number {
  return isIOS() ? MAX_CANVAS_PIXELS_IOS : MAX_CANVAS_PIXELS_DEFAULT
}
