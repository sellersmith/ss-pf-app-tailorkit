/**
 * SVG path scaling utility for movement zone paths in the storefront bundle.
 *
 * Mirrors the scaleSvgPath logic from the admin-side
 * movement-zone-path-transform.client.ts — kept separate to avoid pulling
 * admin-only imports into the storefront bundle.
 */

/**
 * Scale all coordinates in an SVG path d-attribute by (sx, sy).
 * Both absolute and relative commands are scaled (relative offsets scale proportionally).
 *
 * Supported commands:
 *   M L C S Q T m l c s q t — paired-coordinate (x,y) commands
 *   H h                     — horizontal (x only)
 *   V v                     — vertical (y only)
 *   A a                     — arc (rx, ry, x-rotation, large-arc-flag, sweep-flag, x, y)
 */
export function scaleZonePath(d: string, sx: number, sy: number): string {
  if (!d || (sx === 1 && sy === 1)) return d

  return (
    d
      // Paired-coordinate commands: M L C S Q T (absolute + relative)
      .replace(/([MLCSQTmlcsqt])\s*([-\d.eE,\s]+)/g, (_, cmd, coords) => {
        const nums = coords
          .trim()
          .split(/[\s,]+/)
          .filter(Boolean)
        const scaled = nums.map((n: string, i: number) => {
          const v = parseFloat(n)
          return isNaN(v) ? n : v * (i % 2 === 0 ? sx : sy)
        })
        return cmd + scaled.join(',')
      })
      // Horizontal commands: H (absolute) / h (relative) — x only
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
              return isNaN(v) ? n : v * sx
            })
            .join(',')
        )
      })
      // Vertical commands: V (absolute) / v (relative) — y only
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
              return isNaN(v) ? n : v * sy
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
