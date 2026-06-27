/**
 * Movement Zone Scaling Helpers
 *
 * Utilities for scaling movement zone coordinates to storefront canvas space.
 */

/**
 * Scale SVG path data by independent X and Y factors.
 * Used to scale movementBounds.pathData to the storefront canvas coordinate space.
 *
 * Applies a simple regex-based coordinate scaling — sufficient for the closed shapes
 * used in movement zones (rectangles, ellipses, custom paths drawn in VectorEditor).
 * Each numeric coordinate pair is multiplied by scaleX/scaleY respectively.
 */
export function scaleCustomPath(pathData: string, scaleX: number, scaleY: number): string {
  if (!pathData || (scaleX === 1 && scaleY === 1)) return pathData

  // Scale SVG path coordinates using per-command regex replacement — handles all SVG command types
  // M/L/C/S/Q/T: both x and y coords; H: x only; V: y only; A: rx, ry, then x, y endpoint; Z: none
  return pathData
    .replace(/([MmLlCcSsQqTt])\s*([-\d.eE,\s]+)/g, (_match: string, cmd: string, coords: string) => {
      const nums = coords
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
      const scaled = nums.map((n: string, i: number) => {
        const v = parseFloat(n)
        return isNaN(v) ? n : (i % 2 === 0 ? v * scaleX : v * scaleY).toFixed(2)
      })
      return cmd + scaled.join(',')
    })
    .replace(/([Hh])\s*([-\d.eE,\s]+)/g, (_match: string, cmd: string, coords: string) => {
      const nums = coords
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
      const scaled = nums.map((n: string) => {
        const v = parseFloat(n)
        return isNaN(v) ? n : (v * scaleX).toFixed(2)
      })
      return cmd + scaled.join(',')
    })
    .replace(/([Vv])\s*([-\d.eE,\s]+)/g, (_match: string, cmd: string, coords: string) => {
      const nums = coords
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
      const scaled = nums.map((n: string) => {
        const v = parseFloat(n)
        return isNaN(v) ? n : (v * scaleY).toFixed(2)
      })
      return cmd + scaled.join(',')
    })
    .replace(/([Aa])\s*([-\d.eE,\s]+)/g, (_match: string, cmd: string, coords: string) => {
      // Arc: rx ry x-rotation large-arc-flag sweep-flag x y (7 values per arc)
      const nums = coords
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
      const scaled = nums.map((n: string, i: number) => {
        const v = parseFloat(n)
        if (isNaN(v)) return n
        const posInArc = i % 7
        if (posInArc === 0) return (v * scaleX).toFixed(2) // rx
        if (posInArc === 1) return (v * scaleY).toFixed(2) // ry
        if (posInArc === 5) return (v * scaleX).toFixed(2) // x endpoint
        if (posInArc === 6) return (v * scaleY).toFixed(2) // y endpoint
        return n // rotation, flags
      })
      return cmd + scaled.join(',')
    })
}
