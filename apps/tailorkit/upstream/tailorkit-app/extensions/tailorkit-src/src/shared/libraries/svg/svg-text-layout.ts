/**
 * SVG Text Layout
 *
 * Handles text wrapping, positioning, alignment, and font metrics for SVG text elements.
 *
 * @module shared/libraries/svg
 */

import { normalizeFontWeight } from './svg-font-manager'

/**
 * Text alignment options
 */
export type TextAlign = 'left' | 'center' | 'right'

/**
 * Vertical alignment options
 */
export type VerticalAlign = 'top' | 'middle' | 'bottom'

/**
 * Text wrap modes
 */
export type TextWrap = 'none' | 'word' | 'char'

/**
 * Font metrics for positioning calculations
 */
export interface FontMetrics {
  ascent: number
  descent: number
}

/**
 * Map horizontal alignment to SVG text-anchor attribute
 *
 * @param align - Text alignment
 * @returns SVG text-anchor value
 */
export function getTextAnchor(align: TextAlign | undefined): string {
  switch (align) {
    case 'center':
      return 'middle'
    case 'right':
      return 'end'
    default:
      return 'start'
  }
}

/**
 * Get x position based on alignment
 *
 * @param align - Text alignment
 * @param width - Container width
 * @param padding - Horizontal padding
 * @returns X position for text
 */
export function getXPosition(align: TextAlign | undefined, width: number, padding: number): number {
  switch (align) {
    case 'center':
      return width / 2
    case 'right':
      return width - padding
    default:
      return padding
  }
}

/**
 * Calculate text width including letter spacing
 * Letter spacing adds extra space after each character
 *
 * @param ctx - Canvas 2D context
 * @param text - Text to measure
 * @param letterSpacing - Letter spacing in pixels
 * @returns Total width including letter spacing
 */
function measureTextWithLetterSpacing(ctx: CanvasRenderingContext2D, text: string, letterSpacing: number): number {
  const baseWidth = ctx.measureText(text).width
  // Letter spacing is applied between/after characters
  const letterSpacingTotal = letterSpacing * Math.max(0, text.length)
  return baseWidth + letterSpacingTotal
}

/**
 * Manual word wrap implementation using canvas for text measurement
 * Handles explicit newlines (\n), word/char wrapping, and letter spacing
 *
 * @param text - Text to wrap
 * @param maxWidth - Maximum line width
 * @param fontSize - Font size in pixels
 * @param fontFamily - Font family name
 * @param fontWeight - Font weight (optional)
 * @param wrap - Wrap mode ('none', 'word', 'char')
 * @param letterSpacing - Letter spacing in pixels (default: 0)
 * @returns Array of wrapped lines
 */
export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  fontFamily: string,
  fontWeight?: string | number,
  wrap: TextWrap = 'word',
  letterSpacing: number = 0
): string[] {
  // First, split by explicit newlines to preserve user's line breaks
  const paragraphs = text.split('\n')

  if (wrap === 'none') {
    // Even with no wrapping, respect explicit newlines
    return paragraphs
  }

  // Create temporary canvas for text measurement
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return paragraphs

  // Normalize font-weight for consistent text measurement
  const normalizedWeight = fontWeight ? normalizeFontWeight(fontWeight) : ''
  const weight = normalizedWeight ? `${normalizedWeight} ` : ''
  ctx.font = `${weight}${fontSize}px ${fontFamily}`

  const allLines: string[] = []

  // Process each paragraph (text between newlines) separately
  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      // Preserve empty lines from consecutive newlines
      allLines.push('')
      continue
    }

    if (wrap === 'char') {
      // Character-level wrapping for this paragraph
      const chars = paragraph.split('')
      let currentLine = ''

      for (const char of chars) {
        const testLine = currentLine + char
        const testWidth = measureTextWithLetterSpacing(ctx, testLine, letterSpacing)

        if (testWidth > maxWidth && currentLine) {
          allLines.push(currentLine)
          currentLine = char
        } else {
          currentLine = testLine
        }
      }

      if (currentLine) {
        allLines.push(currentLine)
      }
    } else {
      // Word-level wrapping for this paragraph (default)
      const words = paragraph.split(' ')
      let currentLine = ''

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const testWidth = measureTextWithLetterSpacing(ctx, testLine, letterSpacing)

        if (testWidth > maxWidth && currentLine) {
          allLines.push(currentLine)
          currentLine = word
        } else {
          currentLine = testLine
        }
      }

      if (currentLine) {
        allLines.push(currentLine)
      }
    }
  }

  return allLines
}

/**
 * Get font metrics (ascent, descent) for accurate vertical positioning
 * This matches how Konva calculates text positioning
 *
 * @param fontSize - Font size in pixels
 * @param fontFamily - Font family name
 * @param fontWeight - Font weight (optional)
 * @returns Font metrics with ascent and descent
 */
export function getFontMetrics(fontSize: number, fontFamily: string, fontWeight?: string | number): FontMetrics {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    // Fallback: typical font metrics ratio
    return { ascent: fontSize * 0.8, descent: fontSize * 0.2 }
  }

  const normalizedWeight = fontWeight ? normalizeFontWeight(fontWeight) : ''
  const weight = normalizedWeight ? `${normalizedWeight} ` : ''
  ctx.font = `${weight}${fontSize}px ${fontFamily}`

  const metrics = ctx.measureText('M')

  // Use fontBoundingBox if available (more accurate), fallback to actualBoundingBox or estimates
  const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent ?? fontSize * 0.8
  const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent ?? fontSize * 0.2

  return { ascent, descent }
}

/**
 * Calculate vertical offset based on vertical alignment
 * Uses font metrics for accurate visual centering (matches Konva behavior)
 *
 * @param verticalAlign - Vertical alignment
 * @param height - Container height
 * @param totalTextHeight - Total height of all text lines
 * @param padding - Vertical padding
 * @param fontSize - Font size in pixels
 * @param fontFamily - Font family name
 * @param fontWeight - Font weight (optional)
 * @returns Y offset for text positioning
 */
export function getVerticalOffset(
  verticalAlign: VerticalAlign | undefined,
  height: number,
  totalTextHeight: number,
  padding: number,
  fontSize: number,
  fontFamily: string,
  fontWeight?: string | number
): number {
  switch (verticalAlign) {
    case 'middle': {
      // Get actual font metrics for accurate visual centering
      const { descent } = getFontMetrics(fontSize, fontFamily, fontWeight)
      // The descent space is often unused (for text without g, y, p, q, j)
      // Shift up by half the descent to visually center the text
      // This matches how Konva centers text visually
      const visualCenterAdjustment = -descent / 2
      return (height - totalTextHeight) / 2 + padding + visualCenterAdjustment
    }
    case 'bottom':
      return height - totalTextHeight - padding
    default: // 'top'
      return padding
  }
}

/**
 * Calculate total text height for multiple lines
 *
 * @param lineCount - Number of lines
 * @param fontSize - Font size in pixels
 * @param lineHeight - Line height multiplier (default: 1.2)
 * @returns Total text height
 */
export function calculateTotalTextHeight(lineCount: number, fontSize: number, lineHeight: number = 1.2): number {
  const lineHeightPx = fontSize * lineHeight
  return fontSize + (lineCount - 1) * lineHeightPx
}

/**
 * Get start offset percentage for text path alignment
 *
 * @param align - Text alignment
 * @returns Start offset as percentage string
 */
export function getTextPathStartOffset(align: TextAlign | undefined): string {
  switch (align) {
    case 'center':
      return '50%'
    case 'right':
      return '100%'
    default:
      return '0%'
  }
}
