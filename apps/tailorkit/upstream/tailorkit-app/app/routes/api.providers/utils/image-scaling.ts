/**
 * Computes the scale factor required to resize an image so that it fits within a given placeholder area,
 * while preserving the image's original aspect ratio.
 *
 * The scale factor is determined by comparing the ratio of the placeholder dimensions to the image dimensions.
 * If the image is larger than the placeholder in either dimension, it will be scaled down proportionally.
 * If the image is smaller than the placeholder in both dimensions, it will maintain its original size.
 *
 * @example
 * ```ts
 * // Image is twice as large as placeholder
 * const scale = calculateImageScale(200, 200, 100, 100)
 * console.log(scale) // 0.5
 *
 * // Image is smaller than placeholder
 * const scale = calculateImageScale(50, 50, 100, 100)
 * console.log(scale) // 1
 * ```
 *
 * @param imageWidth - The original width of the image in pixels
 * @param imageHeight - The original height of the image in pixels
 * @param placeholderWidth - The width of the area in which the image must fit
 * @param placeholderHeight - The height of the area in which the image must fit
 * @returns The computed scale factor (a value between 0 and 1) to apply to the image dimensions
 */
export function calculateImageScale(
  imageWidth: number,
  imageHeight: number,
  placeholderWidth: number,
  placeholderHeight: number
): number {
  // If any dimension is missing or zero, return default scale of 1
  if (!imageWidth || !imageHeight || !placeholderWidth || !placeholderHeight) {
    return 1
  }

  // Calculate scale ratios for both dimensions
  const widthRatio = placeholderWidth / imageWidth
  const heightRatio = placeholderHeight / imageHeight

  // Use the smaller ratio to ensure image fits in both dimensions
  // If both ratios are > 1, image is smaller than placeholder, so keep original size (scale = 1)
  return Math.min(1, widthRatio, heightRatio)
}
