/**
 * Apply Filter Preset to SVG
 * Utility for dynamically applying path filter presets and styles to SVG strings
 * Used for AI-generated vector shapes that need filter effects (debossing, embossing, etc.)
 * and style transfer (fill, stroke colors)
 */

import {
  getPathFilterPresetById,
  buildPathFilterPrimitives,
  getPathFilterDefaultParams,
  type PathFilterPresetParams,
} from '~/modules/VectorEditor/utils/filters/pathFilterPresets'
import { serializeFilterPrimitive } from '~/modules/VectorEditor/utils/svg/serialization'
import type { FilterPrimitive } from '~/modules/VectorEditor/utils/svg/types/effects'

/**
 * Style options for applying to SVG paths
 */
export interface SvgStyleOptions {
  /** Fill color (e.g., '#000000') */
  fill?: string
  /** Stroke color (e.g., '#000000') */
  stroke?: string
  /** Stroke width */
  strokeWidth?: number
}

/**
 * Build an SVG filter element from filter primitives
 */
function buildFilterElement(filterId: string, primitives: FilterPrimitive[]): string {
  const primitivesStr = primitives.map(serializeFilterPrimitive).join('\n')
  return `<filter id="${filterId}" filterUnits="objectBoundingBox" x="-50%" y="-50%" width="200%" height="200%">${primitivesStr}</filter>`
}

/**
 * Apply a filter preset to an SVG string
 *
 * This function:
 * 1. Parses the SVG to find all path elements
 * 2. Builds filter primitives from the preset
 * 3. Injects the filter definition into <defs>
 * 4. Applies the filter to all paths
 *
 * @param svgString - The SVG string to modify
 * @param filterPresetId - The filter preset ID (e.g., 'debossing', 'embossing')
 * @param filterPresetParams - Optional parameter overrides
 * @returns Modified SVG string with filter applied
 */
export function applyFilterPresetToSvg(
  svgString: string,
  filterPresetId: string,
  filterPresetParams?: PathFilterPresetParams
): string {
  // Get the filter preset
  const preset = getPathFilterPresetById(filterPresetId)
  if (!preset) {
    console.warn(`Filter preset '${filterPresetId}' not found`)
    return svgString
  }

  // Build filter primitives with provided or default params
  const params = filterPresetParams ?? getPathFilterDefaultParams(preset)
  const primitives = buildPathFilterPrimitives(preset, params)

  // Generate unique filter ID
  const filterId = `preset-filter-${filterPresetId}`

  // Build the filter element
  const filterElement = buildFilterElement(filterId, primitives)

  // Check if SVG has existing <defs>
  const hasDefsTag = /<defs[^>]*>/i.test(svgString)

  let modifiedSvg = svgString

  if (hasDefsTag) {
    // Inject filter into existing <defs>
    modifiedSvg = modifiedSvg.replace(/<defs([^>]*)>/i, `<defs$1>\n${filterElement}`)
  } else {
    // Create new <defs> section after opening <svg> tag
    modifiedSvg = modifiedSvg.replace(/(<svg[^>]*>)/i, `$1\n<defs>\n${filterElement}\n</defs>`)
  }

  // Apply filter to all path elements
  // Handle paths that already have a filter attribute
  modifiedSvg = modifiedSvg.replace(/<path([^>]*?)(\s*\/?>)/gi, (match, attrs, closing) => {
    // Check if path already has a filter attribute
    if (/\sfilter\s*=/i.test(attrs)) {
      // Replace existing filter
      attrs = attrs.replace(/\sfilter\s*=\s*["'][^"']*["']/i, ` filter="url(#${filterId})"`)
    } else {
      // Add filter attribute
      attrs += ` filter="url(#${filterId})"`
    }
    return `<path${attrs}${closing}`
  })

  return modifiedSvg
}

/**
 * Remove all filter presets from an SVG string
 * Useful for re-applying a different preset
 *
 * @param svgString - The SVG string to modify
 * @returns SVG string with filter references removed from paths
 */
export function removeFilterPresetsFromSvg(svgString: string): string {
  // Remove filter attributes from all paths
  let modifiedSvg = svgString.replace(
    /<path([^>]*)\sfilter\s*=\s*["']url\(#preset-filter-[^)]+\)["']([^>]*)(\/?>)/gi,
    '<path$1$2$3'
  )

  // Remove preset filter definitions from defs
  modifiedSvg = modifiedSvg.replace(/<filter\s+id="preset-filter-[^"]*"[^>]*>[\s\S]*?<\/filter>/gi, '')

  // Clean up empty defs tags
  modifiedSvg = modifiedSvg.replace(/<defs[^>]*>\s*<\/defs>/gi, '')

  return modifiedSvg
}

/**
 * Parse SVG string and find the filter preset actually used by paths
 *
 * @param svgString - The SVG string to parse
 * @returns Object with filterId referenced by paths and the filter element, or null
 */
function parseFilterFromSvg(svgString: string): { filterId: string; filterElement: Element } | null {
  // Parse the SVG using DOMParser
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')

  // Check for parsing errors
  const parseError = doc.querySelector('parsererror')
  if (parseError) return null

  // Find all paths with filter attribute
  const pathsWithFilter = doc.querySelectorAll('path[filter]')
  if (pathsWithFilter.length === 0) return null

  // Get the last path's filter reference (most recently applied during editing)
  const lastPath = pathsWithFilter[pathsWithFilter.length - 1]
  const filterAttr = lastPath.getAttribute('filter')
  if (!filterAttr) return null

  // Extract filter ID from url(#filterId)
  const filterIdMatch = filterAttr.match(/url\(#([^)]+)\)/i)
  if (!filterIdMatch) return null

  const filterId = filterIdMatch[1]

  // Find the filter element in defs
  const filterElement = doc.getElementById(filterId)
  if (!filterElement || filterElement.tagName.toLowerCase() !== 'filter') return null

  return { filterId, filterElement }
}

/**
 * Check if an SVG has a filter preset applied
 *
 * Parses the SVG DOM to find:
 * 1. Which filter is actually referenced by path elements
 * 2. The preset ID from that filter's data-preset-id attribute
 *
 * @param svgString - The SVG string to check
 * @returns The filter preset ID if found, null otherwise
 */
export function getAppliedFilterPresetId(svgString: string): string | null {
  // First, try DOM parsing for accurate filter detection
  const parsed = parseFilterFromSvg(svgString)
  if (parsed) {
    // Check for data-preset-id on the filter element
    const presetId = parsed.filterElement.getAttribute('data-preset-id')
    if (presetId) return presetId

    // Check if filter ID itself is a preset-filter pattern
    if (parsed.filterId.startsWith('preset-filter-')) {
      return parsed.filterId.replace('preset-filter-', '')
    }
  }

  // Fallback: check for preset-filter URL pattern directly (from applyFilterPresetToSvg)
  const presetUrlMatch = svgString.match(/filter\s*=\s*["']url\(#preset-filter-([^)]+)\)["']/i)
  if (presetUrlMatch) return presetUrlMatch[1]

  return null
}

/**
 * Extract filter preset params from an SVG if present
 *
 * Parses the SVG DOM to find the filter actually referenced by paths
 * and extracts its data-preset-params attribute
 *
 * @param svgString - The SVG string to check
 * @returns The filter preset params if found, null otherwise
 */
export function getAppliedFilterPresetParams(svgString: string): PathFilterPresetParams | null {
  const parsed = parseFilterFromSvg(svgString)
  if (!parsed) return null

  const paramsAttr = parsed.filterElement.getAttribute('data-preset-params')
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
 * Replace the filter preset on an SVG with a new one
 *
 * @param svgString - The SVG string to modify
 * @param newFilterPresetId - The new filter preset ID
 * @param newFilterPresetParams - Optional parameter overrides
 * @returns Modified SVG string with new filter applied
 */
export function replaceFilterPreset(
  svgString: string,
  newFilterPresetId: string,
  newFilterPresetParams?: PathFilterPresetParams
): string {
  const cleanSvg = removeFilterPresetsFromSvg(svgString)
  return applyFilterPresetToSvg(cleanSvg, newFilterPresetId, newFilterPresetParams)
}

/**
 * Extract fill and stroke colors from an SVG string
 * Prioritizes the path element with a filter (the styled path), then falls back to first path with fill/stroke
 *
 * @param svgString - The SVG string to extract styles from
 * @returns Style options object or null if not found
 */
export function getAppliedFillStroke(svgString: string): SvgStyleOptions | null {
  // Parse the SVG using DOMParser for accurate attribute extraction
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')

  // Check for parsing errors
  const parseError = doc.querySelector('parsererror')
  if (parseError) return null

  // Priority 1: Find the path element with a filter (this is the styled path the user customized)
  let pathElement: Element | null = doc.querySelector('path[filter]')

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

  const result: SvgStyleOptions = {}

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
 * Apply fill and stroke styles to all path elements in an SVG
 * Also removes CSS style rules that would override the applied styles
 *
 * @param svgString - The SVG string to modify
 * @param styles - The styles to apply
 * @returns Modified SVG string with styles applied
 */
export function applyFillStrokeToSvg(svgString: string, styles: SvgStyleOptions): string {
  if (!styles || Object.keys(styles).length === 0) {
    return svgString
  }

  let modifiedSvg = svgString

  // Remove CSS fill/stroke rules from <style> blocks that would override our attributes
  // This handles cases like: .ls0{fill:#231f20} which takes precedence over fill="..."
  if (styles.fill !== undefined) {
    // Remove fill declarations from CSS rules (handles both .class{fill:...} and element{fill:...})
    modifiedSvg = modifiedSvg.replace(
      /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
      (match, openTag, cssContent, closeTag) => {
        // Remove fill property from CSS rules
        const cleanedCss = cssContent.replace(/fill\s*:\s*[^;}]+[;}]?/gi, '')
        return `${openTag}${cleanedCss}${closeTag}`
      }
    )
  }
  if (styles.stroke !== undefined) {
    // Remove stroke declarations from CSS rules
    modifiedSvg = modifiedSvg.replace(
      /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
      (match, openTag, cssContent, closeTag) => {
        const cleanedCss = cssContent.replace(/stroke\s*:\s*[^;}]+[;}]?/gi, '')
        return `${openTag}${cleanedCss}${closeTag}`
      }
    )
  }

  // Apply styles to all path elements
  modifiedSvg = modifiedSvg.replace(/<path([^>]*?)(\s*\/?>)/gi, (match, attrs, closing) => {
    let newAttrs = attrs

    // Apply fill
    if (styles.fill !== undefined) {
      if (/\sfill\s*=/i.test(newAttrs)) {
        // Replace existing fill
        newAttrs = newAttrs.replace(/\sfill\s*=\s*["'][^"']*["']/i, ` fill="${styles.fill}"`)
      } else {
        // Add fill attribute
        newAttrs += ` fill="${styles.fill}"`
      }
    }

    // Apply stroke
    if (styles.stroke !== undefined) {
      if (/\sstroke\s*=/i.test(newAttrs)) {
        // Replace existing stroke
        newAttrs = newAttrs.replace(/\sstroke\s*=\s*["'][^"']*["']/i, ` stroke="${styles.stroke}"`)
      } else {
        // Add stroke attribute
        newAttrs += ` stroke="${styles.stroke}"`
      }
    }

    // Apply stroke-width
    if (styles.strokeWidth !== undefined) {
      if (/\sstroke-width\s*=/i.test(newAttrs)) {
        // Replace existing stroke-width
        newAttrs = newAttrs.replace(/\sstroke-width\s*=\s*["'][^"']*["']/i, ` stroke-width="${styles.strokeWidth}"`)
      } else {
        // Add stroke-width attribute
        newAttrs += ` stroke-width="${styles.strokeWidth}"`
      }
    }

    return `<path${newAttrs}${closing}`
  })

  return modifiedSvg
}

/**
 * Apply complete style transfer to an SVG - includes filter preset and fill/stroke
 * This is the main function to use for transferring all styles from one SVG to another
 *
 * When the original SVG has stroke but no fill (stroke-only mode), this function will:
 * 1. Remove fill from the target SVG (set to 'none')
 * 2. Apply the stroke color and strokeWidth
 * 3. Apply the filter preset
 *
 * @param svgString - The SVG string to modify
 * @param options - Style transfer options
 * @param options.removeFillIfNoFill - If true and no fill is provided but stroke is, set fill to 'none'
 * @returns Modified SVG string with all styles applied
 */
export function applyStyleTransferToSvg(
  svgString: string,
  options: {
    filterPresetId?: string
    filterPresetParams?: PathFilterPresetParams
    fill?: string
    stroke?: string
    strokeWidth?: number
    /** If true and stroke is provided but fill is not, remove fill from target SVG */
    removeFillIfNoFill?: boolean
  }
): string {
  let modifiedSvg = svgString

  // Apply fill and stroke first
  const styleOptions: SvgStyleOptions = {}

  // Handle stroke-only mode: if we have stroke but no fill, and removeFillIfNoFill is true,
  // explicitly set fill to 'none' to remove any default fill from the uploaded/generated SVG
  if (options.stroke && !options.fill && options.removeFillIfNoFill) {
    styleOptions.fill = 'none'
  } else if (options.fill) {
    styleOptions.fill = options.fill
  }

  if (options.stroke) styleOptions.stroke = options.stroke
  if (options.strokeWidth) styleOptions.strokeWidth = options.strokeWidth

  if (Object.keys(styleOptions).length > 0) {
    modifiedSvg = applyFillStrokeToSvg(modifiedSvg, styleOptions)
  }

  // Apply filter preset
  if (options.filterPresetId) {
    modifiedSvg = applyFilterPresetToSvg(modifiedSvg, options.filterPresetId, options.filterPresetParams)
  }

  return modifiedSvg
}
