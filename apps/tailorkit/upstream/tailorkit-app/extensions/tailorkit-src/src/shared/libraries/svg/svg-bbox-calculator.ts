/**
 * SVG BBox Calculator
 *
 * Measures actual SVG bounding box using native getBBox() method.
 * This ensures text with effects (shadows, strokes) is never clipped
 * by measuring the real rendered output instead of using static calculations.
 *
 * @module shared/libraries/svg
 */

import type { Svg } from '@svgdotjs/svg.js'

/**
 * Result of measuring SVG bounds
 */
export interface MeasuredBounds {
  /** How far content extends left of origin (x=0) */
  contentLeft: number
  /** How far content extends above origin (y=0) */
  contentTop: number
  /** How far content extends right of the original width */
  contentRight: number
  /** How far content extends below the original height */
  contentBottom: number
  /** Total width including all content */
  totalWidth: number
  /** Total height including all content */
  totalHeight: number
}

/**
 * Hidden container for getBBox measurement
 * Reused to avoid DOM manipulation overhead
 */
let measurementContainer: HTMLDivElement | null = null

/**
 * Get or create the hidden measurement container
 */
function getMeasurementContainer(): HTMLDivElement {
  if (!measurementContainer) {
    measurementContainer = document.createElement('div')
    measurementContainer.style.cssText
      = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none'
    document.body.appendChild(measurementContainer)
  }
  return measurementContainer
}

/**
 * Measure the actual bounding box of an SVG element
 *
 * This function temporarily appends the SVG to the DOM to use the native
 * getBBox() method, which returns the exact bounding box of the rendered content
 * including all effects (shadows, strokes, etc.).
 *
 * @param svg - SVG.js instance to measure
 * @param originalWidth - The original intended width of the text area
 * @param originalHeight - The original intended height of the text area
 * @returns MeasuredBounds with content overflow in each direction
 */
export function measureSVGBounds(svg: Svg, originalWidth: number, originalHeight: number): MeasuredBounds {
  const container = getMeasurementContainer()

  // Add SVG to DOM (required for getBBox to work)
  const svgNode = svg.node
  container.appendChild(svgNode)

  try {
    // Find the text element(s) and measure their bounding box
    const textElements = svg.find('text')

    if (textElements.length === 0) {
      // No text elements, return zero bounds
      return {
        contentLeft: 0,
        contentTop: 0,
        contentRight: 0,
        contentBottom: 0,
        totalWidth: originalWidth,
        totalHeight: originalHeight,
      }
    }

    // Get bounding box of all text elements combined
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const textEl of textElements) {
      const bbox = (textEl.node as SVGGraphicsElement).getBBox()
      minX = Math.min(minX, bbox.x)
      minY = Math.min(minY, bbox.y)
      maxX = Math.max(maxX, bbox.x + bbox.width)
      maxY = Math.max(maxY, bbox.y + bbox.height)
    }

    // Calculate how much content extends beyond the original bounds
    // If content starts before x=0, we need left padding
    const contentLeft = Math.max(0, -minX)
    // If content starts before y=0, we need top padding
    const contentTop = Math.max(0, -minY)
    // If content extends beyond originalWidth, we need right padding
    const contentRight = Math.max(0, maxX - originalWidth)
    // If content extends beyond originalHeight, we need bottom padding
    const contentBottom = Math.max(0, maxY - originalHeight)

    return {
      contentLeft,
      contentTop,
      contentRight,
      contentBottom,
      totalWidth: contentLeft + originalWidth + contentRight,
      totalHeight: contentTop + originalHeight + contentBottom,
    }
  } finally {
    // Always remove SVG from DOM after measurement
    container.removeChild(svgNode)
  }
}

/**
 * Cleanup the measurement container
 * Call this when the module is unloaded or during cleanup
 */
export function cleanupMeasurementContainer(): void {
  if (measurementContainer && measurementContainer.parentNode) {
    measurementContainer.parentNode.removeChild(measurementContainer)
    measurementContainer = null
  }
}
