/**
 * CanvasKit Text Layout Engine
 *
 * Matches Konva's text layout algorithm for consistent rendering.
 * Handles word/character wrapping, alignment, line height, and letter spacing.
 *
 * @module libraries/konva/effects
 */

import type { CanvasKit, Font, Typeface } from 'canvaskit-wasm'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CanvasKitCanvas = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CanvasKitPaint = any

export interface TextLayoutConfig {
  text: string
  width: number
  height: number
  fontSize: number
  fontFamily: string
  fontWeight?: string | number
  fontStyle?: string
  align?: 'left' | 'center' | 'right' | 'justify'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  lineHeight?: number
  letterSpacing?: number
  wrap?: 'none' | 'word' | 'char'
  padding?: number
  ellipsis?: boolean
}

export interface TextLine {
  text: string
  x: number
  y: number
  width: number
  glyphs?: number[] // Glyph IDs for advanced rendering
}

export interface LayoutResult {
  lines: TextLine[]
  actualWidth: number
  actualHeight: number
  font: Font
  textHeight: number
}

/**
 * Compute text layout matching Konva's algorithm
 *
 * Konva's text layout:
 * 1. Split text by newlines
 * 2. For each line, measure words/characters
 * 3. Wrap based on container width
 * 4. Apply horizontal alignment per line
 * 5. Apply vertical alignment for all lines
 */
export function computeTextLayout(
  canvasKit: CanvasKit,
  typeface: Typeface,
  config: TextLayoutConfig
): LayoutResult {
  const {
    text,
    width,
    height,
    fontSize,
    align = 'left',
    verticalAlign = 'top',
    lineHeight = 1,
    letterSpacing = 0,
    wrap = 'word',
    padding = 0,
  } = config

  // Create font
  const font = new canvasKit.Font(typeface, fontSize)
  font.setSubpixel(true)

  // Calculate available dimensions
  const availableWidth = width - padding * 2
  const availableHeight = height - padding * 2

  // Calculate line height in pixels
  const fontMetrics = font.getMetrics()
  const baseLineHeight = Math.abs(fontMetrics.ascent) + Math.abs(fontMetrics.descent)
  const actualLineHeight = baseLineHeight * lineHeight

  // Split text by explicit newlines first
  const paragraphs = text.split('\n')

  // Process each paragraph
  const lines: TextLine[] = []
  let maxWidth = 0

  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      // Empty line
      lines.push({ text: '', x: 0, y: 0, width: 0 })
      continue
    }

    // Wrap the paragraph based on wrap mode
    const wrappedLines = wrapText(canvasKit, font, paragraph, availableWidth, letterSpacing, wrap)

    for (const line of wrappedLines) {
      const lineWidth = measureTextWidth(canvasKit, font, line, letterSpacing)
      maxWidth = Math.max(maxWidth, lineWidth)
      lines.push({ text: line, x: 0, y: 0, width: lineWidth })
    }
  }

  // Calculate total text height
  const textHeight = lines.length * actualLineHeight

  // Apply vertical alignment
  let startY: number
  switch (verticalAlign) {
    case 'middle':
      startY = padding + (availableHeight - textHeight) / 2
      break
    case 'bottom':
      startY = padding + availableHeight - textHeight
      break
    case 'top':
    default:
      startY = padding
      break
  }

  // Position each line with horizontal alignment
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Vertical position (baseline)
    // Konva positions text by top, so we add ascent to get baseline
    line.y = startY + i * actualLineHeight + Math.abs(fontMetrics.ascent)

    // Horizontal alignment
    switch (align) {
      case 'center':
        line.x = padding + (availableWidth - line.width) / 2
        break
      case 'right':
        line.x = padding + availableWidth - line.width
        break
      case 'justify':
        // For justify, we'll handle spacing during rendering
        line.x = padding
        break
      case 'left':
      default:
        line.x = padding
        break
    }
  }

  return {
    lines,
    actualWidth: maxWidth + padding * 2,
    actualHeight: textHeight + padding * 2,
    font,
    textHeight,
  }
}

/**
 * Wrap text based on wrap mode
 */
function wrapText(
  canvasKit: CanvasKit,
  font: Font,
  text: string,
  maxWidth: number,
  letterSpacing: number,
  wrap: 'none' | 'word' | 'char'
): string[] {
  if (wrap === 'none') {
    return [text]
  }

  const lines: string[] = []

  if (wrap === 'word') {
    // Word wrapping
    const words = text.split(/(\s+)/)
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine + word
      const testWidth = measureTextWidth(canvasKit, font, testLine, letterSpacing)

      if (testWidth > maxWidth && currentLine !== '') {
        // Line would be too long, push current and start new
        lines.push(currentLine.trim())
        currentLine = word.trim() === '' ? '' : word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine.trim() !== '') {
      lines.push(currentLine.trim())
    }

    // Handle case where we have no lines (empty or whitespace only)
    if (lines.length === 0) {
      lines.push('')
    }
  } else {
    // Character wrapping
    let currentLine = ''

    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      const testLine = currentLine + char
      const testWidth = measureTextWidth(canvasKit, font, testLine, letterSpacing)

      if (testWidth > maxWidth && currentLine !== '') {
        lines.push(currentLine)
        currentLine = char
      } else {
        currentLine = testLine
      }
    }

    if (currentLine !== '') {
      lines.push(currentLine)
    }

    if (lines.length === 0) {
      lines.push('')
    }
  }

  return lines
}

/**
 * Measure text width including letter spacing
 */
function measureTextWidth(canvasKit: CanvasKit, font: Font, text: string, letterSpacing: number): number {
  if (text === '') return 0

  // Get glyph IDs for the text
  const glyphIds = font.getGlyphIDs(text)

  // Get widths for each glyph
  const widths = font.getGlyphWidths(glyphIds)

  // Sum widths with letter spacing
  let totalWidth = 0
  for (let i = 0; i < widths.length; i++) {
    totalWidth += widths[i]
    // Add letter spacing between characters (not after last)
    if (i < widths.length - 1) {
      totalWidth += letterSpacing
    }
  }

  return totalWidth
}

/**
 * Draw text lines to canvas with letter spacing support
 */
export function drawTextLines(
  canvasKit: CanvasKit,
  canvas: CanvasKitCanvas,
  font: Font,
  lines: TextLine[],
  paint: CanvasKitPaint,
  letterSpacing: number = 0,
  align: 'left' | 'center' | 'right' | 'justify' = 'left',
  availableWidth: number = 0
): void {
  for (const line of lines) {
    if (line.text === '') continue

    if (letterSpacing === 0 && align !== 'justify') {
      // Simple case: no letter spacing, no justify
      canvas.drawText(line.text, line.x, line.y, paint, font)
    } else {
      // Draw character by character with spacing
      drawTextWithSpacing(canvasKit, canvas, font, line, paint, letterSpacing, align, availableWidth)
    }
  }
}

/**
 * Draw text with letter spacing (character by character)
 */
function drawTextWithSpacing(
  _canvasKit: CanvasKit,
  canvas: CanvasKitCanvas,
  font: Font,
  line: TextLine,
  paint: CanvasKitPaint,
  letterSpacing: number,
  align: 'left' | 'center' | 'right' | 'justify',
  availableWidth: number
): void {
  const { text } = line
  let x = line.x

  // For justify, calculate extra spacing per character
  let justifySpacing = 0
  if (align === 'justify' && text.length > 1) {
    const textWidth = measureTextWidthSimple(font, text, letterSpacing)
    const extraSpace = availableWidth - textWidth
    justifySpacing = extraSpace / (text.length - 1)
  }

  // Get glyph widths for positioning
  const glyphIds = font.getGlyphIDs(text)
  const widths = font.getGlyphWidths(glyphIds)

  // Draw each character
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    canvas.drawText(char, x, line.y, paint, font)

    // Advance position
    x += widths[i] + letterSpacing + (align === 'justify' ? justifySpacing : 0)
  }
}

/**
 * Simple text width measurement using font
 */
function measureTextWidthSimple(font: Font, text: string, letterSpacing: number): number {
  if (text === '') return 0

  const glyphIds = font.getGlyphIDs(text)
  const widths = font.getGlyphWidths(glyphIds)

  let total = 0
  for (let i = 0; i < widths.length; i++) {
    total += widths[i]
    if (i < widths.length - 1) {
      total += letterSpacing
    }
  }
  return total
}

/**
 * Compute text path layout for text along SVG path
 */
export interface TextPathLayoutConfig {
  text: string
  pathData: string
  fontSize: number
  letterSpacing?: number
  textBaseline?: CanvasTextBaseline
}

export interface TextPathGlyph {
  char: string
  x: number
  y: number
  angle: number // Rotation angle in radians
}

export interface TextPathLayoutResult {
  glyphs: TextPathGlyph[]
  font: Font
}

/**
 * Compute layout for text along an SVG path
 * Positions each character along the path with appropriate rotation
 */
export function computeTextPathLayout(
  canvasKit: CanvasKit,
  typeface: Typeface,
  config: TextPathLayoutConfig
): TextPathLayoutResult | null {
  const { text, pathData, fontSize, letterSpacing = 0 } = config

  // Create font
  const font = new canvasKit.Font(typeface, fontSize)
  font.setSubpixel(true)

  // Parse SVG path
  const path = canvasKit.Path.MakeFromSVGString(pathData)
  if (!path) {
    console.warn('[TextPathLayout] Invalid SVG path data')
    return null
  }

  // Get path length using ContourMeasureIter
  const contourMeasureIter = new canvasKit.ContourMeasureIter(path, false, 1)
  const contourMeasure = contourMeasureIter.next()
  if (!contourMeasure) {
    path.delete()
    contourMeasureIter.delete()
    return null
  }

  const pathLength = contourMeasure.length()
  if (pathLength === 0) {
    path.delete()
    contourMeasure.delete()
    contourMeasureIter.delete()
    return null
  }

  // Measure total text width
  const glyphIds = font.getGlyphIDs(text)
  const widths = font.getGlyphWidths(glyphIds)

  let totalTextWidth = 0
  for (let i = 0; i < widths.length; i++) {
    totalTextWidth += widths[i]
    if (i < widths.length - 1) {
      totalTextWidth += letterSpacing
    }
  }

  // Center text on path
  let currentPos = (pathLength - totalTextWidth) / 2

  // Position each glyph
  const glyphs: TextPathGlyph[] = []

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const glyphWidth = widths[i]

    // Get position at center of glyph
    const t = Math.max(0, Math.min(pathLength, currentPos + glyphWidth / 2))

    // Get point and tangent on path using ContourMeasure
    const posAndTan = contourMeasure.getPosTan(t)

    glyphs.push({
      char,
      x: posAndTan[0],
      y: posAndTan[1],
      angle: Math.atan2(posAndTan[3], posAndTan[2]),
    })

    // Advance position
    currentPos += glyphWidth + letterSpacing
  }

  path.delete()
  contourMeasure.delete()
  contourMeasureIter.delete()

  return { glyphs, font }
}

/**
 * Draw text path glyphs to canvas
 */
export function drawTextPathGlyphs(
  _canvasKit: CanvasKit,
  canvas: CanvasKitCanvas,
  font: Font,
  glyphs: TextPathGlyph[],
  paint: CanvasKitPaint
): void {
  for (const glyph of glyphs) {
    canvas.save()
    canvas.translate(glyph.x, glyph.y)
    canvas.rotate((glyph.angle * 180) / Math.PI, 0, 0)

    // Center the character
    const glyphIds = font.getGlyphIDs(glyph.char)
    const widths = font.getGlyphWidths(glyphIds)
    const charWidth = widths[0] || 0

    canvas.drawText(glyph.char, -charWidth / 2, 0, paint, font)
    canvas.restore()
  }
}
