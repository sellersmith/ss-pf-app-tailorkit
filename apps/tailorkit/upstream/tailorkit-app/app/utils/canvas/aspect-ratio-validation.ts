const DEFAULT_TOLERANCE = 0.05 // 5%

/**
 * Check if current image dimensions mismatch the setup-time image dimensions beyond tolerance.
 * Compares width and height independently — if either deviates beyond tolerance, it's a mismatch.
 *
 * @returns true if mismatch exceeds tolerance
 */
export function isDimensionMismatch(
  currentWidth: number,
  currentHeight: number,
  setupWidth: number,
  setupHeight: number,
  tolerance: number = DEFAULT_TOLERANCE
): boolean {
  if (currentWidth <= 0 || currentHeight <= 0 || setupWidth <= 0 || setupHeight <= 0) {
    return false
  }

  const widthDeviation = Math.abs(currentWidth - setupWidth) / setupWidth
  const heightDeviation = Math.abs(currentHeight - setupHeight) / setupHeight

  return widthDeviation > tolerance || heightDeviation > tolerance
}

/**
 * Build dimension alert when current product image doesn't match the image used during mockup setup.
 * Returns null if dimensions match within tolerance.
 */
export function buildDimensionAlert(
  currentWidth: number,
  currentHeight: number,
  setupWidth: number,
  setupHeight: number,
  productId: string,
  mockupViewId: string
): DimensionAlert | null {
  if (!isDimensionMismatch(currentWidth, currentHeight, setupWidth, setupHeight)) {
    return null
  }

  return {
    detectedAt: new Date(),
    productImageDims: { width: currentWidth, height: currentHeight },
    setupImageDims: { width: setupWidth, height: setupHeight },
    productId,
    mockupViewId,
  }
}

export interface DimensionAlert {
  detectedAt: Date
  /** Current Shopify product image dimensions */
  productImageDims: { width: number; height: number }
  /** Product image dimensions from mockup setup time (baseImage or previewProductImage) */
  setupImageDims: { width: number; height: number }
  productId: string
  mockupViewId: string
}
