/**
 * SVG Parsing Utilities
 *
 * Functions for parsing and extracting data from SVG strings.
 */

/**
 * Path data extracted from SVG
 */
export interface PathData {
  /** SVG path d attribute */
  d: string
  /** Fill rule (evenodd or nonzero) */
  fillRule?: 'evenodd' | 'nonzero'
  /** Fill color */
  fill?: string
}

/**
 * Extract ALL path data from SVG string
 * Potrace generates multiple <path> elements for separate contours - this captures all of them
 * Preserves compound paths (paths with holes) by NOT splitting at M commands
 *
 * @param svgString - SVG string to parse
 * @returns Array of path data objects
 */
export function extractAllPathsFromSvg(svgString: string): PathData[] {
  const pathRegex = /<path[^>]*>/gi
  const allPaths: PathData[] = []
  let match

  while ((match = pathRegex.exec(svgString)) !== null) {
    const pathElement = match[0]

    // Extract d attribute
    const dMatch = pathElement.match(/d="([^"]*)"/i)
    const pathData = dMatch?.[1]

    if (pathData && pathData.trim().length > 0) {
      // Extract fill-rule attribute if present
      const fillRuleMatch = pathElement.match(/fill-rule="([^"]*)"/i)
      const fillRule = fillRuleMatch?.[1] as 'evenodd' | 'nonzero' | undefined

      // Extract fill attribute if present
      const fillMatch = pathElement.match(/fill="([^"]*)"/i)
      const fill = fillMatch?.[1]

      allPaths.push({
        d: pathData,
        fillRule,
        fill,
      })
    }
  }

  return allPaths
}

/**
 * Extract viewBox dimensions from SVG string
 *
 * @param svgString - SVG string to parse
 * @returns ViewBox dimensions or null if not found
 */
export function extractViewBox(svgString: string): { x: number; y: number; width: number; height: number } | null {
  const viewBoxMatch = svgString.match(/viewBox="([^"]*)"/i)
  if (!viewBoxMatch) return null

  const parts = viewBoxMatch[1].split(/\s+/).map(Number)
  if (parts.length < 4 || parts.some(isNaN)) return null

  return {
    x: parts[0],
    y: parts[1],
    width: parts[2],
    height: parts[3],
  }
}

/**
 * Extract width and height from SVG string
 *
 * @param svgString - SVG string to parse
 * @returns Dimensions or null if not found
 */
export function extractDimensions(svgString: string): { width: number; height: number } | null {
  const widthMatch = svgString.match(/width="(\d+(?:\.\d+)?)(?:px)?"/i)
  const heightMatch = svgString.match(/height="(\d+(?:\.\d+)?)(?:px)?"/i)

  if (!widthMatch || !heightMatch) {
    // Try to get from viewBox
    const viewBox = extractViewBox(svgString)
    if (viewBox) {
      return { width: viewBox.width, height: viewBox.height }
    }
    return null
  }

  return {
    width: parseFloat(widthMatch[1]),
    height: parseFloat(heightMatch[1]),
  }
}
