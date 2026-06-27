/**
 * Hit-test utilities for movement zone boundary checking (storefront bundle).
 *
 * Tests whether a canvas-space point is inside a movement zone.
 * Used by drag-handlers.ts (dragBoundFunc) and manager.ts (initial position clamp).
 */

import type { LayerInteractionFlags } from '../../stores/storefront-layer-state'

/** Zone descriptor (subset of LayerInteractionFlags.movementBounds) */
type ZoneBounds = NonNullable<LayerInteractionFlags['movementBounds']>

/**
 * Pre-built resources for isPointInPath checks on a path zone.
 * Created once per layer to avoid rebuilding on every drag frame.
 */
export interface ZoneHitResources {
  /** Path2D in canvas-space coords (null for rect/ellipse zones or if Path2D unavailable) */
  zonePath2D: Path2D | null
  /** Tiny offscreen canvas context for isPointInPath (null if unavailable) */
  hitCtx: CanvasRenderingContext2D | null
}

/**
 * Build reusable hit-test resources for a zone.
 * Call once at setup time; reuse across drag frames.
 */
export function buildZoneHitResources(bounds: ZoneBounds): ZoneHitResources {
  const { x: zx, y: zy, type = 'rectangle' } = bounds

  let zonePath2D: Path2D | null = null
  let hitCtx: CanvasRenderingContext2D | null = null

  if (type === 'path') {
    const { pathData } = bounds
    if (pathData) {
      try {
        // pathData is already in zone-local canvas-px coordinates (pre-scaled by
        // server's scaleCustomPath() in preparation-fns.server.ts).
        // Only translate to canvas-space — do NOT apply scale (would double-scale).
        const m = new DOMMatrix().translate(zx, zy)
        const scaled = new Path2D()
        scaled.addPath(new Path2D(pathData), m)
        zonePath2D = scaled

        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        hitCtx = canvas.getContext('2d')
      } catch {
        // DOM unavailable (SSR / test env) — leave null, fallback to bbox
      }
    }
  }

  return { zonePath2D, hitCtx }
}

/**
 * Test whether canvas-space point (cx, cy) is inside the zone.
 *
 * @param cx - Canvas-space X of the test point (typically node center)
 * @param cy - Canvas-space Y of the test point
 * @param bounds - Zone descriptor
 * @param resources - Pre-built hit resources from buildZoneHitResources()
 */
export function isInsideZone(cx: number, cy: number, bounds: ZoneBounds, resources: ZoneHitResources): boolean {
  const { x: zx, y: zy, width: zw, height: zh, type = 'rectangle' } = bounds

  if (type === 'ellipse') {
    const rx = zw / 2
    const ry = zh / 2
    const dx = cx - (zx + rx)
    const dy = cy - (zy + ry)
    return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1
  }

  if (type === 'path' && resources.zonePath2D && resources.hitCtx) {
    return resources.hitCtx.isPointInPath(resources.zonePath2D, cx, cy)
  }

  // Default: rect bbox (also fallback when path resources unavailable)
  return cx >= zx && cx <= zx + zw && cy >= zy && cy <= zy + zh
}
