/**
 * SVG Filter Manager
 *
 * Manages SVG filter creation and lifecycle for text effects.
 * Uses SVG filter primitives applied via canvas ctx.filter = 'url(#id)'.
 *
 * Benefits over canvas compositing:
 * - No rasterization needed - vector-based like Figma
 * - GPU-accelerated rendering
 * - Single combined filter for all effects
 *
 * @module shared/libraries/konva/effects
 * @deprecated - Use SVGFilterRenderer instead. May be in the future, when context.filter is supported by all browsers.
 */

import type { DropShadowConfig, InnerShadowConfig } from './types'

const SVG_NS = 'http://www.w3.org/2000/svg'
const FILTER_CONTAINER_ID = 'tailorkit-svg-filters'

interface ShadowConfig {
  color: string
  blur: number
  offsetX: number
  offsetY: number
  opacity: number
}

/**
 * Convert hex color to RGB object
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) {
    return { r: 0, g: 0, b: 0 }
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

/**
 * Parse color string to RGB values
 * Handles hex, rgb(), rgba() formats
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
    const rgb = hexToRgb(color)
    // Check for 8-character hex with alpha
    if (hex.length === 8) {
      const alpha = parseInt(hex.substring(6, 8), 16) / 255
      return { ...rgb, a: alpha }
    }
    return { ...rgb, a: 1 }
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
 * SVG Filter Manager - Singleton class for managing text effect filters
 *
 * Creates and manages SVG filter elements that can be applied to canvas
 * via ctx.filter = 'url(#filterId)'
 */
export class SVGFilterManager {
  private static instance: SVGFilterManager | null = null
  private svgDefs: SVGDefsElement | null = null
  private filterCounter = 0
  private activeFilters = new Map<string, SVGFilterElement>()

  private constructor() {
    this.initContainer()
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SVGFilterManager {
    if (!SVGFilterManager.instance) {
      SVGFilterManager.instance = new SVGFilterManager()
    }
    return SVGFilterManager.instance
  }

  /**
   * Initialize SVG container for filters
   */
  private initContainer(): void {
    // Check if container already exists
    let container = document.getElementById(FILTER_CONTAINER_ID) as SVGSVGElement | null

    if (!container) {
      container = document.createElementNS(SVG_NS, 'svg')
      container.id = FILTER_CONTAINER_ID
      container.setAttribute('style', 'width: 0; height: 0; position: absolute; pointer-events: none;')
      container.setAttribute('version', '1.1')
      container.setAttribute('xmlns', SVG_NS)

      const defs = document.createElementNS(SVG_NS, 'defs')
      container.appendChild(defs)

      // Append to body to ensure it's always accessible
      document.body.appendChild(container)
    }

    this.svgDefs = container.querySelector('defs')
  }

  /**
   * Ensure container exists (call after document ready)
   */
  ensureContainer(): void {
    if (!this.svgDefs || !document.body.contains(this.svgDefs.parentElement)) {
      this.initContainer()
    }
  }

  /**
   * Generate a unique filter ID
   */
  private generateFilterId(): string {
    return `text-effect-${++this.filterCounter}-${Date.now()}`
  }

  /**
   * Calculate filter region percentage based on shadow parameters
   * Filter region must be large enough to contain all shadow effects
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
   * Create SVG filter element with proper region
   */
  private createFilterElement(filterId: string, filterRegion: number): SVGFilterElement {
    const filter = document.createElementNS(SVG_NS, 'filter')
    filter.setAttribute('id', filterId)
    filter.setAttribute('x', `-${filterRegion * 100}%`)
    filter.setAttribute('y', `-${filterRegion * 100}%`)
    filter.setAttribute('width', `${(1 + filterRegion * 2) * 100}%`)
    filter.setAttribute('height', `${(1 + filterRegion * 2) * 100}%`)
    return filter
  }

  /**
   * Build SVG primitives for drop shadow with knockout effect
   *
   * Knockout prevents shadow from showing through semi-transparent text:
   * 1. Blur source alpha to create shadow
   * 2. Offset the blurred shadow
   * 3. Apply shadow color
   * 4. Clip to shadow shape
   * 5. Knock out the text shape from shadow (shadow only visible outside text)
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
   * Build SVG primitives for inner shadow
   *
   * Inner shadow algorithm:
   * 1. Create solid color layer
   * 2. Create inverted mask from text alpha (feComposite out)
   * 3. Offset the inverted mask
   * 4. Blur the offset mask
   * 5. Clip to inside of text shape (feComposite in)
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
   * Build SVG primitives for fill layer with opacity control
   *
   * Uses feComponentTransfer to adjust alpha channel independently
   * This allows text to be semi-transparent while shadows remain at full opacity
   */
  private buildFillLayerPrimitive(fillOpacity: number): string {
    return `
      <feComponentTransfer in="SourceGraphic" result="fillLayer">
        <feFuncA type="linear" slope="${clamp(fillOpacity, 0, 1)}"/>
      </feComponentTransfer>`
  }

  /**
   * Build final merge primitive to combine all layers
   *
   * Layer order (bottom to top):
   * 1. Drop shadows (rendered behind)
   * 2. Fill layer (text with opacity)
   * 3. Inner shadows (rendered on top, clipped to text)
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
   * Convert effect configs to internal shadow format
   * Applies scale factor to blur and offsets to compensate for Stage zoom
   *
   * @param effects - Effect configurations
   * @param textColor - Text color for resolving 'currentColor'
   * @param scaleFactor - Stage scale factor (default 1).
   */
  private convertToShadowConfig(
    effects: Array<DropShadowConfig | InnerShadowConfig>,
    textColor: string,
    scaleFactor: number = 1
  ): ShadowConfig[] {
    return effects.map(effect => ({
      color: effect.color === 'currentColor' ? textColor : effect.color,
      blur: (effect.radius || 0) * scaleFactor,
      offsetX: (effect.offsetX || 0) * scaleFactor,
      offsetY: (effect.offsetY || 0) * scaleFactor,
      opacity: effect.opacity ?? 1,
    }))
  }

  /**
   * Create a combined filter with multiple inner and drop shadows
   *
   * Filter structure:
   * 1. Drop shadows (rendered behind, knocked out under text)
   * 2. Fill layer (with adjustable opacity via feComponentTransfer)
   * 3. Inner shadows (rendered on top, clipped to text shape)
   *
   * @param innerShadows - Inner shadow effect configurations
   * @param dropShadows - Drop shadow effect configurations
   * @param textColor - Text color for resolving 'currentColor'
   * @param fillOpacity - Fill opacity (0-1), default 1
   * @param scale - Stage scale factor for zoom compensation (default 1)
   * @returns Filter ID to use with ctx.filter
   */
  createCombinedFilter(
    innerShadows: InnerShadowConfig[],
    dropShadows: DropShadowConfig[],
    textColor: string,
    fillOpacity: number = 1,
    scale: number = 1
  ): string {
    this.ensureContainer()

    if (!this.svgDefs) {
      console.warn('SVGFilterManager: SVG defs container not found')
      return ''
    }

    const filterId = this.generateFilterId()

    // Convert configs to internal format with scale compensation
    const innerConfigs = this.convertToShadowConfig(innerShadows, textColor, scale)
    const dropConfigs = this.convertToShadowConfig(dropShadows, textColor, scale)
    const allShadows = [...innerConfigs, ...dropConfigs]

    // Calculate filter region
    const filterRegion = allShadows.length > 0 ? this.calculateFilterRegion(allShadows) : 0.5

    const filter = this.createFilterElement(filterId, filterRegion)
    const parts: string[] = []

    // Build drop shadows
    dropConfigs.forEach((shadow, index) => {
      parts.push(this.buildDropShadowPrimitive(shadow, `drop${index}`))
    })

    // Build fill layer with independent opacity control
    parts.push(this.buildFillLayerPrimitive(fillOpacity))

    // Build inner shadows
    innerConfigs.forEach((shadow, index) => {
      parts.push(this.buildInnerShadowPrimitive(shadow, `inner${index}`))
    })

    // Build final merge
    parts.push(this.buildMergePrimitive(dropConfigs.length, innerConfigs.length))

    console.log('parts', parts.join('\n'))

    filter.innerHTML = parts.join('\n')

    console.log('filter', filter)
    this.svgDefs.appendChild(filter)
    this.activeFilters.set(filterId, filter)

    return filterId
  }

  /**
   * Remove a specific filter by ID
   */
  removeFilter(filterId: string): void {
    const filter = this.activeFilters.get(filterId)
    if (filter) {
      filter.remove()
      this.activeFilters.delete(filterId)
    }
  }

  /**
   * Clear all filters
   */
  clearAll(): void {
    if (this.svgDefs) {
      this.svgDefs.innerHTML = ''
    }
    this.activeFilters.clear()
    this.filterCounter = 0
  }

  /**
   * Get count of active filters
   */
  getActiveFilterCount(): number {
    return this.activeFilters.size
  }

  /**
   * Check if a filter exists
   */
  hasFilter(filterId: string): boolean {
    return this.activeFilters.has(filterId)
  }

  /**
   * Destroy the manager instance (for cleanup)
   */
  static destroy(): void {
    if (SVGFilterManager.instance) {
      SVGFilterManager.instance.clearAll()
      const container = document.getElementById(FILTER_CONTAINER_ID)
      if (container) {
        container.remove()
      }
      SVGFilterManager.instance = null
    }
  }
}

// Export singleton getter for convenience
export const getSVGFilterManager = (): SVGFilterManager => SVGFilterManager.getInstance()
