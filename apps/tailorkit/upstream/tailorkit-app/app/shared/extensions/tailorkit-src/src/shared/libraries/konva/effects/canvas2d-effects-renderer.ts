/**
 * Canvas 2D Text Effects Renderer
 *
 * Implements text effects using pure Canvas 2D APIs that work in Safari.
 * Uses native shadow properties for drop shadows and StackBlur for inner shadows.
 *
 * Key insight: ctx.shadowColor/shadowBlur/shadowOffset work in Safari,
 * but ctx.filter does not.
 *
 * @module shared/libraries/konva/effects
 */

import type { DropShadowConfig, InnerShadowConfig } from './types'
import { resolveColor } from './utils'
import { stackBlurImageData } from './stackblur'

/**
 * Type for text drawing function
 * @param ctx - Target canvas context
 * @param fillColor - Optional fill color override (for opaque rendering in compositing)
 */
export type DrawTextFn = (ctx: CanvasRenderingContext2D, fillColor?: string) => void

/**
 * Configuration for the effects renderer
 */
export interface Canvas2DEffectsConfig {
  width: number
  height: number
  dropShadows: DropShadowConfig[]
  innerShadows: InnerShadowConfig[]
  textColor: string // RGB color without alpha for shadows
  fillOpacity: number // Independent fill opacity (0-1)
}

/**
 * Canvas pool for reusing off-screen canvases
 */
const canvasPool: HTMLCanvasElement[] = []

/**
 * Get a canvas from pool or create a new one
 */
function getPooledCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = canvasPool.pop() || document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

/**
 * Get 2D context with willReadFrequently optimization
 */
function getContext2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return canvas.getContext('2d', { willReadFrequently: true })
}

/**
 * Return canvas to pool for reuse
 */
function returnToPool(canvas: HTMLCanvasElement): void {
  // Clear the canvas before returning to pool
  const ctx = getContext2D(canvas)
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // Reset any transformations
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
  canvasPool.push(canvas)
}

/**
 * Calculate buffer size needed for shadow effects
 */
function calculateBuffer(shadow: DropShadowConfig | InnerShadowConfig): number {
  return Math.max(shadow.radius * 3, Math.abs(shadow.offsetX), Math.abs(shadow.offsetY)) + 20
}

/**
 * Render a single drop shadow with knockout effect
 *
 * Algorithm (matches SVG filter):
 * 1. Draw text with native canvas shadow (blur + offset + color)
 * 2. Knockout - punch out text shape using destination-out
 * 3. Result: shadow is only visible outside the text area
 *
 * Note: No scale parameter needed - Canvas 2D shadows work in current coordinate
 * system and the main canvas transform handles zoom automatically.
 *
 * @param ctx - Target canvas context
 * @param drawText - Function to draw the text
 * @param shadow - Drop shadow configuration
 * @param width - Canvas width
 * @param height - Canvas height
 * @param textColor - Text color for resolving 'currentColor'
 */
export function renderDropShadow(
  ctx: CanvasRenderingContext2D,
  drawText: DrawTextFn,
  shadow: DropShadowConfig,
  width: number,
  height: number,
  textColor: string
): void {
  if (shadow.visible === false) return

  // Calculate buffer for shadow overflow (no scale - canvas transform handles it)
  const buffer = calculateBuffer(shadow)

  const canvasWidth = width + buffer * 2
  const canvasHeight = height + buffer * 2

  // Create off-screen canvas for shadow rendering
  const shadowCanvas = getPooledCanvas(canvasWidth, canvasHeight)
  const shadowCtx = getContext2D(shadowCanvas)
  if (!shadowCtx) {
    returnToPool(shadowCanvas)
    return
  }

  // Resolve shadow color
  const shadowColor = resolveColor(shadow.color, textColor)

  // Step 1: Draw text with native shadow (works in Safari!)
  shadowCtx.save()
  shadowCtx.translate(buffer, buffer)

  shadowCtx.shadowColor = shadowColor
  shadowCtx.shadowBlur = shadow.radius
  shadowCtx.shadowOffsetX = shadow.offsetX
  shadowCtx.shadowOffsetY = shadow.offsetY

  // Draw with opaque black - we only need the shape for shadow generation
  drawText(shadowCtx, '#000000')

  // Step 2: Knockout - punch out text shape, leaving only shadow
  shadowCtx.globalCompositeOperation = 'destination-out'
  shadowCtx.shadowColor = 'transparent'
  shadowCtx.shadowBlur = 0
  shadowCtx.shadowOffsetX = 0
  shadowCtx.shadowOffsetY = 0

  drawText(shadowCtx, '#000000')

  shadowCtx.restore()

  // Step 3: Draw to main canvas with opacity
  ctx.save()
  ctx.globalAlpha = shadow.opacity ?? 1
  ctx.drawImage(shadowCanvas, -buffer, -buffer)
  ctx.restore()

  returnToPool(shadowCanvas)
}

/**
 * Render a single inner shadow using StackBlur
 *
 * Algorithm (matches SVG filter):
 * 1. Create inverted mask (solid color with text cutout) using destination-out
 * 2. Apply StackBlur to the mask (no ctx.filter needed!)
 * 3. Offset the blurred mask
 * 4. Clip to text shape using source-in
 *
 * Note: No scale parameter needed - Canvas 2D works in current coordinate
 * system and the main canvas transform handles zoom automatically.
 *
 * @param ctx - Target canvas context
 * @param drawText - Function to draw the text
 * @param shadow - Inner shadow configuration
 * @param width - Canvas width
 * @param height - Canvas height
 * @param textColor - Text color for resolving 'currentColor'
 */
export function renderInnerShadow(
  ctx: CanvasRenderingContext2D,
  drawText: DrawTextFn,
  shadow: InnerShadowConfig,
  width: number,
  height: number,
  textColor: string
): void {
  if (shadow.visible === false) return

  // Calculate buffer for blur overflow (no scale - canvas transform handles it)
  const buffer = calculateBuffer(shadow)

  const canvasWidth = width + buffer * 2
  const canvasHeight = height + buffer * 2

  // Resolve shadow color
  const shadowColor = resolveColor(shadow.color, textColor)

  // Step 1: Create inverted mask (solid color with text cutout)
  const maskCanvas = getPooledCanvas(canvasWidth, canvasHeight)
  const maskCtx = getContext2D(maskCanvas)
  if (!maskCtx) {
    returnToPool(maskCanvas)
    return
  }

  // Fill with shadow color at full opacity (shadow.opacity applied at final composite)
  maskCtx.fillStyle = shadowColor
  maskCtx.fillRect(0, 0, canvasWidth, canvasHeight)

  // Cut out text shape (create inverted mask) - use opaque fill for clean cutout
  maskCtx.globalCompositeOperation = 'destination-out'
  maskCtx.save()
  maskCtx.translate(buffer, buffer)
  drawText(maskCtx, '#000000')
  maskCtx.restore()

  // Step 2: Apply StackBlur (works in Safari - no ctx.filter!)
  if (shadow.radius > 0) {
    const imageData = maskCtx.getImageData(0, 0, canvasWidth, canvasHeight)
    stackBlurImageData(imageData, shadow.radius)
    maskCtx.putImageData(imageData, 0, 0)
  }

  // Step 3: Offset the blurred mask
  const offsetCanvas = getPooledCanvas(canvasWidth, canvasHeight)
  const offsetCtx = getContext2D(offsetCanvas)
  if (!offsetCtx) {
    returnToPool(maskCanvas)
    returnToPool(offsetCanvas)
    return
  }

  offsetCtx.drawImage(maskCanvas, shadow.offsetX, shadow.offsetY)
  returnToPool(maskCanvas)

  // Step 4: Clip to text shape using source-in
  const resultCanvas = getPooledCanvas(width, height)
  const resultCtx = getContext2D(resultCanvas)
  if (!resultCtx) {
    returnToPool(offsetCanvas)
    returnToPool(resultCanvas)
    return
  }

  // Draw text shape as mask - use opaque fill for clean mask
  drawText(resultCtx, '#000000')

  // Apply blurred shadow, clipped to text
  resultCtx.globalCompositeOperation = 'source-in'
  resultCtx.drawImage(offsetCanvas, -buffer, -buffer)
  returnToPool(offsetCanvas)

  // Draw result to main canvas with shadow opacity
  ctx.save()
  ctx.globalAlpha = shadow.opacity ?? 1
  ctx.drawImage(resultCanvas, 0, 0)
  ctx.restore()

  returnToPool(resultCanvas)
}

/**
 * Render fill layer with independent opacity
 *
 * This allows text to be semi-transparent while shadows remain at full opacity.
 *
 * @param ctx - Target canvas context
 * @param drawText - Function to draw the text
 * @param fillOpacity - Fill opacity (0-1)
 */
export function renderFillLayer(
  ctx: CanvasRenderingContext2D,
  drawText: DrawTextFn,
  fillOpacity: number
): void {
  ctx.save()

  // Apply fill opacity independently from shadows
  ctx.globalAlpha = fillOpacity

  // Draw text with its configured color
  drawText(ctx)

  ctx.restore()
}

/**
 * Render text with all effects in correct stacking order
 *
 * Stacking order (matches SVG filter's feMerge):
 * 1. Drop shadows (behind everything)
 * 2. Fill layer (text with independent opacity)
 * 3. Inner shadows (on top, clipped to text)
 *
 * @param ctx - Target canvas context
 * @param drawText - Function to draw the text
 * @param config - Effects configuration
 */
export function renderTextWithEffects(
  ctx: CanvasRenderingContext2D,
  drawText: DrawTextFn,
  config: Canvas2DEffectsConfig
): void {
  const { width, height, dropShadows, innerShadows, textColor, fillOpacity } = config

  // 1. Render ALL drop shadows (behind everything)
  for (const shadow of dropShadows) {
    if (shadow.visible === false) continue
    renderDropShadow(ctx, drawText, shadow, width, height, textColor)
  }

  // 2. Render fill layer (text with independent opacity)
  renderFillLayer(ctx, drawText, fillOpacity)

  // 3. Render ALL inner shadows (on top, clipped to text)
  for (const shadow of innerShadows) {
    if (shadow.visible === false) continue
    renderInnerShadow(ctx, drawText, shadow, width, height, textColor)
  }
}

/**
 * Check if effects are present and need rendering
 */
export function hasEffectsToRender(config: Canvas2DEffectsConfig): boolean {
  const hasDropShadows = config.dropShadows.some(s => s.visible !== false)
  const hasInnerShadows = config.innerShadows.some(s => s.visible !== false)
  const hasFillOpacity = config.fillOpacity < 1

  return hasDropShadows || hasInnerShadows || hasFillOpacity
}

/**
 * Clear the canvas pool (for cleanup/testing)
 */
export function clearCanvasPool(): void {
  canvasPool.length = 0
}
