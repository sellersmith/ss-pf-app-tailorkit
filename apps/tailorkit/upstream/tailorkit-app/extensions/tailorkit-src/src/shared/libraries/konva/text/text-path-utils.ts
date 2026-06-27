/**
 * Shared utility functions for text path calculations
 * Used by both admin app and extensions
 */

/**
 * Validates and ensures safe radius values for canvas operations
 * @param width - Container width
 * @param height - Container height
 * @returns Safe radius that won't cause canvas errors (radius is fixed based on container size only)
 */
export function calculateSafeRadius(width: number, height: number): number {
  // Calculate base radius - fixed based on container dimensions only
  // Use a small margin (5% of container) to ensure circle fits within bounds
  // We want the circle to touch the bounds of the element (minus a tiny safety
  // padding so that Konva strokes never bleed outside the frame).  Using one half
  // of the smaller dimension gives us a perfect inscribed circle.
  const safetyPadding = 1 // px – prevents half-pixel bleed when the stroke is drawn

  const baseRadius = Math.min(width, height) / 2 - safetyPadding

  // Make sure the radius never goes below 1 px so that Konva does not crash.
  return Math.max(1, baseRadius)
}

/**
 * Validates geometry parameters for text path calculations
 * @param params - Geometry parameters
 * @returns Validated parameters with safe fallbacks
 */
export function validateGeometryParams(params: { width: number; height: number }) {
  const { width, height } = params

  // Validate inputs and provide safe fallbacks
  const safeWidth = Math.max(1, width || 1)
  const safeHeight = Math.max(1, height || 1)

  return {
    width: safeWidth,
    height: safeHeight,
  }
}

/**
 * Checks if the current geometry would result in a valid text path
 * @param width - Container width
 * @param height - Container height
 * @param fontSize - Font size
 * @returns True if geometry is valid for text path rendering
 */
export function isValidTextPathGeometry(width: number, height: number, fontSize: number): boolean {
  const { width: safeWidth, height: safeHeight } = validateGeometryParams({
    width,
    height,
  })

  // Check if there's enough space for text
  const minRadius = calculateSafeRadius(safeWidth, safeHeight)

  return minRadius > 1 // Ensure minimum space for readable text
}

/**
 * Converts radians to degrees
 * @param radians - Angle in radians
 * @returns Angle in degrees
 */
export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI)
}

/**
 * Converts degrees to radians
 * @param degrees - Angle in degrees
 * @returns Angle in radians
 */
export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Snaps an angle to the nearest increment when shift is held
 * @param angle - Current angle in radians
 * @param isShiftPressed - Whether shift key is pressed
 * @param snapIncrement - Snap increment in degrees (default: 15)
 * @returns Snapped angle in radians
 */
export function snapAngleToIncrement(angle: number, isShiftPressed: boolean, snapIncrement: number = 15): number {
  if (!isShiftPressed) {
    return angle
  }

  // Convert to degrees for easier calculation
  const degrees = radiansToDegrees(angle)

  // Normalize to 0-360 range
  const normalizedDegrees = ((degrees % 360) + 360) % 360

  // Snap to nearest increment
  const snappedDegrees = Math.round(normalizedDegrees / snapIncrement) * snapIncrement

  // Convert back to radians
  return degreesToRadians(snappedDegrees)
}
