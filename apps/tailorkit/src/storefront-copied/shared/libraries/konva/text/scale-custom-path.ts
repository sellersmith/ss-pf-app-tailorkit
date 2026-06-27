/**
 * Scale custom SVG path data to fit within text layer dimensions
 * Used for custom text-on-path feature with VectorEditor integration
 *
 * This is the storefront version of the utility - no external dependencies
 */

interface Point {
  x: number
  y: number
}

interface PathCommand {
  type: string
  x: number
  y: number
  cp1?: Point
  cp2?: Point
  cp?: Point
  rx?: number
  ry?: number
  rotation?: number
  largeArc?: boolean
  sweep?: boolean
}

export interface CustomPathMetadata {
  viewBoxWidth: number
  viewBoxHeight: number
}

/**
 * Parse SVG path number sequence handling compact notation
 */
function parseSvgNumbers(params: string): number[] {
  const numbers: number[] = []
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

/**
 * Parse SVG path d attribute into array of commands
 */
function parseSvgPath(pathD: string): PathCommand[] {
  const commands: PathCommand[] = []
  const commandRegex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g
  let match: RegExpExecArray | null

  let currentX = 0
  let currentY = 0
  let startX = 0
  let startY = 0

  while ((match = commandRegex.exec(pathD)) !== null) {
    const type = match[1]
    const params = match[2].trim()
    const numbers = parseSvgNumbers(params)

    const isRelative = type === type.toLowerCase()
    const baseX = isRelative ? currentX : 0
    const baseY = isRelative ? currentY : 0

    switch (type.toUpperCase()) {
      case 'M': {
        const x = (numbers[0] || 0) + baseX
        const y = (numbers[1] || 0) + baseY
        commands.push({ type, x, y })
        currentX = x
        currentY = y
        startX = x
        startY = y

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
        for (let i = 0; i < numbers.length; i++) {
          const x = (numbers[i] || 0) + (i === 0 ? baseX : isRelative ? currentX : 0)
          commands.push({ type, x, y: currentY })
          currentX = x
        }
        break
      }

      case 'V': {
        for (let i = 0; i < numbers.length; i++) {
          const y = (numbers[i] || 0) + (i === 0 ? baseY : isRelative ? currentY : 0)
          commands.push({ type, x: currentX, y })
          currentY = y
        }
        break
      }

      case 'C': {
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
        for (let i = 0; i < numbers.length; i += 4) {
          const bx = i === 0 ? baseX : isRelative ? currentX : 0
          const by = i === 0 ? baseY : isRelative ? currentY : 0
          const cp2x = (numbers[i] || 0) + bx
          const cp2y = (numbers[i + 1] || 0) + by
          const x = (numbers[i + 2] || 0) + bx
          const y = (numbers[i + 3] || 0) + by

          let cp1x = currentX
          let cp1y = currentY

          if (commands.length > 0) {
            const prevCmd = commands[commands.length - 1]
            if (prevCmd.cp2) {
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
        for (let i = 0; i < numbers.length; i += 4) {
          const bx = i === 0 ? baseX : isRelative ? currentX : 0
          const by = i === 0 ? baseY : isRelative ? currentY : 0
          const cpx = (numbers[i] || 0) + bx
          const cpy = (numbers[i + 1] || 0) + by
          const x = (numbers[i + 2] || 0) + bx
          const y = (numbers[i + 3] || 0) + by
          commands.push({ type, x, y, cp: { x: cpx, y: cpy } })
          currentX = x
          currentY = y
        }
        break
      }

      case 'T': {
        for (let i = 0; i < numbers.length; i += 2) {
          const bx = i === 0 ? baseX : isRelative ? currentX : 0
          const by = i === 0 ? baseY : isRelative ? currentY : 0
          const x = (numbers[i] || 0) + bx
          const y = (numbers[i + 1] || 0) + by

          let cpx = currentX
          let cpy = currentY

          if (commands.length > 0) {
            const prevCmd = commands[commands.length - 1]
            if (prevCmd.cp) {
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
 * Calculate bounding box of path commands
 */
function calculatePathBounds(commands: PathCommand[]): {
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
    if (cmd.type.toUpperCase() === 'Z') continue

    if (cmd.x !== undefined && cmd.y !== undefined) {
      minX = Math.min(minX, cmd.x)
      minY = Math.min(minY, cmd.y)
      maxX = Math.max(maxX, cmd.x)
      maxY = Math.max(maxY, cmd.y)
    }

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

  if (minX === Infinity) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }

  return { minX, minY, maxX, maxY }
}

/**
 * Format a number to a maximum of 1 decimal place
 */
function formatCoord(n: number): string {
  return Number(n.toFixed(1)).toString()
}

/**
 * Serialize path commands back to SVG path d attribute
 */
function serializePathCommands(commands: PathCommand[]): string {
  return commands
    .map(cmd => {
      const type = cmd.type.toUpperCase()
      switch (type) {
        case 'M':
        case 'L':
          return `${type}${formatCoord(cmd.x)},${formatCoord(cmd.y)}`
        case 'T':
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
          const cp2 = `${formatCoord(cmd.cp2?.x ?? 0)},${formatCoord(cmd.cp2?.y ?? 0)}`
          const end = `${formatCoord(cmd.x)},${formatCoord(cmd.y)}`
          if (cmd.cp1) {
            const cp1 = `${formatCoord(cmd.cp1.x)},${formatCoord(cmd.cp1.y)}`
            return `C${cp1} ${cp2} ${end}`
          }
          return `${type}${cp2} ${end}`
        }
        case 'Q':
          return `${type}${formatCoord(cmd.cp?.x ?? 0)},${formatCoord(cmd.cp?.y ?? 0)} ${formatCoord(cmd.x)},${formatCoord(cmd.y)}`
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
 * Scale and transform path commands to fit within target dimensions
 * Maintains aspect ratio and centers the path
 *
 * NOTE: For paths with arc commands (circles/ellipses), the endpoint-based bounds
 * may not represent the full visual extent. We use sourceWidth/sourceHeight
 * (from viewBox metadata) as the authoritative dimensions for scaling.
 */
function scalePathCommands(
  commands: PathCommand[],
  targetWidth: number,
  targetHeight: number,
  sourceWidth: number,
  sourceHeight: number
): PathCommand[] {
  const bounds = calculatePathBounds(commands)
  const pathWidth = bounds.maxX - bounds.minX
  const pathHeight = bounds.maxY - bounds.minY

  // Avoid division by zero for point-like paths
  if (pathWidth === 0 && pathHeight === 0) {
    return commands
  }

  // FIX: For paths with arcs, endpoint-based bounds can be wrong (e.g., circle endpoints
  // are all on the horizontal centerline, giving pathHeight=0). Use sourceWidth/sourceHeight
  // as the authoritative dimensions for scaling since they come from the viewBox.
  const useSourceForScaling = sourceWidth > 0 && sourceHeight > 0
  const effectiveWidth = useSourceForScaling ? sourceWidth : pathWidth || targetWidth
  const effectiveHeight = useSourceForScaling ? sourceHeight : pathHeight || targetHeight

  // Calculate scale to fit within target dimensions while maintaining aspect ratio
  const scaleX = targetWidth / effectiveWidth
  const scaleY = targetHeight / effectiveHeight
  const scale = Math.min(scaleX, scaleY)

  // Calculate the scaled dimensions
  const scaledWidth = effectiveWidth * scale
  const scaledHeight = effectiveHeight * scale

  // Calculate offset to center the scaled path in target
  const centerOffsetX = (targetWidth - scaledWidth) / 2
  const centerOffsetY = (targetHeight - scaledHeight) / 2

  // When using source viewBox dimensions, path coordinates are relative to viewBox origin (0,0)
  // When using path bounds, we need to translate path to origin first before scaling
  const originOffsetX = useSourceForScaling ? 0 : bounds.minX
  const originOffsetY = useSourceForScaling ? 0 : bounds.minY

  return commands.map(cmd => {
    const newCmd: PathCommand = { ...cmd }

    if (cmd.type.toUpperCase() !== 'Z') {
      // Translate to origin, scale, then center in target
      newCmd.x = (cmd.x - originOffsetX) * scale + centerOffsetX
      newCmd.y = (cmd.y - originOffsetY) * scale + centerOffsetY
    }

    if (cmd.cp1) {
      newCmd.cp1 = {
        x: (cmd.cp1.x - originOffsetX) * scale + centerOffsetX,
        y: (cmd.cp1.y - originOffsetY) * scale + centerOffsetY,
      }
    }
    if (cmd.cp2) {
      newCmd.cp2 = {
        x: (cmd.cp2.x - originOffsetX) * scale + centerOffsetX,
        y: (cmd.cp2.y - originOffsetY) * scale + centerOffsetY,
      }
    }
    if (cmd.cp) {
      newCmd.cp = {
        x: (cmd.cp.x - originOffsetX) * scale + centerOffsetX,
        y: (cmd.cp.y - originOffsetY) * scale + centerOffsetY,
      }
    }

    if (cmd.rx !== undefined) {
      newCmd.rx = cmd.rx * scale
    }
    if (cmd.ry !== undefined) {
      newCmd.ry = cmd.ry * scale
    }

    return newCmd
  })
}

/**
 * Reverse the direction of path commands
 * This makes text flow in the opposite direction along the path
 */
function reversePathCommands(commands: PathCommand[]): PathCommand[] {
  if (commands.length === 0) return []

  // Filter out Z commands and get the actual path points
  const drawCommands = commands.filter(cmd => cmd.type.toUpperCase() !== 'Z')

  if (drawCommands.length === 0) return commands

  // Reverse the order of commands
  const reversed: PathCommand[] = []

  // First command becomes M to the last point
  const lastCmd = drawCommands[drawCommands.length - 1]
  reversed.push({ type: 'M', x: lastCmd.x, y: lastCmd.y })

  // Process commands in reverse order (skip the last one as it's now our M)
  for (let i = drawCommands.length - 1; i > 0; i--) {
    const cmd = drawCommands[i]
    const prevCmd = drawCommands[i - 1]
    const type = cmd.type.toUpperCase()

    switch (type) {
      case 'L':
      case 'M':
        // Line to previous point
        reversed.push({ type: 'L', x: prevCmd.x, y: prevCmd.y })
        break

      case 'H':
        // Horizontal line to previous point
        reversed.push({ type: 'L', x: prevCmd.x, y: prevCmd.y })
        break

      case 'V':
        // Vertical line to previous point
        reversed.push({ type: 'L', x: prevCmd.x, y: prevCmd.y })
        break

      case 'C':
        // Cubic bezier - swap control points
        if (cmd.cp1 && cmd.cp2) {
          reversed.push({
            type: 'C',
            x: prevCmd.x,
            y: prevCmd.y,
            cp1: { x: cmd.cp2.x, y: cmd.cp2.y },
            cp2: { x: cmd.cp1.x, y: cmd.cp1.y },
          })
        } else {
          reversed.push({ type: 'L', x: prevCmd.x, y: prevCmd.y })
        }
        break

      case 'S':
        // Smooth cubic bezier
        if (cmd.cp2) {
          reversed.push({
            type: 'C',
            x: prevCmd.x,
            y: prevCmd.y,
            cp1: { x: cmd.cp2.x, y: cmd.cp2.y },
            cp2: cmd.cp1 ? { x: cmd.cp1.x, y: cmd.cp1.y } : { x: cmd.x, y: cmd.y },
          })
        } else {
          reversed.push({ type: 'L', x: prevCmd.x, y: prevCmd.y })
        }
        break

      case 'Q':
        // Quadratic bezier - control point stays the same
        if (cmd.cp) {
          reversed.push({
            type: 'Q',
            x: prevCmd.x,
            y: prevCmd.y,
            cp: { x: cmd.cp.x, y: cmd.cp.y },
          })
        } else {
          reversed.push({ type: 'L', x: prevCmd.x, y: prevCmd.y })
        }
        break

      case 'T':
        // Smooth quadratic bezier
        if (cmd.cp) {
          reversed.push({
            type: 'Q',
            x: prevCmd.x,
            y: prevCmd.y,
            cp: { x: cmd.cp.x, y: cmd.cp.y },
          })
        } else {
          reversed.push({ type: 'L', x: prevCmd.x, y: prevCmd.y })
        }
        break

      case 'A':
        // Arc - flip the sweep flag to reverse direction
        reversed.push({
          type: 'A',
          x: prevCmd.x,
          y: prevCmd.y,
          rx: cmd.rx,
          ry: cmd.ry,
          rotation: cmd.rotation,
          largeArc: cmd.largeArc,
          sweep: !cmd.sweep, // Flip sweep direction
        })
        break

      default:
        reversed.push({ type: 'L', x: prevCmd.x, y: prevCmd.y })
    }
  }

  // Check if original path was closed
  const hadZ = commands.some(cmd => cmd.type.toUpperCase() === 'Z')
  if (hadZ) {
    const firstPoint = drawCommands[0]
    reversed.push({ type: 'Z', x: firstPoint.x, y: firstPoint.y })
  }

  return reversed
}

export interface ScaleCustomPathOptions {
  metadata?: CustomPathMetadata
  inverted?: boolean
}

/**
 * Scale custom path data to fit within text layer dimensions
 */
export function scaleCustomPathToFit(
  pathData: string,
  targetWidth: number,
  targetHeight: number,
  metadataOrOptions?: CustomPathMetadata | ScaleCustomPathOptions
): string {
  if (!pathData || pathData.trim() === '') {
    return ''
  }

  // Handle both old (metadata only) and new (options object) signatures
  let metadata: CustomPathMetadata | undefined
  let inverted = false

  if (metadataOrOptions) {
    if ('inverted' in metadataOrOptions) {
      metadata = metadataOrOptions.metadata
      inverted = metadataOrOptions.inverted ?? false
    } else {
      metadata = metadataOrOptions
    }
  }

  let commands = parseSvgPath(pathData)

  if (commands.length === 0) {
    return ''
  }

  // Reverse path direction if inverted
  if (inverted) {
    commands = reversePathCommands(commands)
  }

  let sourceWidth: number
  let sourceHeight: number

  if (metadata?.viewBoxWidth && metadata?.viewBoxHeight) {
    sourceWidth = metadata.viewBoxWidth
    sourceHeight = metadata.viewBoxHeight
  } else {
    const bounds = calculatePathBounds(commands)
    sourceWidth = bounds.maxX - bounds.minX || targetWidth
    sourceHeight = bounds.maxY - bounds.minY || targetHeight
  }

  const scaledCommands = scalePathCommands(commands, targetWidth, targetHeight, sourceWidth, sourceHeight)

  return serializePathCommands(scaledCommands)
}

/**
 * Extract the first path's d attribute from an SVG string
 * Used to get path data from VectorEditor output
 *
 * @param svgString - Full SVG string from VectorEditor
 * @returns Path d attribute string or empty string if not found
 */
export function extractFirstPathData(svgString: string): string {
  const dMatch = svgString.match(/<path[^>]*d="([^"]*)"/i)
  return dMatch ? dMatch[1] : ''
}

/**
 * Extract viewBox dimensions from an SVG string
 *
 * @param svgString - Full SVG string from VectorEditor
 * @returns ViewBox dimensions or null if not found
 */
export function extractViewBoxDimensions(svgString: string): CustomPathMetadata | null {
  const viewBoxMatch = svgString.match(/viewBox="([^"]*)"/i)

  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/[\s,]+/).map(Number)
    if (parts.length >= 4 && !isNaN(parts[2]) && !isNaN(parts[3])) {
      return {
        viewBoxWidth: parts[2],
        viewBoxHeight: parts[3],
      }
    }
  }

  // Try width/height attributes as fallback
  const widthMatch = svgString.match(/width="([^"]*)"/i)
  const heightMatch = svgString.match(/height="([^"]*)"/i)

  if (widthMatch && heightMatch) {
    const width = parseFloat(widthMatch[1])
    const height = parseFloat(heightMatch[1])
    if (!isNaN(width) && !isNaN(height)) {
      return {
        viewBoxWidth: width,
        viewBoxHeight: height,
      }
    }
  }

  return null
}
