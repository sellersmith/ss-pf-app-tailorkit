export const prepareProductImage = (pi: any, mockup: any) => {
  if (!Object.keys(pi).length) {
    pi = undefined
  }

  if (!pi?.u) {
    pi = mockup.pi
  }

  return pi
}

/**
 * Extract image URL from img element
 * Used for rendering product image inside canvas for consistent pinch-zoom
 */
export function getProductImageUrl(img: HTMLImageElement): string | null {
  const rawSrc = img.src
  // Remove width/height parameters from the URL
  const url = rawSrc.split('?')[0]
  return url || null
}
