/**
 * TailorKit Chunk Loader
 *
 * Handles dynamic loading of feature chunks based on template requirements.
 * Uses script injection for IIFE-wrapped chunks (Shopify compatibility).
 *
 * @module assets/chunk-loader
 */

/** Available chunk types */
export type ChunkName = 'text' | 'image' | 'ai'

/** Chunk mapper from Liquid template */
interface ChunkMapper {
  text?: string
  image?: string
  ai?: string
}

/** Required chunks from Liquid pre-analysis */
interface RequiredChunks {
  hasText?: boolean
  hasImage?: boolean
  hasAI?: boolean
}

/**
 * TailorKit Chunk Loader
 *
 * Manages dynamic loading of feature-specific JavaScript chunks.
 * Reads configuration from DOM elements injected by Liquid template.
 */
class TailorKitChunkLoader {
  /** Chunk URL mapper from Liquid */
  private mapper: ChunkMapper | null = null

  /** Set of chunks that have finished loading */
  private loaded = new Set<ChunkName>()

  /** Map of chunks currently being loaded */
  private loading = new Map<ChunkName, Promise<void>>()

  /** Timeout for chunk loading (ms) */
  private readonly LOAD_TIMEOUT = 10000

  /**
   * Initialize the chunk loader
   *
   * Reads chunk mapper and required chunks from DOM,
   * then starts pre-loading required chunks.
   */
  init(): void {
    // Wait for DOM to be ready before reading elements
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initFromDOM())
    } else {
      this.initFromDOM()
    }
  }

  /**
   * Initialize from DOM elements (called when DOM is ready)
   */
  private initFromDOM(): void {
    // Parse chunk mapper from DOM
    const mapperEl = document.getElementById('tailorkit-chunk-mapper')
    if (mapperEl) {
      try {
        this.mapper = JSON.parse(mapperEl.textContent || '{}')
        console.log('[TailorKit] Chunk mapper loaded:', this.mapper)
      } catch (e) {
        console.error('[TailorKit] Failed to parse chunk mapper:', e)
      }
    } else {
      console.warn('[TailorKit] Chunk mapper element not found')
    }

    // Parse required chunks and start pre-loading
    const requiredEl = document.getElementById('tailorkit-required-chunks')
    let hasText = false

    if (requiredEl) {
      try {
        const required: RequiredChunks = JSON.parse(requiredEl.textContent || '{}')
        console.log('[TailorKit] Required chunks from Liquid:', required)
        hasText = !!required.hasText
      } catch (e) {
        console.error('[TailorKit] Failed to parse required chunks:', e)
      }
    } else {
      console.warn('[TailorKit] Required chunks element not found')
    }

    // Fallback: Check for unregistered text/font custom elements in DOM
    if (!hasText) {
      hasText = this.detectTextElementsInDOM()
      if (hasText) {
        console.log('[TailorKit] Text elements detected via DOM fallback')
      }
    }

    // Load text chunk if needed
    if (hasText) {
      this.loadChunk('text')
    }

    console.log('[TailorKit] Chunk loader initialized')
  }

  /**
   * Fallback detection: Check if there are text/font custom elements in DOM
   * that haven't been registered yet (indicating text chunk is needed)
   */
  private detectTextElementsInDOM(): boolean {
    const textElementSelectors = [
      'tailorkit-text-options-list',
      'tailorkit-text-options-dropdown',
      'tailorkit-text-options-vertical',
      'tailorkit-font-options-list',
      'tailorkit-font-swatch',
      'tailorkit-font-dropdown',
      'tailorkit-text-customer-input',
    ]

    for (const tagName of textElementSelectors) {
      // Check if element exists in DOM
      const element = document.querySelector(tagName)
      if (element) {
        // Check if it's not yet registered (undefined custom element)
        if (!customElements.get(tagName)) {
          console.log(`[TailorKit] Found unregistered text element: <${tagName}>`)
          return true
        }
      }
    }

    return false
  }

  /**
   * Load a specific chunk by name
   *
   * @param name - The chunk name to load
   * @returns Promise that resolves when chunk is loaded
   */
  async loadChunk(name: ChunkName): Promise<void> {
    // Already loaded
    if (this.loaded.has(name)) {
      return Promise.resolve()
    }

    // Already loading - return existing promise
    const existingPromise = this.loading.get(name)
    if (existingPromise) {
      return existingPromise
    }

    // Check if URL exists
    const url = this.mapper?.[name]
    if (!url) {
      console.warn(`[TailorKit] No URL for chunk: ${name}`)
      return Promise.resolve()
    }

    console.log(`[TailorKit] Loading chunk: ${name}`)

    const promise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = url
      script.async = true

      // Timeout handler
      const timeoutId = setTimeout(() => {
        console.warn(`[TailorKit] Chunk load timeout: ${name}`)
        this.loaded.add(name) // Mark as loaded to prevent retries
        this.loading.delete(name)
        resolve() // Don't reject, just warn and continue
      }, this.LOAD_TIMEOUT)

      script.onload = () => {
        clearTimeout(timeoutId)
        this.loaded.add(name)
        this.loading.delete(name)
        console.log(`[TailorKit] Chunk loaded: ${name}`)
        resolve()
      }

      script.onerror = () => {
        clearTimeout(timeoutId)
        this.loading.delete(name)
        const error = new Error(`Failed to load chunk: ${name}`)
        console.error(`[TailorKit] ${error.message}`)
        reject(error)
      }

      document.head.appendChild(script)
    })

    this.loading.set(name, promise)
    return promise
  }

  /**
   * Wait for a chunk to be ready
   *
   * If the chunk is not loaded, this will trigger loading and wait.
   *
   * @param name - The chunk name to wait for
   * @returns Promise that resolves when chunk is ready
   */
  async waitForChunk(name: ChunkName): Promise<void> {
    if (this.loaded.has(name)) {
      return Promise.resolve()
    }
    return this.loadChunk(name)
  }

  /**
   * Check if a chunk is loaded
   *
   * @param name - The chunk name to check
   * @returns true if the chunk is loaded
   */
  isChunkLoaded(name: ChunkName): boolean {
    return this.loaded.has(name)
  }

  /**
   * Check if a chunk is currently loading
   *
   * @param name - The chunk name to check
   * @returns true if the chunk is currently loading
   */
  isChunkLoading(name: ChunkName): boolean {
    return this.loading.has(name)
  }

  /**
   * Get list of all loaded chunks
   *
   * @returns Array of loaded chunk names
   */
  getLoadedChunks(): ChunkName[] {
    return Array.from(this.loaded)
  }
}

/** Singleton chunk loader instance */
export const chunkLoader = new TailorKitChunkLoader()

// Type augmentation for global window
declare global {
  interface Window {
    __tailorkit__: {
      chunkLoader?: TailorKitChunkLoader
      handlers?: Record<string, (...args: any[]) => any>
      components?: Record<string, unknown>
      [key: string]: unknown
    }
  }
}
