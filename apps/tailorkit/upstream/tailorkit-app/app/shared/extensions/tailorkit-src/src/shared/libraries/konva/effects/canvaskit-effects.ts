/**
 * CanvasKit Effects Renderer
 *
 * Implements drop shadows and inner shadows using Skia/CanvasKit APIs.
 * Inner shadows require multi-layer compositing since Skia doesn't have
 * a built-in inner shadow primitive.
 *
 * @module libraries/konva/effects
 */

import type { CanvasKit, Font, BlendMode } from 'canvaskit-wasm'
import type { DropShadowConfig, InnerShadowConfig } from './types'
import type { LayoutResult, TextPathGlyph } from './canvaskit-text-layout'
import { drawTextLines, drawTextPathGlyphs } from './canvaskit-text-layout'
import { resolveColor } from './utils'

// CanvasKit type definitions are incomplete, so we use any for Canvas and Paint
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CanvasKitCanvas = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CanvasKitPaint = any

/**
 * Parse color string to CanvasKit Color4f [r, g, b, a]
 */
export function parseColor(canvasKit: CanvasKit, color: string): Float32Array {
  // Handle rgba format
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (rgbaMatch) {
    return canvasKit.Color4f(
      parseInt(rgbaMatch[1], 10) / 255,
      parseInt(rgbaMatch[2], 10) / 255,
      parseInt(rgbaMatch[3], 10) / 255,
      rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
    )
  }

  // Handle hex format
  if (color.startsWith('#')) {
    const hex = color.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16) / 255
    const g = parseInt(hex.substring(2, 4), 16) / 255
    const b = parseInt(hex.substring(4, 6), 16) / 255
    const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1
    return canvasKit.Color4f(r, g, b, a)
  }

  // Default to black
  return canvasKit.Color4f(0, 0, 0, 1)
}

/**
 * Get CanvasKit BlendMode from string
 */
function getBlendMode(canvasKit: CanvasKit, mode?: GlobalCompositeOperation | 'NORMAL'): BlendMode {
  if (!mode || mode === 'NORMAL') {
    return canvasKit.BlendMode.SrcOver
  }

  const modeMap: Record<string, BlendMode | undefined> = {
    'source-over': canvasKit.BlendMode.SrcOver,
    'source-in': canvasKit.BlendMode.SrcIn,
    'source-out': canvasKit.BlendMode.SrcOut,
    'source-atop': canvasKit.BlendMode.SrcATop,
    'destination-over': canvasKit.BlendMode.DstOver,
    'destination-in': canvasKit.BlendMode.DstIn,
    'destination-out': canvasKit.BlendMode.DstOut,
    'destination-atop': canvasKit.BlendMode.DstATop,
    lighter: canvasKit.BlendMode.Plus,
    copy: canvasKit.BlendMode.Src,
    xor: canvasKit.BlendMode.Xor,
    multiply: canvasKit.BlendMode.Multiply,
    screen: canvasKit.BlendMode.Screen,
    overlay: canvasKit.BlendMode.Overlay,
    darken: canvasKit.BlendMode.Darken,
    lighten: canvasKit.BlendMode.Lighten,
    'color-dodge': canvasKit.BlendMode.ColorDodge,
    'color-burn': canvasKit.BlendMode.ColorBurn,
    'hard-light': canvasKit.BlendMode.HardLight,
    'soft-light': canvasKit.BlendMode.SoftLight,
    difference: canvasKit.BlendMode.Difference,
    exclusion: canvasKit.BlendMode.Exclusion,
    hue: canvasKit.BlendMode.Hue,
    saturation: canvasKit.BlendMode.Saturation,
    color: canvasKit.BlendMode.Color,
    luminosity: canvasKit.BlendMode.Luminosity,
  }

  return modeMap[mode] || canvasKit.BlendMode.SrcOver
}

/**
 * Convert blur radius to Skia sigma
 * Skia uses sigma (standard deviation) while CSS uses radius
 * CSS blur radius = 2 * sigma (approximately)
 */
function blurRadiusToSigma(radius: number): number {
  // CSS blur is roughly 2x the sigma
  return radius / 2
}

export interface EffectsRenderConfig {
  width: number
  height: number
  textColor: string
  fillOpacity?: number
  dropShadows: DropShadowConfig[]
  innerShadows: InnerShadowConfig[]
  letterSpacing?: number
  align?: 'left' | 'center' | 'right' | 'justify'
}

/**
 * CanvasKit Effects Renderer
 * Handles rendering drop shadows and inner shadows using Skia APIs
 */
export class CanvasKitEffectsRenderer {
  private canvasKit: CanvasKit

  constructor(canvasKit: CanvasKit) {
    this.canvasKit = canvasKit
  }

  /**
   * Render all effects for text
   *
   * Render order:
   * 1. Drop shadows with showBehindNode=true (behind everything)
   * 2. Drop shadows with showBehindNode=false (knocked out under text)
   * 3. Main text with fill opacity
   * 4. Inner shadows (clipped to text shape)
   */
  renderTextWithEffects(
    canvas: CanvasKitCanvas,
    font: Font,
    layout: LayoutResult,
    config: EffectsRenderConfig
  ): void {
    const { width, height, textColor, fillOpacity = 1, dropShadows, innerShadows, letterSpacing = 0, align } = config

    // Separate drop shadows by showBehindNode
    const behindShadows = dropShadows.filter(s => s.showBehindNode === true)
    const knockoutShadows = dropShadows.filter(s => s.showBehindNode !== true)

    // 1. Render behind shadows (simple, no knockout)
    for (const shadow of behindShadows) {
      this.renderDropShadowSimple(canvas, font, layout, shadow, textColor, letterSpacing, align, width)
    }

    // 2. Render knockout shadows (knocked out under text)
    for (const shadow of knockoutShadows) {
      this.renderDropShadowKnockout(canvas, font, layout, shadow, textColor, width, height, letterSpacing, align)
    }

    // 3. Render main text with fill opacity
    const textPaint = new this.canvasKit.Paint()
    const textColorParsed = parseColor(this.canvasKit, resolveColor(textColor, textColor))

    // Apply fill opacity
    if (fillOpacity < 1) {
      textColorParsed[3] *= fillOpacity
    }
    textPaint.setColor(textColorParsed)
    textPaint.setAntiAlias(true)

    drawTextLines(this.canvasKit, canvas, font, layout.lines, textPaint, letterSpacing, align, width)
    textPaint.delete()

    // 4. Render inner shadows (on top, clipped to text)
    for (const shadow of innerShadows) {
      this.renderInnerShadow(canvas, font, layout, shadow, textColor, width, height, letterSpacing, align)
    }
  }

  /**
   * Render simple drop shadow (no knockout)
   */
  private renderDropShadowSimple(
    canvas: CanvasKitCanvas,
    font: Font,
    layout: LayoutResult,
    shadow: DropShadowConfig,
    textColor: string,
    letterSpacing: number,
    align: 'left' | 'center' | 'right' | 'justify' | undefined,
    availableWidth: number
  ): void {
    const shadowPaint = new this.canvasKit.Paint()

    // Set shadow color
    const shadowColor = parseColor(this.canvasKit, resolveColor(shadow.color, textColor))
    if (shadow.opacity !== undefined) {
      shadowColor[3] *= shadow.opacity
    }
    shadowPaint.setColor(shadowColor)
    shadowPaint.setAntiAlias(true)

    // Apply blur
    if (shadow.radius > 0) {
      const sigma = blurRadiusToSigma(shadow.radius)
      const blurFilter = this.canvasKit.MaskFilter.MakeBlur(this.canvasKit.BlurStyle.Normal, sigma, true)
      shadowPaint.setMaskFilter(blurFilter)
    }

    // Apply blend mode
    if (shadow.blendMode) {
      shadowPaint.setBlendMode(getBlendMode(this.canvasKit, shadow.blendMode))
    }

    // Draw shadow at offset
    canvas.save()
    canvas.translate(shadow.offsetX, shadow.offsetY)
    drawTextLines(this.canvasKit, canvas, font, layout.lines, shadowPaint, letterSpacing, align, availableWidth)
    canvas.restore()

    shadowPaint.delete()
  }

  /**
   * Render drop shadow with knockout (shadow doesn't show under text)
   * Uses offscreen surface and compositing
   */
  private renderDropShadowKnockout(
    canvas: CanvasKitCanvas,
    font: Font,
    layout: LayoutResult,
    shadow: DropShadowConfig,
    textColor: string,
    width: number,
    height: number,
    letterSpacing: number,
    align: 'left' | 'center' | 'right' | 'justify' | undefined
  ): void {
    // Create offscreen surface for compositing
    const surface = this.canvasKit.MakeSurface(Math.ceil(width), Math.ceil(height))
    if (!surface) {
      // Fallback to simple shadow if surface creation fails
      this.renderDropShadowSimple(canvas, font, layout, shadow, textColor, letterSpacing, align, width)
      return
    }

    const offCanvas = surface.getCanvas()
    offCanvas.clear(this.canvasKit.Color4f(0, 0, 0, 0))

    // Draw shadow
    const shadowPaint = new this.canvasKit.Paint()
    const shadowColor = parseColor(this.canvasKit, resolveColor(shadow.color, textColor))
    if (shadow.opacity !== undefined) {
      shadowColor[3] *= shadow.opacity
    }
    shadowPaint.setColor(shadowColor)
    shadowPaint.setAntiAlias(true)

    if (shadow.radius > 0) {
      const sigma = blurRadiusToSigma(shadow.radius)
      const blurFilter = this.canvasKit.MaskFilter.MakeBlur(this.canvasKit.BlurStyle.Normal, sigma, true)
      shadowPaint.setMaskFilter(blurFilter)
    }

    // Draw shadow at offset position
    offCanvas.save()
    offCanvas.translate(shadow.offsetX, shadow.offsetY)
    drawTextLines(this.canvasKit, offCanvas, font, layout.lines, shadowPaint, letterSpacing, align, width)
    offCanvas.restore()

    // Knock out the text shape using DstOut
    const knockoutPaint = new this.canvasKit.Paint()
    knockoutPaint.setColor(this.canvasKit.Color4f(1, 1, 1, 1))
    knockoutPaint.setBlendMode(this.canvasKit.BlendMode.DstOut)
    knockoutPaint.setAntiAlias(true)

    drawTextLines(this.canvasKit, offCanvas, font, layout.lines, knockoutPaint, letterSpacing, align, width)

    // Draw result to main canvas
    const image = surface.makeImageSnapshot()
    canvas.drawImage(image, 0, 0)

    // Cleanup
    image.delete()
    knockoutPaint.delete()
    shadowPaint.delete()
    surface.delete()
  }

  /**
   * Render inner shadow using layer compositing
   *
   * Algorithm:
   * 1. Create temp surface, draw text shape (white)
   * 2. Create shadow surface, fill with shadow color
   * 3. Cut out text shape using DstOut blend mode
   * 4. Apply Gaussian blur to shadow
   * 5. Offset the blurred shadow
   * 6. Composite to temp surface using SrcIn (clips to text)
   * 7. Draw temp surface to main canvas
   */
  private renderInnerShadow(
    canvas: CanvasKitCanvas,
    font: Font,
    layout: LayoutResult,
    shadow: InnerShadowConfig,
    textColor: string,
    width: number,
    height: number,
    letterSpacing: number,
    align: 'left' | 'center' | 'right' | 'justify' | undefined
  ): void {
    const surfaceWidth = Math.ceil(width)
    const surfaceHeight = Math.ceil(height)

    // Step 1: Create mask surface with text shape
    const maskSurface = this.canvasKit.MakeSurface(surfaceWidth, surfaceHeight)
    if (!maskSurface) return

    const maskCanvas = maskSurface.getCanvas()
    maskCanvas.clear(this.canvasKit.Color4f(0, 0, 0, 0))

    const whitePaint = new this.canvasKit.Paint()
    whitePaint.setColor(this.canvasKit.Color4f(1, 1, 1, 1))
    whitePaint.setAntiAlias(true)

    drawTextLines(this.canvasKit, maskCanvas, font, layout.lines, whitePaint, letterSpacing, align, width)

    // Step 2: Create shadow surface
    const shadowSurface = this.canvasKit.MakeSurface(surfaceWidth, surfaceHeight)
    if (!shadowSurface) {
      whitePaint.delete()
      maskSurface.delete()
      return
    }

    const shadowCanvas = shadowSurface.getCanvas()

    // Fill entire surface with shadow color
    const shadowColor = parseColor(this.canvasKit, resolveColor(shadow.color, textColor))
    if (shadow.opacity !== undefined) {
      shadowColor[3] *= shadow.opacity
    }
    shadowCanvas.clear(shadowColor)

    // Step 3: Cut out text shape using DstOut
    const cutoutPaint = new this.canvasKit.Paint()
    cutoutPaint.setColor(this.canvasKit.Color4f(1, 1, 1, 1))
    cutoutPaint.setBlendMode(this.canvasKit.BlendMode.DstOut)
    cutoutPaint.setAntiAlias(true)

    drawTextLines(this.canvasKit, shadowCanvas, font, layout.lines, cutoutPaint, letterSpacing, align, width)

    // Step 4: Apply blur to shadow
    let blurredImage = shadowSurface.makeImageSnapshot()

    if (shadow.radius > 0) {
      const blurSurface = this.canvasKit.MakeSurface(surfaceWidth, surfaceHeight)
      if (blurSurface) {
        const blurCanvas = blurSurface.getCanvas()
        blurCanvas.clear(this.canvasKit.Color4f(0, 0, 0, 0))

        const blurPaint = new this.canvasKit.Paint()
        const sigma = blurRadiusToSigma(shadow.radius)
        const imageFilter = this.canvasKit.ImageFilter.MakeBlur(sigma, sigma, this.canvasKit.TileMode.Clamp, null)
        blurPaint.setImageFilter(imageFilter)

        blurCanvas.drawImage(blurredImage, 0, 0, blurPaint)

        blurredImage.delete()
        blurredImage = blurSurface.makeImageSnapshot()

        blurPaint.delete()
        blurSurface.delete()
      }
    }

    // Step 5 & 6: Composite blurred shadow with mask using SrcIn
    const resultSurface = this.canvasKit.MakeSurface(surfaceWidth, surfaceHeight)
    if (!resultSurface) {
      blurredImage.delete()
      cutoutPaint.delete()
      whitePaint.delete()
      shadowSurface.delete()
      maskSurface.delete()
      return
    }

    const resultCanvas = resultSurface.getCanvas()
    resultCanvas.clear(this.canvasKit.Color4f(0, 0, 0, 0))

    // Draw mask (text shape)
    const maskImage = maskSurface.makeImageSnapshot()
    resultCanvas.drawImage(maskImage, 0, 0)

    // Draw blurred shadow with offset, using SrcIn to clip to text
    const compositePaint = new this.canvasKit.Paint()
    compositePaint.setBlendMode(this.canvasKit.BlendMode.SrcIn)

    resultCanvas.drawImage(blurredImage, shadow.offsetX, shadow.offsetY, compositePaint)

    // Apply blend mode if specified
    const finalPaint = new this.canvasKit.Paint()
    if (shadow.blendMode) {
      finalPaint.setBlendMode(getBlendMode(this.canvasKit, shadow.blendMode))
    }

    // Step 7: Draw result to main canvas
    const finalImage = resultSurface.makeImageSnapshot()
    canvas.drawImage(finalImage, 0, 0, finalPaint)

    // Cleanup
    finalImage.delete()
    finalPaint.delete()
    compositePaint.delete()
    maskImage.delete()
    blurredImage.delete()
    cutoutPaint.delete()
    whitePaint.delete()
    resultSurface.delete()
    shadowSurface.delete()
    maskSurface.delete()
  }

  /**
   * Render all effects for text path
   */
  renderTextPathWithEffects(
    canvas: CanvasKitCanvas,
    font: Font,
    glyphs: TextPathGlyph[],
    config: EffectsRenderConfig
  ): void {
    const { width, height, textColor, fillOpacity = 1, dropShadows, innerShadows } = config

    // Separate drop shadows by showBehindNode
    const behindShadows = dropShadows.filter(s => s.showBehindNode === true)
    const knockoutShadows = dropShadows.filter(s => s.showBehindNode !== true)

    // 1. Render behind shadows
    for (const shadow of behindShadows) {
      this.renderTextPathDropShadowSimple(canvas, font, glyphs, shadow, textColor)
    }

    // 2. Render knockout shadows
    for (const shadow of knockoutShadows) {
      this.renderTextPathDropShadowKnockout(canvas, font, glyphs, shadow, textColor, width, height)
    }

    // 3. Render main text
    const textPaint = new this.canvasKit.Paint()
    const textColorParsed = parseColor(this.canvasKit, resolveColor(textColor, textColor))
    if (fillOpacity < 1) {
      textColorParsed[3] *= fillOpacity
    }
    textPaint.setColor(textColorParsed)
    textPaint.setAntiAlias(true)

    drawTextPathGlyphs(this.canvasKit, canvas, font, glyphs, textPaint)
    textPaint.delete()

    // 4. Render inner shadows
    for (const shadow of innerShadows) {
      this.renderTextPathInnerShadow(canvas, font, glyphs, shadow, textColor, width, height)
    }
  }

  /**
   * Render simple drop shadow for text path
   */
  private renderTextPathDropShadowSimple(
    canvas: CanvasKitCanvas,
    font: Font,
    glyphs: TextPathGlyph[],
    shadow: DropShadowConfig,
    textColor: string
  ): void {
    const shadowPaint = new this.canvasKit.Paint()
    const shadowColor = parseColor(this.canvasKit, resolveColor(shadow.color, textColor))
    if (shadow.opacity !== undefined) {
      shadowColor[3] *= shadow.opacity
    }
    shadowPaint.setColor(shadowColor)
    shadowPaint.setAntiAlias(true)

    if (shadow.radius > 0) {
      const sigma = blurRadiusToSigma(shadow.radius)
      const blurFilter = this.canvasKit.MaskFilter.MakeBlur(this.canvasKit.BlurStyle.Normal, sigma, true)
      shadowPaint.setMaskFilter(blurFilter)
    }

    canvas.save()
    canvas.translate(shadow.offsetX, shadow.offsetY)
    drawTextPathGlyphs(this.canvasKit, canvas, font, glyphs, shadowPaint)
    canvas.restore()

    shadowPaint.delete()
  }

  /**
   * Render knockout drop shadow for text path
   */
  private renderTextPathDropShadowKnockout(
    canvas: CanvasKitCanvas,
    font: Font,
    glyphs: TextPathGlyph[],
    shadow: DropShadowConfig,
    textColor: string,
    width: number,
    height: number
  ): void {
    const surface = this.canvasKit.MakeSurface(Math.ceil(width), Math.ceil(height))
    if (!surface) {
      this.renderTextPathDropShadowSimple(canvas, font, glyphs, shadow, textColor)
      return
    }

    const offCanvas = surface.getCanvas()
    offCanvas.clear(this.canvasKit.Color4f(0, 0, 0, 0))

    const shadowPaint = new this.canvasKit.Paint()
    const shadowColor = parseColor(this.canvasKit, resolveColor(shadow.color, textColor))
    if (shadow.opacity !== undefined) {
      shadowColor[3] *= shadow.opacity
    }
    shadowPaint.setColor(shadowColor)
    shadowPaint.setAntiAlias(true)

    if (shadow.radius > 0) {
      const sigma = blurRadiusToSigma(shadow.radius)
      const blurFilter = this.canvasKit.MaskFilter.MakeBlur(this.canvasKit.BlurStyle.Normal, sigma, true)
      shadowPaint.setMaskFilter(blurFilter)
    }

    offCanvas.save()
    offCanvas.translate(shadow.offsetX, shadow.offsetY)
    drawTextPathGlyphs(this.canvasKit, offCanvas, font, glyphs, shadowPaint)
    offCanvas.restore()

    const knockoutPaint = new this.canvasKit.Paint()
    knockoutPaint.setColor(this.canvasKit.Color4f(1, 1, 1, 1))
    knockoutPaint.setBlendMode(this.canvasKit.BlendMode.DstOut)
    knockoutPaint.setAntiAlias(true)

    drawTextPathGlyphs(this.canvasKit, offCanvas, font, glyphs, knockoutPaint)

    const image = surface.makeImageSnapshot()
    canvas.drawImage(image, 0, 0)

    image.delete()
    knockoutPaint.delete()
    shadowPaint.delete()
    surface.delete()
  }

  /**
   * Render inner shadow for text path
   */
  private renderTextPathInnerShadow(
    canvas: CanvasKitCanvas,
    font: Font,
    glyphs: TextPathGlyph[],
    shadow: InnerShadowConfig,
    textColor: string,
    width: number,
    height: number
  ): void {
    const surfaceWidth = Math.ceil(width)
    const surfaceHeight = Math.ceil(height)

    const maskSurface = this.canvasKit.MakeSurface(surfaceWidth, surfaceHeight)
    if (!maskSurface) return

    const maskCanvas = maskSurface.getCanvas()
    maskCanvas.clear(this.canvasKit.Color4f(0, 0, 0, 0))

    const whitePaint = new this.canvasKit.Paint()
    whitePaint.setColor(this.canvasKit.Color4f(1, 1, 1, 1))
    whitePaint.setAntiAlias(true)

    drawTextPathGlyphs(this.canvasKit, maskCanvas, font, glyphs, whitePaint)

    const shadowSurface = this.canvasKit.MakeSurface(surfaceWidth, surfaceHeight)
    if (!shadowSurface) {
      whitePaint.delete()
      maskSurface.delete()
      return
    }

    const shadowCanvas = shadowSurface.getCanvas()
    const shadowColor = parseColor(this.canvasKit, resolveColor(shadow.color, textColor))
    if (shadow.opacity !== undefined) {
      shadowColor[3] *= shadow.opacity
    }
    shadowCanvas.clear(shadowColor)

    const cutoutPaint = new this.canvasKit.Paint()
    cutoutPaint.setColor(this.canvasKit.Color4f(1, 1, 1, 1))
    cutoutPaint.setBlendMode(this.canvasKit.BlendMode.DstOut)
    cutoutPaint.setAntiAlias(true)

    drawTextPathGlyphs(this.canvasKit, shadowCanvas, font, glyphs, cutoutPaint)

    let blurredImage = shadowSurface.makeImageSnapshot()

    if (shadow.radius > 0) {
      const blurSurface = this.canvasKit.MakeSurface(surfaceWidth, surfaceHeight)
      if (blurSurface) {
        const blurCanvas = blurSurface.getCanvas()
        blurCanvas.clear(this.canvasKit.Color4f(0, 0, 0, 0))

        const blurPaint = new this.canvasKit.Paint()
        const sigma = blurRadiusToSigma(shadow.radius)
        const imageFilter = this.canvasKit.ImageFilter.MakeBlur(sigma, sigma, this.canvasKit.TileMode.Clamp, null)
        blurPaint.setImageFilter(imageFilter)

        blurCanvas.drawImage(blurredImage, 0, 0, blurPaint)

        blurredImage.delete()
        blurredImage = blurSurface.makeImageSnapshot()

        blurPaint.delete()
        blurSurface.delete()
      }
    }

    const resultSurface = this.canvasKit.MakeSurface(surfaceWidth, surfaceHeight)
    if (!resultSurface) {
      blurredImage.delete()
      cutoutPaint.delete()
      whitePaint.delete()
      shadowSurface.delete()
      maskSurface.delete()
      return
    }

    const resultCanvas = resultSurface.getCanvas()
    resultCanvas.clear(this.canvasKit.Color4f(0, 0, 0, 0))

    const maskImage = maskSurface.makeImageSnapshot()
    resultCanvas.drawImage(maskImage, 0, 0)

    const compositePaint = new this.canvasKit.Paint()
    compositePaint.setBlendMode(this.canvasKit.BlendMode.SrcIn)

    resultCanvas.drawImage(blurredImage, shadow.offsetX, shadow.offsetY, compositePaint)

    const finalPaint = new this.canvasKit.Paint()
    if (shadow.blendMode) {
      finalPaint.setBlendMode(getBlendMode(this.canvasKit, shadow.blendMode))
    }

    const finalImage = resultSurface.makeImageSnapshot()
    canvas.drawImage(finalImage, 0, 0, finalPaint)

    finalImage.delete()
    finalPaint.delete()
    compositePaint.delete()
    maskImage.delete()
    blurredImage.delete()
    cutoutPaint.delete()
    whitePaint.delete()
    resultSurface.delete()
    shadowSurface.delete()
    maskSurface.delete()
  }
}
