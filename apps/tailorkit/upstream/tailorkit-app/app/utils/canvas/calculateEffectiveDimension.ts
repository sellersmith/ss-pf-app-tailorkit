import type { Dimension } from '~/types/template'
import type { TemplateEditor } from '~/stores/modules/template'

export interface EffectiveDimensionResult {
  effectiveDimension: Dimension
  contentOffset?: { offsetX: number; offsetY: number }
}

/**
 * Calculates the effective dimension and content offset for viewport calculations,
 * accounting for preview product images that may extend beyond template bounds.
 *
 * @param dimension - The base template dimension
 * @param previewImage - Optional preview product image with position and size
 * @returns Object containing effective dimension and optional content offset
 */
export function calculateEffectiveDimension(
  dimension: Dimension,
  previewImage?: TemplateEditor['previewProductImage']
): EffectiveDimensionResult {
  // If no preview or preview is hidden, return original dimension
  const isPreviewVisible = !!(previewImage && previewImage.visible !== false)
  if (!isPreviewVisible) {
    return { effectiveDimension: dimension }
  }

  // Calculate bounding box that includes both template (starting at 0,0) and preview image
  const templateWidth = dimension?.width || 0
  const templateHeight = dimension?.height || 0
  const previewLeft = previewImage.left || 0
  const previewTop = previewImage.top || 0
  const previewRight = previewLeft + (previewImage.width || 0)
  const previewBottom = previewTop + (previewImage.height || 0)

  // Find the bounding box that encompasses both template and preview
  // Handle both positive and negative positioning
  const minX = Math.min(0, previewLeft)
  const minY = Math.min(0, previewTop)
  const maxX = Math.max(templateWidth, previewRight)
  const maxY = Math.max(templateHeight, previewBottom)

  return {
    effectiveDimension: {
      width: maxX - minX,
      height: maxY - minY,
    },
    contentOffset: {
      offsetX: minX,
      offsetY: minY,
    },
  }
}
