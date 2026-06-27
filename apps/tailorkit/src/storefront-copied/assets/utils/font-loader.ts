/**
 * Utility for loading and managing custom fonts
 */
const GOOGLE_FONTS_API_URL = 'https://fonts.googleapis.com/css2'

export class FontLoader {
  private loadedFonts: Set<string>
  private loadingPromises: Map<string, Promise<void>>

  constructor() {
    this.loadedFonts = new Set()
    this.loadingPromises = new Map()
  }

  /**
   * Check if a font is already loaded
   * @param fontFamily - Font family name
   * @param fontSrc - URL to the font file (optional)
   */
  public isFontLoaded(fontFamily: string, fontSrc?: string): boolean {
    const cacheKey = fontSrc ? `${fontFamily}::${fontSrc}` : fontFamily
    return this.loadedFonts.has(cacheKey)
  }

  /**
   * Create a @font-face CSS rule
   * @param fontFamily - Font family name
   * @param fontSrc - URL to the font file
   */
  private createFontFaceRule(fontFamily: string, fontSrc: string): void {
    const styleElement = document.createElement('style')
    styleElement.textContent = `
      @font-face {
        font-family: '${fontFamily}';
        src: url(${fontSrc});
      }
    `
    document.head.appendChild(styleElement)
    console.log(`Added @font-face rule for ${fontFamily} from ${fontSrc}`)
  }

  /**
   * Load a font from a URL
   * @param fontFamily - Font family name
   * @param fontSrc - URL to the font file
   * @returns Promise that resolves when the font is loaded
   */
  public loadFont(fontFamily?: string, fontSrc?: string): Promise<void> {
    if (!fontFamily) {
      return Promise.resolve()
    }

    // Use fontFamily + fontSrc as cache key to handle same family name with different sources
    const cacheKey = fontSrc ? `${fontFamily}::${fontSrc}` : fontFamily

    // If already loaded, return a resolved promise
    if (this.loadedFonts.has(cacheKey)) {
      return Promise.resolve()
    }

    // If currently loading, return the existing promise
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!
    }

    // Create a new promise to load the font
    const loadPromise = new Promise<void>((resolve, reject) => {
      try {
        // Handle Google Fonts differently than direct font URLs
        if (!fontSrc) {
          // Use the link element approach for Google Fonts
          const encodedFontFamily = encodeURIComponent(fontFamily)
          const linkElement = document.createElement('link')
          linkElement.href = `${GOOGLE_FONTS_API_URL}?family=${encodedFontFamily}&display=swap`
          linkElement.rel = 'stylesheet'

          linkElement.onload = () => {
            // Mark as loaded
            this.loadedFonts.add(cacheKey)
            // Remove from loading promises
            this.loadingPromises.delete(cacheKey)
            resolve()
          }

          linkElement.onerror = error => {
            console.error(`Failed to load Google Font ${fontFamily}:`, error)
            this.loadingPromises.delete(cacheKey)
            reject(error)
          }

          document.head.appendChild(linkElement)
        } else {
          // For direct font URLs, use FontFace API
          const fontFace = new FontFace(fontFamily, `url(${fontSrc})`)

          fontFace
            .load()
            .then(loadedFace => {
              // Add the font to the document
              document.fonts.add(loadedFace)

              // Mark as loaded
              this.loadedFonts.add(cacheKey)

              // Remove from loading promises
              this.loadingPromises.delete(cacheKey)

              resolve()
            })
            .catch(error => {
              // For direct font URLs, use @font-face CSS approach
              this.createFontFaceRule(fontFamily, fontSrc)

              // Don't wait - just mark as loaded immediately for speed
              // The font will load in the background
              setTimeout(() => {
                this.loadedFonts.add(cacheKey)
                this.loadingPromises.delete(cacheKey)
                resolve()
              }, 50) // Very short delay just to let CSS apply
              console.error(`Failed to load font ${fontFamily} from ${fontSrc}:`, error)
            })
        }
      } catch (error) {
        console.error(`Error setting up font ${fontFamily}:`, error)
        this.loadingPromises.delete(cacheKey)
        reject(error)
      }
    })

    // Store the loading promise
    this.loadingPromises.set(cacheKey, loadPromise)

    return loadPromise
  }

  /**
   * Get all loaded font families
   */
  public getLoadedFonts(): string[] {
    return Array.from(this.loadedFonts)
  }

  /**
   * Wait for a font to be available before proceeding
   * @param fontFamily - Font family name
   * @param fontSrc - URL to the font file (optional)
   * @param timeout - Maximum time to wait in ms (default: 5000ms)
   */
  public async waitForFont(fontFamily: string, fontSrc?: string, timeout = 5000): Promise<boolean> {
    const cacheKey = fontSrc ? `${fontFamily}::${fontSrc}` : fontFamily

    // If the font is already loaded, return immediately
    if (this.loadedFonts.has(cacheKey)) {
      return true
    }

    // If there's no loading promise, the font hasn't been requested
    if (!this.loadingPromises.has(cacheKey)) {
      console.warn(`Font ${fontFamily} is not being loaded`)
      return false
    }

    // Create a timeout promise
    const timeoutPromise = new Promise<false>(resolve => {
      setTimeout(() => resolve(false), timeout)
    })

    // Wait for either the font to load or the timeout
    return Promise.race([this.loadingPromises.get(cacheKey)!.then(() => true), timeoutPromise])
  }
}
