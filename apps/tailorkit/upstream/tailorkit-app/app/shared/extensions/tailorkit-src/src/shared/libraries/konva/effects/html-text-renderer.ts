/**
 * HTML Text Renderer
 *
 * Renders text with CSS SVG filters in a hidden HTML element,
 * then captures it as an image using html-to-image.
 *
 * This approach works in all browsers (including Safari) since it uses
 * CSS filters instead of canvas ctx.filter.
 *
 * @module shared/libraries/konva/effects
 */

import * as htmlToImage from 'html-to-image'
import type { DropShadowConfig, InnerShadowConfig, EffectConfig } from './types'

const SVG_NS = 'http://www.w3.org/2000/svg'
const CONTAINER_ID = 'tailorkit-html-text-renderer'

/**
 * Configuration for text rendering
 */
export interface TextRenderConfig {
  /** Text content to render */
  text: string
  /** Width of the text box */
  width: number
  /** Height of the text box */
  height: number
  /** Font size in pixels */
  fontSize: number
  /** Font family name */
  fontFamily: string
  /** Font weight */
  fontWeight?: string | number
  /** Font style (normal, italic) */
  fontStyle?: string
  /** Text color */
  color: string
  /** Horizontal alignment */
  align?: 'left' | 'center' | 'right' | 'justify'
  /** Vertical alignment */
  verticalAlign?: 'top' | 'middle' | 'bottom'
  /** Line height multiplier */
  lineHeight?: number
  /** Letter spacing in pixels */
  letterSpacing?: number
  /** Padding in pixels */
  padding?: number
  /** Text wrapping mode */
  wrap?: 'none' | 'char' | 'word'
  /** Effects to apply */
  effects: EffectConfig[]
  /** Fill opacity (0-1) */
  fillOpacity?: number
  /** Pixel ratio for high-DPI rendering */
  pixelRatio?: number
  /** Text decoration */
  textDecoration?: string
  /** Stroke color */
  strokeColor?: string
  /** Stroke width */
  strokeWidth?: number
}

/**
 * Configuration for text path rendering
 */
export interface TextPathRenderConfig {
  /** Text content to render */
  text: string
  /** Width of the canvas */
  width: number
  /** Height of the canvas */
  height: number
  /** Font size in pixels */
  fontSize: number
  /** Font family name */
  fontFamily: string
  /** Font weight */
  fontWeight?: string | number
  /** Font style (normal, italic) */
  fontStyle?: string
  /** Text color */
  color: string
  /** SVG path data string */
  pathData: string
  /** Letter spacing in pixels */
  letterSpacing?: number
  /** Text baseline */
  textBaseline?: CanvasTextBaseline
  /** Text decoration */
  textDecoration?: string
  /** Effects to apply */
  effects: EffectConfig[]
  /** Fill opacity (0-1) */
  fillOpacity?: number
  /** Pixel ratio for high-DPI rendering */
  pixelRatio?: number
}

interface ShadowConfig {
  color: string
  blur: number
  offsetX: number
  offsetY: number
  opacity: number
}

/**
 * Parse color string to RGB values
 */
function parseColorToRgb(color: string): { r: number; g: number; b: number; a: number } {
  // Handle rgba
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
    }
  }

  // Handle hex with alpha (#RRGGBBAA)
  if (color.startsWith('#')) {
    const hex = color.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    // Check for 8-character hex with alpha
    if (hex.length === 8) {
      const alpha = parseInt(hex.substring(6, 8), 16) / 255
      return { r, g, b, a: alpha }
    }
    return { r, g, b, a: 1 }
  }

  // Default to black
  return { r: 0, g: 0, b: 0, a: 1 }
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Configuration for filter margin calculation
 */
const FILTER_CONFIG = {
  BASE_MARGIN: 20,
  EXTRA_MARGIN: 30,
  BLUR_MULTIPLIER: 3,
}

/**
 * HTML Text Renderer - Singleton class for rendering text with effects to images
 */
export class HTMLTextRenderer {
  private static instance: HTMLTextRenderer | null = null
  private container: HTMLDivElement | null = null
  private svgDefs: SVGDefsElement | null = null
  private filterCounter = 0

  private constructor() {
    this.initContainer()
  }

  /**
   * Get singleton instance
   */
  static getInstance(): HTMLTextRenderer {
    if (!HTMLTextRenderer.instance) {
      HTMLTextRenderer.instance = new HTMLTextRenderer()
    }
    return HTMLTextRenderer.instance
  }

  /**
   * Initialize hidden container for rendering
   */
  private initContainer(): void {
    // Check if container already exists
    let container = document.getElementById(CONTAINER_ID) as HTMLDivElement | null

    if (!container) {
      container = document.createElement('div')
      container.id = CONTAINER_ID
      // Position off-screen but keep visible for html-to-image to capture
      container.style.cssText = `
        position: absolute;
        left: -10000px;
        top: -10000px;
        pointer-events: none;
      `

      // Create SVG element for filter definitions
      const svg = document.createElementNS(SVG_NS, 'svg')
      svg.setAttribute('width', '0')
      svg.setAttribute('height', '0')
      svg.setAttribute('style', 'position: absolute;')

      const defs = document.createElementNS(SVG_NS, 'defs')
      svg.appendChild(defs)
      container.appendChild(svg)

      document.body.appendChild(container)
      this.svgDefs = defs
    } else {
      this.svgDefs = container.querySelector('defs')
    }

    this.container = container
  }

  /**
   * Ensure container exists
   */
  private ensureContainer(): void {
    if (!this.container || !document.body.contains(this.container)) {
      this.initContainer()
    }
  }

  /**
   * Generate unique filter ID
   */
  private generateFilterId(): string {
    return `html-text-filter-${++this.filterCounter}-${Date.now()}`
  }

  /**
   * Convert effect configs to shadow configs
   */
  private convertToShadowConfig(
    effects: Array<DropShadowConfig | InnerShadowConfig>,
    textColor: string
  ): ShadowConfig[] {
    return effects.map(effect => ({
      color: effect.color === 'currentColor' ? textColor : effect.color,
      blur: effect.radius || 0,
      offsetX: effect.offsetX || 0,
      offsetY: effect.offsetY || 0,
      opacity: effect.opacity ?? 1,
    }))
  }

  /**
   * Calculate filter region percentage
   */
  private calculateFilterRegion(shadows: ShadowConfig[]): number {
    let maxMargin = FILTER_CONFIG.BASE_MARGIN

    for (const shadow of shadows) {
      maxMargin = Math.max(
        maxMargin,
        shadow.blur * FILTER_CONFIG.BLUR_MULTIPLIER,
        Math.abs(shadow.offsetX),
        Math.abs(shadow.offsetY)
      )
    }

    return (maxMargin + FILTER_CONFIG.EXTRA_MARGIN) / 100
  }

  /**
   * Build drop shadow SVG primitive with knockout effect
   */
  private buildDropShadowPrimitive(shadow: ShadowConfig, name: string): string {
    const { r, g, b } = parseColorToRgb(shadow.color)

    return `
      <feGaussianBlur in="SourceAlpha" stdDeviation="${shadow.blur}" result="${name}Blur"/>
      <feOffset in="${name}Blur" dx="${shadow.offsetX}" dy="${shadow.offsetY}" result="${name}Offset"/>
      <feFlood flood-color="rgb(${r},${g},${b})" flood-opacity="${shadow.opacity}" result="${name}Color"/>
      <feComposite in="${name}Color" in2="${name}Offset" operator="in" result="${name}Shaped"/>
      <feComposite in="${name}Shaped" in2="SourceAlpha" operator="out" result="${name}"/>`
  }

  /**
   * Build inner shadow SVG primitive
   */
  private buildInnerShadowPrimitive(shadow: ShadowConfig, name: string): string {
    const { r, g, b } = parseColorToRgb(shadow.color)

    return `
      <feFlood flood-color="rgb(${r},${g},${b})" flood-opacity="${shadow.opacity}" result="${name}Color"/>
      <feComposite in="${name}Color" in2="SourceAlpha" operator="out" result="${name}Mask"/>
      <feOffset in="${name}Mask" dx="${shadow.offsetX}" dy="${shadow.offsetY}" result="${name}Offset"/>
      <feGaussianBlur in="${name}Offset" stdDeviation="${shadow.blur}" result="${name}Blur"/>
      <feComposite in="${name}Blur" in2="SourceAlpha" operator="in" result="${name}"/>`
  }

  /**
   * Build fill layer primitive with opacity control
   */
  private buildFillLayerPrimitive(fillOpacity: number): string {
    return `
      <feComponentTransfer in="SourceGraphic" result="fillLayer">
        <feFuncA type="linear" slope="${clamp(fillOpacity, 0, 1)}"/>
      </feComponentTransfer>`
  }

  /**
   * Build merge primitive
   */
  private buildMergePrimitive(dropCount: number, innerCount: number): string {
    const nodes: string[] = []

    // Drop shadows first (behind everything)
    for (let i = 0; i < dropCount; i++) {
      nodes.push(`<feMergeNode in="drop${i}"/>`)
    }

    // Fill layer
    nodes.push('<feMergeNode in="fillLayer"/>')

    // Inner shadows on top
    for (let i = 0; i < innerCount; i++) {
      nodes.push(`<feMergeNode in="inner${i}"/>`)
    }

    return `<feMerge>${nodes.join('')}</feMerge>`
  }

  /**
   * Create SVG filter element
   */
  private createFilter(
    effects: EffectConfig[],
    textColor: string,
    fillOpacity: number
  ): string | null {
    this.ensureContainer()

    if (!this.svgDefs) {
      console.warn('HTMLTextRenderer: SVG defs container not found')
      return null
    }

    const innerShadows = effects.filter(
      (e): e is InnerShadowConfig => e.type === 'INNER_SHADOW' && e.visible !== false
    )
    const dropShadows = effects.filter(
      (e): e is DropShadowConfig => e.type === 'DROP_SHADOW' && e.visible !== false
    )

    // No effects to apply
    if (innerShadows.length === 0 && dropShadows.length === 0 && fillOpacity >= 1) {
      return null
    }

    const filterId = this.generateFilterId()
    const innerConfigs = this.convertToShadowConfig(innerShadows, textColor)
    const dropConfigs = this.convertToShadowConfig(dropShadows, textColor)
    const allShadows = [...innerConfigs, ...dropConfigs]

    const filterRegion = allShadows.length > 0 ? this.calculateFilterRegion(allShadows) : 0.5

    const filter = document.createElementNS(SVG_NS, 'filter')
    filter.setAttribute('id', filterId)
    filter.setAttribute('x', `-${filterRegion * 100}%`)
    filter.setAttribute('y', `-${filterRegion * 100}%`)
    filter.setAttribute('width', `${(1 + filterRegion * 2) * 100}%`)
    filter.setAttribute('height', `${(1 + filterRegion * 2) * 100}%`)

    const parts: string[] = []

    // Build drop shadows
    dropConfigs.forEach((shadow, index) => {
      parts.push(this.buildDropShadowPrimitive(shadow, `drop${index}`))
    })

    // Build fill layer
    parts.push(this.buildFillLayerPrimitive(fillOpacity))

    // Build inner shadows
    innerConfigs.forEach((shadow, index) => {
      parts.push(this.buildInnerShadowPrimitive(shadow, `inner${index}`))
    })

    // Build merge
    parts.push(this.buildMergePrimitive(dropConfigs.length, innerConfigs.length))

    filter.innerHTML = parts.join('\n')
    this.svgDefs.appendChild(filter)

    return filterId
  }

  /**
   * Remove a filter by ID
   */
  private removeFilter(filterId: string): void {
    if (!this.svgDefs) return
    const filter = this.svgDefs.querySelector(`#${filterId}`)
    if (filter) {
      filter.remove()
    }
  }

  /**
   * Get vertical align CSS value
   */
  private getVerticalAlignCSS(verticalAlign?: 'top' | 'middle' | 'bottom'): string {
    switch (verticalAlign) {
      case 'middle':
        return 'center'
      case 'bottom':
        return 'flex-end'
      default:
        return 'flex-start'
    }
  }

  /**
   * Get horizontal align CSS value
   */
  private getHorizontalAlignCSS(align?: 'left' | 'center' | 'right' | 'justify'): string {
    switch (align) {
      case 'center':
        return 'center'
      case 'right':
        return 'flex-end'
      case 'justify':
        return 'stretch'
      default:
        return 'flex-start'
    }
  }

  /**
   * Render text with effects to a canvas
   *
   * @param config - Text render configuration
   * @returns Canvas element with rendered text
   */
  async renderToCanvas(config: TextRenderConfig): Promise<HTMLCanvasElement> {
    this.ensureContainer()

    if (!this.container) {
      throw new Error('HTMLTextRenderer: Container not initialized')
    }

    const {
      text,
      width,
      height,
      fontSize,
      fontFamily,
      fontWeight = 'normal',
      fontStyle = 'normal',
      color,
      align = 'left',
      verticalAlign = 'top',
      lineHeight = 1,
      letterSpacing = 0,
      padding = 0,
      effects,
      fillOpacity = 1,
      pixelRatio = 2,
      textDecoration,
      strokeColor,
      strokeWidth,
    } = config

    // Calculate padding for filter overflow
    const filterPadding = 50 // Extra padding for shadow/blur overflow

    // Create filter if needed
    const filterId = this.createFilter(effects, color, fillOpacity)

    // Calculate SVG dimensions with padding
    const svgWidth = width + filterPadding * 2
    const svgHeight = height + filterPadding * 2

    // Create container div for the SVG
    const container = document.createElement('div')
    container.style.cssText = `
      width: ${svgWidth}px;
      height: ${svgHeight}px;
    `

    // Get text anchor based on alignment
    const getTextAnchor = (a: string) => {
      switch (a) {
        case 'center': return 'middle'
        case 'right': return 'end'
        default: return 'start'
      }
    }

    // Get X position based on alignment
    const getTextX = (a: string) => {
      switch (a) {
        case 'center': return filterPadding + width / 2
        case 'right': return filterPadding + width - padding
        default: return filterPadding + padding
      }
    }

    // Get Y position based on vertical alignment
    const getTextY = (va: string) => {
      switch (va) {
        case 'middle': return filterPadding + height / 2
        case 'bottom': return filterPadding + height - padding
        default: return filterPadding + fontSize + padding
      }
    }

    // Get dominant baseline based on vertical alignment
    const getDominantBaseline = (va: string) => {
      switch (va) {
        case 'middle': return 'central'
        case 'bottom': return 'text-after-edge'
        default: return 'text-before-edge'
      }
    }

    // Create SVG with text element
    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">
        <text
          x="${getTextX(align || 'left')}"
          y="${getTextY(verticalAlign || 'top')}"
          font-size="${fontSize}"
          font-family="${fontFamily}"
          font-weight="${fontWeight}"
          font-style="${fontStyle}"
          fill="${color}"
          letter-spacing="${letterSpacing}"
          text-anchor="${getTextAnchor(align || 'left')}"
          dominant-baseline="${getDominantBaseline(verticalAlign || 'top')}"
          ${textDecoration ? `text-decoration="${textDecoration}"` : ''}
          ${strokeColor && strokeWidth ? `stroke="${strokeColor}" stroke-width="${strokeWidth}"` : ''}
          ${filterId ? `filter="url(#${filterId})"` : ''}
        >${this.escapeHtml(text)}</text>
      </svg>
    `

    container.innerHTML = svgContent
    this.container!.appendChild(container)

    // Debug: log what we're rendering
    console.log('[HTMLTextRenderer] Rendering text:', {
      text: text.substring(0, 50),
      containerSize: `${svgWidth}x${svgHeight}`,
      textSize: `${width}x${height}`,
      fontSize,
      fontFamily,
      color,
      hasFilter: !!filterId,
    })

    // Render to canvas
    try {
      let canvas: HTMLCanvasElement

      try {
        // First try with font embedding
        canvas = await htmlToImage.toCanvas(container, {
          pixelRatio,
          backgroundColor: undefined,
          skipFonts: false,
          cacheBust: false,
          includeQueryParams: true,
        })
      } catch (fontError) {
        // If font embedding fails (CORS), retry without fonts
        console.warn('[HTMLTextRenderer] Font embedding failed, retrying without fonts:', fontError)
        canvas = await htmlToImage.toCanvas(container, {
          pixelRatio,
          backgroundColor: undefined,
          skipFonts: true,
          cacheBust: false,
          includeQueryParams: true,
        })
      }

      console.log('[HTMLTextRenderer] Raw canvas captured:', {
        width: canvas.width,
        height: canvas.height,
      })

      // DEBUG: Return full canvas without cropping to see where the text is
      return canvas

      // Crop canvas to remove filter padding
      // const croppedCanvas = document.createElement('canvas')
      // const ctx = croppedCanvas.getContext('2d')
      // if (!ctx) {
      //   throw new Error('Failed to get canvas context')
      // }

      // croppedCanvas.width = width * pixelRatio
      // croppedCanvas.height = height * pixelRatio

      // ctx.drawImage(
      //   canvas,
      //   filterPadding * pixelRatio,
      //   filterPadding * pixelRatio,
      //   width * pixelRatio,
      //   height * pixelRatio,
      //   0,
      //   0,
      //   width * pixelRatio,
      //   height * pixelRatio
      // )

      // return croppedCanvas
    } finally {
      // Cleanup
      container.remove()
      if (filterId) {
        this.removeFilter(filterId)
      }
    }
  }

  /**
   * Render text along a path with effects to a canvas
   *
   * @param config - Text path render configuration
   * @returns Canvas element with rendered text path
   */
  async renderTextPathToCanvas(config: TextPathRenderConfig): Promise<HTMLCanvasElement> {
    this.ensureContainer()

    if (!this.container) {
      throw new Error('HTMLTextRenderer: Container not initialized')
    }

    const {
      text,
      width,
      height,
      fontSize,
      fontFamily,
      fontWeight = 'normal',
      fontStyle = 'normal',
      color,
      pathData,
      letterSpacing = 0,
      textBaseline = 'bottom',
      effects,
      fillOpacity = 1,
      pixelRatio = 2,
    } = config

    // Calculate padding for filter overflow
    const filterPadding = 50

    // Create filter if needed
    const filterId = this.createFilter(effects, color, fillOpacity)

    // Generate unique IDs for path
    const pathId = `text-path-${this.filterCounter}-${Date.now()}`

    // Create SVG element with text path
    const svgContainer = document.createElement('div')
    svgContainer.style.cssText = `
      width: ${width + filterPadding * 2}px;
      height: ${height + filterPadding * 2}px;
      padding: ${filterPadding}px;
      box-sizing: border-box;
    `

    // Map textBaseline to SVG dominant-baseline
    const getDominantBaseline = (baseline: CanvasTextBaseline): string => {
      switch (baseline) {
        case 'top':
          return 'text-before-edge'
        case 'hanging':
          return 'hanging'
        case 'middle':
          return 'central'
        case 'alphabetic':
          return 'alphabetic'
        case 'ideographic':
          return 'ideographic'
        case 'bottom':
          return 'text-after-edge'
        default:
          return 'alphabetic'
      }
    }

    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
          <path id="${pathId}" d="${pathData}" fill="none"/>
        </defs>
        <text
          font-size="${fontSize}"
          font-family="${fontFamily}"
          font-weight="${fontWeight}"
          font-style="${fontStyle}"
          fill="${color}"
          letter-spacing="${letterSpacing}"
          dominant-baseline="${getDominantBaseline(textBaseline)}"
          text-anchor="middle"
          ${filterId ? `filter="url(#${filterId})"` : ''}
        >
          <textPath href="#${pathId}" startOffset="50%">${this.escapeHtml(text)}</textPath>
        </text>
      </svg>
    `

    svgContainer.innerHTML = svgContent
    this.container.appendChild(svgContainer)

    // Render to canvas
    try {
      const canvas = await htmlToImage.toCanvas(svgContainer, {
        pixelRatio,
        backgroundColor: undefined,
        skipFonts: true, // Skip web fonts to avoid CORS errors with cross-origin stylesheets
        cacheBust: false,
        includeQueryParams: true,
      })

      // Crop canvas to remove filter padding
      const croppedCanvas = document.createElement('canvas')
      const ctx = croppedCanvas.getContext('2d')
      if (!ctx) {
        throw new Error('Failed to get canvas context')
      }

      croppedCanvas.width = width * pixelRatio
      croppedCanvas.height = height * pixelRatio

      ctx.drawImage(
        canvas,
        filterPadding * pixelRatio,
        filterPadding * pixelRatio,
        width * pixelRatio,
        height * pixelRatio,
        0,
        0,
        width * pixelRatio,
        height * pixelRatio
      )

      return croppedCanvas
    } finally {
      // Cleanup
      svgContainer.remove()
      if (filterId) {
        this.removeFilter(filterId)
      }
    }
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return text.replace(/[&<>"']/g, char => htmlEscapes[char])
  }

  /**
   * Destroy the renderer instance
   */
  static destroy(): void {
    if (HTMLTextRenderer.instance) {
      const container = document.getElementById(CONTAINER_ID)
      if (container) {
        container.remove()
      }
      HTMLTextRenderer.instance = null
    }
  }
}

/**
 * Get HTMLTextRenderer singleton instance
 */
export const getHTMLTextRenderer = (): HTMLTextRenderer => HTMLTextRenderer.getInstance()
