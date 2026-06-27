/**
 * Calculate optimal circle container size based on text content
 * Uses arc geometry to ensure text fits without cropping when switching to circle text shape
 */

interface CalculateCircleContainerSizeOptions {
  /** Text content to measure */
  content: string
  /** Font size in pixels */
  fontSize: number
  /** Font family name */
  fontFamily: string
  /** Letter spacing in pixels */
  letterSpacing: number
  /** Circle start angle in radians */
  startAngle: number
  /** Circle end angle in radians */
  endAngle: number
  /** Current container width */
  currentWidth: number
  /** Current container height */
  currentHeight: number
}

/**
 * Calculates the optimal square container size for circle text based on content.
 *
 * The calculation uses arc geometry:
 * - Arc length = radius × arcSpan
 * - To fit text without cropping: arcLength >= textWidth
 * - Required radius = textWidth / arcSpan
 * - Container size = 2 × radius + padding
 *
 * @param options - Configuration options for the calculation
 * @returns The optimal square container size in pixels
 */
export function calculateCircleContainerSize(options: CalculateCircleContainerSizeOptions): number {
  const { content, fontSize, fontFamily, letterSpacing, startAngle, endAngle, currentWidth, currentHeight } = options

  // Measure text width using canvas
  let textWidth = 100 // fallback
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.font = `${fontSize}px "${fontFamily}"`
      const baseWidth = ctx.measureText(content).width
      // Account for letter spacing (applied between characters)
      textWidth = baseWidth + Math.max(0, content.length - 1) * letterSpacing
    }
  } catch {
    // Fallback to current dimensions
    textWidth = currentWidth
  }

  // Calculate arc span from angles (default is semi-circle: π to 0)
  // Normalize angles to get positive arc span
  let arcSpan = endAngle - startAngle
  if (arcSpan <= 0) {
    arcSpan += 2 * Math.PI
  }
  // Handle very small gaps as full circle
  if (arcSpan < 0.1) {
    arcSpan = 2 * Math.PI
  }

  // Arc length = radius × arcSpan
  // To fit text: arcLength >= textWidth
  // Required radius = textWidth / arcSpan
  const requiredRadius = textWidth / arcSpan

  // Container size is diameter (2 × radius) plus padding for comfortable editing
  const editingPadding = 40 // px - extra space for rotation/resize handles
  const calculatedSize = Math.ceil(2 * requiredRadius) + editingPadding

  // Apply reasonable bounds
  const minSize = 80 // minimum usable circle size
  const maxSize = Math.max(currentWidth, currentHeight) * 2 // don't go excessively large

  return Math.min(maxSize, Math.max(calculatedSize, minSize))
}
