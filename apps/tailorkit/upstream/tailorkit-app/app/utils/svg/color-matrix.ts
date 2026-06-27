/**
 * Color Matrix Utilities
 *
 * Generate SVG feColorMatrix values for color adjustments.
 * Extracted from VectorEditor for reuse across modules.
 *
 * The SVG color matrix is a 4x5 matrix that transforms RGBA values:
 * | R' |   | a00 a01 a02 a03 a04 |   | R |
 * | G' | = | a10 a11 a12 a13 a14 | * | G |
 * | B' |   | a20 a21 a22 a23 a24 |   | B |
 * | A' |   | a30 a31 a32 a33 a34 |   | A |
 *                                     | 1 |
 */

import type { ColorAdjustments, FeColorMatrix, FilterDef } from '~/types/svg-effects'

/**
 * Identity matrix (no transformation)
 */
export function identityMatrix(): number[] {
  return [
    1,
    0,
    0,
    0,
    0, // R
    0,
    1,
    0,
    0,
    0, // G
    0,
    0,
    1,
    0,
    0, // B
    0,
    0,
    0,
    1,
    0, // A
  ]
}

/**
 * Brightness matrix
 * @param value - Brightness adjustment (-100 to 100, 0 = no change)
 */
export function brightnessMatrix(value: number): number[] {
  // Convert from -100..100 to -1..1 and then to offset
  const offset = value / 100
  return [1, 0, 0, 0, offset, 0, 1, 0, 0, offset, 0, 0, 1, 0, offset, 0, 0, 0, 1, 0]
}

/**
 * Contrast matrix
 * @param value - Contrast adjustment (-100 to 100, 0 = no change)
 */
export function contrastMatrix(value: number): number[] {
  // Convert from -100..100 to scale factor
  // At -100: scale = 0 (all gray)
  // At 0: scale = 1 (no change)
  // At 100: scale = 2 (double contrast)
  const scale = 1 + value / 100
  const offset = 0.5 * (1 - scale)
  return [scale, 0, 0, 0, offset, 0, scale, 0, 0, offset, 0, 0, scale, 0, offset, 0, 0, 0, 1, 0]
}

/**
 * Saturation matrix
 * @param value - Saturation adjustment (-100 to 100, 0 = no change)
 * Note: -100 = grayscale, 100 = double saturation
 */
export function saturationMatrix(value: number): number[] {
  // Convert from -100..100 to 0..2 scale
  // At -100: s = 0 (grayscale)
  // At 0: s = 1 (no change)
  // At 100: s = 2 (double saturation)
  const s = 1 + value / 100

  // Luminance weights for grayscale
  const lumR = 0.2126
  const lumG = 0.7152
  const lumB = 0.0722

  return [
    lumR * (1 - s) + s,
    lumG * (1 - s),
    lumB * (1 - s),
    0,
    0,
    lumR * (1 - s),
    lumG * (1 - s) + s,
    lumB * (1 - s),
    0,
    0,
    lumR * (1 - s),
    lumG * (1 - s),
    lumB * (1 - s) + s,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ]
}

/**
 * Hue rotation matrix
 * @param degrees - Rotation angle in degrees (0-360)
 */
export function hueRotateMatrix(degrees: number): number[] {
  const rad = (degrees * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  // Luminance weights
  const lumR = 0.2126
  const lumG = 0.7152
  const lumB = 0.0722

  return [
    lumR + cos * (1 - lumR) + sin * -lumR,
    lumG + cos * -lumG + sin * -lumG,
    lumB + cos * -lumB + sin * (1 - lumB),
    0,
    0,

    lumR + cos * -lumR + sin * 0.143,
    lumG + cos * (1 - lumG) + sin * 0.14,
    lumB + cos * -lumB + sin * -0.283,
    0,
    0,

    lumR + cos * -lumR + sin * -(1 - lumR),
    lumG + cos * -lumG + sin * lumG,
    lumB + cos * (1 - lumB) + sin * lumB,
    0,
    0,

    0,
    0,
    0,
    1,
    0,
  ]
}

/**
 * Invert matrix
 * @param value - Inversion amount (0-1, 0 = no inversion, 1 = full inversion)
 */
export function invertMatrix(value: number): number[] {
  const inv = value
  const scale = 1 - 2 * inv
  return [scale, 0, 0, 0, inv, 0, scale, 0, 0, inv, 0, 0, scale, 0, inv, 0, 0, 0, 1, 0]
}

/**
 * Sepia matrix
 * @param value - Sepia amount (0-1, 0 = no sepia, 1 = full sepia)
 */
export function sepiaMatrix(value: number): number[] {
  const s = value
  const inv = 1 - s
  return [
    inv + s * 0.393,
    s * 0.769,
    s * 0.189,
    0,
    0,
    s * 0.349,
    inv + s * 0.686,
    s * 0.168,
    0,
    0,
    s * 0.272,
    s * 0.534,
    inv + s * 0.131,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ]
}

/**
 * Grayscale matrix
 * @param value - Grayscale amount (0-1, 0 = no grayscale, 1 = full grayscale)
 */
export function grayscaleMatrix(value: number): number[] {
  // This is equivalent to saturationMatrix with value = -100 * grayscaleAmount
  return saturationMatrix(-100 * value)
}

/**
 * Opacity matrix (adjust alpha channel)
 * @param value - Opacity (0-1)
 */
export function opacityMatrix(value: number): number[] {
  return [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, value, 0]
}

/**
 * Multiply two 4x5 color matrices
 * Result = A * B (apply A after B)
 */
export function multiplyColorMatrices(a: number[], b: number[]): number[] {
  const result = new Array(20).fill(0)

  // The matrices are stored as flat arrays:
  // [a00, a01, a02, a03, a04, a10, a11, ...]
  // We need to multiply as if they are 4x5 matrices acting on [R, G, B, A, 1]

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let sum = 0
      for (let k = 0; k < 4; k++) {
        sum += a[row * 5 + k] * b[k * 5 + col]
      }
      // Add the offset column contribution
      if (col === 4) {
        sum += a[row * 5 + 4]
      }
      result[row * 5 + col] = sum
    }
  }

  return result
}

/**
 * Chain multiple color matrix operations
 */
export function chainColorMatrices(...matrices: number[][]): number[] {
  if (matrices.length === 0) return identityMatrix()
  if (matrices.length === 1) return matrices[0]

  let result = matrices[0]
  for (let i = 1; i < matrices.length; i++) {
    result = multiplyColorMatrices(matrices[i], result)
  }
  return result
}

/**
 * Convert ColorAdjustments to a single combined color matrix
 */
export function colorAdjustmentsToMatrix(adjustments: ColorAdjustments): number[] {
  const matrices: number[][] = []

  if (adjustments.brightness !== undefined && adjustments.brightness !== 0) {
    matrices.push(brightnessMatrix(adjustments.brightness))
  }

  if (adjustments.contrast !== undefined && adjustments.contrast !== 0) {
    matrices.push(contrastMatrix(adjustments.contrast))
  }

  if (adjustments.saturation !== undefined && adjustments.saturation !== 0) {
    matrices.push(saturationMatrix(adjustments.saturation))
  }

  if (adjustments.hueRotate !== undefined && adjustments.hueRotate !== 0) {
    matrices.push(hueRotateMatrix(adjustments.hueRotate))
  }

  if (adjustments.invert !== undefined && adjustments.invert !== 0) {
    matrices.push(invertMatrix(adjustments.invert))
  }

  if (adjustments.sepia !== undefined && adjustments.sepia !== 0) {
    matrices.push(sepiaMatrix(adjustments.sepia))
  }

  if (adjustments.grayscale !== undefined && adjustments.grayscale !== 0) {
    matrices.push(grayscaleMatrix(adjustments.grayscale))
  }

  if (adjustments.opacity !== undefined && adjustments.opacity !== 1) {
    matrices.push(opacityMatrix(adjustments.opacity))
  }

  if (matrices.length === 0) {
    return identityMatrix()
  }

  return chainColorMatrices(...matrices)
}

/**
 * Create a feColorMatrix filter primitive from ColorAdjustments
 */
export function colorAdjustmentsToFeColorMatrix(adjustments: ColorAdjustments): FeColorMatrix {
  const matrix = colorAdjustmentsToMatrix(adjustments)
  return {
    type: 'feColorMatrix',
    matrixType: 'matrix',
    values: matrix,
  }
}

/**
 * Create a complete filter from ColorAdjustments
 */
export function colorAdjustmentsToFilter(id: string, adjustments: ColorAdjustments): FilterDef {
  return {
    id,
    primitives: [colorAdjustmentsToFeColorMatrix(adjustments)],
  }
}

/**
 * Format a matrix for display (useful for debugging)
 */
export function formatMatrix(matrix: number[]): string {
  const lines: string[] = []
  for (let row = 0; row < 4; row++) {
    const values = matrix.slice(row * 5, row * 5 + 5).map(v => v.toFixed(3).padStart(7))
    lines.push(`| ${values.join(' ')} |`)
  }
  return lines.join('\n')
}
