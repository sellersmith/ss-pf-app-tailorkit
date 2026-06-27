import { CANVAS_LIMITS } from './mask-constants'

/**
 * Canvas creation and management utilities
 */

/**
 * Gets or creates a reusable canvas with specified dimensions
 * @param canvasRef Ref to store the canvas instance
 * @param width Canvas width
 * @param height Canvas height
 * @returns Canvas element or null if invalid dimensions
 */
export function getOrCreateCanvas(
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
  width: number,
  height: number
): HTMLCanvasElement | null {
  // Input validation
  if (width <= 0 || height <= 0) {
    console.warn('Invalid canvas dimensions:', { width, height })
    return null
  }

  if (!canvasRef.current) {
    canvasRef.current = document.createElement('canvas')
  }

  const canvas = canvasRef.current
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height

    // Clear canvas when dimensions change
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, width, height)
    }
  }

  return canvas
}

/**
 * Gets or creates a high-DPI canvas with specified dimensions
 * @param canvasRef Ref to store the canvas instance
 * @param width Canvas width
 * @param height Canvas height
 * @param devicePixelRatio Device pixel ratio for high-DPI displays
 * @returns Canvas element or null if invalid dimensions
 */
export function getOrCreateHDPICanvas(
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
  width: number,
  height: number,
  devicePixelRatio: number = window.devicePixelRatio || 1
): HTMLCanvasElement | null {
  // Input validation
  if (width <= 0 || height <= 0) {
    console.warn('Invalid canvas dimensions:', { width, height })
    return null
  }

  if (!canvasRef.current) {
    canvasRef.current = document.createElement('canvas')
  }

  const canvas = canvasRef.current
  const scaledWidth = width * devicePixelRatio
  const scaledHeight = height * devicePixelRatio

  // Validate scaled dimensions don't exceed browser limits
  if (scaledWidth > CANVAS_LIMITS.MAX_CANVAS_SIZE || scaledHeight > CANVAS_LIMITS.MAX_CANVAS_SIZE) {
    console.warn('Canvas dimensions exceed browser limits:', { scaledWidth, scaledHeight })
    // Fallback to unscaled canvas
    canvas.width = width
    canvas.height = height
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    return canvas
  }

  // Update canvas dimensions if changed
  if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
    canvas.width = scaledWidth
    canvas.height = scaledHeight

    // Scale the canvas CSS size to maintain original display dimensions
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    // Scale the drawing context to match device pixel ratio
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // Reset transform first to avoid compounding scales
      ctx.resetTransform()
      ctx.scale(devicePixelRatio, devicePixelRatio)
      ctx.clearRect(0, 0, width, height)
    }
  }

  return canvas
}

/**
 * Creates a reusable temporary canvas manager
 * @returns Function to get or create a temporary canvas with specified dimensions
 */
export function createReusableTempCanvasManager() {
  let tempCanvas: HTMLCanvasElement | null = null

  return function getReusableTempCanvas(width: number, height: number): HTMLCanvasElement {
    if (!tempCanvas) {
      tempCanvas = document.createElement('canvas')
    }

    if (tempCanvas.width !== width || tempCanvas.height !== height) {
      tempCanvas.width = width
      tempCanvas.height = height
    }

    return tempCanvas
  }
}

/**
 * Clears a canvas and optionally resets its context properties
 * @param canvas Canvas element to clear
 * @param resetContext Whether to reset context properties
 */
export function clearCanvas(canvas: HTMLCanvasElement, resetContext: boolean = false): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (resetContext) {
    ctx.resetTransform()
    ctx.filter = 'none'
    ctx.globalCompositeOperation = 'source-over'
    ctx.imageSmoothingEnabled = true
  }
}

/**
 * Sets up canvas context with optimal settings for image rendering
 * @param ctx Canvas rendering context
 * @param smoothing Whether to enable smoothing
 * @param quality Image smoothing quality setting
 */
export function setupCanvasContext(
  ctx: CanvasRenderingContext2D,
  smoothing: boolean = true,
  quality: ImageSmoothingQuality = 'high'
): void {
  ctx.imageSmoothingEnabled = smoothing
  if (smoothing && 'imageSmoothingQuality' in ctx) {
    ctx.imageSmoothingQuality = quality
  }
}
