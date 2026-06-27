/**
 * CanvasKit Font Manager
 *
 * Manages font loading for CanvasKit/Skia rendering.
 * CanvasKit requires font data as ArrayBuffer to create Typeface objects.
 *
 * @module libraries/konva/effects
 */

import type { CanvasKit, Typeface } from 'canvaskit-wasm'

interface FontData {
  familyName: string
  arrayBuffer: ArrayBuffer
  typeface: Typeface | null
}

/**
 * Font manager for CanvasKit
 * Handles loading fonts as ArrayBuffer and creating Typeface objects
 */
export class CanvasKitFontManager {
  private fontCache: Map<string, FontData> = new Map()
  private loadingPromises: Map<string, Promise<Typeface | null>> = new Map()
  private canvasKit: CanvasKit | null = null
  private defaultTypeface: Typeface | null = null

  /**
   * Initialize with CanvasKit instance
   */
  initialize(canvasKit: CanvasKit): void {
    this.canvasKit = canvasKit
    // Create default typeface from built-in font
    // Note: MakeDefault may not exist in all CanvasKit versions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typefaceFactory = canvasKit.Typeface as any
    if (typeof typefaceFactory.MakeDefault === 'function') {
      this.defaultTypeface = typefaceFactory.MakeDefault()
    }
  }

  /**
   * Load font and create Typeface for CanvasKit
   *
   * @param fontFamily - Font family name
   * @param fontSrc - Optional direct URL to font file (TTF, OTF, WOFF, WOFF2)
   * @returns Typeface or null if loading fails
   */
  async loadFont(fontFamily: string, fontSrc?: string): Promise<Typeface | null> {
    if (!this.canvasKit) {
      console.warn('[CanvasKitFontManager] Not initialized')
      return null
    }

    const cacheKey = `${fontFamily}|${fontSrc || ''}`

    // Check cache
    const cached = this.fontCache.get(cacheKey)
    if (cached?.typeface) {
      return cached.typeface
    }

    // Check if already loading
    const existingPromise = this.loadingPromises.get(cacheKey)
    if (existingPromise) {
      return existingPromise
    }

    // Start loading
    const loadPromise = this.doLoadFont(fontFamily, fontSrc)
    this.loadingPromises.set(cacheKey, loadPromise)

    try {
      const typeface = await loadPromise
      return typeface
    } finally {
      this.loadingPromises.delete(cacheKey)
    }
  }

  /**
   * Internal font loading implementation
   */
  private async doLoadFont(fontFamily: string, fontSrc?: string): Promise<Typeface | null> {
    if (!this.canvasKit) return null

    try {
      let fontUrl: string

      if (fontSrc) {
        // Direct URL provided (custom font)
        fontUrl = fontSrc
      } else {
        // Try to resolve Google Font URL
        fontUrl = await this.resolveGoogleFontUrl(fontFamily)
      }

      // Fetch font as ArrayBuffer
      const response = await fetch(fontUrl, {
        mode: 'cors',
        credentials: 'omit',
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch font: ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()

      // Create Typeface from font data
      const typeface = this.canvasKit.Typeface.MakeFreeTypeFaceFromData(arrayBuffer)

      if (!typeface) {
        console.warn(`[CanvasKitFontManager] Failed to create typeface for ${fontFamily}`)
        return this.defaultTypeface
      }

      // Cache the result
      this.fontCache.set(`${fontFamily}|${fontSrc || ''}`, {
        familyName: fontFamily,
        arrayBuffer,
        typeface,
      })

      return typeface
    } catch (error) {
      console.warn(`[CanvasKitFontManager] Error loading font ${fontFamily}:`, error)
      return this.defaultTypeface
    }
  }

  /**
   * Resolve Google Font URL from family name
   * Parses the CSS from Google Fonts API to extract actual font file URL
   */
  private async resolveGoogleFontUrl(fontFamily: string): Promise<string> {
    try {
      // Encode font family name for URL
      const encodedFamily = encodeURIComponent(fontFamily).replace(/%20/g, '+')

      // Fetch CSS from Google Fonts API
      // Use woff2 format for best compression/quality
      const cssUrl = `https://fonts.googleapis.com/css2?family=${encodedFamily}&display=swap`

      const response = await fetch(cssUrl, {
        headers: {
          // Request woff2 format by mimicking modern browser
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch Google Font CSS: ${response.status}`)
      }

      const css = await response.text()

      // Extract font URL from CSS
      // Format: src: url(https://fonts.gstatic.com/...) format('woff2');
      const urlMatch = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]woff2['"]\)/)

      if (urlMatch && urlMatch[1]) {
        return urlMatch[1]
      }

      // Fallback: try to find any URL in the CSS
      const fallbackMatch = css.match(/url\(([^)]+\.(?:woff2?|ttf|otf))\)/)

      if (fallbackMatch && fallbackMatch[1]) {
        return fallbackMatch[1]
      }

      throw new Error(`Could not find font URL in Google Fonts CSS for ${fontFamily}`)
    } catch (error) {
      console.warn(`[CanvasKitFontManager] Error resolving Google Font URL for ${fontFamily}:`, error)
      throw error
    }
  }

  /**
   * Get cached typeface by font family
   */
  getTypeface(fontFamily: string, fontSrc?: string): Typeface | null {
    const cacheKey = `${fontFamily}|${fontSrc || ''}`
    return this.fontCache.get(cacheKey)?.typeface || this.defaultTypeface
  }

  /**
   * Get default typeface
   */
  getDefaultTypeface(): Typeface | null {
    return this.defaultTypeface
  }

  /**
   * Check if a font is loaded
   */
  isFontLoaded(fontFamily: string, fontSrc?: string): boolean {
    const cacheKey = `${fontFamily}|${fontSrc || ''}`
    return this.fontCache.has(cacheKey)
  }

  /**
   * Clear all cached typefaces
   */
  clearCache(): void {
    // Delete all typefaces to free memory
    this.fontCache.forEach(data => {
      if (data.typeface) {
        data.typeface.delete()
      }
    })
    this.fontCache.clear()
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.clearCache()
    if (this.defaultTypeface) {
      this.defaultTypeface.delete()
      this.defaultTypeface = null
    }
    this.canvasKit = null
  }
}

// Singleton instance
let fontManagerInstance: CanvasKitFontManager | null = null

/**
 * Get the singleton font manager instance
 */
export function getCanvasKitFontManager(): CanvasKitFontManager {
  if (!fontManagerInstance) {
    fontManagerInstance = new CanvasKitFontManager()
  }
  return fontManagerInstance
}
