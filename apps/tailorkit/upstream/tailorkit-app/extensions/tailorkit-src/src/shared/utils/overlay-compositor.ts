/* eslint-disable max-lines, operator-linebreak */
/**
 * Overlay Compositor Utility
 * Composites a raster image with SVG overlay from VectorEditor
 * Applies clip paths, color filters, hole masks, and overlay paths
 *
 * This is a framework-agnostic utility that can be used in:
 * - Main app (React)
 * - Extensions (Preact)
 * - Server-side rendering
 * - Web workers
 */

import { loadImage } from '../libraries/paint/paint-image-loader'

// Self-contained types (no external dependencies)
export interface OverlayMetadata {
  /** Original image width */
  imageWidth: number
  /** Original image height */
  imageHeight: number
  /** Whether overlay contains clip paths */
  hasClipPaths: boolean
  /** Whether overlay contains color filters */
  hasFilters: boolean
  /** Whether overlay contains drawn paths */
  hasDrawnPaths: boolean
  /** Whether overlay contains hole masks */
  hasHoles?: boolean
  /** Whether overlay contains adjustment masks */
  hasAdjustmentMasks?: boolean
}

export interface OverlayData {
  /** Combined SVG string for rendering (contains clipPath, mask, filter, paths) */
  combinedSvg: string
  /** Metadata about the overlay */
  metadata: OverlayMetadata
}

export interface OverlayCompositorOptions {
  /** The raster image URL to apply overlay to */
  imageUrl: string
  /** The overlay data (use combinedSvg for rendering) */
  overlay: OverlayData
  /** Target width for the output (defaults to image natural width) */
  targetWidth?: number
  /** Target height for the output (defaults to image natural height) */
  targetHeight?: number
  /** Device pixel ratio for high-DPI rendering (defaults to 1) */
  devicePixelRatio?: number
}

export interface CompositorResult {
  /** The composited image as a data URL */
  dataUrl: string
  /** The composited image as an HTMLImageElement */
  image: HTMLImageElement
  /** The width of the composited image */
  width: number
  /** The height of the composited image */
  height: number
}

interface AdjustmentMaskDef {
  mask: SVGMaskElement
  filter: SVGFilterElement | null
}

/**
 * Parsed filter definition with preset information
 */
interface ParsedPathFilter {
  filterId: string
  cssFilter: string | null
  presetId: string | null
  presetParams: Record<string, number | string> | null
  /** The actual SVG filter element for native rendering */
  filterElement: SVGFilterElement | null
}

interface ParsedSvgOverlay {
  svgElement: SVGSVGElement | null
  clipPath: SVGClipPathElement | null
  mask: SVGMaskElement | null
  filter: SVGFilterElement | null
  overlayPaths: SVGGElement | null
  adjustmentMasks: AdjustmentMaskDef[]
  /** Map of filter IDs to their CSS preview strings (for path filters) */
  pathFilterCssMap: Map<string, string>
  /** Map of filter IDs to their full parsed definitions (for leather techniques) */
  pathFilterMap: Map<string, ParsedPathFilter>
  /** Original SVG width from viewBox or width attribute */
  svgWidth: number
  /** Original SVG height from viewBox or height attribute */
  svgHeight: number
}

/**
 * Parse SVG string and extract defs (clipPaths, masks, filters)
 */
function parseSvgOverlay(svgString: string): ParsedSvgOverlay {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgElement = doc.querySelector('svg')

  if (!svgElement) {
    return {
      svgElement: null,
      clipPath: null,
      mask: null,
      filter: null,
      overlayPaths: null,
      adjustmentMasks: [],
      pathFilterCssMap: new Map(),
      pathFilterMap: new Map(),
      svgWidth: 0,
      svgHeight: 0,
    }
  }

  // Extract SVG dimensions from viewBox or width/height attributes
  let svgWidth = 0
  let svgHeight = 0
  const viewBox = svgElement.getAttribute('viewBox')
  if (viewBox) {
    const parts = viewBox.split(/\s+/)
    if (parts.length >= 4) {
      svgWidth = parseFloat(parts[2]) || 0
      svgHeight = parseFloat(parts[3]) || 0
    }
  }
  // Fallback to width/height attributes if viewBox not available
  if (svgWidth === 0) {
    svgWidth = parseFloat(svgElement.getAttribute('width') || '0') || 0
  }
  if (svgHeight === 0) {
    svgHeight = parseFloat(svgElement.getAttribute('height') || '0') || 0
  }

  // Parse adjustment masks (overlay-adjustment-mask-0, overlay-adjustment-mask-1, etc.)
  const adjustmentMasks: AdjustmentMaskDef[] = []
  let maskIndex = 0
  while (true) {
    const mask = svgElement.querySelector(`mask#overlay-adjustment-mask-${maskIndex}`) as SVGMaskElement | null
    if (!mask) break
    const filter = svgElement.querySelector(`filter#overlay-adjustment-filter-${maskIndex}`) as SVGFilterElement | null
    adjustmentMasks.push({ mask, filter })
    maskIndex++
  }

  // Parse all filter definitions and extract CSS previews and full definitions for path filters
  // CSS previews are used for non-leather techniques (CSS filter transform)
  // Full definitions are used for leather techniques (solid color fill replacement)
  const pathFilterCssMap = new Map<string, string>()
  const pathFilterMap = new Map<string, ParsedPathFilter>()
  const allFilters = svgElement.querySelectorAll('filter')
  allFilters.forEach(filterEl => {
    const filterId = filterEl.getAttribute('id')
    if (!filterId) return

    const cssFilter = filterEl.getAttribute('data-css-filter')
    const presetId = filterEl.getAttribute('data-preset-id')

    // Add to CSS map for backwards compatibility
    if (cssFilter) {
      pathFilterCssMap.set(filterId, cssFilter)
    }

    // Parse preset params from data attribute if present
    // Note: params may be HTML-escaped (quotes as &quot;) from serialization
    let presetParams: Record<string, number | string> | null = null
    const paramsAttr = filterEl.getAttribute('data-preset-params')
    if (paramsAttr) {
      try {
        // Unescape HTML entities before parsing
        const unescaped = paramsAttr.replace(/&quot;/g, '"').replace(/&amp;/g, '&')
        presetParams = JSON.parse(unescaped)
      } catch {
        // Ignore parse errors
      }
    }

    // Add to full filter map with all metadata
    pathFilterMap.set(filterId, {
      filterId,
      cssFilter,
      presetId,
      presetParams,
      filterElement: filterEl,
    })
  })

  return {
    svgElement,
    clipPath: svgElement.querySelector('clipPath#overlay-clip'),
    mask: svgElement.querySelector('mask#overlay-mask'),
    filter: svgElement.querySelector('filter#overlay-filter'),
    overlayPaths: svgElement.querySelector('g#overlay-paths'),
    adjustmentMasks,
    pathFilterCssMap,
    pathFilterMap,
    svgWidth,
    svgHeight,
  }
}

/**
 * Create a canvas with the specified dimensions
 */
function createCanvas(
  width: number,
  height: number,
  dpr = 1
): {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
} {
  const canvas = document.createElement('canvas')
  canvas.width = width * dpr
  canvas.height = height * dpr

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas 2D context')
  }

  // Scale for high-DPI
  if (dpr !== 1) {
    ctx.scale(dpr, dpr)
  }

  return { canvas, ctx }
}

/**
 * Apply clip path to canvas context using SVG path data
 * @param scaleX - Scale factor for X coordinates
 * @param scaleY - Scale factor for Y coordinates
 */
function applyClipPath(
  ctx: CanvasRenderingContext2D,
  clipPath: SVGClipPathElement,
  scaleX: number,
  scaleY: number
): void {
  const paths = clipPath.querySelectorAll('path')
  if (paths.length === 0) return

  ctx.save()

  // Create a combined path for clipping
  paths.forEach(pathEl => {
    const d = pathEl.getAttribute('d')
    if (d) {
      // Create a scaled path using DOMMatrix transform
      const path2D = new Path2D(d)
      const scaledPath = new Path2D()
      const matrix = new DOMMatrix().scale(scaleX, scaleY)
      scaledPath.addPath(path2D, matrix)
      ctx.clip(scaledPath, 'evenodd')
    }
  })
}

// =============================================================================
// Filter Primitive Implementations
// =============================================================================

/**
 * Apply feColorMatrix to ImageData
 */
function applyFeColorMatrix(imageData: ImageData, element: Element): void {
  const matrixType = element.getAttribute('type') || 'matrix'
  let values: number[] = []

  if (matrixType === 'matrix') {
    const valuesAttr = element.getAttribute('values')
    if (!valuesAttr) return
    values = valuesAttr.trim().split(/\s+/).map(Number)
    if (values.length !== 20) return
  } else if (matrixType === 'saturate') {
    const s = parseFloat(element.getAttribute('values') || '1')
    const lumR = 0.2126,
      lumG = 0.7152,
      lumB = 0.0722
    values = [
      lumR * (1 - s) + s,
      lumG * (1 - s),
      lumB * (1 - s),
      0,
      0,
      lumR * (1 - s),
      lumG * (1 - s) + s,
      lumB * (1 - s),
      0,
      0,
      lumR * (1 - s),
      lumG * (1 - s),
      lumB * (1 - s) + s,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
    ]
  } else {
    return // hueRotate, luminanceToAlpha not implemented yet
  }

  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2],
      a = data[i + 3]
    data[i] = Math.max(
      0,
      Math.min(255, values[0] * r + values[1] * g + values[2] * b + values[3] * a + values[4] * 255)
    )
    data[i + 1] = Math.max(
      0,
      Math.min(255, values[5] * r + values[6] * g + values[7] * b + values[8] * a + values[9] * 255)
    )
    data[i + 2] = Math.max(
      0,
      Math.min(255, values[10] * r + values[11] * g + values[12] * b + values[13] * a + values[14] * 255)
    )
    data[i + 3] = Math.max(
      0,
      Math.min(255, values[15] * r + values[16] * g + values[17] * b + values[18] * a + values[19] * 255)
    )
  }
}

/**
 * Apply feComponentTransfer to ImageData (discrete, table, linear, gamma)
 */
function applyFeComponentTransfer(imageData: ImageData, element: Element): void {
  const data = imageData.data

  // Parse transfer function for a channel
  const parseFunc = (funcEl: Element | null): ((v: number) => number) | null => {
    if (!funcEl) return null
    const type = funcEl.getAttribute('type')
    if (!type) return null

    if (type === 'discrete' || type === 'table') {
      const tableValuesAttr = funcEl.getAttribute('tableValues')
      if (!tableValuesAttr) return null
      const tableValues = tableValuesAttr.trim().split(/\s+/).map(Number)
      if (tableValues.length === 0) return null

      if (type === 'discrete') {
        // Discrete: divide input into n equal intervals, output corresponding table value
        return (v: number) => {
          const n = tableValues.length
          const k = Math.min(Math.floor(v * n), n - 1)
          return tableValues[k]
        }
      }
      // Table: linear interpolation between table values
      return (v: number) => {
        const n = tableValues.length - 1
        const k = Math.floor(v * n)
        const f = v * n - k
        if (k >= n) return tableValues[n]
        return tableValues[k] * (1 - f) + tableValues[k + 1] * f
      }
    }
    if (type === 'linear') {
      const slope = parseFloat(funcEl.getAttribute('slope') || '1')
      const intercept = parseFloat(funcEl.getAttribute('intercept') || '0')
      return (v: number) => Math.max(0, Math.min(1, slope * v + intercept))
    }
    if (type === 'gamma') {
      const amplitude = parseFloat(funcEl.getAttribute('amplitude') || '1')
      const exponent = parseFloat(funcEl.getAttribute('exponent') || '1')
      const offset = parseFloat(funcEl.getAttribute('offset') || '0')
      return (v: number) => Math.max(0, Math.min(1, amplitude * Math.pow(v, exponent) + offset))
    }
    if (type === 'identity') {
      return (v: number) => v
    }
    return null
  }

  const funcR = parseFunc(element.querySelector('feFuncR'))
  const funcG = parseFunc(element.querySelector('feFuncG'))
  const funcB = parseFunc(element.querySelector('feFuncB'))
  const funcA = parseFunc(element.querySelector('feFuncA'))

  for (let i = 0; i < data.length; i += 4) {
    if (funcR) data[i] = Math.round(funcR(data[i] / 255) * 255)
    if (funcG) data[i + 1] = Math.round(funcG(data[i + 1] / 255) * 255)
    if (funcB) data[i + 2] = Math.round(funcB(data[i + 2] / 255) * 255)
    if (funcA) data[i + 3] = Math.round(funcA(data[i + 3] / 255) * 255)
  }
}

/**
 * Apply feConvolveMatrix to ImageData (edge detection, sharpening, blur kernels)
 */
function applyFeConvolveMatrix(imageData: ImageData, element: Element, width: number, height: number): ImageData {
  const orderAttr = element.getAttribute('order') || '3'
  const orderParts = orderAttr.trim().split(/\s+/).map(Number)
  const orderX = orderParts[0] || 3
  const orderY = orderParts[1] || orderX

  const kernelMatrixAttr = element.getAttribute('kernelMatrix')
  if (!kernelMatrixAttr) return imageData
  const kernel = kernelMatrixAttr.trim().split(/\s+/).map(Number)
  if (kernel.length !== orderX * orderY) return imageData

  const divisor = parseFloat(element.getAttribute('divisor') || String(kernel.reduce((a, b) => a + b, 0) || 1))
  const bias = parseFloat(element.getAttribute('bias') || '0') * 255
  const targetX = parseInt(element.getAttribute('targetX') || String(Math.floor(orderX / 2)), 10)
  const targetY = parseInt(element.getAttribute('targetY') || String(Math.floor(orderY / 2)), 10)
  const edgeMode = element.getAttribute('edgeMode') || 'duplicate'
  const preserveAlpha = element.getAttribute('preserveAlpha') === 'true'

  const srcData = imageData.data
  const output = new ImageData(width, height)
  const dstData = output.data

  // Helper to get pixel with edge handling
  const getPixel = (x: number, y: number, c: number): number => {
    if (edgeMode === 'duplicate') {
      x = Math.max(0, Math.min(width - 1, x))
      y = Math.max(0, Math.min(height - 1, y))
    } else if (edgeMode === 'wrap') {
      x = ((x % width) + width) % width
      y = ((y % height) + height) % height
    } else {
      // 'none' - treat outside as 0
      if (x < 0 || x >= width || y < 0 || y >= height) return 0
    }
    return srcData[(y * width + x) * 4 + c]
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      for (let c = 0; c < (preserveAlpha ? 3 : 4); c++) {
        let sum = 0
        for (let ky = 0; ky < orderY; ky++) {
          for (let kx = 0; kx < orderX; kx++) {
            const px = x + kx - targetX
            const py = y + ky - targetY
            sum += getPixel(px, py, c) * kernel[ky * orderX + kx]
          }
        }
        dstData[idx + c] = Math.max(0, Math.min(255, sum / divisor + bias))
      }
      if (preserveAlpha) {
        dstData[idx + 3] = srcData[idx + 3]
      }
    }
  }

  return output
}

/**
 * Generate feTurbulence noise (Perlin/fractal noise)
 */
function generateFeTurbulence(element: Element, width: number, height: number): ImageData {
  const turbulenceType = element.getAttribute('type') || 'turbulence'
  const baseFreqAttr = element.getAttribute('baseFrequency') || '0.05'
  const baseFreqParts = baseFreqAttr.trim().split(/\s+/).map(Number)
  const freqX = baseFreqParts[0] || 0.05
  const freqY = baseFreqParts[1] || freqX
  const numOctaves = parseInt(element.getAttribute('numOctaves') || '1', 10)
  const seed = parseInt(element.getAttribute('seed') || '0', 10)

  const output = new ImageData(width, height)
  const data = output.data

  // Simple pseudo-random noise based on coordinates and seed
  const noise = (x: number, y: number, s: number): number => {
    const n = Math.sin(x * 12.9898 + y * 78.233 + s) * 43758.5453
    return n - Math.floor(n)
  }

  // Interpolated noise
  const smoothNoise = (x: number, y: number, s: number): number => {
    const x0 = Math.floor(x),
      y0 = Math.floor(y)
    const fx = x - x0,
      fy = y - y0
    const n00 = noise(x0, y0, s),
      n10 = noise(x0 + 1, y0, s)
    const n01 = noise(x0, y0 + 1, s),
      n11 = noise(x0 + 1, y0 + 1, s)
    const nx0 = n00 * (1 - fx) + n10 * fx
    const nx1 = n01 * (1 - fx) + n11 * fx
    return nx0 * (1 - fy) + nx1 * fy
  }

  // Fractal noise with octaves
  const fractalNoise = (x: number, y: number, s: number): number => {
    let value = 0,
      amplitude = 1,
      frequency = 1,
      maxValue = 0
    for (let i = 0; i < numOctaves; i++) {
      value += smoothNoise(x * frequency, y * frequency, s + i * 100) * amplitude
      maxValue += amplitude
      amplitude *= 0.5
      frequency *= 2
    }
    return value / maxValue
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      // Generate noise for each channel with different seeds
      for (let c = 0; c < 4; c++) {
        let n = fractalNoise(x * freqX, y * freqY, seed + c * 1000)
        if (turbulenceType === 'turbulence') {
          n = Math.abs(n * 2 - 1) // Turbulence: absolute value
        }
        data[idx + c] = Math.round(n * 255)
      }
    }
  }

  return output
}

/**
 * Apply feComposite to combine two ImageData buffers using Porter-Duff operators
 */
function applyFeComposite(
  input1: ImageData,
  input2: ImageData,
  operator: string,
  k1 = 0,
  k2 = 0,
  k3 = 0,
  k4 = 0
): ImageData {
  const output = new ImageData(input1.width, input1.height)
  const d1 = input1.data,
    d2 = input2.data,
    dOut = output.data

  for (let i = 0; i < d1.length; i += 4) {
    const r1 = d1[i],
      g1 = d1[i + 1],
      b1 = d1[i + 2],
      a1 = d1[i + 3] / 255
    const r2 = d2[i],
      g2 = d2[i + 1],
      b2 = d2[i + 2],
      a2 = d2[i + 3] / 255

    let rOut = 0,
      gOut = 0,
      bOut = 0,
      aOut = 0

    switch (operator) {
      case 'over':
        // Standard alpha compositing: result = in1 over in2
        aOut = a1 + a2 * (1 - a1)
        if (aOut > 0) {
          rOut = (r1 * a1 + r2 * a2 * (1 - a1)) / aOut
          gOut = (g1 * a1 + g2 * a2 * (1 - a1)) / aOut
          bOut = (b1 * a1 + b2 * a2 * (1 - a1)) / aOut
        }
        break

      case 'in':
        // Result is in1 masked by in2's alpha: only shows in1 where in2 has alpha
        aOut = a1 * a2
        rOut = r1
        gOut = g1
        bOut = b1
        break

      case 'out':
        // Result is in1 where in2 has no alpha: shows in1 only outside in2
        aOut = a1 * (1 - a2)
        rOut = r1
        gOut = g1
        bOut = b1
        break

      case 'atop':
        // Result is in1 over in2, clipped to in2's shape
        aOut = a2
        if (aOut > 0) {
          rOut = r1 * a1 + r2 * (1 - a1)
          gOut = g1 * a1 + g2 * (1 - a1)
          bOut = b1 * a1 + b2 * (1 - a1)
        }
        break

      case 'xor':
        // Result is in1 xor in2: shows either but not both
        aOut = a1 * (1 - a2) + a2 * (1 - a1)
        if (aOut > 0) {
          rOut = (r1 * a1 * (1 - a2) + r2 * a2 * (1 - a1)) / aOut
          gOut = (g1 * a1 * (1 - a2) + g2 * a2 * (1 - a1)) / aOut
          bOut = (b1 * a1 * (1 - a2) + b2 * a2 * (1 - a1)) / aOut
        }
        break

      case 'arithmetic':
        // Result = k1*in1*in2 + k2*in1 + k3*in2 + k4
        rOut = Math.max(0, Math.min(255, (k1 * r1 * r2) / 255 + k2 * r1 + k3 * r2 + k4 * 255))
        gOut = Math.max(0, Math.min(255, (k1 * g1 * g2) / 255 + k2 * g1 + k3 * g2 + k4 * 255))
        bOut = Math.max(0, Math.min(255, (k1 * b1 * b2) / 255 + k2 * b1 + k3 * b2 + k4 * 255))
        aOut = Math.max(0, Math.min(1, k1 * a1 * a2 + k2 * a1 + k3 * a2 + k4))
        break

      default: // 'over' as default
        aOut = a1 + a2 * (1 - a1)
        if (aOut > 0) {
          rOut = (r1 * a1 + r2 * a2 * (1 - a1)) / aOut
          gOut = (g1 * a1 + g2 * a2 * (1 - a1)) / aOut
          bOut = (b1 * a1 + b2 * a2 * (1 - a1)) / aOut
        }
    }

    dOut[i] = Math.round(rOut)
    dOut[i + 1] = Math.round(gOut)
    dOut[i + 2] = Math.round(bOut)
    dOut[i + 3] = Math.round(aOut * 255)
  }

  return output
}

/**
 * Apply feBlend to combine two ImageData buffers
 */
function applyFeBlend(input1: ImageData, input2: ImageData, mode: string): ImageData {
  const output = new ImageData(input1.width, input1.height)
  const d1 = input1.data,
    d2 = input2.data,
    dOut = output.data

  for (let i = 0; i < d1.length; i += 4) {
    const r1 = d1[i] / 255,
      g1 = d1[i + 1] / 255,
      b1 = d1[i + 2] / 255,
      a1 = d1[i + 3] / 255
    const r2 = d2[i] / 255,
      g2 = d2[i + 1] / 255,
      b2 = d2[i + 2] / 255,
      a2 = d2[i + 3] / 255

    let r = 0
    let g = 0
    let b = 0
    switch (mode) {
      case 'multiply':
        r = r1 * r2
        g = g1 * g2
        b = b1 * b2
        break
      case 'screen':
        r = 1 - (1 - r1) * (1 - r2)
        g = 1 - (1 - g1) * (1 - g2)
        b = 1 - (1 - b1) * (1 - b2)
        break
      case 'darken':
        r = Math.min(r1, r2)
        g = Math.min(g1, g2)
        b = Math.min(b1, b2)
        break
      case 'lighten':
        r = Math.max(r1, r2)
        g = Math.max(g1, g2)
        b = Math.max(b1, b2)
        break
      case 'overlay':
        r = r1 < 0.5 ? 2 * r1 * r2 : 1 - 2 * (1 - r1) * (1 - r2)
        g = g1 < 0.5 ? 2 * g1 * g2 : 1 - 2 * (1 - g1) * (1 - g2)
        b = b1 < 0.5 ? 2 * b1 * b2 : 1 - 2 * (1 - b1) * (1 - b2)
        break
      case 'soft-light':
        r = r2 < 0.5 ? r1 - (1 - 2 * r2) * r1 * (1 - r1) : r1 + (2 * r2 - 1) * (Math.sqrt(r1) - r1)
        g = g2 < 0.5 ? g1 - (1 - 2 * g2) * g1 * (1 - g1) : g1 + (2 * g2 - 1) * (Math.sqrt(g1) - g1)
        b = b2 < 0.5 ? b1 - (1 - 2 * b2) * b1 * (1 - b1) : b1 + (2 * b2 - 1) * (Math.sqrt(b1) - b1)
        break
      default: // 'normal'
        r = r2
        g = g2
        b = b2
    }

    // Simple alpha compositing
    const a = a1 + a2 * (1 - a1)
    dOut[i] = Math.round(r * 255)
    dOut[i + 1] = Math.round(g * 255)
    dOut[i + 2] = Math.round(b * 255)
    dOut[i + 3] = Math.round(a * 255)
  }

  return output
}

/**
 * Apply SVG filter to canvas using filter primitive chain
 * Supports: feColorMatrix, feComponentTransfer, feConvolveMatrix, feTurbulence, feBlend, feComposite
 */
function applyColorFilter(
  ctx: CanvasRenderingContext2D,
  filter: SVGFilterElement,
  width: number,
  height: number
): void {
  // Get all filter primitives in order
  const primitives = Array.from(filter.children).filter(el => el.tagName.startsWith('fe'))

  if (primitives.length === 0) return

  // Buffer storage for filter chain (named results)
  const buffers = new Map<string, ImageData>()
  buffers.set('SourceGraphic', ctx.getImageData(0, 0, width, height))
  buffers.set('SourceAlpha', ctx.getImageData(0, 0, width, height)) // Simplified

  let lastOutput: ImageData = buffers.get('SourceGraphic')!

  for (const primitive of primitives) {
    const inAttr = primitive.getAttribute('in') || 'SourceGraphic'
    const resultAttr = primitive.getAttribute('result')

    // Get input buffer
    let input = buffers.get(inAttr) || lastOutput
    // Clone input to avoid mutating cached buffers
    input = new ImageData(new Uint8ClampedArray(input.data), input.width, input.height)

    let output: ImageData = input

    switch (primitive.tagName) {
      case 'feColorMatrix':
        applyFeColorMatrix(input, primitive)
        output = input
        break

      case 'feComponentTransfer':
        applyFeComponentTransfer(input, primitive)
        output = input
        break

      case 'feConvolveMatrix':
        output = applyFeConvolveMatrix(input, primitive, width, height)
        break

      case 'feTurbulence':
        output = generateFeTurbulence(primitive, width, height)
        break

      case 'feBlend': {
        const in2Attr = primitive.getAttribute('in2')
        const mode = primitive.getAttribute('mode') || 'normal'
        const input2 = buffers.get(in2Attr || '') || input
        output = applyFeBlend(input, input2, mode)
        break
      }

      case 'feComposite': {
        const in2Attr = primitive.getAttribute('in2')
        const operator = primitive.getAttribute('operator') || 'over'
        const input2 = buffers.get(in2Attr || '') || buffers.get('SourceGraphic')!
        const k1 = parseFloat(primitive.getAttribute('k1') || '0')
        const k2 = parseFloat(primitive.getAttribute('k2') || '0')
        const k3 = parseFloat(primitive.getAttribute('k3') || '0')
        const k4 = parseFloat(primitive.getAttribute('k4') || '0')
        output = applyFeComposite(input, input2, operator, k1, k2, k3, k4)
        break
      }

      case 'feGaussianBlur':
        // Simple box blur approximation (proper Gaussian would need more code)
        // For now, skip as it's not used by our presets
        output = input
        break

      default:
        // Unsupported primitive - pass through
        output = input
    }

    // Store result
    if (resultAttr) {
      buffers.set(resultAttr, output)
    }
    lastOutput = output
  }

  // Write final result to canvas
  ctx.putImageData(lastOutput, 0, 0)
}

/**
 * Helper to check if a fill color is white-like
 */
function isWhiteFill(fill: string | null): boolean {
  if (!fill) return false
  const lower = fill.toLowerCase().trim()
  return lower === 'white' || lower === '#fff' || lower === '#ffffff' || lower === 'rgb(255, 255, 255)'
}

/**
 * Helper to check if a fill color is black-like
 */
function isBlackFill(fill: string | null): boolean {
  if (!fill) return false
  const lower = fill.toLowerCase().trim()
  return lower === 'black' || lower === '#000' || lower === '#000000' || lower === 'rgb(0, 0, 0)'
}

/**
 * Apply hole mask to canvas (makes masked areas transparent)
 * Uses alpha channel: white areas (alpha=1) are visible, holes have alpha=0
 * @param svgWidth - Original SVG/image width (for coordinate scaling)
 * @param svgHeight - Original SVG/image height (for coordinate scaling)
 */
function applyHoleMask(
  ctx: CanvasRenderingContext2D,
  mask: SVGMaskElement,
  width: number,
  height: number,
  svgWidth: number,
  svgHeight: number
): void {
  // Get all black paths (holes) from the mask
  const allPaths = mask.querySelectorAll('path')
  const holePaths = Array.from(allPaths).filter(p => isBlackFill(p.getAttribute('fill')))
  if (holePaths.length === 0) return

  // Calculate scale factors to transform SVG coordinates to canvas coordinates
  const scaleX = width / svgWidth
  const scaleY = height / svgHeight

  // Create a mask canvas with proper alpha values
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = Math.ceil(width)
  maskCanvas.height = Math.ceil(height)
  const maskCtx = maskCanvas.getContext('2d')
  if (!maskCtx) return

  // Fill with opaque white (alpha=1, visible areas)
  maskCtx.fillStyle = 'rgba(255, 255, 255, 1)'
  maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)

  // Cut out holes using destination-out (makes hole areas transparent, alpha=0)
  // Use DOMMatrix for consistent scaling with clip path approach
  maskCtx.globalCompositeOperation = 'destination-out'
  maskCtx.fillStyle = 'rgba(0, 0, 0, 1)' // Ensure fully opaque fill for complete hole punch
  holePaths.forEach(pathEl => {
    const d = pathEl.getAttribute('d')
    if (d) {
      const path2D = new Path2D(d)
      const scaledPath = new Path2D()
      const matrix = new DOMMatrix().scale(scaleX, scaleY)
      scaledPath.addPath(path2D, matrix)
      maskCtx.fill(scaledPath)
    }
  })
  maskCtx.globalCompositeOperation = 'source-over'

  // Apply mask using destination-in (keeps destination only where mask has alpha > 0)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(maskCanvas, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
}

/**
 * Apply adjustment mask to canvas
 * Renders the base image with filter applied, masked to the adjustment mask area
 * @param svgWidth - Original SVG/image width (for coordinate scaling)
 * @param svgHeight - Original SVG/image height (for coordinate scaling)
 */
function applyAdjustmentMask(
  ctx: CanvasRenderingContext2D,
  baseImage: HTMLImageElement,
  adjustmentMask: AdjustmentMaskDef,
  width: number,
  height: number,
  svgWidth: number,
  svgHeight: number
): void {
  const { mask, filter } = adjustmentMask

  // Get all paths from mask and categorize by fill color
  const allPaths = mask.querySelectorAll('path')
  const whitePaths = Array.from(allPaths).filter(p => isWhiteFill(p.getAttribute('fill')))
  const blackPaths = Array.from(allPaths).filter(p => isBlackFill(p.getAttribute('fill')))

  if (whitePaths.length === 0) return

  // Calculate scale factors to transform SVG coordinates to canvas coordinates
  const scaleX = width / svgWidth
  const scaleY = height / svgHeight
  const scaleMatrix = new DOMMatrix().scale(scaleX, scaleY)

  // Create a temporary canvas for the masked adjustment
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = Math.ceil(width)
  tempCanvas.height = Math.ceil(height)
  const tempCtx = tempCanvas.getContext('2d')
  if (!tempCtx) return

  // Draw the base image on temp canvas with CSS filter if available
  const cssFilter = filter?.getAttribute('data-css-filter')
  if (cssFilter) {
    // Use CSS filter for efficient rendering
    tempCtx.filter = cssFilter
    tempCtx.drawImage(baseImage, 0, 0, tempCanvas.width, tempCanvas.height)
    tempCtx.filter = 'none'
  } else {
    tempCtx.drawImage(baseImage, 0, 0, tempCanvas.width, tempCanvas.height)
    // Apply SVG color filter if present
    if (filter) {
      applyColorFilter(tempCtx, filter, tempCanvas.width, tempCanvas.height)
    }
  }

  // Create the mask canvas
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = Math.ceil(width)
  maskCanvas.height = Math.ceil(height)
  const maskCtx = maskCanvas.getContext('2d')
  if (!maskCtx) return

  // Fill white paths (visible area) using DOMMatrix for consistent scaling
  maskCtx.fillStyle = 'rgba(255, 255, 255, 1)'
  whitePaths.forEach(pathEl => {
    const d = pathEl.getAttribute('d')
    if (d) {
      const path2D = new Path2D(d)
      const scaledPath = new Path2D()
      scaledPath.addPath(path2D, scaleMatrix)
      maskCtx.fill(scaledPath)
    }
  })

  // Cut out black paths (holes) using destination-out
  if (blackPaths.length > 0) {
    maskCtx.globalCompositeOperation = 'destination-out'
    maskCtx.fillStyle = 'rgba(0, 0, 0, 1)'
    blackPaths.forEach(pathEl => {
      const d = pathEl.getAttribute('d')
      if (d) {
        const path2D = new Path2D(d)
        const scaledPath = new Path2D()
        scaledPath.addPath(path2D, scaleMatrix)
        maskCtx.fill(scaledPath)
      }
    })
    maskCtx.globalCompositeOperation = 'source-over'
  }

  // Apply the mask to the filtered image using destination-in
  tempCtx.globalCompositeOperation = 'destination-in'
  tempCtx.drawImage(maskCanvas, 0, 0)
  tempCtx.globalCompositeOperation = 'source-over'

  // Composite the masked result onto the main canvas
  ctx.drawImage(tempCanvas, 0, 0)
}

/**
 * Map CSS mix-blend-mode values to canvas globalCompositeOperation
 */
const BLEND_MODE_MAP: Record<string, GlobalCompositeOperation> = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
  'hard-light': 'hard-light',
  'soft-light': 'soft-light',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
}

/**
 * Extract mix-blend-mode from SVG element's style attribute
 */
function getBlendMode(element: SVGElement): GlobalCompositeOperation {
  const style = element.getAttribute('style') || ''
  const match = style.match(/mix-blend-mode:\s*([^;]+)/)
  if (match) {
    const mode = match[1].trim()
    return BLEND_MODE_MAP[mode] || 'source-over'
  }
  return 'source-over'
}

/**
 * Extract filter ID from filter="url(#filterId)" attribute
 */
function extractFilterId(filterAttr: string | null): string | null {
  if (!filterAttr) return null
  const match = filterAttr.match(/url\(#([^)]+)\)/)
  return match ? match[1] : null
}

// =============================================================================
// Leather Technique Filter Rendering
// =============================================================================

/**
 * Leather technique preset IDs that require solid color fill rendering
 * These techniques use feFlood + feComposite to replace the original color entirely
 */
const LEATHER_TECHNIQUE_PRESETS = new Set(['debossing', 'embossing', 'hot-foil-stamping', 'laser-engraving'])

/**
 * Check if a preset ID is a leather technique that needs solid color rendering
 */
function isLeatherTechniquePreset(presetId: string | null): boolean {
  return presetId !== null && LEATHER_TECHNIQUE_PRESETS.has(presetId)
}

/**
 * Compute the solid fill color for leather technique path filters
 * These techniques replace the original path color with a technique-specific color
 *
 * Based on real-world reference analysis:
 * - Debossing: Dark pressed-in color based on light angle
 * - Embossing: Light raised color based on light angle
 * - Hot Foil Stamping: Metallic foil colors (gold, silver, rose gold, copper)
 * - Laser Engraving: Burnt brown color ranging from light brown to near-black
 */
function computeLeatherTechniqueFillColor(
  presetId: string,
  presetParams: Record<string, number | string> | undefined
): string | null {
  const params = presetParams || {}

  switch (presetId) {
    case 'laser-engraving': {
      // Laser Engraving: Burnt brown color based on burn intensity
      // Color progression: light brown (#9B6B3D) → dark brown (#5A3218) → near-black (#1A0A04)
      const burnIntensity = ((params.burnIntensity as number) ?? 40) / 100
      const r = Math.round(155 - burnIntensity * 129) // 155 -> 26
      const g = Math.round(107 - burnIntensity * 97) // 107 -> 10
      const b = Math.round(61 - burnIntensity * 57) // 61 -> 4
      return `rgb(${r}, ${g}, ${b})`
    }

    case 'debossing': {
      // Debossing: Dark pressed-in appearance
      // Uses a dark brown/shadow color to simulate pressed-in effect
      const depth = ((params.depth as number) ?? 40) / 100
      const darkness = 0.3 + depth * 0.4 // 0.3 to 0.7 darkness
      const r = Math.round(80 * (1 - darkness))
      const g = Math.round(60 * (1 - darkness))
      const b = Math.round(40 * (1 - darkness))
      return `rgb(${r}, ${g}, ${b})`
    }

    case 'embossing': {
      // Embossing: Light raised appearance
      // Uses a light color to simulate raised/highlighted effect
      const depth = ((params.depth as number) ?? 40) / 100
      const lightness = 0.6 + depth * 0.3 // 0.6 to 0.9 lightness
      const base = Math.round(180 * lightness)
      return `rgb(${base}, ${base - 10}, ${base - 20})`
    }

    case 'hot-foil-stamping': {
      // Hot Foil Stamping: Metallic foil colors
      const foilColor = (params.foilColor as number) ?? 0
      const foilColors: Record<number, string> = {
        0: 'rgb(212, 175, 55)', // Gold
        1: 'rgb(192, 192, 192)', // Silver
        2: 'rgb(183, 110, 121)', // Rose Gold
        3: 'rgb(184, 115, 51)', // Copper
      }
      return foilColors[foilColor] || foilColors[0]
    }

    default:
      return null
  }
}

/**
 * Depth effect configuration for Canvas 2D rendering
 * Used to simulate SVG filter depth effects with shadows
 */
interface DepthEffectConfig {
  /** Outer shadow (cast onto surrounding area) */
  outerShadow: {
    offsetX: number
    offsetY: number
    blur: number
    color: string
    opacity: number
  } | null
  /** Inner shadow (inside the shape) */
  innerShadow: {
    offsetX: number
    offsetY: number
    blur: number
    color: string
    opacity: number
  } | null
  /** Rim highlight (light edge) */
  rimHighlight: {
    offsetX: number
    offsetY: number
    blur: number
    color: string
    opacity: number
  } | null
}

/**
 * Compute depth effect configuration for leather techniques
 * Creates shadow/highlight parameters for Canvas 2D rendering that approximate SVG filter effects
 */
function computeLeatherTechniqueDepthEffect(
  presetId: string,
  presetParams: Record<string, number | string> | undefined,
  scale: number
): DepthEffectConfig | null {
  const params = presetParams || {}

  // Light angle for shadow direction (315° = light from top-left)
  const lightAngle = 315
  const angleRad = (lightAngle * Math.PI) / 180

  switch (presetId) {
    case 'laser-engraving': {
      const depth = ((params.depth as number) ?? 1) * scale
      if (depth <= 0) return null

      return {
        outerShadow: {
          offsetX: -Math.cos(angleRad) * depth * 0.3,
          offsetY: Math.sin(angleRad) * depth * 0.3,
          blur: Math.max(depth * 0.5, 1.5),
          color: '#000000',
          opacity: 0.1 + depth * 0.015,
        },
        innerShadow: {
          offsetX: -Math.cos(angleRad) * depth * 0.6,
          offsetY: Math.sin(angleRad) * depth * 0.6,
          blur: Math.max(depth * 0.35, 0.8),
          color: '#000000',
          opacity: 0.25 + depth * 0.025,
        },
        rimHighlight: {
          offsetX: Math.cos(angleRad) * depth * 0.35,
          offsetY: -Math.sin(angleRad) * depth * 0.35,
          blur: Math.max(depth * 0.25, 0.6),
          color: '#ffffff',
          opacity: 0.15 + depth * 0.02,
        },
      }
    }

    case 'debossing': {
      const depth = ((params.depth as number) ?? 5) * scale
      const softness = ((params.softness as number) ?? 50) / 100
      if (depth <= 0) return null

      return {
        outerShadow: {
          offsetX: -Math.cos(angleRad) * depth * 0.3,
          offsetY: Math.sin(angleRad) * depth * 0.3,
          blur: Math.max(depth * 0.5 * (0.5 + softness * 0.5), 1.5),
          color: '#000000',
          opacity: 0.12 + depth * 0.015,
        },
        innerShadow: {
          offsetX: -Math.cos(angleRad) * depth * 0.7,
          offsetY: Math.sin(angleRad) * depth * 0.7,
          blur: Math.max(depth * 0.35 * (0.4 + softness * 0.6), 1.0),
          color: '#000000',
          opacity: 0.35 + depth * 0.03,
        },
        rimHighlight: {
          offsetX: Math.cos(angleRad) * depth * 0.4,
          offsetY: -Math.sin(angleRad) * depth * 0.4,
          blur: Math.max(depth * 0.3 * (0.3 + softness * 0.5), 0.8),
          color: '#ffffff',
          opacity: 0.25 + depth * 0.03 + softness * 0.1,
        },
      }
    }

    case 'embossing': {
      const depth = ((params.depth as number) ?? 5) * scale
      const softness = ((params.softness as number) ?? 50) / 100
      if (depth <= 0) return null

      // Embossing is raised, so shadows/highlights are inverted from debossing
      return {
        outerShadow: {
          offsetX: Math.cos(angleRad) * depth * 0.3,
          offsetY: -Math.sin(angleRad) * depth * 0.3,
          blur: Math.max(depth * 0.5 * (0.5 + softness * 0.5), 1.5),
          color: '#000000',
          opacity: 0.12 + depth * 0.015,
        },
        innerShadow: null, // Embossing uses highlight instead of inner shadow
        rimHighlight: {
          offsetX: -Math.cos(angleRad) * depth * 0.4,
          offsetY: Math.sin(angleRad) * depth * 0.4,
          blur: Math.max(depth * 0.3 * (0.3 + softness * 0.5), 0.8),
          color: '#ffffff',
          opacity: 0.3 + depth * 0.04 + softness * 0.1,
        },
      }
    }

    case 'hot-foil-stamping': {
      const depth = ((params.depth as number) ?? 3) * scale
      const softness = ((params.softness as number) ?? 40) / 100
      if (depth <= 0) return null

      return {
        outerShadow: {
          offsetX: -Math.cos(angleRad) * depth * 0.3,
          offsetY: Math.sin(angleRad) * depth * 0.3,
          blur: Math.max(depth * 0.5 * (0.5 + softness * 0.5), 1.5),
          color: '#000000',
          opacity: 0.12 + depth * 0.015,
        },
        innerShadow: {
          offsetX: -Math.cos(angleRad) * depth * 0.7,
          offsetY: Math.sin(angleRad) * depth * 0.7,
          blur: Math.max(depth * 0.35 * (0.4 + softness * 0.6), 1.0),
          color: '#000000',
          opacity: 0.25 + depth * 0.02,
        },
        rimHighlight: {
          offsetX: Math.cos(angleRad) * depth * 0.4,
          offsetY: -Math.sin(angleRad) * depth * 0.4,
          blur: Math.max(depth * 0.3 * (0.3 + softness * 0.5), 0.8),
          color: '#ffffff',
          opacity: 0.25 + depth * 0.03 + softness * 0.1,
        },
      }
    }

    default:
      return null
  }
}

/**
 * Parameters for rendering a path with SVG (supports both filtered and non-filtered paths)
 */
interface SvgPathRenderParams {
  pathData: string
  filterElement?: SVGFilterElement | null
  fill: string | null
  fillOpacity: number
  fillRule: string
  stroke: string | null
  strokeWidth: number
  strokeOpacity: number
  opacity: number
  scaleX: number
  scaleY: number
  canvasWidth: number
  canvasHeight: number
  /** Device pixel ratio for high-resolution rendering */
  devicePixelRatio?: number
  /** Blend mode for compositing */
  blendMode?: string
}

/**
 * Render a path using native SVG rendering for maximum quality
 * This produces identical output to browser SVG rendering by creating an inline SVG
 * and rasterizing it at high resolution (DPR-scaled).
 *
 * Works for:
 * - Paths with filter presets (leather techniques, jewelry techniques, etc.)
 * - Simple fill/stroke paths (for crisp vector rendering)
 *
 * For filter presets:
 * - Some technique filters handle opacity internally via feColorMatrix
 * - We must NOT apply fill-opacity for these, as it would double-apply opacity
 * - The filter's internal opacity calculation expects SourceGraphic alpha = 1.0
 *
 * For simple paths (no filter):
 * - Apply fill-opacity, stroke-opacity, and opacity normally
 * - This ensures the path matches the original SVG styling
 */
async function renderPathWithNativeSvg(ctx: CanvasRenderingContext2D, params: SvgPathRenderParams): Promise<void> {
  const {
    pathData,
    filterElement,
    fill,
    fillOpacity,
    fillRule,
    stroke,
    strokeWidth,
    strokeOpacity,
    opacity,
    scaleX,
    scaleY,
    canvasWidth,
    canvasHeight,
    devicePixelRatio = 1,
    blendMode,
  } = params

  // Create an SVG element with the path at HIGH RESOLUTION (DPR-scaled)
  // This ensures crisp vector rendering on Retina displays
  const renderWidth = canvasWidth * devicePixelRatio
  const renderHeight = canvasHeight * devicePixelRatio
  const svgWidth = canvasWidth / scaleX
  const svgHeight = canvasHeight / scaleY

  // Build filter defs if filter element is present
  let defsString = ''
  let filterAttr = ''
  if (filterElement) {
    const filterClone = filterElement.cloneNode(true) as SVGFilterElement
    const filterId = `render-filter-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    filterClone.setAttribute('id', filterId)
    defsString = `<defs>${new XMLSerializer().serializeToString(filterClone)}</defs>`
    filterAttr = `filter="url(#${filterId})"`
  }

  // Build path attributes
  // For paths with filters, don't apply opacity attributes (filter handles it internally)
  // For simple paths, apply opacity attributes for accurate styling
  const hasFilter = !!filterElement
  const pathAttrs: string[] = [
    `d="${pathData}"`,
    `fill="${fill && fill !== 'none' ? fill : 'none'}"`,
    `fill-rule="${fillRule}"`,
  ]

  // Add opacity attributes only for non-filtered paths
  if (!hasFilter) {
    if (fillOpacity !== 1) pathAttrs.push(`fill-opacity="${fillOpacity}"`)
    if (opacity !== 1) pathAttrs.push(`opacity="${opacity}"`)
  }

  // Add filter attribute if present
  if (filterAttr) {
    pathAttrs.push(filterAttr)
  }

  // Add stroke attributes if stroke is present
  if (stroke && stroke !== 'none') {
    pathAttrs.push(`stroke="${stroke}"`)
    pathAttrs.push(`stroke-width="${strokeWidth}"`)
    if (!hasFilter && strokeOpacity !== 1) {
      pathAttrs.push(`stroke-opacity="${strokeOpacity}"`)
    }
  }

  // Add blend mode via style if specified
  if (blendMode && blendMode !== 'source-over') {
    // Map canvas composite operation back to CSS mix-blend-mode
    const cssBlendMode = blendMode.replace(/-/g, '-')
    pathAttrs.push(`style="mix-blend-mode: ${cssBlendMode}"`)
  }

  // Create SVG at high resolution (DPR-scaled) for crisp rendering
  // viewBox remains at original coordinates, width/height are scaled up
  const svgString = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${renderWidth}" height="${renderHeight}"`,
    ` viewBox="0 0 ${svgWidth} ${svgHeight}">`,
    defsString,
    `<path ${pathAttrs.join(' ')}/>`,
    `</svg>`,
  ].join('')

  // Use data URL approach for better cross-browser compatibility
  // Base64 encoding ensures special characters in SVG are properly handled
  const base64Svg = btoa(unescape(encodeURIComponent(svgString)))
  const dataUrl = `data:image/svg+xml;base64,${base64Svg}`

  // Load and draw the SVG at logical dimensions
  // The high-resolution SVG image is scaled down by the browser, preserving quality
  // The context already has DPR scale applied, so drawing at logical size is correct
  const img = await loadImage(dataUrl)
  ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight)
}

/**
 * Render a path with leather technique depth effects (Canvas 2D fallback)
 * Used when SVG rendering is not available or fails
 * Uses multiple Canvas 2D passes to simulate outer shadow, rim highlight, base fill, and inner shadow
 */
function renderLeatherTechniquePathCanvas2D(
  ctx: CanvasRenderingContext2D,
  scaledPath: Path2D,
  fillColor: string,
  depthEffect: DepthEffectConfig,
  opacity: number,
  fillRule: CanvasFillRule
): void {
  // Step 1: Render outer shadow (outside the shape)
  if (depthEffect.outerShadow) {
    const shadow = depthEffect.outerShadow
    ctx.save()
    ctx.globalAlpha = opacity * shadow.opacity
    ctx.shadowColor = shadow.color
    ctx.shadowBlur = shadow.blur
    ctx.shadowOffsetX = shadow.offsetX
    ctx.shadowOffsetY = shadow.offsetY
    // Draw the shape to create shadow, then clip it out
    ctx.fillStyle = 'rgba(0,0,0,0)' // Transparent fill
    ctx.fill(scaledPath, fillRule)
    ctx.restore()
  }

  // Step 2: Render rim highlight (outside the shape, light-facing edge)
  if (depthEffect.rimHighlight) {
    const highlight = depthEffect.rimHighlight
    ctx.save()
    ctx.globalAlpha = opacity * highlight.opacity
    ctx.shadowColor = highlight.color
    ctx.shadowBlur = highlight.blur
    ctx.shadowOffsetX = highlight.offsetX
    ctx.shadowOffsetY = highlight.offsetY
    ctx.fillStyle = 'rgba(0,0,0,0)' // Transparent fill
    ctx.fill(scaledPath, fillRule)
    ctx.restore()
  }

  // Step 3: Render base fill color
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.fillStyle = fillColor
  ctx.fill(scaledPath, fillRule)
  ctx.restore()

  // Step 4: Render inner shadow (inside the shape)
  // This requires a clipping approach - draw shadow, clip to shape
  if (depthEffect.innerShadow) {
    const shadow = depthEffect.innerShadow
    ctx.save()
    ctx.globalAlpha = opacity * shadow.opacity
    // Clip to the shape
    ctx.clip(scaledPath, fillRule)
    // Draw a larger rectangle with shadow to create inner shadow effect
    ctx.shadowColor = shadow.color
    ctx.shadowBlur = shadow.blur
    ctx.shadowOffsetX = shadow.offsetX
    ctx.shadowOffsetY = shadow.offsetY
    ctx.fillStyle = shadow.color
    // Draw outside the visible area to only show the shadow inside
    ctx.fillRect(-10000, -10000, 20000, 20000)
    ctx.restore()
  }
}

/**
 * Render overlay paths on top of the image
 * Supports blend modes via globalCompositeOperation and path filters
 *
 * For leather technique filters (debossing, embossing, hot-foil-stamping, laser-engraving):
 * - Uses NATIVE SVG rendering for identical output to VectorEditor
 * - Falls back to Canvas 2D approximation if SVG rendering fails
 *
 * For other path filters (jewelry techniques, etc.):
 * - Uses CSS filter for color transformation
 *
 * @param scaleX - Scale factor for X coordinates
 * @param scaleY - Scale factor for Y coordinates
 * @param pathFilterCssMap - Map of filter IDs to CSS filter strings (legacy, for non-leather techniques)
 * @param pathFilterMap - Map of filter IDs to full filter definitions (for leather techniques)
 * @param logicalWidth - Logical canvas width for SVG rendering (before DPR scaling)
 * @param logicalHeight - Logical canvas height for SVG rendering (before DPR scaling)
 * @param devicePixelRatio - Device pixel ratio for high-DPI rendering
 */
async function renderOverlayPaths(
  ctx: CanvasRenderingContext2D,
  overlayPaths: SVGGElement,
  scaleX: number,
  scaleY: number,
  pathFilterCssMap: Map<string, string> = new Map(),
  pathFilterMap: Map<string, ParsedPathFilter> = new Map(),
  logicalWidth: number = 0,
  logicalHeight: number = 0,
  devicePixelRatio: number = 1
): Promise<void> {
  const paths = Array.from(overlayPaths.querySelectorAll('path'))

  // Process paths sequentially to maintain proper layering
  for (const pathEl of paths) {
    const d = pathEl.getAttribute('d')
    if (!d) continue

    // Get fill
    const fill = pathEl.getAttribute('fill')
    const fillOpacity = parseFloat(pathEl.getAttribute('fill-opacity') || '1')

    // Get stroke
    const stroke = pathEl.getAttribute('stroke')
    const strokeWidth = parseFloat(pathEl.getAttribute('stroke-width') || '1')
    const strokeOpacity = parseFloat(pathEl.getAttribute('stroke-opacity') || '1')

    // Get opacity
    const opacity = parseFloat(pathEl.getAttribute('opacity') || '1')

    // Get blend mode from style attribute
    const blendMode = getBlendMode(pathEl)

    // Get filter if present
    const filterId = extractFilterId(pathEl.getAttribute('filter'))
    const filterDef = filterId ? pathFilterMap.get(filterId) : null

    // Check if path has visible content (fill or stroke)
    const hasFill = fill && fill !== 'none'
    const hasStroke = stroke && stroke !== 'none'

    // Skip paths with no visible content
    if (!hasFill && !hasStroke) continue

    const fillRule = pathEl.getAttribute('fill-rule') || 'nonzero'

    ctx.save()
    ctx.globalCompositeOperation = blendMode

    // Use native SVG rendering for ALL paths to achieve maximum quality
    // This creates an inline SVG, rasterizes at high DPR, and draws to canvas
    // Result: crisp vector rendering that matches browser SVG quality
    if (logicalWidth > 0 && logicalHeight > 0) {
      try {
        await renderPathWithNativeSvg(ctx, {
          pathData: d,
          filterElement: filterDef?.filterElement || null,
          fill,
          fillOpacity,
          fillRule,
          stroke,
          strokeWidth,
          strokeOpacity,
          opacity,
          scaleX,
          scaleY,
          canvasWidth: logicalWidth,
          canvasHeight: logicalHeight,
          devicePixelRatio,
          blendMode,
        })
        ctx.restore()
        continue
      } catch {
        // Fallback to Canvas 2D rendering if native SVG fails
        // This is a last resort and won't be as crisp
      }
    }

    // Canvas 2D fallback (only used if native SVG rendering fails)
    // Create a scaled path using DOMMatrix transform
    const path2D = new Path2D(d)
    const scaledPath = new Path2D()
    const matrix = new DOMMatrix().scale(scaleX, scaleY)
    scaledPath.addPath(path2D, matrix)
    const avgScale = Math.sqrt(scaleX * scaleY)

    // Check if this is a leather technique (for Canvas 2D fallback with computed colors)
    const isLeatherTechnique = filterDef && isLeatherTechniquePreset(filterDef.presetId)

    // Fill the path
    if (hasFill) {
      if (isLeatherTechnique && filterDef?.presetId) {
        const leatherFillColor = computeLeatherTechniqueFillColor(
          filterDef.presetId,
          filterDef.presetParams || undefined
        )
        const depthEffect = computeLeatherTechniqueDepthEffect(
          filterDef.presetId,
          filterDef.presetParams || undefined,
          avgScale
        )
        if (leatherFillColor && depthEffect) {
          renderLeatherTechniquePathCanvas2D(
            ctx,
            scaledPath,
            leatherFillColor,
            depthEffect,
            opacity * fillOpacity,
            fillRule as CanvasFillRule
          )
        } else if (leatherFillColor) {
          ctx.globalAlpha = opacity * fillOpacity
          ctx.fillStyle = leatherFillColor
          ctx.fill(scaledPath, fillRule as CanvasFillRule)
        }
      } else {
        ctx.globalAlpha = opacity * fillOpacity
        ctx.fillStyle = fill!
        ctx.fill(scaledPath, fillRule as CanvasFillRule)
      }
    }

    // Stroke the path
    if (hasStroke) {
      ctx.globalAlpha = opacity * strokeOpacity

      if (isLeatherTechnique && filterDef?.presetId) {
        const leatherFillColor = computeLeatherTechniqueFillColor(
          filterDef.presetId,
          filterDef.presetParams || undefined
        )
        ctx.strokeStyle = leatherFillColor || stroke!
      } else {
        ctx.strokeStyle = stroke!
      }

      ctx.lineWidth = strokeWidth * avgScale
      ctx.stroke(scaledPath)
    }

    ctx.restore()
  }
}

/**
 * Composite a raster image with SVG overlay from VectorEditor
 * Returns the composited image as a data URL and HTMLImageElement
 */
export async function compositeImageWithOverlay(options: OverlayCompositorOptions): Promise<CompositorResult> {
  const { imageUrl, overlay, devicePixelRatio = 1 } = options

  // Load the base image
  const baseImage = await loadImage(imageUrl)

  // Use provided dimensions or natural image dimensions
  const width = options.targetWidth || baseImage.naturalWidth
  const height = options.targetHeight || baseImage.naturalHeight

  // Parse the SVG overlay
  const {
    clipPath,
    mask,
    filter,
    overlayPaths,
    adjustmentMasks,
    pathFilterCssMap,
    pathFilterMap,
    svgWidth,
    svgHeight,
  } = parseSvgOverlay(overlay.combinedSvg)

  // Calculate scale factors to transform SVG coordinates to canvas coordinates
  // Use natural image dimensions as fallback if SVG dimensions are not available
  const effectiveSvgWidth = svgWidth || baseImage.naturalWidth
  const effectiveSvgHeight = svgHeight || baseImage.naturalHeight
  const scaleX = width / effectiveSvgWidth
  const scaleY = height / effectiveSvgHeight

  // Create the output canvas
  const { canvas, ctx } = createCanvas(width, height, devicePixelRatio)

  // Step 1: Apply clip path if present (before drawing the image)
  let hasClipPath = false
  if (clipPath) {
    applyClipPath(ctx, clipPath, scaleX, scaleY)
    hasClipPath = true
  }

  // Step 2: Draw the base image with CSS filter if available (more efficient for presets)
  // Check for data-css-filter attribute which contains a CSS filter string for presets
  const cssFilter = filter?.getAttribute('data-css-filter')
  if (cssFilter) {
    // Use CSS filter for efficient rendering (works well for filter presets)
    ctx.filter = cssFilter
    ctx.drawImage(baseImage, 0, 0, width, height)
    ctx.filter = 'none' // Reset filter
  } else {
    // Draw image without CSS filter
    ctx.drawImage(baseImage, 0, 0, width, height)
    // Step 3: Apply SVG color filter if present (manual processing for complex filters)
    if (filter) {
      applyColorFilter(ctx, filter, canvas.width, canvas.height)
    }
  }

  // Step 4: Restore clip path context if it was applied
  if (hasClipPath) {
    ctx.restore()
  }

  // Step 5: Apply hole mask if present (to the base image)
  if (mask) {
    applyHoleMask(ctx, mask, width, height, effectiveSvgWidth, effectiveSvgHeight)
  }

  // Step 6: Apply adjustment masks (region-specific color adjustments)
  if (adjustmentMasks.length > 0) {
    for (const adjustmentMask of adjustmentMasks) {
      applyAdjustmentMask(ctx, baseImage, adjustmentMask, width, height, effectiveSvgWidth, effectiveSvgHeight)
    }
  }

  // Step 7: Render overlay paths on top
  // If there are holes, we need to apply the hole mask to the overlay paths as well
  // so that the holes cut through both the base image AND the overlay paths
  if (overlayPaths) {
    if (mask) {
      // Render overlay paths to a temporary canvas with DPR scaling for crisp rendering
      const { canvas: overlayCanvas, ctx: overlayCtx } = createCanvas(width, height, devicePixelRatio)
      // Render paths to the temporary canvas
      // Pass both CSS map (for non-leather techniques) and full filter map (for leather techniques)
      // Also pass canvas dimensions for native SVG rendering of leather techniques
      // Note: Use logical dimensions (width, height) for path rendering, not canvas.width/height
      // The DPR scaling is handled by createCanvas context scaling
      await renderOverlayPaths(
        overlayCtx,
        overlayPaths,
        scaleX,
        scaleY,
        pathFilterCssMap,
        pathFilterMap,
        width,
        height,
        devicePixelRatio
      )
      // Apply hole mask to the overlay paths
      applyHoleMask(overlayCtx, mask, width, height, effectiveSvgWidth, effectiveSvgHeight)
      // Composite the masked overlay paths onto the main canvas
      // Reset context scale before drawing to avoid double-scaling
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(overlayCanvas, 0, 0)
      ctx.restore()
    } else {
      // No holes, render directly
      // Pass both CSS map (for non-leather techniques) and full filter map (for leather techniques)
      // Also pass canvas dimensions for native SVG rendering of leather techniques
      await renderOverlayPaths(
        ctx,
        overlayPaths,
        scaleX,
        scaleY,
        pathFilterCssMap,
        pathFilterMap,
        width,
        height,
        devicePixelRatio
      )
    }
  }

  // Convert to data URL and HTMLImageElement
  const dataUrl = canvas.toDataURL('image/png')
  const resultImage = await loadImage(dataUrl)

  return {
    dataUrl,
    image: resultImage,
    width,
    height,
  }
}

/**
 * Check if overlay data has any visual effects that need to be applied
 */
export function hasVisualOverlay(overlay: { metadata?: OverlayMetadata } | null | undefined): boolean {
  if (!overlay?.metadata) return false

  if (overlay.metadata.hasClipPaths) return true

  if (overlay.metadata.hasFilters) return true

  if (overlay.metadata.hasDrawnPaths) return true

  if (overlay.metadata.hasHoles) return true

  return Boolean(overlay.metadata.hasAdjustmentMasks)
}

/**
 * Create a cached compositor that reuses results for the same inputs
 */
export function createCachedCompositor() {
  const cache = new Map<string, Promise<CompositorResult>>()

  return {
    /**
     * Composite with caching - returns cached result if inputs match
     */
    async composite(options: OverlayCompositorOptions): Promise<CompositorResult> {
      const cacheKey = [
        options.imageUrl,
        options.overlay.combinedSvg,
        options.targetWidth,
        options.targetHeight,
        options.devicePixelRatio,
      ].join('|')

      const cached = cache.get(cacheKey)
      if (cached) {
        return cached
      }

      const result = compositeImageWithOverlay(options)
      cache.set(cacheKey, result)

      // Clean up on error
      result.catch(() => {
        cache.delete(cacheKey)
      })

      return result
    },

    /**
     * Clear the cache
     */
    clear() {
      cache.clear()
    },

    /**
     * Remove a specific entry from cache
     */
    invalidate(imageUrl: string) {
      for (const key of Array.from(cache.keys())) {
        if (key.startsWith(imageUrl)) {
          cache.delete(key)
        }
      }
    },
  }
}

export default compositeImageWithOverlay
