/**
 * Shared Image Filter Primitives
 *
 * Generates SVG filter primitives for image adjustments.
 * Used by both paint-renderer.ts (for fills) and svg-filter-primitives.ts (for strokes).
 *
 * @module shared/libraries/paint/image-filter-primitives
 */

import type { ImageFilters } from './paint-types'

/**
 * Options for generating filter primitives with input/output chaining
 */
export interface FilterPrimitiveOptions {
  /** Input result name for the first primitive (e.g., "SourceGraphic", "stroke_pattern") */
  inputResult?: string
  /** Output result prefix for intermediate steps */
  outputPrefix?: string
  /** Whether to include in/result attributes on primitives */
  useResultChaining?: boolean
}

/**
 * Result of building filter primitives
 */
export interface FilterPrimitivesResult {
  /** Array of SVG filter primitive strings */
  primitives: string[]
  /** Whether any adjustments were applied */
  hasAdjustments: boolean
  /** The final result name (only when useResultChaining is true) */
  finalResult?: string
}

/**
 * Check if any filter adjustments are needed
 */
export function hasFilterAdjustments(filters: ImageFilters): boolean {
  const {
    blur = 0,
    brightness = 0,
    exposure = 0,
    contrast = 0,
    saturation = 0,
    temperature = 0,
    tint = 0,
    highlights = 0,
    shadows = 0,
    sharpness = 0,
  } = filters

  return (
    blur > 0
    || brightness !== 0
    || exposure !== 0
    || contrast !== 0
    || saturation !== 0
    || temperature !== 0
    || tint !== 0
    || highlights !== 0
    || shadows !== 0
    || sharpness > 0
  )
}

/**
 * Build SVG filter primitives for image adjustments
 *
 * Supports all 10 filters in order:
 * 1. blur - Gaussian blur
 * 2. brightness - Linear offset
 * 3. exposure - Photographic stops with gamma correction
 * 4. contrast - Slope adjustment around midpoint
 * 5. temperature - Warm/cool color shift
 * 6. tint - Magenta/green color shift
 * 7. saturation - Color saturation
 * 8. highlights - Gamma adjustment for bright areas
 * 9. shadows - Offset for dark areas
 * 10. sharpness - Edge enhancement convolution
 *
 * @param filters - ImageFilters object with adjustment values
 * @param options - Options for input/output chaining (for stroke filter chains)
 * @returns Filter primitives result with primitives array and metadata
 */
export function buildImageFilterPrimitives(
  filters: ImageFilters,
  options: FilterPrimitiveOptions = {}
): FilterPrimitivesResult {
  const { inputResult, outputPrefix = 'filter_step', useResultChaining = false } = options

  const {
    blur = 0,
    brightness = 0,
    exposure = 0,
    contrast = 0,
    saturation = 0,
    temperature = 0,
    tint = 0,
    highlights = 0,
    shadows = 0,
    sharpness = 0,
  } = filters

  if (!hasFilterAdjustments(filters)) {
    return { primitives: [], hasAdjustments: false }
  }

  const primitives: string[] = []
  let currentInput = inputResult || ''
  let stepIndex = 0

  // Helper to get next result name
  const nextResult = () => `${outputPrefix}${stepIndex++}`

  // Helper to build in/result attributes
  const inAttr = (input: string) => (useResultChaining && input ? ` in="${input}"` : '')
  const resultAttr = (result: string) => (useResultChaining ? ` result="${result}"` : '')

  // 1. Blur - gaussian blur (applied first)
  // stdDeviation maps 0-1 to 0-10 pixels blur radius
  if (blur > 0) {
    const radius = blur * 10
    const stepResult = useResultChaining ? nextResult() : ''
    primitives.push(`<feGaussianBlur${inAttr(currentInput)} stdDeviation="${radius}"${resultAttr(stepResult)}/>`)
    currentInput = stepResult
  }

  // 2. Brightness - simple linear offset
  if (brightness !== 0) {
    const offset = brightness * 0.5
    const stepResult = useResultChaining ? nextResult() : ''
    primitives.push(`
      <feComponentTransfer${inAttr(currentInput)}${resultAttr(stepResult)}>
        <feFuncR type="linear" slope="1" intercept="${offset}"/>
        <feFuncG type="linear" slope="1" intercept="${offset}"/>
        <feFuncB type="linear" slope="1" intercept="${offset}"/>
      </feComponentTransfer>
    `)
    currentInput = stepResult
  }

  // 3. Exposure - photographic exposure adjustment in LINEAR space
  // Process: sRGB → Linear → Multiply by 2^stops → sRGB
  if (exposure !== 0) {
    const maxStops = 4
    const stops = exposure * maxStops
    const multiplier = Math.pow(2, stops)
    const stepResult = useResultChaining ? nextResult() : ''
    primitives.push(`
      <feComponentTransfer${inAttr(currentInput)}>
        <feFuncR type="gamma" amplitude="1" exponent="2.2" offset="0"/>
        <feFuncG type="gamma" amplitude="1" exponent="2.2" offset="0"/>
        <feFuncB type="gamma" amplitude="1" exponent="2.2" offset="0"/>
      </feComponentTransfer>
      <feComponentTransfer>
        <feFuncR type="linear" slope="${multiplier}" intercept="0"/>
        <feFuncG type="linear" slope="${multiplier}" intercept="0"/>
        <feFuncB type="linear" slope="${multiplier}" intercept="0"/>
      </feComponentTransfer>
      <feComponentTransfer${resultAttr(stepResult)}>
        <feFuncR type="gamma" amplitude="1" exponent="0.4545" offset="0"/>
        <feFuncG type="gamma" amplitude="1" exponent="0.4545" offset="0"/>
        <feFuncB type="gamma" amplitude="1" exponent="0.4545" offset="0"/>
      </feComponentTransfer>
    `)
    currentInput = stepResult
  }

  // 4. Contrast - adjust slope around midpoint
  if (contrast !== 0) {
    const slope = 1 + contrast
    const intercept = (1 - slope) / 2
    const stepResult = useResultChaining ? nextResult() : ''
    primitives.push(`
      <feComponentTransfer${inAttr(currentInput)}${resultAttr(stepResult)}>
        <feFuncR type="linear" slope="${slope}" intercept="${intercept}"/>
        <feFuncG type="linear" slope="${slope}" intercept="${intercept}"/>
        <feFuncB type="linear" slope="${slope}" intercept="${intercept}"/>
      </feComponentTransfer>
    `)
    currentInput = stepResult
  }

  // 5. Temperature - warm/cool (adjust red/blue channels)
  // Positive = warmer (increase red, decrease blue)
  // Negative = cooler (decrease red, increase blue)
  if (temperature !== 0) {
    const shift = temperature * 0.3
    const stepResult = useResultChaining ? nextResult() : ''
    primitives.push(`
      <feColorMatrix${inAttr(currentInput)} type="matrix"${resultAttr(stepResult)} values="
        ${1 + shift} 0 0 0 0
        0 1 0 0 0
        0 0 ${1 - shift} 0 0
        0 0 0 1 0
      "/>
    `)
    currentInput = stepResult
  }

  // 6. Tint - magenta/green
  // Positive = more green (increase green, decrease red+blue)
  // Negative = more magenta (decrease green, increase red+blue)
  if (tint !== 0) {
    const shift = tint * 0.3
    const stepResult = useResultChaining ? nextResult() : ''
    primitives.push(`
      <feColorMatrix${inAttr(currentInput)} type="matrix"${resultAttr(stepResult)} values="
        ${1 - shift * 0.5} 0 0 0 0
        0 ${1 + shift} 0 0 0
        0 0 ${1 - shift * 0.5} 0 0
        0 0 0 1 0
      "/>
    `)
    currentInput = stepResult
  }

  // 7. Saturation
  if (saturation !== 0) {
    const satValue = 1 + saturation
    const stepResult = useResultChaining ? nextResult() : ''
    primitives.push(
      `<feColorMatrix${inAttr(currentInput)} type="saturate" values="${satValue}"${resultAttr(stepResult)}/>`
    )
    currentInput = stepResult
  }

  // 8. Highlights - gamma adjustment for bright areas
  // Gamma < 1 lifts midtones/highlights, Gamma > 1 darkens them
  if (highlights !== 0) {
    const gamma = 1 - highlights * 0.4
    const stepResult = useResultChaining ? nextResult() : ''
    primitives.push(`
      <feComponentTransfer${inAttr(currentInput)}${resultAttr(stepResult)}>
        <feFuncR type="gamma" amplitude="1" exponent="${gamma}" offset="0"/>
        <feFuncG type="gamma" amplitude="1" exponent="${gamma}" offset="0"/>
        <feFuncB type="gamma" amplitude="1" exponent="${gamma}" offset="0"/>
      </feComponentTransfer>
    `)
    currentInput = stepResult
  }

  // 9. Shadows - offset for dark areas
  // Positive = brighten shadows, Negative = darken shadows
  if (shadows !== 0) {
    const offset = shadows * 0.15
    const stepResult = useResultChaining ? nextResult() : ''
    primitives.push(`
      <feComponentTransfer${inAttr(currentInput)}${resultAttr(stepResult)}>
        <feFuncR type="linear" slope="1" intercept="${offset}"/>
        <feFuncG type="linear" slope="1" intercept="${offset}"/>
        <feFuncB type="linear" slope="1" intercept="${offset}"/>
      </feComponentTransfer>
    `)
    currentInput = stepResult
  }

  // 10. Sharpness - edge enhancement using convolution kernel
  // Interpolates between identity kernel and sharpen kernel
  if (sharpness > 0) {
    const s = sharpness
    const stepResult = useResultChaining ? nextResult() : ''
    primitives.push(`
      <feConvolveMatrix${inAttr(currentInput)} order="3" preserveAlpha="true"${resultAttr(stepResult)}
        kernelMatrix="0 ${-s} 0 ${-s} ${1 + 4 * s} ${-s} 0 ${-s} 0"/>
    `)
    currentInput = stepResult
  }

  return {
    primitives,
    hasAdjustments: true,
    finalResult: currentInput || undefined,
  }
}
