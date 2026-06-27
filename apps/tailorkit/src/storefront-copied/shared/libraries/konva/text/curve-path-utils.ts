import { validateGeometryParams } from './text-path-utils'

// Constants for curve calculation
const DEFAULT_CALCULATION_STEPS = 100 // Balance between accuracy (99.5%) and performance
const MIN_CALCULATION_STEPS = 10 // Minimum steps for basic accuracy
const MAX_CALCULATION_STEPS = 500 // Maximum steps to prevent performance issues
const CURVE_BOUNDARY_MARGIN = 5 // Pixels margin from container edges
const MIN_CURVE_PEAKS = 1 // Minimum number of peaks
const MAX_CURVE_PEAKS = 4 // Maximum number of peaks
const MIN_CURVE_BEND = -100 // Minimum bend percentage
const MAX_CURVE_BEND = 100 // Maximum bend percentage

/**
 * Options for customizing curve path calculation
 */
interface CurveCalculationOptions {
  /** Number of steps for numerical approximation (default: 100) */
  steps?: number
}

/**
 * Validate curve parameters to ensure they're within acceptable bounds
 */
function validateCurveParams(curvePeaks: number, curveBend: number): void {
  if (curvePeaks < MIN_CURVE_PEAKS || curvePeaks > MAX_CURVE_PEAKS) {
    throw new Error(`curvePeaks must be between ${MIN_CURVE_PEAKS} and ${MAX_CURVE_PEAKS}, got: ${curvePeaks}`)
  }

  if (curveBend < MIN_CURVE_BEND || curveBend > MAX_CURVE_BEND) {
    throw new Error(`curveBend must be between ${MIN_CURVE_BEND}% and ${MAX_CURVE_BEND}%, got: ${curveBend}%`)
  }
}

/**
 * Calculate curve path length using numerical approximation
 *
 * This function approximates the length of a sinusoidal curve by breaking it into
 * small line segments and summing their lengths. This is necessary because sinusoidal
 * curves don't have a simple closed-form solution for arc length.
 *
 * @param width - Container width in pixels
 * @param height - Container height in pixels
 * @param curvePeaks - Number of wave peaks (1-4). Each peak = π radians (half cycle)
 * @param curveBend - Bend percentage (-100% to 100%). 100% = peak touches boundary
 * @returns The approximate curve length in pixels
 *
 * @example
 * // Calculate length of a 1000x500 container with 2 peaks at 75% bend
 * const length = calculateCurvePathLength(1000, 500, 2, 75)
 * // Returns ~1200px (approximate)
 */
export function calculateCurvePathLength(
  width: number,
  height: number,
  curvePeaks: number = 1,
  curveBend: number = 50,
  options: CurveCalculationOptions = {}
): number {
  // Validate curve parameters
  validateCurveParams(curvePeaks, curveBend)

  // Validate and normalize input dimensions to prevent edge cases
  const { width: safeWidth, height: safeHeight } = validateGeometryParams({
    width,
    height,
  })

  // Validate and clamp steps parameter
  const steps = Math.max(
    MIN_CALCULATION_STEPS,
    Math.min(MAX_CALCULATION_STEPS, options.steps || DEFAULT_CALCULATION_STEPS)
  )

  const stepSize = safeWidth / steps // Width of each segment (e.g., 10px for 1000px width)
  let pathLength = 0

  // Pre-calculate constants to avoid repeated calculations in the loop
  const centerY = safeHeight / 2 // Baseline Y position (container center)
  const amplitude = (curveBend / 100) * (safeHeight / 2 - CURVE_BOUNDARY_MARGIN) // Wave amplitude with margin
  const angleMultiplier = (curvePeaks * Math.PI) / steps // Angle increment per step

  // Break the curve into small line segments and sum their lengths
  for (let i = 0; i < steps - 1; i++) {
    // Calculate X coordinates for current segment endpoints
    const x1 = i * stepSize // Start X (e.g., 0px, 10px, 20px...)
    const x2 = (i + 1) * stepSize // End X (e.g., 10px, 20px, 30px...)

    // Calculate wave angles for sine function (optimized calculation)
    const angle1 = i * angleMultiplier
    const angle2 = (i + 1) * angleMultiplier

    // Apply sine wave to get Y coordinates
    // This MUST match the formula in generateCurvePath for consistency
    const y1 = centerY + amplitude * Math.sin(angle1)
    const y2 = centerY + amplitude * Math.sin(angle2)

    // Calculate straight-line distance between the two points using Pythagorean theorem
    // This approximates the curve segment as a small straight line
    const segmentLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    pathLength += segmentLength
  }

  return pathLength
}

/**
 * Calculate equivalent circular radius for curve auto-scaling
 *
 * This function converts a sinusoidal curve into an equivalent circular arc
 * that has the same total length. This is used for auto-scaling text because
 * the text scaling algorithm works with circular paths.
 *
 * @param width - Container width in pixels
 * @param height - Container height in pixels
 * @param curvePeaks - Number of wave peaks (1-4)
 * @param curveBend - Bend percentage (-100% to 100%)
 * @returns Equivalent circular radius in pixels
 *
 * @example
 * // For a 1000x500 curve with 2 peaks at 75% bend
 * const radius = calculateCurveEquivalentRadius(1000, 500, 2, 75)
 * // Returns ~191px (1200px circumference ÷ 2π ≈ 191px radius)
 */
export function calculateCurveEquivalentRadius(
  width: number,
  height: number,
  curvePeaks: number = 1,
  curveBend: number = 50,
  options: CurveCalculationOptions = {}
): number {
  // First, calculate the actual curve path length
  const pathLength = calculateCurvePathLength(width, height, curvePeaks, curveBend, options)

  // Convert to equivalent circular radius using the circumference formula
  // Circumference = 2π × radius, so radius = circumference ÷ 2π
  // We treat the curve length as if it were a full circle circumference
  return pathLength / (2 * Math.PI)
}
