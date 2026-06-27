/* eslint-disable max-len */
/**
 * SVG Envelope Text Creator
 *
 * Renders text with envelope distortion as SVG.
 * Creates SVG text elements positioned and scaled to fill a closed shape.
 */

import { autoClosePath } from './svg-envelope-boundary'
import { processEnvelopeText, type TextMetrics, type EnvelopeDistortionResult } from './svg-envelope-distortion'

export interface EnvelopeTextOptions {
  text: string
  fontSize: number
  fontFamily: string
  fontWeight?: string | number
  letterSpacing?: number
  lineHeight?: number
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  /** Base64 CSS for font embedding (required for custom fonts to render correctly) */
  fontBase64Css?: string | null
  /**
   * Vertical offset as percentage (-50 to +50)
   * Positive values move text down, negative move text up
   * @default 0
   */
  verticalOffset?: number
  /**
   * Vertical scale factor (0.5 to 2.0)
   * Values > 1.0 stretch characters taller, < 1.0 compress them
   * @default 1.0
   */
  verticalScale?: number
  /**
   * Horizontal offset as percentage (-50 to +50)
   * Positive values move text right, negative move text left
   * @default 0
   */
  horizontalOffset?: number
  /**
   * Horizontal scale factor (0.5 to 2.0)
   * Values > 1.0 stretch characters wider, < 1.0 compress them
   * @default 1.0
   */
  horizontalScale?: number
  /**
   * Character spacing adjustment (-50 to +50)
   * Negative values bring characters closer together, positive values spread them apart
   * @default 0
   */
  characterSpacing?: number
}

export interface EnvelopeTextResult {
  svg: string
  width: number
  height: number
  viewBox: string
}

/**
 * Create SVG text that fills a closed path using envelope distortion
 */
export function createEnvelopeText(
  pathData: string,
  options: EnvelopeTextOptions,
  viewBoxWidth: number,
  viewBoxHeight: number
): EnvelopeTextResult | null {
  if (!pathData || !options.text) {
    return null
  }

  try {
    // Ensure path is closed
    const closedPath = autoClosePath(pathData)

    // Create text metrics
    const metrics: TextMetrics = {
      text: options.text,
      fontSize: options.fontSize,
      fontFamily: options.fontFamily,
      fontWeight: options.fontWeight,
      letterSpacing: options.letterSpacing || 0,
      lineHeight: options.lineHeight || options.fontSize * 1.2,
    }

    // Process text with envelope distortion
    const distortion = processEnvelopeText(options.text, metrics, closedPath, {
      verticalOffset: options.verticalOffset,
      verticalScale: options.verticalScale,
      horizontalOffset: options.horizontalOffset,
      horizontalScale: options.horizontalScale,
      characterSpacing: options.characterSpacing,
    })

    if (!distortion || distortion.lines.length === 0) {
      return null
    }

    // Check if all lines have zero characters
    const totalChars = distortion.lines.reduce((sum, line) => sum + line.characters.length, 0)
    if (totalChars === 0) {
      return null
    }

    // Generate SVG
    const svg = generateEnvelopeSvg(distortion, options, viewBoxWidth, viewBoxHeight)

    return {
      svg,
      width: viewBoxWidth,
      height: viewBoxHeight,
      viewBox: `0 0 ${viewBoxWidth} ${viewBoxHeight}`,
    }
  } catch (err) {
    return null
  }
}

/**
 * Generate SVG markup for envelope-distorted text
 * Each character is positioned and scaled VERTICALLY to fill the shape's height at that X position.
 * This creates the "text filling shape" visual effect.
 *
 * Rendering approach:
 * - Each character is positioned at its X coordinate
 * - scaleY stretches the character vertically to fill the shape height at that position
 * - Clip path ensures text stays within the shape boundary
 */
function generateEnvelopeSvg(
  distortion: EnvelopeDistortionResult,
  options: EnvelopeTextOptions,
  viewBoxWidth: number,
  viewBoxHeight: number
): string {
  const { lines } = distortion
  const fillColor = options.fillColor || '#000000'
  const fontFamily = options.fontFamily || 'Arial'
  const fontWeight = options.fontWeight || 'normal'

  // Build text elements - each character in its own group with vertical scaling
  const textElements: string[] = []

  for (const line of lines) {
    for (const char of line.characters) {
      const x = char.x
      const y = char.y
      const fontSize = char.fontSize
      const scaleX = char.scaleX
      const scaleY = char.scaleY

      // Transform: translate to position, then scale both horizontally and vertically
      // The character starts at the top of its segment (y) and stretches down
      // Text baseline offset (0.75-0.85 of fontSize) accounts for font metrics
      textElements.push(
        `<g transform="translate(${x.toFixed(2)}, ${y.toFixed(2)}) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})">`
          + `<text `
          + `x="0" `
          + `y="${(fontSize * 0.78).toFixed(2)}" `
          + `font-family="${escapeXml(fontFamily)}, sans-serif" `
          + `font-size="${fontSize.toFixed(2)}" `
          + `font-weight="${fontWeight}" `
          + `fill="${fillColor}">`
          + `${escapeXml(char.char)}</text>`
          + `</g>`
      )
    }
  }

  // Combine into SVG with stroke support
  let strokeAttr = ''

  if (options.strokeColor && options.strokeWidth && options.strokeWidth > 0) {
    strokeAttr = ` stroke="${options.strokeColor}" stroke-width="${options.strokeWidth}"`
  }

  const textContent = textElements.join('\n    ')

  // Build font style element if font CSS is provided
  // This is CRITICAL for custom fonts to render correctly when SVG is rasterized to image
  const fontStyleElement = options.fontBase64Css ? `<style type="text/css">${options.fontBase64Css}</style>` : ''

  // Render text WITHOUT clip path - allow characters to extend beyond shape boundary
  // The envelope distortion positions characters to visually form the shape
  const defsContent = fontStyleElement ? `<defs>\n    ${fontStyleElement}\n  </defs>\n  ` : ''
  const finalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" width="${viewBoxWidth}" height="${viewBoxHeight}">
  ${defsContent}<g${strokeAttr}>
    ${textContent}
  </g>
</svg>`

  return finalSvg
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Create a simple preview of envelope text for thumbnails
 * Returns a simplified SVG suitable for small previews
 */
export function createEnvelopeTextPreview(
  pathData: string,
  text: string,
  viewBoxWidth: number,
  viewBoxHeight: number
): string {
  if (!pathData) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}">
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-size="12">${escapeXml(text.substring(0, 20))}</text>
</svg>`
  }

  const closedPath = autoClosePath(pathData)
  const textContent = escapeXml(text.substring(0, 15)) + (text.length > 15 ? '...' : '')

  // Show shape outline with centered text for preview
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}">
  <path d="${closedPath}" fill="none" stroke="#ccc" stroke-width="1" stroke-dasharray="4,2"/>
  <text x="${viewBoxWidth / 2}" y="${viewBoxHeight / 2}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#666">${textContent}</text>
</svg>`
}

/**
 * Render envelope text directly to canvas context (for Konva integration)
 * This function returns rendering instructions that can be executed on a canvas
 */
export interface CanvasRenderInstruction {
  type: 'text'
  text: string
  x: number
  y: number
  scaleX: number
  scaleY: number
  fontSize: number
  fontFamily: string
  fontWeight: string | number
  fillColor: string
  strokeColor?: string
  strokeWidth?: number
}

export function getEnvelopeTextRenderInstructions(
  pathData: string,
  options: EnvelopeTextOptions,
  _viewBoxWidth: number,
  _viewBoxHeight: number
): CanvasRenderInstruction[] | null {
  if (!pathData || !options.text) {
    return null
  }

  // Ensure path is closed
  const closedPath = autoClosePath(pathData)

  // Create text metrics
  const metrics: TextMetrics = {
    text: options.text,
    fontSize: options.fontSize,
    fontFamily: options.fontFamily,
    fontWeight: options.fontWeight,
    letterSpacing: options.letterSpacing || 0,
    lineHeight: options.lineHeight || options.fontSize * 1.2,
  }

  // Process text with envelope distortion
  const distortion = processEnvelopeText(options.text, metrics, closedPath)

  if (!distortion) {
    return null
  }

  // Convert to render instructions
  const instructions: CanvasRenderInstruction[] = []

  for (const line of distortion.lines) {
    for (const char of line.characters) {
      instructions.push({
        type: 'text',
        text: char.char,
        x: char.x,
        y: char.y,
        scaleX: char.scaleX,
        scaleY: char.scaleY,
        fontSize: options.fontSize,
        fontFamily: options.fontFamily,
        fontWeight: options.fontWeight || 'normal',
        fillColor: options.fillColor || '#000000',
        strokeColor: options.strokeColor,
        strokeWidth: options.strokeWidth,
      })
    }
  }

  return instructions
}
