import type { Dimension } from '~/types/template'

// Helper function to format dimensions
export const formatDimensions = (width: number, height: number): string => {
  return `${Math.round(width)} x ${Math.round(height)}`
}

/**
 * Calculate the aspect ratio for a given dimension.
 * @param {Dimension} dimension - Object containing width and height properties.
 * @returns {number} The calculated aspect ratio.
 */
const calculateAspectRatio = (dimension: Dimension): number => {
  if (dimension.height === 0) {
    return 1
  }
  return dimension.width / dimension.height
}

/**
 * Check if two dimensions have the same aspect ratio within an optional tolerance.
 * This reusable function factors out ratio calculation and allows a tolerance for floating point comparisons.
 *
 * @param {Dimension} first - The first dimension.
 * @param {Dimension} second - The second dimension.
 * @param {number} [tolerance=1e-6] - Optional tolerance for comparing ratios.
 * @returns {boolean} True if the aspect ratios are equivalent within the specified tolerance, false otherwise.
 */
export const hasSameAspectRatio = (first: Dimension, second: Dimension, tolerance: number = 1e-6): boolean => {
  const firstRatio = calculateAspectRatio(first)
  const secondRatio = calculateAspectRatio(second)
  return Math.abs(firstRatio - secondRatio) < tolerance
}
