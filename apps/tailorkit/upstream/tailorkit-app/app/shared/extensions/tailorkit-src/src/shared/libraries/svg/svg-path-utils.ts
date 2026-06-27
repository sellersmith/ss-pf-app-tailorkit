/**
 * SVG Path Parsing Utilities for Storefront
 *
 * Provides functions to parse, manipulate, and serialize SVG path data.
 * This is a self-contained module with no external dependencies.
 */

export interface Point {
  x: number
  y: number
}

export interface PathCommand {
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

/**
 * Parse SVG path number sequence handling compact notation
 * Note: Arc flags (0 or 1) can be concatenated without separators in SVG
 * e.g., "A50,50 0 11 100,150" where "11" means largeArc=1, sweep=1
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
 * Flags are always 0 or 1 and can be written without separators
 */
function parseArcParams(params: string): number[][] {
  const arcs: number[][] = []

  // Match arc parameter groups more carefully
  // rx,ry rotation flag flag x,y - flags can be 0 or 1 without separators
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
export function parseSvgPath(pathD: string): PathCommand[] {
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
        // Use specialized arc parser to handle concatenated flags
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
 * Format a number with appropriate precision
 * Use more decimal places to avoid rounding errors in clip paths
 */
function formatCoord(n: number): string {
  // Use 2 decimal places for better precision while keeping output readable
  return Number(n.toFixed(2)).toString()
}

/**
 * Serialize path commands back to SVG path d attribute
 */
export function serializePathCommands(commands: PathCommand[]): string {
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
