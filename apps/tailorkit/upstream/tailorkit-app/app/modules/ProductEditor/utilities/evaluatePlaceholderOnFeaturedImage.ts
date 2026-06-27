import type { Dimension } from '~/types/template'

/**
 * Resize and set position placeholder ratio if product image is smaller than placeholder
 *
 * @param placeholder
 * @param featuredImage
 * @returns { placeholder, x, y}
 */
export function evaluatePlaceholderDimensionPositionOnFeaturedImage(placeholder: Dimension, featuredImage: Dimension) {
  // Resize placeholder ratio if product image is smaller than placeholder
  const { width: featuredImageWidth, height: featuredImageHeight } = featuredImage
  const { width: placeholderWidth, height: placeholderHeight } = placeholder

  // If product image is smaller than placeholder, resize placeholder to fit product image
  // Resize the placeholder smaller 80% of the product image and retain the aspect ratio
  if (featuredImageWidth < placeholderWidth || featuredImageHeight < placeholderHeight) {
    const widthRatio = featuredImageWidth / placeholderWidth
    const heightRatio = featuredImageHeight / placeholderHeight
    const resizeRatio = Math.min(widthRatio, heightRatio) * 0.8

    placeholder.width = placeholderWidth * resizeRatio
    placeholder.height = placeholderHeight * resizeRatio
  }

  // Set position placeholder center of featured image after resize
  const x = (featuredImageWidth - placeholder.width) / 2
  const y = (featuredImageHeight - placeholder.height) / 2

  return { ...placeholder, x, y }
}
