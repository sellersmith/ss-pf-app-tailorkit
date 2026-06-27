/**
 * SVG Font Manager
 *
 * Handles font loading, caching, and embedding for SVG rendering.
 * Fonts are converted to base64 for standalone SVG images.
 *
 * @module shared/libraries/svg
 */

import type { Svg } from '@svgdotjs/svg.js'

const GOOGLE_FONTS_API_URL = 'https://fonts.googleapis.com/css2'

/**
 * Cache for fetched font base64 data to avoid repeated requests
 */
const fontBase64Cache = new Map<string, string>()

/**
 * Named font weight mappings to numeric values
 */
const NAMED_FONT_WEIGHTS: Record<string, string> = {
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

/**
 * Convert ArrayBuffer to base64 string
 *
 * @param buffer - ArrayBuffer to convert
 * @returns Base64 encoded string
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
 *
 * @param weight - Font weight value (string or number)
 * @returns Numeric weight string (e.g., '400', '700')
 */
export function normalizeFontWeight(weight: string | number | undefined): string {
  if (weight === undefined || weight === null) return '400'

  const weightStr = String(weight).toLowerCase().trim()
  return NAMED_FONT_WEIGHTS[weightStr] || weightStr
}

/**
 * Extract font URL from Google Fonts CSS response
 *
 * @param css - CSS content from Google Fonts
 * @param fontWeight - Target font weight to find
 * @returns Font URL or null if not found
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
 * Determine MIME type from font URL
 *
 * @param fontUrl - URL of the font file
 * @returns MIME type string
 */
function getMimeTypeFromUrl(fontUrl: string): string {
  if (fontUrl.includes('.woff2')) return 'font/woff2'
  if (fontUrl.includes('.woff')) return 'font/woff'
  if (fontUrl.includes('.ttf')) return 'font/ttf'
  if (fontUrl.includes('.otf')) return 'font/otf'
  return 'font/woff2' // Default to woff2
}

/**
 * Fetch font file and convert to base64 data URL
 *
 * @param fontUrl - URL of the font file
 * @returns Base64 data URL or null on error
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
    const mimeType = getMimeTypeFromUrl(fontUrl)
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
 *
 * @param fontFamily - Google Font family name
 * @param fontWeight - Font weight (default: '400')
 * @returns CSS with base64 data URL or null on error
 */
export async function fetchGoogleFontCss(
  fontFamily: string,
  fontWeight: string | number = '400'
): Promise<string | null> {
  const normalizedWeight = normalizeFontWeight(fontWeight)
  const cacheKey = `${fontFamily}-${normalizedWeight}-base64`

  if (fontBase64Cache.has(cacheKey)) {
    return fontBase64Cache.get(cacheKey)!
  }

  try {
    const encodedFontFamily = encodeURIComponent(fontFamily)
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
    // Use minimal whitespace for cleaner SVG embedding
    const fontFaceCss = `@font-face { font-family: '${fontFamily}'; src: url('${base64DataUrl}') format('woff2'); }`

    fontBase64Cache.set(cacheKey, fontFaceCss)
    return fontFaceCss
  } catch (error) {
    console.warn(`Error fetching Google Font CSS for ${fontFamily}:`, error)
    return null
  }
}

/**
 * Fetch custom font and convert to base64 for embedding
 *
 * @param fontSrc - URL of the custom font file
 * @param fontFamily - Font family name to use
 * @returns CSS with base64 data URL or null on error
 */
export async function fetchCustomFontAsBase64(fontSrc: string, fontFamily: string): Promise<string | null> {
  const cacheKey = `custom-${fontSrc}`
  if (fontBase64Cache.has(cacheKey)) {
    return fontBase64Cache.get(cacheKey)!
  }

  const base64DataUrl = await fetchFontAsBase64(fontSrc)
  if (!base64DataUrl) {
    return null
  }

  // Don't specify font-weight - let browser use this font for all weights
  // Use minimal whitespace for cleaner SVG embedding
  const mimeType = getMimeTypeFromUrl(fontSrc)
  const format = mimeType.includes('woff2')
    ? 'woff2'
    : mimeType.includes('woff')
      ? 'woff'
      : mimeType.includes('ttf')
        ? 'truetype'
        : 'opentype'
  const fontFaceCss = `@font-face { font-family: '${fontFamily}'; src: url('${base64DataUrl}') format('${format}'); }`

  fontBase64Cache.set(cacheKey, fontFaceCss)
  return fontFaceCss
}

/**
 * Embed font in SVG using @font-face in a style element
 *
 * @param svg - SVG.js instance
 * @param fontFamily - Font family name
 * @param fontBase64Css - Pre-fetched base64 CSS (optional)
 */
export function embedFontInSvg(svg: Svg, fontFamily: string, fontBase64Css?: string | null): void {
  if (!fontBase64Css) return

  // Add style element to SVG defs
  const defs = svg.defs()
  const styleElement = defs.element('style')
  styleElement.words(fontBase64Css)
}

/**
 * Clear the font cache (useful for testing or memory management)
 */
export function clearFontCache(): void {
  fontBase64Cache.clear()
}

/**
 * Get the current font cache size
 *
 * @returns Number of cached fonts
 */
export function getFontCacheSize(): number {
  return fontBase64Cache.size
}
