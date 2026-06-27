/**
 * Color Matrix Utilities
 *
 * Re-exports from shared utilities for backward compatibility.
 * @see ~/utils/svg/color-matrix.ts for implementation details.
 */

export {
  identityMatrix,
  brightnessMatrix,
  contrastMatrix,
  saturationMatrix,
  hueRotateMatrix,
  invertMatrix,
  sepiaMatrix,
  grayscaleMatrix,
  opacityMatrix,
  multiplyColorMatrices,
  chainColorMatrices,
  colorAdjustmentsToMatrix,
  colorAdjustmentsToFeColorMatrix,
  colorAdjustmentsToFilter,
  formatMatrix,
} from '~/utils/svg/color-matrix'
