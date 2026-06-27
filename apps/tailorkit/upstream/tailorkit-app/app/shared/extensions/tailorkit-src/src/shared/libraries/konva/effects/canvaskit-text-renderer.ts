/**
 * CanvasKit Text Renderer
 *
 * Main entry point for rendering text with effects using CanvasKit/Skia.
 * Lazy-loads CanvasKit WASM on first use and provides caching for rendered results.
 *
 * @module libraries/konva/effects
 */

import type { CanvasKit } from 'canvaskit-wasm'
import type { EffectConfig, DropShadowConfig, InnerShadowConfig } from './types'
import { getCanvasKitFontManager, type CanvasKitFontManager } from './canvaskit-font-manager'
import { computeTextLayout, computeTextPathLayout, type TextLayoutConfig } from './canvaskit-text-layout'
import { CanvasKitEffectsRenderer } from './canvaskit-effects'

export interface RenderConfig {
  text: string
  width: number
  height: number
  fontSize: number
  fontFamily: string
  fontSrc?: string
  fontWeight?: string | number
  fontStyle?: string
  color: string
  align?: 'left' | 'center' | 'right' | 'justify'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  lineHeight?: number
  letterSpacing?: number
  wrap?: 'none' | 'word' | 'char'
  padding?: number
  ellipsis?: boolean
  effects: EffectConfig[]
  fillOpacity?: number
  scale?: number
}

export interface TextPathRenderConfig {
  text: string
  pathData: string
  width: number
  height: number
  fontSize: number
  fontFamily: string
  fontSrc?: string
  fontWeight?: string | number
  fontStyle?: string
  color: string
  letterSpacing?: number
  textBaseline?: CanvasTextBaseline
  effects: EffectConfig[]
  fillOpacity?: number
  scale?: number
}

export interface RenderResult {
  canvas: HTMLCanvasElement
  width: number
  height: number
}

interface CacheEntry {
  canvas: HTMLCanvasElement
  timestamp: number
}

/**
 * CanvasKit Text Renderer
 *
 * Singleton class that manages CanvasKit initialization and text rendering.
 * Lazy-loads CanvasKit WASM when first needed.
 */
export class CanvasKitTextRenderer {
  private static instance: CanvasKitTextRenderer | null = null

  private canvasKit: CanvasKit | null = null
  private fontManager: CanvasKitFontManager
  private effectsRenderer: CanvasKitEffectsRenderer | null = null
  private initPromise: Promise<void> | null = null
  private initFailed = false

  // LRU cache for rendered results
  private cache: Map<string, CacheEntry> = new Map()
  private readonly maxCacheSize = 100
  private readonly cacheMaxAge = 60000 // 1 minute

  private constructor() {
    this.fontManager = getCanvasKitFontManager()
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CanvasKitTextRenderer {
    if (!CanvasKitTextRenderer.instance) {
      CanvasKitTextRenderer.instance = new CanvasKitTextRenderer()
    }
    return CanvasKitTextRenderer.instance
  }

  /**
   * Initialize CanvasKit (lazy load WASM)
   */
  async initialize(): Promise<void> {
    // Already initialized
    if (this.canvasKit) return

    // Already failed
    if (this.initFailed) {
      throw new Error('CanvasKit initialization previously failed')
    }

    // Already initializing
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this.doInitialize()
    return this.initPromise
  }

  /**
   * Internal initialization
   */
  private async doInitialize(): Promise<void> {
    try {
      // Load CanvasKit from CDN
      const CANVASKIT_VERSION = '0.39.1'
      const cdnUrl = `https://unpkg.com/canvaskit-wasm@${CANVASKIT_VERSION}/bin/canvaskit.js`

      // Load the script dynamically
      await this.loadScript(cdnUrl)

      // Get the CanvasKitInit function from global scope
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const CanvasKitInit = (window as any).CanvasKitInit
      if (!CanvasKitInit) {
        throw new Error('CanvasKitInit not found after loading script')
      }

      // Initialize CanvasKit
      this.canvasKit = await CanvasKitInit({
        locateFile: (file: string) => {
          return `https://unpkg.com/canvaskit-wasm@${CANVASKIT_VERSION}/bin/${file}`
        },
      })

      // Initialize font manager
      this.fontManager.initialize(this.canvasKit)

      // Initialize effects renderer
      this.effectsRenderer = new CanvasKitEffectsRenderer(this.canvasKit)

      console.log('[CanvasKitTextRenderer] Initialized successfully')
    } catch (error) {
      this.initFailed = true
      console.error('[CanvasKitTextRenderer] Failed to initialize:', error)
      throw error
    }
  }

  /**
   * Load a script from URL
   */
  private loadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (document.querySelector(`script[src="${url}"]`)) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = url
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`))
      document.head.appendChild(script)
    })
  }

  /**
   * Check if CanvasKit is available and initialized
   */
  isAvailable(): boolean {
    return this.canvasKit !== null && !this.initFailed
  }

  /**
   * Check if initialization failed
   */
  hasFailed(): boolean {
    return this.initFailed
  }

  /**
   * Render text with effects to canvas
   */
  async renderToCanvas(config: RenderConfig): Promise<RenderResult> {
    // Ensure initialized
    await this.initialize()

    if (!this.canvasKit || !this.effectsRenderer) {
      throw new Error('CanvasKit not initialized')
    }

    // Check cache
    const cacheKey = this.getCacheKey(config)
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return cached
    }

    // Separate effects by type
    const dropShadows = config.effects.filter(
      (e): e is DropShadowConfig => e.type === 'DROP_SHADOW' && e.visible !== false
    )
    const innerShadows = config.effects.filter(
      (e): e is InnerShadowConfig => e.type === 'INNER_SHADOW' && e.visible !== false
    )

    // Load font
    const typeface = await this.fontManager.loadFont(config.fontFamily, config.fontSrc)
    if (!typeface) {
      throw new Error(`Failed to load font: ${config.fontFamily}`)
    }

    // Calculate render dimensions with scale
    const scale = config.scale || 1
    const renderWidth = Math.ceil(config.width * scale)
    const renderHeight = Math.ceil(config.height * scale)

    // Create CanvasKit surface
    const surface = this.canvasKit.MakeSurface(renderWidth, renderHeight)
    if (!surface) {
      throw new Error('Failed to create CanvasKit surface')
    }

    try {
      const canvas = surface.getCanvas()
      canvas.clear(this.canvasKit.Color4f(0, 0, 0, 0))

      // Apply scale
      if (scale !== 1) {
        canvas.scale(scale, scale)
      }

      // Compute text layout
      const layoutConfig: TextLayoutConfig = {
        text: config.text,
        width: config.width,
        height: config.height,
        fontSize: config.fontSize,
        fontFamily: config.fontFamily,
        fontWeight: config.fontWeight,
        fontStyle: config.fontStyle,
        align: config.align,
        verticalAlign: config.verticalAlign,
        lineHeight: config.lineHeight,
        letterSpacing: config.letterSpacing,
        wrap: config.wrap,
        padding: config.padding,
        ellipsis: config.ellipsis,
      }

      const layout = computeTextLayout(this.canvasKit, typeface, layoutConfig)

      // Render with effects
      this.effectsRenderer.renderTextWithEffects(canvas, layout.font, layout, {
        width: config.width,
        height: config.height,
        textColor: config.color,
        fillOpacity: config.fillOpacity,
        dropShadows,
        innerShadows,
        letterSpacing: config.letterSpacing,
        align: config.align,
      })

      // Get result as HTML canvas
      const htmlCanvas = document.createElement('canvas')
      htmlCanvas.width = renderWidth
      htmlCanvas.height = renderHeight

      const ctx = htmlCanvas.getContext('2d')
      if (!ctx) {
        throw new Error('Failed to get 2D context')
      }

      // Copy CanvasKit surface to HTML canvas
      const imageData = surface.makeImageSnapshot()
      const pixels = imageData.readPixels(0, 0, {
        width: renderWidth,
        height: renderHeight,
        colorType: this.canvasKit.ColorType.RGBA_8888,
        alphaType: this.canvasKit.AlphaType.Unpremul,
        colorSpace: this.canvasKit.ColorSpace.SRGB,
      })

      if (pixels) {
        const imgData = new ImageData(new Uint8ClampedArray(pixels), renderWidth, renderHeight)
        ctx.putImageData(imgData, 0, 0)
      }

      imageData.delete()
      layout.font.delete()

      const result: RenderResult = {
        canvas: htmlCanvas,
        width: renderWidth,
        height: renderHeight,
      }

      // Cache the result
      this.setCache(cacheKey, result)

      return result
    } finally {
      surface.delete()
    }
  }

  /**
   * Render text path with effects to canvas
   */
  async renderTextPathToCanvas(config: TextPathRenderConfig): Promise<RenderResult> {
    // Ensure initialized
    await this.initialize()

    if (!this.canvasKit || !this.effectsRenderer) {
      throw new Error('CanvasKit not initialized')
    }

    // Check cache
    const cacheKey = this.getTextPathCacheKey(config)
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return cached
    }

    // Separate effects by type
    const dropShadows = config.effects.filter(
      (e): e is DropShadowConfig => e.type === 'DROP_SHADOW' && e.visible !== false
    )
    const innerShadows = config.effects.filter(
      (e): e is InnerShadowConfig => e.type === 'INNER_SHADOW' && e.visible !== false
    )

    // Load font
    const typeface = await this.fontManager.loadFont(config.fontFamily, config.fontSrc)
    if (!typeface) {
      throw new Error(`Failed to load font: ${config.fontFamily}`)
    }

    // Calculate render dimensions with scale
    const scale = config.scale || 1
    const renderWidth = Math.ceil(config.width * scale)
    const renderHeight = Math.ceil(config.height * scale)

    // Create CanvasKit surface
    const surface = this.canvasKit.MakeSurface(renderWidth, renderHeight)
    if (!surface) {
      throw new Error('Failed to create CanvasKit surface')
    }

    try {
      const canvas = surface.getCanvas()
      canvas.clear(this.canvasKit.Color4f(0, 0, 0, 0))

      // Apply scale
      if (scale !== 1) {
        canvas.scale(scale, scale)
      }

      // Compute text path layout
      const pathLayout = computeTextPathLayout(this.canvasKit, typeface, {
        text: config.text,
        pathData: config.pathData,
        fontSize: config.fontSize,
        letterSpacing: config.letterSpacing,
        textBaseline: config.textBaseline,
      })

      if (!pathLayout) {
        throw new Error('Failed to compute text path layout')
      }

      // Render with effects
      this.effectsRenderer.renderTextPathWithEffects(canvas, pathLayout.font, pathLayout.glyphs, {
        width: config.width,
        height: config.height,
        textColor: config.color,
        fillOpacity: config.fillOpacity,
        dropShadows,
        innerShadows,
      })

      // Get result as HTML canvas
      const htmlCanvas = document.createElement('canvas')
      htmlCanvas.width = renderWidth
      htmlCanvas.height = renderHeight

      const ctx = htmlCanvas.getContext('2d')
      if (!ctx) {
        throw new Error('Failed to get 2D context')
      }

      // Copy CanvasKit surface to HTML canvas
      const imageData = surface.makeImageSnapshot()
      const pixels = imageData.readPixels(0, 0, {
        width: renderWidth,
        height: renderHeight,
        colorType: this.canvasKit.ColorType.RGBA_8888,
        alphaType: this.canvasKit.AlphaType.Unpremul,
        colorSpace: this.canvasKit.ColorSpace.SRGB,
      })

      if (pixels) {
        const imgData = new ImageData(new Uint8ClampedArray(pixels), renderWidth, renderHeight)
        ctx.putImageData(imgData, 0, 0)
      }

      imageData.delete()
      pathLayout.font.delete()

      const result: RenderResult = {
        canvas: htmlCanvas,
        width: renderWidth,
        height: renderHeight,
      }

      // Cache the result
      this.setCache(cacheKey, result)

      return result
    } finally {
      surface.delete()
    }
  }

  /**
   * Generate cache key from config
   */
  private getCacheKey(config: RenderConfig): string {
    return JSON.stringify({
      text: config.text,
      width: config.width,
      height: config.height,
      fontSize: config.fontSize,
      fontFamily: config.fontFamily,
      fontSrc: config.fontSrc,
      fontWeight: config.fontWeight,
      fontStyle: config.fontStyle,
      color: config.color,
      align: config.align,
      verticalAlign: config.verticalAlign,
      lineHeight: config.lineHeight,
      letterSpacing: config.letterSpacing,
      wrap: config.wrap,
      padding: config.padding,
      effects: config.effects,
      fillOpacity: config.fillOpacity,
      scale: config.scale,
    })
  }

  /**
   * Generate cache key for text path config
   */
  private getTextPathCacheKey(config: TextPathRenderConfig): string {
    return JSON.stringify({
      type: 'textPath',
      text: config.text,
      pathData: config.pathData,
      width: config.width,
      height: config.height,
      fontSize: config.fontSize,
      fontFamily: config.fontFamily,
      fontSrc: config.fontSrc,
      color: config.color,
      letterSpacing: config.letterSpacing,
      effects: config.effects,
      fillOpacity: config.fillOpacity,
      scale: config.scale,
    })
  }

  /**
   * Get from cache if valid
   */
  private getFromCache(key: string): RenderResult | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check if expired
    if (Date.now() - entry.timestamp > this.cacheMaxAge) {
      this.cache.delete(key)
      return null
    }

    return {
      canvas: entry.canvas,
      width: entry.canvas.width,
      height: entry.canvas.height,
    }
  }

  /**
   * Set cache entry
   */
  private setCache(key: string, result: RenderResult): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, {
      canvas: result.canvas,
      timestamp: Date.now(),
    })
  }

  /**
   * Clear the render cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.clearCache()
    this.fontManager.dispose()
    this.effectsRenderer = null
    this.canvasKit = null
    this.initPromise = null
    CanvasKitTextRenderer.instance = null
  }
}

/**
 * Get the singleton renderer instance
 */
export function getCanvasKitTextRenderer(): CanvasKitTextRenderer {
  return CanvasKitTextRenderer.getInstance()
}

/**
 * Check if CanvasKit rendering is supported
 */
export function isCanvasKitSupported(): boolean {
  // Check for WebGL support (required by CanvasKit)
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) return false

    // Check for WASM support
    if (typeof WebAssembly !== 'object') return false

    return true
  } catch {
    return false
  }
}
