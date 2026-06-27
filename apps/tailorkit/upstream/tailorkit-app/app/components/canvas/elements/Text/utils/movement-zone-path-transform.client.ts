/**
 * SVG path coordinate transform utilities for movement zone editing.
 * Client-only (uses DOM for getBBox).
 */

/**
 * Translate all coordinates in an SVG path d-attribute by (dx, dy).
 * Only translates ABSOLUTE commands (uppercase). Relative commands (lowercase)
 * encode offsets from the current point and are unaffected by a global translate.
 *
 * Precondition: caller should use absolute-command paths (as VectorEditor outputs).
 */
export function translateSvgPath(d: string, dx: number, dy: number): string {
  if (!d || (dx === 0 && dy === 0)) return d
  return (
    d
      // Absolute paired-coordinate commands: M L C S Q T (x,y pairs)
      .replace(/([MLCSQT])\s*([-\d.eE,\s]+)/g, (_, cmd, coords) => {
        const nums = coords
          .trim()
          .split(/[\s,]+/)
          .filter(Boolean)
        const shifted = nums.map((n: string, i: number) => {
          const v = parseFloat(n)
          if (isNaN(v)) return n
          return (v + (i % 2 === 0 ? dx : dy)).toFixed(2)
        })
        return cmd + shifted.join(',')
      })
      // Absolute horizontal: H (x only)
      .replace(/H\s*([-\d.eE,\s]+)/g, (_, coords) => {
        const nums = coords
          .trim()
          .split(/[\s,]+/)
          .filter(Boolean)
        return `H${nums
          .map((n: string) => {
            const v = parseFloat(n)
            return isNaN(v) ? n : (v + dx).toFixed(2)
          })
          .join(',')}`
      })
      // Absolute vertical: V (y only)
      .replace(/V\s*([-\d.eE,\s]+)/g, (_, coords) => {
        const nums = coords
          .trim()
          .split(/[\s,]+/)
          .filter(Boolean)
        return `V${nums
          .map((n: string) => {
            const v = parseFloat(n)
            return isNaN(v) ? n : (v + dy).toFixed(2)
          })
          .join(',')}`
      })
      // Absolute arc: A (rx ry x-rotation large-arc-flag sweep-flag x y)
      .replace(/A\s*([-\d.eE,\s]+)/g, (_, coords) => {
        const nums = coords
          .trim()
          .split(/[\s,]+/)
          .filter(Boolean)
        const shifted = nums.map((n: string, i: number) => {
          const v = parseFloat(n)
          if (isNaN(v)) return n
          const pos = i % 7
          if (pos === 5) return (v + dx).toFixed(2) // x endpoint
          if (pos === 6) return (v + dy).toFixed(2) // y endpoint
          return n
        })
        return `A${shifted.join(',')}`
      })
  )
}

/**
 * Scale all coordinates in an SVG path d-attribute by (sx, sy).
 * Both absolute and relative commands are scaled (relative offsets scale proportionally).
 */
export function scaleSvgPath(d: string, sx: number, sy: number): string {
  if (!d || (sx === 1 && sy === 1)) return d
  return (
    d
      .replace(/([MLCSQTmlcsqt])\s*([-\d.eE,\s]+)/g, (_, cmd, coords) => {
        const nums = coords
          .trim()
          .split(/[\s,]+/)
          .filter(Boolean)
        const scaled = nums.map((n: string, i: number) => {
          const v = parseFloat(n)
          return isNaN(v) ? n : String(v * (i % 2 === 0 ? sx : sy))
        })
        return cmd + scaled.join(',')
      })
      .replace(/([Hh])\s*([-\d.eE,\s]+)/g, (_, cmd, coords) => {
        const nums = coords
          .trim()
          .split(/[\s,]+/)
          .filter(Boolean)
        return (
          cmd
          + nums
            .map((n: string) => {
              const v = parseFloat(n)
              return isNaN(v) ? n : String(v * sx)
            })
            .join(',')
        )
      })
      .replace(/([Vv])\s*([-\d.eE,\s]+)/g, (_, cmd, coords) => {
        const nums = coords
          .trim()
          .split(/[\s,]+/)
          .filter(Boolean)
        return (
          cmd
          + nums
            .map((n: string) => {
              const v = parseFloat(n)
              return isNaN(v) ? n : String(v * sy)
            })
            .join(',')
        )
      })
      // Arc commands: A (absolute) / a (relative)
      // Format: A rx ry x-rotation large-arc-flag sweep-flag x y
      // Scale rx (pos 0) by sx, ry (pos 1) by sy, endpoint x (pos 5) by sx, endpoint y (pos 6) by sy.
      // Rotation (pos 2) and flags (pos 3, 4) are dimensionless — left unchanged.
      .replace(/([Aa])\s*([-\d.eE,\s]+)/g, (_, cmd, coords) => {
        const nums = coords
          .trim()
          .split(/[\s,]+/)
          .filter(Boolean)
        const scaled = nums.map((n: string, i: number) => {
          const v = parseFloat(n)
          if (isNaN(v)) return n
          const pos = i % 7
          if (pos === 0) return String(v * sx) // rx
          if (pos === 1) return String(v * sy) // ry
          if (pos === 5) return String(v * sx) // endpoint x
          if (pos === 6) return String(v * sy) // endpoint y
          return n // rotation, flags — unchanged
        })
        return cmd + scaled.join(',')
      })
  )
}

/**
 * Compute axis-aligned bounding box of an SVG path using browser SVGPathElement.getBBox().
 * Returns null if DOM unavailable or path invalid.
 */
export function computeSvgPathBoundingBox(d: string): { x: number; y: number; width: number; height: number } | null {
  if (typeof document === 'undefined') return null
  const svgNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNS, 'svg')
  svg.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none'
  const pathEl = document.createElementNS(svgNS, 'path')
  pathEl.setAttribute('d', d)
  svg.appendChild(pathEl)
  document.body.appendChild(svg)
  try {
    const { x, y, width, height } = pathEl.getBBox()
    return { x, y, width, height }
  } catch {
    return null
  } finally {
    document.body.removeChild(svg)
  }
}
