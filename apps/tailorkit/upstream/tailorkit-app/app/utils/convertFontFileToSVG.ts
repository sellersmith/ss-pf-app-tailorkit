import * as fontkit from 'fontkit'

/**
 * Configuration options for converting font glyphs to SVG
 * @interface GlyphToSVGOptions
 * @property {number} [fontSize=12] - The size of the font in pixels
 * @property {number} [offsetX=0] - Horizontal offset from origin in pixels
 * @property {number} [offsetY=0] - Vertical offset from origin in pixels
 */
interface GlyphToSVGOptions {
  fontSize?: number
  offsetX?: number
  offsetY?: number
  /** Optional inline style for the root SVG element */
  style?: string
  /** Number of sample glyphs to render from the font's character set when input text has no supported codepoints */
  sampleCount?: number
  /** Extra horizontal space in pixels between multiple glyphs */
  glyphGap?: number
}

/**
 * Converts text to SVG paths using a provided font file
 *
 * @param {File | string} fontInput - The font file or URL to use for conversion (TTF/OTF format)
 * @param {string} text - The text to convert to SVG paths
 * @param {GlyphToSVGOptions} [options] - Configuration options for the conversion
 * @returns {Promise<string>} A Promise that resolves to an SVG string containing the text as paths
 *
 * @throws {Error} If font file cannot be loaded or processed
 *
 * @example
 * ```typescript
 * const fontFile = new File(['...'], 'font.ttf', { type: 'font/ttf' });
 * const svg = await convertFontFileToSVG(fontFile, 'Hello', {
 *   fontSize: 24,
 *   offsetX: 10,
 *   offsetY: 10
 * });
 *
 * const svgFromURL = await convertFontFileToSVG('https://example.com/font.ttf', 'Hello', {
 *   fontSize: 24,
 *   offsetX: 10,
 *   offsetY: 10
 * });
 * ```
 */
export async function convertFontFileToSVG(
  fontInput: File | string,
  text: string,
  options: GlyphToSVGOptions = {}
): Promise<string> {
  try {
    if (!text) {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"></svg>'
    }
    let uint8Array: Uint8Array

    if (fontInput instanceof File) {
      // Handle File input
      const arrayBuffer = await fontInput.arrayBuffer()
      uint8Array = new Uint8Array(arrayBuffer)
    } else {
      // Handle URL string input with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      try {
        const response = await fetch(fontInput, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Failed to fetch font from URL: ${response.statusText}`)
        }
        const arrayBuffer = await response.arrayBuffer()
        uint8Array = new Uint8Array(arrayBuffer)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Font fetch timed out after 5 seconds')
        }
        throw error
      } finally {
        clearTimeout(timeoutId)
      }
    }

    const font = await new Promise<fontkit.Font>((resolve, reject) => {
      try {
        const f = fontkit.create(uint8Array)
        resolve(f)
      } catch (error) {
        reject(error)
      }
    })

    if (!Number.isFinite(font.unitsPerEm) || font.unitsPerEm <= 0) {
      throw new Error('Invalid font metrics: unitsPerEm must be a positive finite number')
    }

    const {
      fontSize = 12, // Default font size
      offsetX = 0,
      offsetY = 0,
      sampleCount = 3,
      glyphGap = 0,
    } = options

    // Get the font metrics
    const safeAscent = Number.isFinite(font.ascent) ? font.ascent : font.unitsPerEm * 0.8
    const safeDescent = Number.isFinite(font.descent) ? font.descent : -font.unitsPerEm * 0.2
    const scale = (1 / font.unitsPerEm) * fontSize
    let currentX = offsetX

    // Calculate baseline based on font metrics
    const baseline = offsetY + safeAscent * scale

    // Initialize SVG path data and track bounds
    let pathData = ''
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let hasBounds = false
    let totalAdvance = 0

    // Utility to validate numeric values
    const isFiniteNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

    // Prepare a renderable string: if provided text has no supported codepoints in this font (icon fonts),
    // choose a fallback sample from the font's character set
    const characterSet = (font as unknown as { characterSet?: number[] }).characterSet || []
    const supportedCodePoints = new Set<number>(characterSet)
    const filteredText = Array.from(text)
      .filter(ch => {
        const cp = ch.codePointAt(0)
        return typeof cp === 'number' && supportedCodePoints.has(cp)
      })
      .join('')

    const renderText = (() => {
      if (filteredText.length > 0) return filteredText
      if (characterSet.length > 0) {
        const count = Math.max(1, Math.min(sampleCount, characterSet.length))
        return String.fromCodePoint(...characterSet.slice(0, count))
      }
      return ' '
    })()

    // Prefer kerning-aware shaping via layout when available
    const run
      = typeof (font as unknown as { layout?: (t: string) => unknown }).layout === 'function'
        ? (
            font as unknown as {
              layout: (t: string) => {
                glyphs: Array<fontkit.Glyph>
                positions: Array<{ xAdvance: number; yAdvance: number; xOffset?: number; yOffset?: number }>
              }
            }
          ).layout(renderText)
        : null

    if (
      run
      && Array.isArray(run.glyphs)
      && Array.isArray(run.positions)
      && run.glyphs.length === run.positions.length
    ) {
      for (let i = 0; i < run.glyphs.length; i += 1) {
        const glyph = run.glyphs[i] as fontkit.Glyph
        const pos = run.positions[i] as { xAdvance: number; yAdvance: number; xOffset?: number; yOffset?: number }

        const xOffset = (pos.xOffset ?? 0) * scale
        const yOffset = (pos.yOffset ?? 0) * scale

        // Update bounds
        if (
          glyph.bbox
          && isFiniteNumber(glyph.bbox.minX)
          && isFiniteNumber(glyph.bbox.minY)
          && isFiniteNumber(glyph.bbox.maxX)
          && isFiniteNumber(glyph.bbox.maxY)
        ) {
          const glyphMinX = currentX + xOffset + glyph.bbox.minX * scale
          const glyphMaxX = currentX + xOffset + glyph.bbox.maxX * scale
          const glyphMinY = -baseline - yOffset - glyph.bbox.maxY * scale
          const glyphMaxY = -baseline - yOffset - glyph.bbox.minY * scale

          minX = Math.min(minX, glyphMinX)
          minY = Math.min(minY, glyphMinY)
          maxX = Math.max(maxX, glyphMaxX)
          maxY = Math.max(maxY, glyphMaxY)
          hasBounds = true
        }

        if (glyph.path) {
          const glyphPath = glyph.path
            .scale(scale)
            .translate(currentX + xOffset, baseline + yOffset)
            .toSVG()
          pathData += `${glyphPath} `
        }

        let advance = (pos.xAdvance ?? glyph.advanceWidth ?? 0) * scale
        if (i < run.glyphs.length - 1 && glyphGap > 0) {
          advance += glyphGap
        }
        currentX += advance
        totalAdvance += advance
      }
    } else {
      // Fallback: simple per-codepoint flow
      const chars = Array.from(renderText)
      for (let i = 0; i < chars.length; i += 1) {
        const char = chars[i]
        const glyph = font.glyphForCodePoint(char.codePointAt(0)!)

        if (
          glyph.bbox
          && isFiniteNumber(glyph.bbox.minX)
          && isFiniteNumber(glyph.bbox.minY)
          && isFiniteNumber(glyph.bbox.maxX)
          && isFiniteNumber(glyph.bbox.maxY)
        ) {
          const glyphMinX = currentX + glyph.bbox.minX * scale
          const glyphMaxX = currentX + glyph.bbox.maxX * scale
          const glyphMinY = -baseline - glyph.bbox.maxY * scale
          const glyphMaxY = -baseline - glyph.bbox.minY * scale

          minX = Math.min(minX, glyphMinX)
          minY = Math.min(minY, glyphMinY)
          maxX = Math.max(maxX, glyphMaxX)
          maxY = Math.max(maxY, glyphMaxY)
          hasBounds = true
        }

        if (glyph.path) {
          const glyphPath = glyph.path.scale(scale).translate(currentX, baseline).toSVG()
          pathData += `${glyphPath} `
        }

        let advance = (glyph.advanceWidth ?? 0) * scale
        if (i < chars.length - 1 && glyphGap > 0) {
          advance += glyphGap
        }
        currentX += advance
        totalAdvance += advance
      }
    }

    // After building, if still no path, throw explicit error
    if (!pathData.trim()) {
      throw new Error('The provided text does not map to drawable glyphs in this font.')
    }

    // If path is still empty, report a clear error instead of returning an empty path SVG
    if (!pathData.trim()) {
      throw new Error(
        'The provided text does not map to drawable glyphs in this font and no fallback glyphs were found.'
      )
    }

    // Fallback bounds when glyphs have no bbox (e.g., whitespace-only or certain fonts)
    if (!hasBounds) {
      const textWidth = totalAdvance > 0 ? totalAdvance : Math.max(1, fontSize * text.length * 0.6)
      minX = offsetX
      maxX = offsetX + textWidth
      // Top is ascent above baseline, bottom is descent below baseline (note descent is typically negative)
      minY = -baseline - safeAscent * scale
      maxY = -baseline - safeDescent * scale
    }

    // Add padding to ensure no clipping
    const padding = fontSize * 0.1 // 10% of fontSize as padding
    minX = Math.floor(minX - padding)
    minY = Math.floor(minY - padding)
    maxX = Math.ceil(maxX + padding)
    maxY = Math.ceil(maxY + padding)

    // Replace any non-finite origins with 0 before dimension calculation
    if (!Number.isFinite(minX)) minX = 0
    if (!Number.isFinite(minY)) minY = 0

    // Calculate dimensions
    let width = maxX - minX
    let height = maxY - minY

    // Guard against invalid metrics
    if (!Number.isFinite(width) || width <= 0) {
      width = Math.max(1, Math.ceil(totalAdvance + padding * 2))
    }
    if (!Number.isFinite(height) || height <= 0) {
      height = Math.max(1, Math.ceil((font.ascent - font.descent) * scale + padding * 2))
    }

    // Generate the complete SVG with viewBox to ensure proper scaling
    // Add transform="scale(1, -1)" to flip the path vertically
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"
      width="${width}" height="${height}"
      viewBox="${minX} ${minY} ${width} ${height}"
      ${options.style ? `style="${options.style}"` : ''}>
      <path transform="scale(1, -1)" d="${pathData}" />
    </svg> ${!filteredText ? `(${text})` : ''}`

    return svg
  } catch (error) {
    throw new Error(`Failed to convert font to SVG: ${error instanceof Error ? error.message : String(error)}`)
  }
}
