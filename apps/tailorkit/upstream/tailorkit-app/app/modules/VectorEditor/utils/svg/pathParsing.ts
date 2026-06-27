/**
 * SVG Path Parsing Utilities
 * Provides functions to parse, manipulate, and serialize SVG path data
 */

import type { ColorAdjustments } from './types/effects'

/**
 * Number of decimal places to use when serializing coordinates
 * Lower values produce smaller SVG files, higher values preserve more precision
 */
export const COORDINATE_PRECISION = 1

/**
 * Format a number to a maximum of COORDINATE_PRECISION decimal places
 * Removes unnecessary trailing zeros (e.g., 10.00 -> 10, 10.50 -> 10.5)
 */
export function formatCoord(n: number): string {
  return Number(n.toFixed(COORDINATE_PRECISION)).toString()
}

/**
 * Parse SVG path number sequence handling compact notation
 * SVG allows: .5.3 = [0.5, 0.3], 10-5 = [10, -5], 1.5.3 = [1.5, 0.3]
 */
function parseSvgNumbers(params: string): number[] {
  const numbers: number[] = []
  // Regex matches one valid SVG number at a time:
  // - Optional negative sign
  // - Either: digits with optional decimal (1, 1.5, 1.)
  // - Or: decimal with digits (.5)
  // - Optional scientific notation (e-5, E+10)
  const numberRegex = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g
  let match: RegExpExecArray | null

  while ((match = numberRegex.exec(params)) !== null) {
    const num = parseFloat(match[0])
    if (!isNaN(num)) {
      numbers.push(num)
    }
  }

  return numbers
}

/**
 * Parse arc parameters specially, handling concatenated flags
 * Arc syntax: rx ry x-axis-rotation large-arc-flag sweep-flag x y
 * In SVG, flags are always 0 or 1 and can be written without separators (e.g., "11" = largeArc=1, sweep=1)
 * This is a common optimization in minified SVGs and some tools' output
 */
function parseArcParams(params: string): number[][] {
  const arcs: number[][] = []

  // Match arc parameter groups carefully - flags can be 0 or 1 without separators
  // Pattern: rx,ry rotation flag flag x,y
  const arcRegex = /(-?[\d.]+)[,\s]*(-?[\d.]+)[,\s]*(-?[\d.]+)[,\s]*([01])[,\s]*([01])[,\s]*(-?[\d.]+)[,\s]*(-?[\d.]+)/g

  let match: RegExpExecArray | null
  while ((match = arcRegex.exec(params)) !== null) {
    arcs.push([
      parseFloat(match[1]), // rx
      parseFloat(match[2]), // ry
      parseFloat(match[3]), // rotation
      parseInt(match[4], 10), // largeArc (0 or 1)
      parseInt(match[5], 10), // sweep (0 or 1)
      parseFloat(match[6]), // x
      parseFloat(match[7]), // y
    ])
  }

  return arcs
}

// Path command types
export type PathCommandType =
  | 'M'
  | 'L'
  | 'C'
  | 'Q'
  | 'Z'
  | 'A'
  | 'H'
  | 'V'
  | 'S'
  | 'T'
  | 'm'
  | 'l'
  | 'c'
  | 'q'
  | 'z'
  | 'a'
  | 'h'
  | 'v'
  | 's'
  | 't'

export interface Point {
  x: number
  y: number
}

export interface PathCommand {
  type: PathCommandType
  x: number
  y: number
  // For cubic bezier (C, c, S, s)
  cp1?: Point
  cp2?: Point
  // For quadratic bezier (Q, q, T, t)
  cp?: Point
  // For arc (A, a)
  rx?: number
  ry?: number
  rotation?: number
  largeArc?: boolean
  sweep?: boolean
}

export interface ParsedPath {
  id?: string
  commands: PathCommand[]
  fill: string
  stroke?: string
  strokeWidth?: number
  fillRule?: 'nonzero' | 'evenodd'
  // Effect references (optional, extracted from path attributes)
  filterId?: string
  maskId?: string
  clipPathId?: string
  // Color adjustments (stored as JSON in data-adjustments attribute)
  colorAdjustments?: ColorAdjustments
  // Rotation transform (degrees, around path center)
  pathRotation?: number
  pathRotationOrigin?: Point
  // Opacity properties
  opacity?: number
  fillOpacity?: number
  strokeOpacity?: number
  // Blend mode (extracted from style attribute)
  mixBlendMode?: string
}

export interface ParsedSvg {
  paths: ParsedPath[]
  viewBox: { x: number; y: number; width: number; height: number }
  width: number
  height: number
}

/**
 * Parse SVG path d attribute into array of commands
 */
export function parseSvgPath(pathD: string): PathCommand[] {
  const commands: PathCommand[] = []

  // Regex to match path commands and their parameters
  const commandRegex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g
  let match: RegExpExecArray | null

  // Track current position for relative commands
  let currentX = 0
  let currentY = 0
  let startX = 0
  let startY = 0

  while ((match = commandRegex.exec(pathD)) !== null) {
    const type = match[1] as PathCommandType
    const params = match[2].trim()
    const numbers = parseSvgNumbers(params)

    const isRelative = type === type.toLowerCase()
    const baseX = isRelative ? currentX : 0
    const baseY = isRelative ? currentY : 0

    switch (type.toUpperCase()) {
      case 'M': {
        // Move to
        const x = (numbers[0] || 0) + baseX
        const y = (numbers[1] || 0) + baseY
        commands.push({ type, x, y })
        currentX = x
        currentY = y
        startX = x
        startY = y

        // Additional pairs are treated as line-to commands
        for (let i = 2; i < numbers.length; i += 2) {
          const lx = (numbers[i] || 0) + (isRelative ? currentX : 0)
          const ly = (numbers[i + 1] || 0) + (isRelative ? currentY : 0)
          commands.push({ type: isRelative ? 'l' : 'L', x: lx, y: ly })
          currentX = lx
          currentY = ly
        }
        break
      }

      case 'L': {
        // Line to
        for (let i = 0; i < numbers.length; i += 2) {
          const x = (numbers[i] || 0) + (i === 0 ? baseX : isRelative ? currentX : 0)
          const y = (numbers[i + 1] || 0) + (i === 0 ? baseY : isRelative ? currentY : 0)
          commands.push({ type, x, y })
          currentX = x
          currentY = y
        }
        break
      }

      case 'H': {
        // Horizontal line to
        for (let i = 0; i < numbers.length; i++) {
          const x = (numbers[i] || 0) + (i === 0 ? baseX : isRelative ? currentX : 0)
          commands.push({ type, x, y: currentY })
          currentX = x
        }
        break
      }

      case 'V': {
        // Vertical line to
        for (let i = 0; i < numbers.length; i++) {
          const y = (numbers[i] || 0) + (i === 0 ? baseY : isRelative ? currentY : 0)
          commands.push({ type, x: currentX, y })
          currentY = y
        }
        break
      }

      case 'C': {
        // Cubic bezier curve
        for (let i = 0; i < numbers.length; i += 6) {
          const bx = i === 0 ? baseX : isRelative ? currentX : 0
          const by = i === 0 ? baseY : isRelative ? currentY : 0
          const cp1x = (numbers[i] || 0) + bx
          const cp1y = (numbers[i + 1] || 0) + by
          const cp2x = (numbers[i + 2] || 0) + bx
          const cp2y = (numbers[i + 3] || 0) + by
          const x = (numbers[i + 4] || 0) + bx
          const y = (numbers[i + 5] || 0) + by
          commands.push({
            type,
            x,
            y,
            cp1: { x: cp1x, y: cp1y },
            cp2: { x: cp2x, y: cp2y },
          })
          currentX = x
          currentY = y
        }
        break
      }

      case 'S': {
        // Smooth cubic bezier
        // The first control point (cp1) is the reflection of the previous segment's
        // second control point (cp2) across the current position
        for (let i = 0; i < numbers.length; i += 4) {
          const bx = i === 0 ? baseX : isRelative ? currentX : 0
          const by = i === 0 ? baseY : isRelative ? currentY : 0
          const cp2x = (numbers[i] || 0) + bx
          const cp2y = (numbers[i + 1] || 0) + by
          const x = (numbers[i + 2] || 0) + bx
          const y = (numbers[i + 3] || 0) + by

          // Compute cp1 by reflecting previous segment's cp2 across current position
          let cp1x = currentX // Default: current position (if no previous C/S command)
          let cp1y = currentY

          if (commands.length > 0) {
            const prevCmd = commands[commands.length - 1]
            // Check if previous command has cp2 (C, c, S, s commands)
            if (prevCmd.cp2) {
              // Reflect previous cp2 across current position
              cp1x = 2 * currentX - prevCmd.cp2.x
              cp1y = 2 * currentY - prevCmd.cp2.y
            }
          }

          commands.push({
            type,
            x,
            y,
            cp1: { x: cp1x, y: cp1y },
            cp2: { x: cp2x, y: cp2y },
          })
          currentX = x
          currentY = y
        }
        break
      }

      case 'Q': {
        // Quadratic bezier curve
        for (let i = 0; i < numbers.length; i += 4) {
          const bx = i === 0 ? baseX : isRelative ? currentX : 0
          const by = i === 0 ? baseY : isRelative ? currentY : 0
          const cpx = (numbers[i] || 0) + bx
          const cpy = (numbers[i + 1] || 0) + by
          const x = (numbers[i + 2] || 0) + bx
          const y = (numbers[i + 3] || 0) + by
          commands.push({
            type,
            x,
            y,
            cp: { x: cpx, y: cpy },
          })
          currentX = x
          currentY = y
        }
        break
      }

      case 'T': {
        // Smooth quadratic bezier
        // The control point (cp) is the reflection of the previous segment's
        // control point across the current position
        for (let i = 0; i < numbers.length; i += 2) {
          const bx = i === 0 ? baseX : isRelative ? currentX : 0
          const by = i === 0 ? baseY : isRelative ? currentY : 0
          const x = (numbers[i] || 0) + bx
          const y = (numbers[i + 1] || 0) + by

          // Compute cp by reflecting previous segment's cp across current position
          let cpx = currentX // Default: current position (if no previous Q/T command)
          let cpy = currentY

          if (commands.length > 0) {
            const prevCmd = commands[commands.length - 1]
            // Check if previous command has cp (Q, q, T, t commands)
            if (prevCmd.cp) {
              // Reflect previous cp across current position
              cpx = 2 * currentX - prevCmd.cp.x
              cpy = 2 * currentY - prevCmd.cp.y
            }
          }

          commands.push({ type, x, y, cp: { x: cpx, y: cpy } })
          currentX = x
          currentY = y
        }
        break
      }

      case 'A': {
        // Arc - Use specialized parser to handle concatenated flags (e.g., "11" = largeArc=1, sweep=1)
        const arcParams = parseArcParams(params)

        if (arcParams.length > 0) {
          // Use specialized parser result
          for (let i = 0; i < arcParams.length; i++) {
            const arc = arcParams[i]
            const bx = i === 0 ? baseX : isRelative ? currentX : 0
            const by = i === 0 ? baseY : isRelative ? currentY : 0
            const rx = arc[0] || 0
            const ry = arc[1] || 0
            const rotation = arc[2] || 0
            const largeArc = arc[3] === 1
            const sweep = arc[4] === 1
            const x = (arc[5] || 0) + bx
            const y = (arc[6] || 0) + by
            commands.push({ type, x, y, rx, ry, rotation, largeArc, sweep })
            currentX = x
            currentY = y
          }
        } else {
          // Fallback to standard number parsing
          for (let i = 0; i < numbers.length; i += 7) {
            const bx = i === 0 ? baseX : isRelative ? currentX : 0
            const by = i === 0 ? baseY : isRelative ? currentY : 0
            const rx = numbers[i] || 0
            const ry = numbers[i + 1] || 0
            const rotation = numbers[i + 2] || 0
            const largeArc = (numbers[i + 3] || 0) === 1
            const sweep = (numbers[i + 4] || 0) === 1
            const x = (numbers[i + 5] || 0) + bx
            const y = (numbers[i + 6] || 0) + by
            commands.push({ type, x, y, rx, ry, rotation, largeArc, sweep })
            currentX = x
            currentY = y
          }
        }
        break
      }

      case 'Z': {
        // Close path
        commands.push({ type, x: startX, y: startY })
        currentX = startX
        currentY = startY
        break
      }
    }
  }

  return commands
}

/**
 * Serialize path commands back to SVG path d attribute
 * IMPORTANT: Always use absolute commands (uppercase) because parsed coordinates are absolute
 * Coordinates are formatted to a maximum of 2 decimal places
 */
export function serializePathCommands(commands: PathCommand[]): string {
  return commands
    .map(cmd => {
      // Always use uppercase (absolute) commands since we store absolute coordinates
      const type = cmd.type.toUpperCase()
      switch (type) {
        case 'M':
        case 'L':
          return `${type}${formatCoord(cmd.x)},${formatCoord(cmd.y)}`
        case 'T':
          // T command with computed control point - serialize as Q for accurate rendering
          // (or keep as T if cp matches the reflection, but Q is safer)
          if (cmd.cp) {
            return `Q${formatCoord(cmd.cp.x)},${formatCoord(cmd.cp.y)} ${formatCoord(cmd.x)},${formatCoord(cmd.y)}`
          }
          return `${type}${formatCoord(cmd.x)},${formatCoord(cmd.y)}`
        case 'H':
          return `${type}${formatCoord(cmd.x)}`
        case 'V':
          return `${type}${formatCoord(cmd.y)}`
        case 'C': {
          const cp1 = `${formatCoord(cmd.cp1?.x ?? 0)},${formatCoord(cmd.cp1?.y ?? 0)}`
          const cp2 = `${formatCoord(cmd.cp2?.x ?? 0)},${formatCoord(cmd.cp2?.y ?? 0)}`
          const end = `${formatCoord(cmd.x)},${formatCoord(cmd.y)}`
          return `${type}${cp1} ${cp2} ${end}`
        }
        case 'S': {
          // S command with computed cp1 - serialize as C for accurate rendering
          // This ensures the curve renders correctly even after path manipulation
          const cp2 = `${formatCoord(cmd.cp2?.x ?? 0)},${formatCoord(cmd.cp2?.y ?? 0)}`
          const end = `${formatCoord(cmd.x)},${formatCoord(cmd.y)}`
          if (cmd.cp1) {
            const cp1 = `${formatCoord(cmd.cp1.x)},${formatCoord(cmd.cp1.y)}`
            return `C${cp1} ${cp2} ${end}`
          }
          return `${type}${cp2} ${end}`
        }
        case 'Q':
          return (
            `${type}${formatCoord(cmd.cp?.x ?? 0)},${formatCoord(cmd.cp?.y ?? 0)} `
            + `${formatCoord(cmd.x)},${formatCoord(cmd.y)}`
          )
        case 'A': {
          const radii = `${formatCoord(cmd.rx ?? 0)},${formatCoord(cmd.ry ?? 0)}`
          const flags = `${cmd.largeArc ? 1 : 0} ${cmd.sweep ? 1 : 0}`
          const end = `${formatCoord(cmd.x)},${formatCoord(cmd.y)}`
          return `${type}${radii} ${formatCoord(cmd.rotation ?? 0)} ${flags} ${end}`
        }
        case 'Z':
          return 'Z'
        default:
          return ''
      }
    })
    .join(' ')
}

/**
 * Check if a position in the string is inside a definition element (defs, mask, clipPath, pattern)
 * These elements contain paths that should not be treated as editable paths
 */
function isInsideDefElement(svgString: string, position: number): boolean {
  // Find the last opening tag before this position for each def element type
  const defTypes = ['defs', 'mask', 'clipPath', 'pattern', 'symbol', 'marker']

  for (const defType of defTypes) {
    // Find all opening and closing tags for this type
    const openRegex = new RegExp(`<${defType}[^>]*>`, 'gi')
    const closeRegex = new RegExp(`</${defType}>`, 'gi')

    let depth = 0
    let lastOpenPos = -1

    // Find all opening tags before position
    let match
    while ((match = openRegex.exec(svgString)) !== null) {
      if (match.index < position) {
        depth++
        lastOpenPos = match.index
      }
    }

    // Find all closing tags before position
    closeRegex.lastIndex = 0
    while ((match = closeRegex.exec(svgString)) !== null) {
      if (match.index < position && match.index > lastOpenPos) {
        depth--
      }
    }

    // If we're still inside this def type (depth > 0), return true
    if (depth > 0) {
      return true
    }
  }

  return false
}

/**
 * Extract paths from SVG string
 * Only extracts paths that are direct children of the SVG, not paths inside defs/mask/clipPath/etc.
 */
export function extractPathsFromSvg(svgString: string): ParsedPath[] {
  const paths: ParsedPath[] = []

  // Match all path elements
  const pathRegex = /<path[^>]*>/gi
  let pathMatch: RegExpExecArray | null

  while ((pathMatch = pathRegex.exec(svgString)) !== null) {
    const pathElement = pathMatch[0]
    const pathPosition = pathMatch.index

    // Skip paths that are inside definition elements (defs, mask, clipPath, etc.)
    // These are used for effects and should not be treated as editable paths
    if (isInsideDefElement(svgString, pathPosition)) {
      continue
    }

    // Extract d attribute
    const dMatch = pathElement.match(/d="([^"]*)"/i)
    if (!dMatch) continue

    const pathD = dMatch[1]

    // Extract fill
    const fillMatch = pathElement.match(/fill="([^"]*)"/i)
    const fill = fillMatch ? fillMatch[1] : '#000000'

    // Extract stroke
    const strokeMatch = pathElement.match(/stroke="([^"]*)"/i)
    const stroke = strokeMatch ? strokeMatch[1] : undefined

    // Extract stroke-width
    const strokeWidthMatch = pathElement.match(/stroke-width="([^"]*)"/i)
    const strokeWidth = strokeWidthMatch ? parseFloat(strokeWidthMatch[1]) : undefined

    // Extract fill-rule
    const fillRuleMatch = pathElement.match(/fill-rule="([^"]*)"/i)
    const fillRule = fillRuleMatch?.at(1) === 'evenodd' ? 'evenodd' : undefined

    // Extract filter (e.g., filter="url(#filter-1)")
    const filterMatch = pathElement.match(/filter="url\(#([^)]+)\)"/i)
    const filterId = filterMatch ? filterMatch[1] : undefined

    // Extract mask (e.g., mask="url(#mask-1)")
    // Skip effect group masks (svg-hole-N) as they are regenerated dynamically
    const maskMatch = pathElement.match(/mask="url\(#([^)]+)\)"/i)
    const extractedMaskId = maskMatch ? maskMatch[1] : undefined
    const maskId = extractedMaskId && /^svg-(clip|hole)-\d+$/.test(extractedMaskId) ? undefined : extractedMaskId

    // Extract clip-path (e.g., clip-path="url(#clip-1)")
    // Skip effect group clipPaths (svg-clip-N) as they are regenerated dynamically
    const clipPathMatch = pathElement.match(/clip-path="url\(#([^)]+)\)"/i)
    const extractedClipPathId = clipPathMatch ? clipPathMatch[1] : undefined
    const clipPathId
      = extractedClipPathId && /^svg-(clip|hole)-\d+$/.test(extractedClipPathId) ? undefined : extractedClipPathId

    // Extract color adjustments (stored as JSON in data-adjustments attribute)
    const adjustmentsMatch = pathElement.match(/data-adjustments='([^']*)'/i)
    let colorAdjustments: ColorAdjustments | undefined
    if (adjustmentsMatch) {
      try {
        colorAdjustments = JSON.parse(adjustmentsMatch[1]) as ColorAdjustments
      } catch {
        // Invalid JSON, ignore
      }
    }

    // Extract opacity attributes
    const opacityMatch = pathElement.match(/opacity="([^"]*)"/i)
    const opacity = opacityMatch ? parseFloat(opacityMatch[1]) : undefined

    const fillOpacityMatch = pathElement.match(/fill-opacity="([^"]*)"/i)
    const fillOpacity = fillOpacityMatch ? parseFloat(fillOpacityMatch[1]) : undefined

    const strokeOpacityMatch = pathElement.match(/stroke-opacity="([^"]*)"/i)
    const strokeOpacity = strokeOpacityMatch ? parseFloat(strokeOpacityMatch[1]) : undefined

    // Extract style attribute for mix-blend-mode
    const styleMatch = pathElement.match(/style="([^"]*)"/i)
    let mixBlendMode: string | undefined
    if (styleMatch) {
      const blendMatch = styleMatch[1].match(/mix-blend-mode:\s*([^;]+)/i)
      if (blendMatch) {
        mixBlendMode = blendMatch[1].trim()
      }
    }

    // Extract transform attribute (rotation only for now)
    const transformMatch = pathElement.match(/transform="([^"]*)"/i)
    let pathRotation: number | undefined
    let pathRotationOrigin: Point | undefined

    if (transformMatch) {
      // Parse rotate(angle cx cy) format
      const rotateMatch = transformMatch[1].match(/rotate\(([^)]+)\)/)
      if (rotateMatch) {
        const parts = rotateMatch[1].split(/[\s,]+/).map(Number)
        if (parts.length >= 1 && !isNaN(parts[0])) {
          pathRotation = parts[0]
          if (parts.length >= 3 && !isNaN(parts[1]) && !isNaN(parts[2])) {
            pathRotationOrigin = { x: parts[1], y: parts[2] }
          }
        }
      }
    }

    const commands = parseSvgPath(pathD)

    paths.push({
      commands,
      fill,
      stroke,
      strokeWidth,
      fillRule,
      filterId,
      maskId,
      clipPathId,
      colorAdjustments,
      pathRotation,
      pathRotationOrigin,
      opacity,
      fillOpacity,
      strokeOpacity,
      mixBlendMode,
    })
  }

  return paths
}

/**
 * Parse full SVG string including viewBox and dimensions
 */
export function parseSvgString(svgString: string): ParsedSvg {
  // Extract viewBox
  const viewBoxMatch = svgString.match(/viewBox="([^"]*)"/i)
  let viewBox = { x: 0, y: 0, width: 100, height: 100 }

  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/[\s,]+/).map(Number)
    viewBox = {
      x: parts[0] || 0,
      y: parts[1] || 0,
      width: parts[2] || 100,
      height: parts[3] || 100,
    }
  }

  // Extract width and height
  const widthMatch = svgString.match(/width="([^"]*)"/i)
  const heightMatch = svgString.match(/height="([^"]*)"/i)

  const width = widthMatch ? parseFloat(widthMatch[1]) : viewBox.width
  const height = heightMatch ? parseFloat(heightMatch[1]) : viewBox.height

  const paths = extractPathsFromSvg(svgString)

  return {
    paths,
    viewBox,
    width,
    height,
  }
}

/**
 * Decode SVG data URI or raw SVG string to SVG string
 * Handles multiple input formats:
 * - Raw SVG string (starts with <svg or <?xml)
 * - Base64 data URI (data:image/svg+xml;base64,...)
 * - UTF-8 data URI (data:image/svg+xml,... or data:image/svg+xml;charset=utf-8,...)
 */
export function decodeSvgDataUri(dataUri: string): string {
  // If it's already a raw SVG string, return as-is
  const trimmed = dataUri.trim()
  if (trimmed.startsWith('<svg') || trimmed.startsWith('<?xml') || trimmed.startsWith('<SVG')) {
    return trimmed
  }

  // Handle base64 encoded data URI
  if (dataUri.startsWith('data:image/svg+xml;base64,')) {
    const base64 = dataUri.replace('data:image/svg+xml;base64,', '')
    return atob(base64)
  }

  // Handle UTF-8 encoded data URI (with or without charset specification)
  if (
    dataUri.startsWith('data:image/svg+xml;charset=utf-8,')
    || dataUri.startsWith('data:image/svg+xml;charset=UTF-8,')
  ) {
    const encoded = dataUri.replace(/^data:image\/svg\+xml;charset=(utf-8|UTF-8),/, '')
    return decodeURIComponent(encoded)
  }

  // Handle plain data URI without encoding specification
  if (dataUri.startsWith('data:image/svg+xml,')) {
    const encoded = dataUri.replace('data:image/svg+xml,', '')
    return decodeURIComponent(encoded)
  }

  throw new Error('Invalid SVG data URI')
}

/**
 * Encode SVG string to base64 data URI
 */
export function encodeSvgToDataUri(svgString: string): string {
  const base64 = btoa(svgString)
  return `data:image/svg+xml;base64,${base64}`
}

/**
 * Calculate bounding box of path commands
 * Returns { minX, minY, maxX, maxY } for all points in the path
 */
export function calculatePathBounds(commands: PathCommand[]): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const cmd of commands) {
    // Skip Z commands (they have no coordinates)
    if (cmd.type.toUpperCase() === 'Z') continue

    // Include main point
    if (cmd.x !== undefined && cmd.y !== undefined) {
      minX = Math.min(minX, cmd.x)
      minY = Math.min(minY, cmd.y)
      maxX = Math.max(maxX, cmd.x)
      maxY = Math.max(maxY, cmd.y)
    }

    // Include control points for curves
    if (cmd.cp1) {
      minX = Math.min(minX, cmd.cp1.x)
      minY = Math.min(minY, cmd.cp1.y)
      maxX = Math.max(maxX, cmd.cp1.x)
      maxY = Math.max(maxY, cmd.cp1.y)
    }
    if (cmd.cp2) {
      minX = Math.min(minX, cmd.cp2.x)
      minY = Math.min(minY, cmd.cp2.y)
      maxX = Math.max(maxX, cmd.cp2.x)
      maxY = Math.max(maxY, cmd.cp2.y)
    }
    if (cmd.cp) {
      minX = Math.min(minX, cmd.cp.x)
      minY = Math.min(minY, cmd.cp.y)
      maxX = Math.max(maxX, cmd.cp.x)
      maxY = Math.max(maxY, cmd.cp.y)
    }
  }

  // Handle empty paths
  if (minX === Infinity) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }

  return { minX, minY, maxX, maxY }
}

/**
 * Calculate center point of path commands
 */
export function calculatePathCenter(commands: PathCommand[]): Point {
  const bounds = calculatePathBounds(commands)
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  }
}

/**
 * Rebuild SVG string from parsed data
 */
export function rebuildSvgString(parsedSvg: ParsedSvg): string {
  const { paths, viewBox, width, height } = parsedSvg

  const pathElements = paths
    .map(path => {
      const d = serializePathCommands(path.commands)
      let attrs = `d="${d}" fill="${path.fill}"`
      if (path.fillRule) {
        attrs += ` fill-rule="${path.fillRule}"`
      }
      if (path.stroke) {
        attrs += ` stroke="${path.stroke}"`
      }
      if (path.strokeWidth) {
        attrs += ` stroke-width="${path.strokeWidth}"`
      }
      // Effect references
      if (path.filterId) {
        attrs += ` filter="url(#${path.filterId})"`
      }
      if (path.maskId) {
        attrs += ` mask="url(#${path.maskId})"`
      }
      if (path.clipPathId) {
        attrs += ` clip-path="url(#${path.clipPathId})"`
      }
      // Color adjustments as JSON data attribute
      if (path.colorAdjustments) {
        attrs += ` data-adjustments='${JSON.stringify(path.colorAdjustments)}'`
      }
      // Rotation transform
      if (path.pathRotation && path.pathRotation !== 0) {
        const center = path.pathRotationOrigin || calculatePathCenter(path.commands)
        attrs += ` transform="rotate(${formatCoord(path.pathRotation)} ${formatCoord(center.x)} ${formatCoord(center.y)})"`
      }
      return `<path ${attrs} />`
    })
    .join('\n')

  const viewBoxStr = `${formatCoord(viewBox.x)} ${formatCoord(viewBox.y)} ${formatCoord(viewBox.width)} ${formatCoord(viewBox.height)}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxStr}" width="${formatCoord(width)}" height="${formatCoord(height)}">
${pathElements}
</svg>`
}
