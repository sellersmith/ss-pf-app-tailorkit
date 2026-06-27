/* eslint-disable max-len */
/**
 * Mask and ClipPath Parsing Utilities
 * Parse SVG mask and clipPath definitions from SVG strings
 */

import type { MaskDef, ClipPathDef, MaskType } from '../types/effects'

/**
 * Parse a mask element
 */
function parseMask(maskElement: string): MaskDef | null {
  // Extract id
  const idMatch = maskElement.match(/id="([^"]*)"/i)
  if (!idMatch) return null

  const id = idMatch[1]

  // Extract mask attributes
  const maskUnitsMatch = maskElement.match(/maskUnits="([^"]*)"/i)
  const maskUnits = maskUnitsMatch ? (maskUnitsMatch[1] as 'userSpaceOnUse' | 'objectBoundingBox') : undefined

  const maskContentUnitsMatch = maskElement.match(/maskContentUnits="([^"]*)"/i)
  const maskContentUnits = maskContentUnitsMatch
    ? (maskContentUnitsMatch[1] as 'userSpaceOnUse' | 'objectBoundingBox')
    : undefined

  const maskTypeMatch = maskElement.match(/mask-type="([^"]*)"/i)
  const maskType = maskTypeMatch ? (maskTypeMatch[1] as MaskType) : undefined

  const xMatch = maskElement.match(/\sx="([^"]*)"/i)
  const yMatch = maskElement.match(/\sy="([^"]*)"/i)
  const widthMatch = maskElement.match(/width="([^"]*)"/i)
  const heightMatch = maskElement.match(/height="([^"]*)"/i)

  // Extract content (everything between <mask> and </mask>)
  const contentMatch = maskElement.match(/<mask[^>]*>([\s\S]*?)<\/mask>/i)
  const content = contentMatch ? contentMatch[1].trim() : ''

  return {
    id,
    maskUnits,
    maskContentUnits,
    maskType,
    x: xMatch ? xMatch[1] : undefined,
    y: yMatch ? yMatch[1] : undefined,
    width: widthMatch ? widthMatch[1] : undefined,
    height: heightMatch ? heightMatch[1] : undefined,
    content,
  }
}

/**
 * Parse a clipPath element
 */
function parseClipPath(clipPathElement: string): ClipPathDef | null {
  // Extract id
  const idMatch = clipPathElement.match(/id="([^"]*)"/i)
  if (!idMatch) return null

  const id = idMatch[1]

  // Extract clipPathUnits
  const clipPathUnitsMatch = clipPathElement.match(/clipPathUnits="([^"]*)"/i)
  const clipPathUnits = clipPathUnitsMatch
    ? (clipPathUnitsMatch[1] as 'userSpaceOnUse' | 'objectBoundingBox')
    : undefined

  // Extract clip-rule (can be on the clipPath or its children)
  const clipRuleMatch = clipPathElement.match(/clip-rule="([^"]*)"/i)
  const clipRule = clipRuleMatch ? (clipRuleMatch[1] as 'nonzero' | 'evenodd') : undefined

  // Extract the path data from the first path element inside the clipPath
  const pathMatch = clipPathElement.match(/<path[^>]*d="([^"]*)"[^>]*\/?>/i)
  let pathData = ''

  if (pathMatch) {
    pathData = pathMatch[1]
  } else {
    // Try to find path d attribute in a different format
    const altPathMatch = clipPathElement.match(/<path[^>]*>/i)
    if (altPathMatch) {
      const dMatch = altPathMatch[0].match(/d="([^"]*)"/i)
      if (dMatch) {
        pathData = dMatch[1]
      }
    }
  }

  // Also check for other shape elements that might be in the clipPath
  // (rect, circle, ellipse, polygon, etc.)
  if (!pathData) {
    // Handle rect
    const rectMatch = clipPathElement.match(/<rect[^>]*\/?>/i)
    if (rectMatch) {
      const rect = rectMatch[0]
      const x = parseFloat((rect.match(/\sx="([^"]*)"/i) || ['', '0'])[1])
      const y = parseFloat((rect.match(/\sy="([^"]*)"/i) || ['', '0'])[1])
      const width = parseFloat((rect.match(/width="([^"]*)"/i) || ['', '0'])[1])
      const height = parseFloat((rect.match(/height="([^"]*)"/i) || ['', '0'])[1])
      const rx = parseFloat((rect.match(/rx="([^"]*)"/i) || ['', '0'])[1])
      const ry = parseFloat((rect.match(/ry="([^"]*)"/i) || ['', '0'])[1])

      if (rx || ry) {
        // Rounded rectangle path
        const r = rx || ry
        pathData = `M${x + r},${y} h${width - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${height - 2 * r} a${r},${r} 0 0 1 -${r},${r} h-${width - 2 * r} a${r},${r} 0 0 1 -${r},-${r} v-${height - 2 * r} a${r},${r} 0 0 1 ${r},-${r} z`
      } else {
        // Simple rectangle path
        pathData = `M${x},${y} h${width} v${height} h-${width} z`
      }
    }

    // Handle circle
    const circleMatch = clipPathElement.match(/<circle[^>]*\/?>/i)
    if (circleMatch) {
      const circle = circleMatch[0]
      const cx = parseFloat((circle.match(/cx="([^"]*)"/i) || ['', '0'])[1])
      const cy = parseFloat((circle.match(/cy="([^"]*)"/i) || ['', '0'])[1])
      const r = parseFloat((circle.match(/\sr="([^"]*)"/i) || ['', '0'])[1])

      // Circle as path using arcs
      pathData = `M${cx - r},${cy} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 -${2 * r},0 z`
    }

    // Handle ellipse
    const ellipseMatch = clipPathElement.match(/<ellipse[^>]*\/?>/i)
    if (ellipseMatch) {
      const ellipse = ellipseMatch[0]
      const cx = parseFloat((ellipse.match(/cx="([^"]*)"/i) || ['', '0'])[1])
      const cy = parseFloat((ellipse.match(/cy="([^"]*)"/i) || ['', '0'])[1])
      const rx = parseFloat((ellipse.match(/rx="([^"]*)"/i) || ['', '0'])[1])
      const ry = parseFloat((ellipse.match(/ry="([^"]*)"/i) || ['', '0'])[1])

      // Ellipse as path using arcs
      pathData = `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${2 * rx},0 a${rx},${ry} 0 1,0 -${2 * rx},0 z`
    }

    // Handle polygon
    const polygonMatch = clipPathElement.match(/<polygon[^>]*points="([^"]*)"[^>]*\/?>/i)
    if (polygonMatch) {
      const points = polygonMatch[1].trim().split(/[\s,]+/)
      if (points.length >= 4) {
        pathData = `M${points[0]},${points[1]}`
        for (let i = 2; i < points.length; i += 2) {
          pathData += ` L${points[i]},${points[i + 1]}`
        }
        pathData += ' z'
      }
    }
  }

  return {
    id,
    clipPathUnits,
    clipRule,
    pathData,
  }
}

/**
 * Check if an ID is an effect group ID (generated by calculateEffectGroups)
 * Effect group IDs follow the pattern: svg-clip-N or svg-hole-N
 * These should not be extracted as persistent defs since they are regenerated dynamically
 */
function isEffectGroupId(id: string): boolean {
  return /^svg-(clip|hole)-\d+$/.test(id)
}

/**
 * Extract all masks from an SVG string
 * Excludes masks with effect group IDs (svg-hole-N) since those are dynamically generated
 */
export function extractMasks(svgString: string): Map<string, MaskDef> {
  const masks = new Map<string, MaskDef>()

  // Match mask elements
  const maskRegex = /<mask[^>]*(?:\/>|>[\s\S]*?<\/mask>)/gi
  let match: RegExpExecArray | null

  while ((match = maskRegex.exec(svgString)) !== null) {
    const mask = parseMask(match[0])
    if (mask) {
      // Skip effect group masks (svg-hole-N) - these are regenerated dynamically from effectGroups
      if (isEffectGroupId(mask.id)) {
        continue
      }
      masks.set(mask.id, mask)
    }
  }

  return masks
}

/**
 * Extract all clipPaths from an SVG string
 * Excludes clipPaths with effect group IDs (svg-clip-N) since those are dynamically generated
 */
export function extractClipPaths(svgString: string): Map<string, ClipPathDef> {
  const clipPaths = new Map<string, ClipPathDef>()

  // Match clipPath elements
  const clipPathRegex = /<clipPath[^>]*(?:\/>|>[\s\S]*?<\/clipPath>)/gi
  let match: RegExpExecArray | null

  while ((match = clipPathRegex.exec(svgString)) !== null) {
    const clipPath = parseClipPath(match[0])
    if (clipPath) {
      // Skip effect group clipPaths (svg-clip-N) - these are regenerated dynamically from effectGroups
      if (isEffectGroupId(clipPath.id)) {
        continue
      }
      clipPaths.set(clipPath.id, clipPath)
    }
  }

  return clipPaths
}

/**
 * Check if a value is a mask reference
 */
export function isMaskReference(value: string): boolean {
  return value.startsWith('url(#') && value.endsWith(')')
}

/**
 * Extract mask ID from a url() reference
 */
export function extractMaskId(value: string): string | null {
  const match = value.match(/url\(#([^)]+)\)/)
  return match ? match[1] : null
}

/**
 * Check if a value is a clipPath reference
 */
export function isClipPathReference(value: string): boolean {
  return value.startsWith('url(#') && value.endsWith(')')
}

/**
 * Extract clipPath ID from a url() reference
 */
export function extractClipPathId(value: string): string | null {
  const match = value.match(/url\(#([^)]+)\)/)
  return match ? match[1] : null
}
