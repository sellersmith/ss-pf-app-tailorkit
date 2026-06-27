/**
 * Gets the width and height of a DOM element in pixels
 * Uses getBoundingClientRect() for reliable pixel values regardless of CSS units
 * @param element - The HTML element to measure
 * @returns Object with width and height as numbers, or null if element is invalid
 */
export const getWidthHeightNumberOfDom = (element: HTMLElement) => {
  if (!element) return null

  const rect = element.getBoundingClientRect()

  return {
    width: rect.width,
    height: rect.height,
  }
}
