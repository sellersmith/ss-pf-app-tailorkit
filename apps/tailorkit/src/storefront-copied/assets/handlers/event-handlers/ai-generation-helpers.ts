/**
 * Shared helpers for AI image/vector generation
 */

/**
 * Extract filter preset ID from SVG string
 * Finds the filter actually referenced by the first path element, then extracts its preset ID
 * Supports two formats:
 * 1. VectorEditor format: filter element with data-preset-id attribute
 * 2. Applied preset format: filter URL pattern preset-filter-{id}
 */
export function extractFilterPresetIdFromSvg(svgContent: string): string | null {
  if (!svgContent) return null

  // Parse the SVG to find which filter the first path actually uses
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgContent, 'image/svg+xml')

  // Check for parsing errors
  const parseError = doc.querySelector('parsererror')
  if (parseError) return null

  // Find the first path element with a filter attribute
  const pathElement = doc.querySelector('path[filter]')
  if (!pathElement) {
    // No path with filter - fall back to first filter with data-preset-id
    const anyFilter = doc.querySelector('filter[data-preset-id]')
    if (anyFilter) {
      return anyFilter.getAttribute('data-preset-id')
    }
    return null
  }

  // Get the filter URL from the path
  const filterAttr = pathElement.getAttribute('filter')
  if (!filterAttr) return null

  // Extract filter ID from url(#filterId)
  const filterIdMatch = filterAttr.match(/url\(#([^)]+)\)/i)
  if (!filterIdMatch) return null

  const filterId = filterIdMatch[1]

  // Check if it's a preset-filter pattern (applied by applyFilterPresetToSvg)
  if (filterId.startsWith('preset-filter-')) {
    return filterId.replace('preset-filter-', '')
  }

  // Find the filter element with this ID and check for data-preset-id
  const filterElement = doc.getElementById(filterId)
  if (filterElement && filterElement.tagName.toLowerCase() === 'filter') {
    const presetId = filterElement.getAttribute('data-preset-id')
    if (presetId) return presetId
  }

  return null
}

/**
 * Extract filter preset params from SVG string
 * Finds the filter actually referenced by the first path element, then extracts its params
 * Returns the params object if found (from data-preset-params attribute on filter element)
 */
export function extractFilterPresetParamsFromSvg(svgContent: string): Record<string, number> | null {
  if (!svgContent) return null

  // Parse the SVG using DOMParser
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgContent, 'image/svg+xml')

  // Check for parsing errors
  const parseError = doc.querySelector('parsererror')
  if (parseError) return null

  // Find the first path element with a filter attribute
  const pathElement = doc.querySelector('path[filter]')

  let filterElement: Element | null = null

  if (pathElement) {
    // Get the filter URL from the path
    const filterAttr = pathElement.getAttribute('filter')
    if (filterAttr) {
      // Extract filter ID from url(#filterId)
      const filterIdMatch = filterAttr.match(/url\(#([^)]+)\)/i)
      if (filterIdMatch) {
        filterElement = doc.getElementById(filterIdMatch[1])
      }
    }
  }

  // Fall back to first filter with data-preset-id if no path-referenced filter found
  if (!filterElement) {
    filterElement = doc.querySelector('filter[data-preset-id]')
  }

  if (!filterElement) return null

  const paramsAttr = filterElement.getAttribute('data-preset-params')
  if (!paramsAttr) return null

  try {
    // Unescape HTML entities in the JSON string
    const paramsJson = paramsAttr.replace(/&quot;/g, '"')
    return JSON.parse(paramsJson)
  } catch {
    return null
  }
}

/**
 * Extract fill and stroke colors from SVG string
 * Prioritizes the path element with a filter (the styled path), then falls back to first path with fill/stroke
 *
 * @param svgContent - The SVG string to extract styles from
 * @returns Object with fill and stroke colors, or null if not found
 */
export function extractFillStrokeFromSvg(
  svgContent: string
): { fill?: string; stroke?: string; strokeWidth?: number } | null {
  if (!svgContent) return null

  // Parse the SVG using DOMParser for accurate attribute extraction
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgContent, 'image/svg+xml')

  // Check for parsing errors
  const parseError = doc.querySelector('parsererror')
  if (parseError) return null

  // Priority 1: Find the path element with a filter (this is the styled path the user customized)
  let pathElement = doc.querySelector('path[filter]')

  // Priority 2: Find a path with explicit fill or stroke attributes
  if (!pathElement) {
    const allPaths = doc.querySelectorAll('path')
    for (const path of allPaths) {
      const fill = path.getAttribute('fill')
      const stroke = path.getAttribute('stroke')
      // Look for a path with an explicit color (not 'none', not empty, not a gradient)
      const hasExplicitFill = fill && fill !== 'none' && fill !== '' && !fill.startsWith('url(')
      const hasExplicitStroke = stroke && stroke !== 'none' && stroke !== '' && !stroke.startsWith('url(')
      if (hasExplicitFill || hasExplicitStroke) {
        pathElement = path
        break
      }
    }
  }

  // Priority 3: Fall back to first path element
  if (!pathElement) {
    pathElement = doc.querySelector('path')
  }

  if (!pathElement) return null

  const result: { fill?: string; stroke?: string; strokeWidth?: number } = {}

  // Helper to check if value is a solid color (not a gradient/pattern reference)
  const isSolidColor = (value: string): boolean => {
    if (!value || value === 'none' || value === '') return false
    // Exclude url() references (gradients, patterns)
    if (value.startsWith('url(')) return false
    // Exclude 'inherit', 'currentColor' as they're context-dependent
    if (value === 'inherit' || value === 'currentColor') return false
    return true
  }

  // Extract fill - check both attribute and style (only solid colors)
  const fill = pathElement.getAttribute('fill')
  if (isSolidColor(fill || '')) {
    result.fill = fill!
  } else {
    // Check inline style
    const style = pathElement.getAttribute('style')
    if (style) {
      const fillMatch = style.match(/fill\s*:\s*([^;]+)/i)
      if (fillMatch && isSolidColor(fillMatch[1].trim())) {
        result.fill = fillMatch[1].trim()
      }
    }
  }

  // Extract stroke - check both attribute and style (only solid colors)
  const stroke = pathElement.getAttribute('stroke')
  if (isSolidColor(stroke || '')) {
    result.stroke = stroke!
  } else {
    // Check inline style
    const style = pathElement.getAttribute('style')
    if (style) {
      const strokeMatch = style.match(/stroke\s*:\s*([^;]+)/i)
      if (strokeMatch && isSolidColor(strokeMatch[1].trim())) {
        result.stroke = strokeMatch[1].trim()
      }
    }
  }

  // Extract stroke-width
  const strokeWidth = pathElement.getAttribute('stroke-width')
  if (strokeWidth) {
    const width = parseFloat(strokeWidth)
    if (!isNaN(width) && width > 0) {
      result.strokeWidth = width
    }
  } else {
    // Check inline style
    const style = pathElement.getAttribute('style')
    if (style) {
      const strokeWidthMatch = style.match(/stroke-width\s*:\s*([^;]+)/i)
      if (strokeWidthMatch) {
        const width = parseFloat(strokeWidthMatch[1])
        if (!isNaN(width) && width > 0) {
          result.strokeWidth = width
        }
      }
    }
  }

  // Return null if no styles were found
  if (Object.keys(result).length === 0) return null

  return result
}

/**
 * Check if a URL likely points to an SVG file
 * Handles both explicit .svg extensions and Shopify CDN URLs
 */
function isSvgUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase()
  // Explicit .svg extension (with or without query string)
  if (lowerUrl.split('?')[0].endsWith('.svg')) return true
  // Shopify CDN URLs with content type
  if (lowerUrl.includes('content_type=image/svg') || lowerUrl.includes('content_type=image%2Fsvg')) return true
  // Generic SVG detection in URL
  if (lowerUrl.includes('.svg')) return true
  return false
}

/**
 * Fetch SVG content from URL or decode from data URI
 */
export async function getSvgContent(svgSource: string): Promise<string | null> {
  if (!svgSource) return null

  if (svgSource.startsWith('data:image/svg+xml')) {
    try {
      // Handle base64 encoded data URIs (with optional charset parameter)
      // Matches: data:image/svg+xml;base64,... OR data:image/svg+xml;charset=utf-8;base64,...
      const base64Match = svgSource.match(/^data:image\/svg\+xml[^,]*;base64,(.+)$/i)
      if (base64Match) {
        return atob(base64Match[1])
      }
      // Handle URL-encoded data URIs (with optional charset parameter)
      // Matches: data:image/svg+xml,... OR data:image/svg+xml;charset=utf-8,...
      const urlEncodedMatch = svgSource.match(/^data:image\/svg\+xml(?:;[^,]*)?,(.+)$/i)
      if (urlEncodedMatch) {
        return decodeURIComponent(urlEncodedMatch[1])
      }
    } catch {
      return null
    }
    return null
  }

  // Try to fetch any HTTP URL that might be an SVG
  if (svgSource.startsWith('http')) {
    try {
      const res = await fetch(svgSource)
      // Check content type header
      const contentType = res.headers.get('content-type') || ''
      const isSvgContentType = contentType.includes('svg') || contentType.includes('xml')

      const text = await res.text()
      // Verify it's actually SVG content
      if (
        text.includes('<svg')
        && (isSvgContentType || isSvgUrl(svgSource) || text.trim().startsWith('<svg') || text.trim().startsWith('<?xml'))
      ) {
        return text
      }
    } catch {
      return null
    }
  }

  return null
}
