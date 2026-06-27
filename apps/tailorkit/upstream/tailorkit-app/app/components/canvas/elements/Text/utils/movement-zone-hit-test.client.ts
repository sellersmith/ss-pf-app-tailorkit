/**
 * Hit-test utilities for movement zone boundary checking.
 *
 * Used by admin snap-back (TextWithZoneGroupRenderer) to validate drag-end position.
 * Storefront drag-handlers.ts uses an inline version for performance (avoids extension bundle import).
 */

import type { MovementBounds } from '~/types/psd'

/**
 * Check whether a canvas-space point (cx, cy) is inside a movement zone.
 *
 * - rect: simple bbox check
 * - ellipse: exact ellipse equation
 * - path: isPointInPath via Path2D (requires browser DOM)
 *
 * @param cx - Canvas-space X of the point to test (e.g. node center)
 * @param cy - Canvas-space Y of the point to test
 * @param bounds - MovementBounds zone descriptor
 * @returns true if the point is inside the zone shape
 */
export function isInsideMovementBounds(cx: number, cy: number, bounds: MovementBounds): boolean {
  const { x: zx, y: zy, width: zw, height: zh, type = 'rectangle' } = bounds

  if (type === 'ellipse') {
    const rx = zw / 2
    const ry = zh / 2
    const dx = cx - (zx + rx)
    const dy = cy - (zy + ry)
    return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1
  }

  if (type === 'path') {
    const { pathData, pathViewBox } = bounds
    if (!pathData || !pathViewBox?.width || !pathViewBox?.height) {
      // Fallback to bbox if pathData missing
      return cx >= zx && cx <= zx + zw && cy >= zy && cy <= zy + zh
    }
    try {
      // Build Path2D in canvas-space: zone-local coords → canvas coords
      // translate(zx, zy) moves origin to zone top-left, scale maps pathViewBox → zone bbox
      const m = new DOMMatrix().translate(zx, zy).scale(zw / pathViewBox.width, zh / pathViewBox.height)
      const scaled = new Path2D()
      scaled.addPath(new Path2D(pathData), m)

      // Use a tiny offscreen canvas for isPointInPath check
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const ctx = canvas.getContext('2d')!
      return ctx.isPointInPath(scaled, cx, cy)
    } catch {
      // DOM unavailable or invalid path — fallback to bbox
      return cx >= zx && cx <= zx + zw && cy >= zy && cy <= zy + zh
    }
  }

  // Default: rect bbox
  return cx >= zx && cx <= zx + zw && cy >= zy && cy <= zy + zh
}
