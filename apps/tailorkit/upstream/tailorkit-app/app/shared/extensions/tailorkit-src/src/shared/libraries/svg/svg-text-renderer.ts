/**
 * SVG Text Renderer
 *
 * Renders text using SVG.js for native SVG filter support in Safari.
 * Converts SVG to image for Konva integration.
 *
 * @module shared/libraries/svg
 */

import { SVG, type Svg } from '@svgdotjs/svg.js'
import type { DropShadowConfig, InnerShadowConfig } from '../konva/effects/types'

const GOOGLE_FONTS_API_URL = 'https://fonts.googleapis.com/css2'

/**
 * Cache for fetched font base64 data to avoid repeated requests
 */
const fontBase64Cache = new Map<string, string>()

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Normalize font weight to numeric string
 * Handles both numeric weights (400, 700) and named weights (normal, bold)
 */
function normalizeFontWeight(weight: string | number | undefined): string {
  if (weight === undefined || weight === null) return '400'

  const weightStr = String(weight).toLowerCase().trim()

  // Map named weights to numeric
  const namedWeights: Record<string, string> = {
    thin: '100',
    hairline: '100',
    extralight: '200',
    ultralight: '200',
    light: '300',
    normal: '400',
    regular: '400',
    medium: '500',
    semibold: '600',
    demibold: '600',
    bold: '700',
    extrabold: '800',
    ultrabold: '800',
    black: '900',
    heavy: '900',
  }

  return namedWeights[weightStr] || weightStr
}

/**
 * Extract font URL from Google Fonts CSS
 */
function extractFontUrlFromCss(css: string, fontWeight = '400'): string | null {
  const normalizedWeight = normalizeFontWeight(fontWeight)

  // Split CSS into @font-face blocks
  const fontFaceBlocks = css.split('@font-face')

  for (const block of fontFaceBlocks) {
    if (!block.trim()) continue

    // Extract font-weight from this block
    const weightMatch = block.match(/font-weight:\s*(\d+)/)
    if (!weightMatch) continue

    const blockWeight = weightMatch[1]

    // Extract URL from this block
    const urlMatch = block.match(/src:\s*url\(([^)]+)\)/)
    if (!urlMatch) continue

    if (blockWeight === normalizedWeight) {
      return urlMatch[1]
    }
  }

  // Fallback: try to find any URL in the CSS (use first available)
  const urlMatch = css.match(/url\(([^)]+)\)/)
  return urlMatch ? urlMatch[1] : null
}

/**
 * Fetch font file and convert to base64 data URL
 */
async function fetchFontAsBase64(fontUrl: string): Promise<string | null> {
  if (fontBase64Cache.has(fontUrl)) {
    return fontBase64Cache.get(fontUrl)!
  }

  try {
    const response = await fetch(fontUrl)
    if (!response.ok) {
      console.warn(`Failed to fetch font from ${fontUrl}`)
      return null
    }

    const buffer = await response.arrayBuffer()
    const base64 = arrayBufferToBase64(buffer)

    // Determine MIME type based on URL
    let mimeType = 'font/woff2'
    if (fontUrl.includes('.woff2')) {
      mimeType = 'font/woff2'
    } else if (fontUrl.includes('.woff')) {
      mimeType = 'font/woff'
    } else if (fontUrl.includes('.ttf')) {
      mimeType = 'font/ttf'
    } else if (fontUrl.includes('.otf')) {
      mimeType = 'font/otf'
    }

    const dataUrl = `data:${mimeType};base64,${base64}`
    fontBase64Cache.set(fontUrl, dataUrl)
    return dataUrl
  } catch (error) {
    console.warn(`Error fetching font from ${fontUrl}:`, error)
    return null
  }
}

/**
 * Fetch Google Font CSS and convert font to base64 for embedding
 * Returns CSS with base64 data URL
 */
async function fetchGoogleFontCss(fontFamily: string, fontWeight: string | number = '400'): Promise<string | null> {
  // Normalize weight to numeric string (e.g., "bold" → "700")
  const normalizedWeight = normalizeFontWeight(fontWeight)
  const cacheKey = `${fontFamily}-${normalizedWeight}-base64`

  if (fontBase64Cache.has(cacheKey)) {
    return fontBase64Cache.get(cacheKey)!
  }

  try {
    const encodedFontFamily = encodeURIComponent(fontFamily)
    // Request only the specific weight we need
    const url = `${GOOGLE_FONTS_API_URL}?family=${encodedFontFamily}:wght@${normalizedWeight}&display=swap`

    const response = await fetch(url, {
      headers: {
        // Request woff2 format by using a modern user agent
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })

    if (!response.ok) {
      console.warn(`Failed to fetch Google Font CSS for ${fontFamily} weight ${normalizedWeight}`)
      return null
    }

    const css = await response.text()

    // Extract font URL for the requested weight
    const fontUrl = extractFontUrlFromCss(css, normalizedWeight)
    if (!fontUrl) {
      console.warn(`Could not extract font URL from CSS for ${fontFamily} weight ${normalizedWeight}`)
      return null
    }

    const base64DataUrl = await fetchFontAsBase64(fontUrl)
    if (!base64DataUrl) {
      return null
    }

    // Create @font-face with base64 data URL
    // Don't specify font-weight - let browser use this font for all weights
    // This matches the working pattern in generate-shape-path.ts
    const fontFaceCss = `
      @font-face {
        font-family: '${fontFamily}';
        src: url('${base64DataUrl}') format('woff2');
      }
    `

    fontBase64Cache.set(cacheKey, fontFaceCss)
    return fontFaceCss
  } catch (error) {
    console.warn(`Error fetching Google Font CSS for ${fontFamily}:`, error)
    return null
  }
}

/**
 * Fetch custom font and convert to base64 for embedding
 */
async function fetchCustomFontAsBase64(fontSrc: string, fontFamily: string): Promise<string | null> {
  const cacheKey = `custom-${fontSrc}`
  if (fontBase64Cache.has(cacheKey)) {
    return fontBase64Cache.get(cacheKey)!
  }

  const base64DataUrl = await fetchFontAsBase64(fontSrc)
  if (!base64DataUrl) {
    return null
  }

  // Don't specify font-weight - let browser use this font for all weights
  // This matches the working pattern in generate-shape-path.ts
  const fontFaceCss = `
    @font-face {
      font-family: '${fontFamily}';
      src: url('${base64DataUrl}');
    }
  `

  fontBase64Cache.set(cacheKey, fontFaceCss)
  return fontFaceCss
}

/**
 * Embed font in SVG using @font-face in a style element
 * Uses pre-fetched base64 CSS (googleFontCss already contains base64)
 */
function embedFontInSvg(svg: Svg, fontFamily: string, fontBase64Css?: string | null): void {
  if (!fontBase64Css) return

  // Add style element to SVG defs
  const defs = svg.defs()
  const styleElement = defs.element('style')
  styleElement.words(fontBase64Css)
}

export interface SVGTextConfig {
  content: string
  width: number
  height: number
  fontSize: number
  fontFamily: string
  fontWeight?: string | number
  fontStyle?: string
  fontBase64Css?: string | null // Pre-fetched font CSS with base64 data URL
  color: string
  letterSpacing?: number
  lineHeight?: number
  align?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  wrap?: 'none' | 'word' | 'char'
  textDecoration?: string
  fillOpacity?: number
  padding?: number
  // Text stroke
  stroke?: string
  strokeWidth?: number
  // Shadow effects - used for three-element rendering when stroke is present
  dropShadows?: DropShadowConfig[]
  innerShadows?: InnerShadowConfig[]
}

/**
 * Calculate extra padding needed for italic text to prevent clipping.
 * Italic text slants to the right, so we need extra space on the right edge.
 * The slant is typically around 12-15 degrees (tan(12°) ≈ 0.21)
 */
function calculateItalicPadding(fontSize: number, isItalic: boolean): number {
  if (!isItalic) return 0
  // Use a factor of ~0.3 to accommodate italic slant (roughly 14 degrees)
  return Math.ceil(fontSize * 0.3)
}

/**
 * Calculate extra vertical padding for text descenders (g, y, p, q, j).
 * Descenders typically extend about 20-25% below the baseline.
 * This prevents the bottom of text from being clipped.
 */
function calculateDescenderPadding(fontSize: number): number {
  // Use a factor of ~0.25 to accommodate descenders
  return Math.ceil(fontSize * 0.25)
}

/**
 * Effect configuration for padding calculation
 */
export interface EffectForPadding {
  type: 'DROP_SHADOW' | 'INNER_SHADOW'
  visible?: boolean
  radius?: number
  offsetX?: number
  offsetY?: number
}

/**
 * Calculate dynamic padding for SVG text based on font metrics and effects.
 * This ensures text and its effects are never clipped.
 *
 * Components of padding:
 * 1. Base font metrics: ascenders (~80% fontSize) and descenders (~25% fontSize)
 * 2. Italic slant: ~tan(15°) * fontSize ≈ 0.27 * fontSize
 * 3. Drop shadow effects: blur * 2 (blur spread) + |offset| (shadow position)
 *
 * @param fontSize - The font size in pixels
 * @param isItalic - Whether the text is italic
 * @param effects - Array of effects (drop shadows extend bounds, inner shadows don't)
 * @param isTextPath - If true, returns uniform padding for all sides (text can curve any direction)
 */
export function calculateDynamicPadding(
  fontSize: number,
  isItalic: boolean,
  effects: EffectForPadding[] = [],
  isTextPath: boolean = false,
  strokeWidth: number = 0
): { top: number; right: number; bottom: number; left: number } {
  // Base padding for font metrics
  // For text path, text can extend in any direction from the path
  const ascenderPadding = Math.ceil(fontSize * 0.3) // Space above baseline for tall letters
  const descenderPadding = Math.ceil(fontSize * 0.3) // Space below baseline for g, y, p, q, j

  // Italic slant padding (text leans right)
  const italicPadding = isItalic ? Math.ceil(fontSize * 0.3) : 0

  // Stroke padding (stroke is centered, so half extends outside)
  const strokePadding = strokeWidth ? Math.ceil(strokeWidth / 2) : 0

  // Calculate maximum effect extension (only drop shadows extend bounds)
  let maxEffectLeft = 0
  let maxEffectRight = 0
  let maxEffectTop = 0
  let maxEffectBottom = 0

  const safeFactor = 2

  for (const effect of effects) {
    if (effect.visible === false) continue
    if (effect.type !== 'DROP_SHADOW') continue // Inner shadows don't extend bounds

    const blur = effect.radius || 0
    const offsetX = effect.offsetX || 0
    const offsetY = effect.offsetY || 0

    // Blur spreads outward by approximately blur * 2
    // Using 2.5 for safety margin
    const blurSpread = Math.ceil(blur * 2.5)

    // Calculate extension in each direction
    // Shadow extends in the direction of offset, plus blur spread in all directions
    const effectLeft = blurSpread + Math.max(0, -offsetX)
    const effectRight = blurSpread + Math.max(0, offsetX)
    const effectTop = blurSpread + Math.max(0, -offsetY)
    const effectBottom = blurSpread + Math.max(0, offsetY)

    maxEffectLeft = Math.max(maxEffectLeft, effectLeft)
    maxEffectRight = Math.max(maxEffectRight, effectRight)
    maxEffectTop = Math.max(maxEffectTop, effectTop)
    maxEffectBottom = Math.max(maxEffectBottom, effectBottom)
  }

  if (isTextPath) {
    // For text path, use uniform padding on all sides
    // Text can curve in any direction, so we need the maximum padding everywhere
    const uniformPadding
      = Math.max(
        ascenderPadding + maxEffectTop + strokePadding,
        descenderPadding + maxEffectBottom + strokePadding,
        italicPadding + maxEffectLeft + strokePadding,
        italicPadding + maxEffectRight + strokePadding,
        // Minimum padding to prevent clipping on curved paths
        Math.ceil(fontSize * 0.5) + strokePadding
      ) * safeFactor

    return {
      top: uniformPadding,
      right: uniformPadding,
      bottom: uniformPadding,
      left: uniformPadding,
    }
  }

  // For normal text, use directional padding (stroke extends in all directions)
  return {
    top: Math.max(ascenderPadding, maxEffectTop, strokePadding) * safeFactor,
    right: Math.max(italicPadding, maxEffectRight, strokePadding) * safeFactor,
    bottom: Math.max(descenderPadding, maxEffectBottom, strokePadding) * safeFactor,
    left: Math.max(maxEffectLeft, strokePadding) * safeFactor,
  }
}

// Export the fetch functions and utilities for use in components
export { fetchGoogleFontCss, fetchCustomFontAsBase64, normalizeFontWeight, calculateItalicPadding }

export interface SVGTextPathConfig extends Omit<SVGTextConfig, 'wrap' | 'verticalAlign' | 'padding'> {
  pathData: string
  textBaseline?: 'top' | 'middle' | 'bottom' | 'alphabetic' | 'hanging'
  /** Effects for dynamic padding calculation (drop shadows extend bounds) */
  effects?: EffectForPadding[]
}

/**
 * Map horizontal alignment to SVG text-anchor
 */
function getTextAnchor(align: 'left' | 'center' | 'right' | undefined): string {
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
 */
function getXPosition(align: 'left' | 'center' | 'right' | undefined, width: number, padding: number): number {
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
 * Letter spacing adds extra space after each character (except the last one in some implementations)
 */
function measureTextWithLetterSpacing(ctx: CanvasRenderingContext2D, text: string, letterSpacing: number): number {
  const baseWidth = ctx.measureText(text).width
  // Letter spacing is applied between characters, so (text.length - 1) gaps
  // But some implementations apply it after each character, so text.length gaps
  // Using text.length to be safe and match CSS behavior
  const letterSpacingTotal = letterSpacing * Math.max(0, text.length)
  return baseWidth + letterSpacingTotal
}

/**
 * Manual word wrap implementation using canvas for text measurement
 * Handles explicit newlines (\n), word/char wrapping, and letter spacing
 */
export function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  fontFamily: string,
  fontWeight?: string | number,
  wrap: 'none' | 'word' | 'char' = 'word',
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
 */
function getFontMetrics(
  fontSize: number,
  fontFamily: string,
  fontWeight?: string | number
): { ascent: number; descent: number } {
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
 */
function getVerticalOffset(
  verticalAlign: 'top' | 'middle' | 'bottom' | undefined,
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
 * Result of creating SVG text, includes the SVG and any offset info
 */
export interface SVGTextResult {
  svg: Svg
  italicPadding: number // Extra horizontal padding added for italic text (right edge)
  descenderPadding: number // Extra vertical padding added for descenders (bottom edge)
  strokePadding: number // Extra padding on all sides for stroke (strokeWidth / 2)
}

/**
 * Create SVG container with text
 *
 * Rendering approaches based on stroke and effects:
 * - No stroke or no effects: Single element with combined filter
 * - Inner shadow + stroke: Two elements (stroke behind, fill with inner shadow filter)
 * - Drop shadow + stroke: Three elements (shadow elements, stroke, fill with inner shadow)
 *
 * This matches Figma's behavior where stroke is independent of shadow effects.
 */
export function createSVGText(config: SVGTextConfig): SVGTextResult {
  const {
    content,
    width,
    height,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    fontBase64Css,
    color,
    letterSpacing = 0,
    lineHeight = 1.2,
    align = 'left',
    verticalAlign = 'top',
    wrap = 'word',
    textDecoration,
    fillOpacity = 1,
    padding = 0,
    stroke,
    strokeWidth,
    dropShadows = [],
    innerShadows = [],
  } = config

  // Filter visible effects
  const visibleDropShadows = dropShadows.filter(s => s.visible !== false)
  const visibleInnerShadows = innerShadows.filter(s => s.visible !== false)

  // Determine rendering approach
  const hasStroke = stroke && strokeWidth && strokeWidth > 0
  const hasDropShadow = visibleDropShadows.length > 0
  const hasInnerShadow = visibleInnerShadows.length > 0

  // Parse fontStyle for bold/italic
  const fontStyleLower = (fontStyle || '').toLowerCase()
  const hasBoldInStyle = fontStyleLower.includes('bold')
  const hasItalicInStyle = fontStyleLower.includes('italic')

  // Calculate paddings
  const italicPadding = calculateItalicPadding(fontSize, hasItalicInStyle)
  const descenderPadding = calculateDescenderPadding(fontSize)
  const strokePadding = stroke && strokeWidth ? Math.ceil(strokeWidth / 2) : 0

  // Create SVG container
  const svgWidth = width + italicPadding + strokePadding * 2
  const svgHeight = height + descenderPadding + strokePadding * 2
  const svg = SVG().size(svgWidth, svgHeight)

  if (strokePadding > 0) {
    svg.viewbox(-strokePadding, -strokePadding, svgWidth, svgHeight)
  }

  embedFontInSvg(svg, fontFamily, fontBase64Css)

  // Calculate text layout
  const effectiveWidth = width - padding * 2
  const lines = wrapText(content, effectiveWidth, fontSize, fontFamily, fontWeight, wrap, letterSpacing)
  const lineHeightPx = fontSize * lineHeight
  const totalTextHeight = fontSize + (lines.length - 1) * lineHeightPx
  const yOffset = getVerticalOffset(verticalAlign, height, totalTextHeight, padding, fontSize, fontFamily, fontWeight)
  const xPos = getXPosition(align, width, padding)
  const textAnchor = getTextAnchor(align)

  // Build inline styles
  const inlineStyles: string[] = []
  if (fontWeight || hasBoldInStyle) {
    const weight = fontWeight ? normalizeFontWeight(fontWeight) : '700'
    inlineStyles.push(`font-weight: ${weight === '700' ? 'bold' : weight};`)
  }
  if (hasItalicInStyle) inlineStyles.push('font-style: italic;')
  if (letterSpacing) inlineStyles.push(`letter-spacing: ${letterSpacing}px;`)
  if (textDecoration) inlineStyles.push(`text-decoration: ${textDecoration};`)

  /** Helper to create a text element */
  const createTextElement = (
    fillColor: string,
    strokeConfig: { color: string; width: number } | null,
    className: string,
    applyFillOpacity: boolean
  ) => {
    const textElement = svg.text(add => {
      lines.forEach((line, index) => {
        add.tspan(line).attr({ x: xPos, dy: index === 0 ? 0 : lineHeightPx })
      })
    })
    textElement.fill(fillColor)
    textElement.attr({
      'text-anchor': textAnchor,
      'font-size': fontSize,
      'font-family': fontFamily,
      'dominant-baseline': 'text-before-edge',
      class: className,
    })
    if (strokeConfig) textElement.stroke({ color: strokeConfig.color, width: strokeConfig.width })
    textElement.move(0, yOffset)

    const elementStyles = [...inlineStyles]
    if (applyFillOpacity && fillOpacity < 1) elementStyles.push(`fill-opacity: ${fillOpacity};`)
    if (elementStyles.length > 0) textElement.attr('style', elementStyles.join(' '))
    return textElement
  }

  // THREE-ELEMENT APPROACH: Drop shadow + stroke
  // Render order: drop shadows (behind) → stroke → fill (with inner shadow filter)
  if (hasDropShadow && hasStroke) {
    // 1. Create drop shadow elements (rendered first = behind everything)
    visibleDropShadows.forEach((shadow, i) => {
      const shadowElement = svg.text(add => {
        lines.forEach((line, index) => {
          add.tspan(line).attr({ x: xPos, dy: index === 0 ? 0 : lineHeightPx })
        })
      })
      // Shadow uses shadow color as fill, no stroke
      const { r, g, b } = parseColorToRgb(shadow.color)
      shadowElement.fill(`rgb(${r},${g},${b})`)
      shadowElement.attr({
        'text-anchor': textAnchor,
        'font-size': fontSize,
        'font-family': fontFamily,
        'dominant-baseline': 'text-before-edge',
        class: 'text-shadow',
        opacity: shadow.opacity ?? 1,
      })
      // Position with shadow offset
      shadowElement.move(shadow.offsetX ?? 0, yOffset + (shadow.offsetY ?? 0))
      // Apply blur filter
      const blurFilterId = `blur-${i}`
      addBlurFilterToSvg(svg, shadow.radius ?? 0, blurFilterId)
      shadowElement.attr('filter', `url(#${blurFilterId})`)
      // Apply same font styles
      if (inlineStyles.length > 0) shadowElement.attr('style', inlineStyles.join(' '))
    })

    // 2. Stroke element (behind fill)
    createTextElement('none', { color: stroke!, width: strokeWidth! }, 'text-stroke', false)

    // 3. Fill element (on top, inner shadow filter applied separately by caller)
    createTextElement(color, null, 'text-fill', true)
  }
  // TWO-ELEMENT APPROACH: Inner shadow only + stroke (no drop shadow)
  else if (hasInnerShadow && hasStroke) {
    createTextElement('none', { color: stroke!, width: strokeWidth! }, 'text-stroke', false)
    createTextElement(color, null, 'text-fill', true)
  }
  // SINGLE ELEMENT: No stroke, or no effects
  else {
    const textElement = createTextElement(
      color,
      hasStroke ? { color: stroke!, width: strokeWidth! } : null,
      'text-fill',
      true
    )
    if (hasStroke) textElement.attr('paint-order', 'stroke fill')
  }

  return { svg, italicPadding, descenderPadding, strokePadding }
}

/** Parse color to RGB values */
function parseColorToRgb(color: string): { r: number; g: number; b: number } {
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbaMatch) return { r: +rgbaMatch[1], g: +rgbaMatch[2], b: +rgbaMatch[3] }
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    if (hex.length >= 6) {
      return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) }
    }
  }
  return { r: 0, g: 0, b: 0 }
}

/** Add blur filter to SVG defs */
function addBlurFilterToSvg(svg: Svg, blurRadius: number, filterId: string): void {
  const stdDev = blurRadius / 2
  const defs = svg.defs()
  defs.svg(`<filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="${stdDev}"/>
  </filter>`)
}

/**
 * Result of creating SVG text path, includes the SVG and padding info
 * TextPath uses uniform padding on all sides since text can curve in any direction
 */
export interface SVGTextPathResult {
  svg: Svg
  pathPadding: number // Uniform padding on all sides for text path (handles ascenders, descenders, italic in all directions)
}

/**
 * Create SVG container with text on path
 *
 * Rendering approaches based on stroke and effects:
 * - No stroke or no effects: Single element with combined filter
 * - Inner shadow + stroke: Two elements (stroke behind, fill with inner shadow filter)
 * - Drop shadow + stroke: Three elements (shadow elements, stroke, fill with inner shadow)
 *
 * This matches Figma's behavior where stroke is independent of shadow effects.
 */
export function createSVGTextPath(config: SVGTextPathConfig): SVGTextPathResult {
  const {
    content,
    width,
    height,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    fontBase64Css,
    color,
    letterSpacing = 0,
    textDecoration,
    fillOpacity = 1,
    pathData,
    textBaseline = 'alphabetic',
    align = 'center',
    effects = [],
    stroke,
    strokeWidth,
    dropShadows = [],
    innerShadows = [],
  } = config

  // Filter visible effects
  const visibleDropShadows = dropShadows.filter(s => s.visible !== false)
  const visibleInnerShadows = innerShadows.filter(s => s.visible !== false)

  // Determine rendering approach
  const hasStroke = stroke && strokeWidth && strokeWidth > 0
  const hasDropShadow = visibleDropShadows.length > 0
  const hasInnerShadow = visibleInnerShadows.length > 0

  // Check if text is italic
  const fontStyleLower = (fontStyle || '').toLowerCase()
  const isItalic = fontStyleLower.includes('italic')
  const hasBoldInStyle = fontStyleLower.includes('bold')

  // Calculate dynamic padding based on font size, italic, effects, and stroke
  const padding = calculateDynamicPadding(fontSize, isItalic, effects, true, strokeWidth || 0)
  const pathPadding = padding.top // All sides are equal for text path

  // Create SVG container with padding on all sides
  const svg = SVG().size(width + pathPadding * 2, height + pathPadding * 2)

  // Set viewBox to offset the coordinate system
  svg.viewbox(-pathPadding, -pathPadding, width + pathPadding * 2, height + pathPadding * 2)

  // Embed font in SVG for standalone rendering
  embedFontInSvg(svg, fontFamily, fontBase64Css)

  // Calculate text anchor and start offset for alignment
  const textAnchor = getTextAnchor(align)
  const startOffset = align === 'center' ? '50%' : align === 'right' ? '100%' : '0%'

  // Build inline CSS styles
  const inlineStyles: string[] = []
  if (fontWeight || hasBoldInStyle) {
    const weight = fontWeight ? normalizeFontWeight(fontWeight) : '700'
    inlineStyles.push(`font-weight: ${weight === '700' ? 'bold' : weight};`)
  }
  if (isItalic) inlineStyles.push('font-style: italic;')
  if (letterSpacing) inlineStyles.push(`letter-spacing: ${letterSpacing}px;`)
  if (textDecoration) inlineStyles.push(`text-decoration: ${textDecoration};`)

  /** Helper to create a text-on-path element */
  const createTextPathElement = (
    fillColor: string,
    strokeConfig: { color: string; width: number } | null,
    className: string,
    applyFillOpacity: boolean
  ) => {
    const textElement = svg.text('')
    const textPath = textElement.path(pathData)
    textPath.text(content)
    textPath.attr({ startOffset })

    textElement.fill(fillColor)
    textElement.attr({
      'text-anchor': textAnchor,
      'font-size': fontSize,
      'font-family': fontFamily,
      'dominant-baseline': textBaseline,
      class: className,
    })

    if (strokeConfig) {
      textElement.stroke({ color: strokeConfig.color, width: strokeConfig.width })
    }

    const elementStyles = [...inlineStyles]
    if (applyFillOpacity && fillOpacity < 1) {
      elementStyles.push(`fill-opacity: ${fillOpacity};`)
    }
    if (elementStyles.length > 0) {
      textElement.attr('style', elementStyles.join(' '))
    }

    return textElement
  }

  // THREE-ELEMENT APPROACH: Drop shadow + stroke
  // Render order: drop shadows (behind) → stroke → fill (with inner shadow filter)
  if (hasDropShadow && hasStroke) {
    // 1. Create drop shadow elements (rendered first = behind everything)
    visibleDropShadows.forEach((shadow, i) => {
      const shadowElement = svg.text('')
      const textPath = shadowElement.path(pathData)
      textPath.text(content)
      textPath.attr({ startOffset })

      // Shadow uses shadow color as fill, no stroke
      const { r, g, b } = parseColorToRgb(shadow.color)
      shadowElement.fill(`rgb(${r},${g},${b})`)
      shadowElement.attr({
        'text-anchor': textAnchor,
        'font-size': fontSize,
        'font-family': fontFamily,
        'dominant-baseline': textBaseline,
        class: 'text-shadow',
        opacity: shadow.opacity ?? 1,
      })

      // Apply blur filter
      const blurFilterId = `blur-${i}`
      addBlurFilterToSvg(svg, shadow.radius ?? 0, blurFilterId)
      shadowElement.attr('filter', `url(#${blurFilterId})`)

      // Apply same font styles
      if (inlineStyles.length > 0) shadowElement.attr('style', inlineStyles.join(' '))

      // Apply offset transform for shadow position
      if (shadow.offsetX || shadow.offsetY) {
        shadowElement.attr('transform', `translate(${shadow.offsetX ?? 0}, ${shadow.offsetY ?? 0})`)
      }
    })

    // 2. Stroke element (behind fill)
    createTextPathElement('none', { color: stroke!, width: strokeWidth! }, 'text-stroke', false)

    // 3. Fill element (on top, inner shadow filter applied separately by caller)
    createTextPathElement(color, null, 'text-fill', true)
  }
  // TWO-ELEMENT APPROACH: Inner shadow only + stroke (no drop shadow)
  else if (hasInnerShadow && hasStroke) {
    createTextPathElement('none', { color: stroke!, width: strokeWidth! }, 'text-stroke', false)
    createTextPathElement(color, null, 'text-fill', true)
  }
  // SINGLE ELEMENT: No stroke, or no effects
  else {
    const textElement = createTextPathElement(
      color,
      hasStroke ? { color: stroke!, width: strokeWidth! } : null,
      'text-fill',
      true
    )
    if (hasStroke) textElement.attr('paint-order', 'stroke fill')
  }

  return { svg, pathPadding }
}

/**
 * Render SVG to HTMLImageElement
 */
export async function svgToImage(svg: Svg, scale = 1): Promise<HTMLImageElement> {
  // Get dimensions
  const width = svg.width() as number
  const height = svg.height() as number

  // Scale the SVG if needed
  if (scale !== 1) {
    svg.size(width * scale, height * scale)
    svg.viewbox(0, 0, width, height)
  }

  // Get SVG string
  const svgString = svg.svg()

  // Create blob URL
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  // Load as image
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = error => {
      URL.revokeObjectURL(url)
      reject(error)
    }
    img.src = url
  })
}

/**
 * Get text element from SVG for applying filters
 */
export function getTextElement(svg: Svg) {
  return svg.find('text')[0]
}
