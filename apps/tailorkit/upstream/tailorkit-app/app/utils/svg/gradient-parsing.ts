/**
 * Gradient Parsing Utilities
 *
 * Parse SVG gradient definitions from SVG strings.
 * Extracted from VectorEditor for reuse across modules.
 */

import type {
  GradientStop,
  LinearGradientDef,
  RadialGradientDef,
  GradientDef,
  GradientUnits,
  SpreadMethod,
} from '~/types/svg-effects'

/**
 * Parse a single gradient stop element
 */
function parseGradientStop(stopElement: string): GradientStop | null {
  // Extract offset
  const offsetMatch = stopElement.match(/offset="([^"]*)"/i)
  if (!offsetMatch) return null

  let offset = parseFloat(offsetMatch[1])
  // Handle percentage values
  if (offsetMatch[1].includes('%')) {
    offset = offset / 100
  }

  // Extract stop-color
  const colorMatch = stopElement.match(/stop-color="([^"]*)"/i)
  const color = colorMatch ? colorMatch[1] : '#000000'

  // Extract stop-opacity
  const opacityMatch = stopElement.match(/stop-opacity="([^"]*)"/i)
  const opacity = opacityMatch ? parseFloat(opacityMatch[1]) : undefined

  // Also check for style attribute (stop-color and stop-opacity can be in style)
  const styleMatch = stopElement.match(/style="([^"]*)"/i)
  let styleColor = color
  let styleOpacity = opacity

  if (styleMatch) {
    const style = styleMatch[1]
    const styleColorMatch = style.match(/stop-color:\s*([^;]+)/i)
    if (styleColorMatch) {
      styleColor = styleColorMatch[1].trim()
    }
    const styleOpacityMatch = style.match(/stop-opacity:\s*([^;]+)/i)
    if (styleOpacityMatch) {
      styleOpacity = parseFloat(styleOpacityMatch[1])
    }
  }

  return {
    offset,
    color: styleColor,
    opacity: styleOpacity,
  }
}

/**
 * Parse all stop elements within a gradient
 */
export function parseGradientStops(gradientElement: string): GradientStop[] {
  const stops: GradientStop[] = []
  const stopRegex = /<stop[^>]*\/?>/gi
  let match: RegExpExecArray | null

  while ((match = stopRegex.exec(gradientElement)) !== null) {
    const stop = parseGradientStop(match[0])
    if (stop) {
      stops.push(stop)
    }
  }

  // Sort stops by offset
  stops.sort((a, b) => a.offset - b.offset)

  return stops
}

/**
 * Parse a linear gradient element
 */
export function parseLinearGradient(element: string): LinearGradientDef | null {
  // Extract id
  const idMatch = element.match(/id="([^"]*)"/i)
  if (!idMatch) return null

  const id = idMatch[1]

  // Extract coordinates (default to 0%, 0%, 100%, 0% for left-to-right)
  const x1Match = element.match(/x1="([^"]*)"/i)
  const y1Match = element.match(/y1="([^"]*)"/i)
  const x2Match = element.match(/x2="([^"]*)"/i)
  const y2Match = element.match(/y2="([^"]*)"/i)

  const parseCoord = (match: RegExpMatchArray | null, defaultVal: number): number => {
    if (!match) return defaultVal
    const val = match[1]
    if (val.includes('%')) {
      return parseFloat(val) / 100
    }
    return parseFloat(val)
  }

  const x1 = parseCoord(x1Match, 0)
  const y1 = parseCoord(y1Match, 0)
  const x2 = parseCoord(x2Match, 1)
  const y2 = parseCoord(y2Match, 0)

  // Extract gradientUnits
  const gradientUnitsMatch = element.match(/gradientUnits="([^"]*)"/i)
  const gradientUnits = gradientUnitsMatch ? (gradientUnitsMatch[1] as GradientUnits) : undefined

  // Extract spreadMethod
  const spreadMethodMatch = element.match(/spreadMethod="([^"]*)"/i)
  const spreadMethod = spreadMethodMatch ? (spreadMethodMatch[1] as SpreadMethod) : undefined

  // Extract gradientTransform
  const gradientTransformMatch = element.match(/gradientTransform="([^"]*)"/i)
  const gradientTransform = gradientTransformMatch ? gradientTransformMatch[1] : undefined

  // Parse stops
  const stops = parseGradientStops(element)

  return {
    type: 'linearGradient',
    id,
    x1,
    y1,
    x2,
    y2,
    gradientUnits,
    spreadMethod,
    gradientTransform,
    stops,
  }
}

/**
 * Parse a radial gradient element
 */
export function parseRadialGradient(element: string): RadialGradientDef | null {
  // Extract id
  const idMatch = element.match(/id="([^"]*)"/i)
  if (!idMatch) return null

  const id = idMatch[1]

  // Extract coordinates (default to center)
  const cxMatch = element.match(/cx="([^"]*)"/i)
  const cyMatch = element.match(/cy="([^"]*)"/i)
  const rMatch = element.match(/r="([^"]*)"/i)
  const fxMatch = element.match(/fx="([^"]*)"/i)
  const fyMatch = element.match(/fy="([^"]*)"/i)
  const frMatch = element.match(/fr="([^"]*)"/i)

  const parseCoord = (match: RegExpMatchArray | null, defaultVal: number): number => {
    if (!match) return defaultVal
    const val = match[1]
    if (val.includes('%')) {
      return parseFloat(val) / 100
    }
    return parseFloat(val)
  }

  const cx = parseCoord(cxMatch, 0.5)
  const cy = parseCoord(cyMatch, 0.5)
  const r = parseCoord(rMatch, 0.5)
  const fx = fxMatch ? parseCoord(fxMatch, cx) : undefined
  const fy = fyMatch ? parseCoord(fyMatch, cy) : undefined
  const fr = frMatch ? parseCoord(frMatch, 0) : undefined

  // Extract gradientUnits
  const gradientUnitsMatch = element.match(/gradientUnits="([^"]*)"/i)
  const gradientUnits = gradientUnitsMatch ? (gradientUnitsMatch[1] as GradientUnits) : undefined

  // Extract spreadMethod
  const spreadMethodMatch = element.match(/spreadMethod="([^"]*)"/i)
  const spreadMethod = spreadMethodMatch ? (spreadMethodMatch[1] as SpreadMethod) : undefined

  // Extract gradientTransform
  const gradientTransformMatch = element.match(/gradientTransform="([^"]*)"/i)
  const gradientTransform = gradientTransformMatch ? gradientTransformMatch[1] : undefined

  // Parse stops
  const stops = parseGradientStops(element)

  return {
    type: 'radialGradient',
    id,
    cx,
    cy,
    r,
    fx,
    fy,
    fr,
    gradientUnits,
    spreadMethod,
    gradientTransform,
    stops,
  }
}

/**
 * Extract all gradients from an SVG string
 */
export function extractGradients(svgString: string): Map<string, GradientDef> {
  const gradients = new Map<string, GradientDef>()

  // Match linear gradients (including self-closing and with content)
  const linearRegex = /<linearGradient[^>]*(?:\/>|>[\s\S]*?<\/linearGradient>)/gi
  let match: RegExpExecArray | null

  while ((match = linearRegex.exec(svgString)) !== null) {
    const gradient = parseLinearGradient(match[0])
    if (gradient) {
      gradients.set(gradient.id, gradient)
    }
  }

  // Match radial gradients
  const radialRegex = /<radialGradient[^>]*(?:\/>|>[\s\S]*?<\/radialGradient>)/gi

  while ((match = radialRegex.exec(svgString)) !== null) {
    const gradient = parseRadialGradient(match[0])
    if (gradient) {
      gradients.set(gradient.id, gradient)
    }
  }

  return gradients
}

/**
 * Check if a fill/stroke value is a gradient reference
 */
export function isGradientReference(value: string): boolean {
  return value.startsWith('url(#') && value.endsWith(')')
}

/**
 * Extract gradient ID from a url() reference
 */
export function extractGradientId(value: string): string | null {
  const match = value.match(/url\(#([^)]+)\)/)
  return match ? match[1] : null
}
