/**
 * Centralized Google Fonts service with intelligent fallback logic, caching, and validation.
 */

import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { createCache } from '../utils/LRUCache'

/** Google Font metadata with family, variants, subsets, and file URLs. */
export interface GoogleFont {
  /** Font family name (e.g., "Roboto", "Open Sans") */
  family: string
  /** Available font variants (e.g., ["regular", "bold", "italic"]) */
  variants: string[]
  /** Supported character subsets (e.g., ["latin", "latin-ext"]) */
  subsets: string[]
  /** Mapping of variants to font file URLs */
  files: Record<string, string>
  /** Font category classification (e.g., "sans-serif", "serif") */
  category?: string
  /** SVG path data for preview */
  svgString?: string
}

/** Resolved font result with family, src URL, weight, and style for web use. */
export interface FontResolution {
  /** Font family name */
  family: string
  /** Direct URL to font file */
  src: string
  /** CSS font-weight value */
  weight?: string
  /** CSS font-style value */
  style?: string
  /** SVG path data for preview */
  svgString?: string
}

/** Configuration options for FontService with catalog path and fallback preferences. */
export interface FontServiceOptions {
  /** Path to Google Fonts catalog JSON file */
  catalogPath?: string
  /** Preferred fallback fonts in priority order */
  defaultFallbacks?: string[]
  /** Whether to enable caching (defaults to true) */
  cacheEnabled?: boolean
}

/** Singleton Google Fonts service with intelligent fallback chains and LRU caching. */
export class FontService {
  /** Singleton instance */
  private static instance: FontService

  /** Cached Google Fonts catalog data */
  private googleFontsCatalog: GoogleFont[] | null = null

  /** Path to Google Fonts catalog JSON file */
  private readonly catalogPath: string

  /** Ordered list of preferred fallback fonts */
  private readonly defaultFallbacks: string[]

  /** LRU cache for font resolution results */
  private readonly fontCache = createCache<string, FontResolution | null>('style', { maxSize: 200 })

  /** Private constructor with catalog path and default fallback configuration. */
  private constructor(options: FontServiceOptions = {}) {
    this.catalogPath = options.catalogPath || path.resolve(process.cwd(), 'public/fonts/google-fonts.json')
    this.defaultFallbacks = options.defaultFallbacks || [
      'Inter', // Modern, clean sans-serif
      'Roboto', // Google's flagship font
      'Open Sans', // Highly readable, widely adopted
      'Lato', // Friendly, humanist design
      'Montserrat', // Geometric, modern
      'Poppins', // Rounded, approachable
      'Noto Sans', // Extensive language support
    ]
  }

  /** Gets or creates singleton FontService instance with optional initial configuration. */
  static getInstance(options?: FontServiceOptions): FontService {
    if (!FontService.instance) {
      FontService.instance = new FontService(options)
    }
    return FontService.instance
  }

  /** Loads and caches Google Fonts catalog with lazy loading and error handling. */
  private async loadGoogleFontsCatalog(): Promise<GoogleFont[]> {
    if (this.googleFontsCatalog) {
      return this.googleFontsCatalog
    }

    try {
      // Primary source: gzip-compressed map file produced by scripts/generate-font-to-svg.js
      const gzPath = path.resolve(process.cwd(), 'public/fonts/google-fonts-svg.json.gz')
      if (fs.existsSync(gzPath)) {
        const buf = await fs.promises.readFile(gzPath)
        const raw = zlib.gunzipSync(buf).toString('utf8')
        const parsed = JSON.parse(raw)
        this.googleFontsCatalog = parsed && typeof parsed === 'object' ? (Object.values(parsed) as GoogleFont[]) : []
      } else {
        // Fallback to configured catalogPath (legacy uncompressed array).
        const raw = await fs.promises.readFile(this.catalogPath, 'utf-8')
        const parsed = JSON.parse(raw)
        this.googleFontsCatalog = Array.isArray(parsed) ? parsed : []
      }
    } catch (error) {
      console.error('Failed to load Google Fonts catalog:', error)
      this.googleFontsCatalog = []
    }

    return this.googleFontsCatalog
  }

  /** Checks if font has Latin subset support. */
  private hasLatinSubset(font: GoogleFont): boolean {
    if (!Array.isArray(font.subsets)) return false
    const subsets = new Set(font.subsets.map(s => s.toLowerCase()))
    return subsets.has('latin') || subsets.has('latin-ext')
  }

  /** Finds font by family name with case-insensitive matching and Latin subset preference. */
  private async findFontByFamily(familyName: string): Promise<GoogleFont | undefined> {
    const catalog = await this.loadGoogleFontsCatalog()
    const normalizedName = familyName.toLowerCase().trim()

    // First try exact match with latin subset
    let font = catalog.find(f => f.family.toLowerCase() === normalizedName && this.hasLatinSubset(f))

    // Fallback to exact match without latin requirement
    if (!font) {
      font = catalog.find(f => f.family.toLowerCase() === normalizedName)
    }

    return font
  }

  /** Finds best fallback font from default list with Latin subset priority. */
  private async findBestFallback(): Promise<GoogleFont | undefined> {
    const catalog = await this.loadGoogleFontsCatalog()

    // Try each fallback in order
    for (const fallbackName of this.defaultFallbacks) {
      const font = catalog.find(f => f.family.toLowerCase() === fallbackName.toLowerCase() && this.hasLatinSubset(f))
      if (font) {
        return font
      }
    }

    // Last resort: any font with latin support
    return catalog.find(f => this.hasLatinSubset(f))
  }

  /** Gets font file URL for specific variant with intelligent fallback selection. */
  private getFontFileUrl(font: GoogleFont, preferredVariant = 'regular'): string | null {
    if (!font.files) return null

    // Normalize file keys to lowercase for consistent matching
    const normalizedFiles: Record<string, string> = {}
    Object.entries(font.files).forEach(([key, value]) => {
      normalizedFiles[key.toLowerCase()] = value
    })

    // Try preferred variant first
    let url = normalizedFiles[preferredVariant.toLowerCase()]

    // Fallback to 'regular' or 'normal'
    if (!url) {
      url = normalizedFiles['regular'] || normalizedFiles['normal'] || normalizedFiles['400']
    }

    // Last resort: use any available variant
    if (!url) {
      const firstAvailable = Object.values(normalizedFiles)[0]
      url = firstAvailable
    }

    return url || null
  }

  /** Resolves Google Font with comprehensive fallback strategy and caching. */
  async resolveGoogleFont(
    requestedFamily?: string,
    options: {
      variant?: string
      fallbacks?: string[]
      requireLatinSubset?: boolean
    } = {}
  ): Promise<FontResolution | null> {
    const { variant = 'regular', fallbacks = this.defaultFallbacks, requireLatinSubset = true } = options

    // Create cache key
    const cacheKey = `${requestedFamily || 'default'}_${variant}_${requireLatinSubset}`

    // Check cache first
    const cached = this.fontCache.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    let resolvedFont: GoogleFont | undefined

    // Try requested font first
    if (requestedFamily?.trim()) {
      resolvedFont = await this.findFontByFamily(requestedFamily.trim())

      // If found but no latin subset and it's required, skip it
      if (resolvedFont && requireLatinSubset && !this.hasLatinSubset(resolvedFont)) {
        resolvedFont = undefined
      }
    }

    // Try custom fallbacks
    if (!resolvedFont && fallbacks.length > 0) {
      for (const fallback of fallbacks) {
        const font = await this.findFontByFamily(fallback)
        if (font && (!requireLatinSubset || this.hasLatinSubset(font))) {
          resolvedFont = font
          break
        }
      }
    }

    // Try default fallbacks
    if (!resolvedFont) {
      resolvedFont = await this.findBestFallback()
    }

    // Create result
    let result: FontResolution | null = null
    if (resolvedFont) {
      const src = this.getFontFileUrl(resolvedFont, variant)
      if (src) {
        result = {
          family: resolvedFont.family,
          src,
          weight: variant.includes('bold') ? 'bold' : 'normal',
          style: variant.includes('italic') ? 'italic' : 'normal',
          svgString: resolvedFont.svgString,
        }
      }
    }

    // Cache the result (including null results to avoid repeated failures)
    this.fontCache.set(cacheKey, result)

    return result
  }

  /** Gets multiple font variants for a family resolved in parallel. */
  async getFontVariants(
    familyName: string,
    variants: string[] = ['regular', 'bold', 'italic']
  ): Promise<FontResolution[]> {
    const results = await Promise.all(variants.map(variant => this.resolveGoogleFont(familyName, { variant })))

    return results.filter((result): result is FontResolution => result !== null)
  }

  /** Validates if font family exists in Google Fonts catalog with case-insensitive lookup. */
  async validateFontFamily(familyName: string): Promise<boolean> {
    if (!familyName?.trim()) return false

    const font = await this.findFontByFamily(familyName.trim())
    return font !== undefined
  }

  /** Gets font recommendations filtered by category and sorted by popularity. */
  async getFontRecommendations(category?: string, limit = 10): Promise<{ family: string; category?: string }[]> {
    const catalog = await this.loadGoogleFontsCatalog()

    let filtered = catalog.filter(font => this.hasLatinSubset(font))

    if (category) {
      filtered = filtered.filter(font => font.category?.toLowerCase() === category.toLowerCase())
    }

    // Sort by popularity (assuming order in catalog represents popularity)
    return filtered.slice(0, limit).map(font => ({
      family: font.family,
      category: font.category,
    }))
  }

  /** Clears font resolution cache forcing fresh lookups. */
  clearCache(): void {
    this.fontCache.clear()
  }

  /** Gets cache statistics and catalog information for monitoring. */
  getCacheStats() {
    return {
      font: this.fontCache.getStats(),
      catalogLoaded: this.googleFontsCatalog !== null,
      catalogSize: this.googleFontsCatalog?.length || 0,
    }
  }

  /** Preloads popular fonts into cache for improved performance. */
  async preloadPopularFonts(): Promise<void> {
    const popularFonts = [
      'Inter',
      'Roboto',
      'Open Sans',
      'Lato',
      'Montserrat',
      'Poppins',
      'Noto Sans',
      'Playfair Display',
      'Oswald',
    ]

    await Promise.all(popularFonts.map(family => this.resolveGoogleFont(family, { variant: 'regular' })))
  }
}

/** Convenience function for quick font resolution using singleton FontService. */
export async function resolveFont(familyName?: string, variant = 'regular'): Promise<FontResolution | null> {
  const service = FontService.getInstance()
  return service.resolveGoogleFont(familyName, { variant })
}

/** Factory function for creating FontService with custom configuration. */
export function createFontService(options?: FontServiceOptions): FontService {
  return FontService.getInstance(options)
}
