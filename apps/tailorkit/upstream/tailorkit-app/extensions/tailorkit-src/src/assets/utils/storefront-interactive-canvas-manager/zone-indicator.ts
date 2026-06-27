/**
 * Zone indicator rendering for the Buyer Text Movement Zone feature.
 *
 * Creates a shape-aware dashed outline that shows where the buyer can move the text layer.
 * Rendered OUTSIDE the clip group so it is always visible even when text overflows.
 *
 * Supported shapes:
 *   rect     → Konva.Rect  (default)
 *   ellipse  → Konva.Ellipse
 *   path     → Konva.Path  (pathData is pre-scaled to canvas-px by preparation-fns.server.ts)
 */

import Konva from 'konva'
import type { MovementBounds } from '../../stores/storefront-layer-state'
import { ZONE_DASH, ZONE_FILL, ZONE_STROKE_COLOR, ZONE_STROKE_WIDTH } from '../../../shared/constants/movement-zone'

const ZONE_INDICATOR_NAME_PREFIX = 'zone-indicator-'

/**
 * Creates a shape-aware zone indicator (dashed outline) for a movement zone.
 * Zone indicator renders OUTSIDE the clip group so it is always visible.
 * Opacity defaults to 0 (hidden); use showZoneIndicator / hideZoneIndicator to toggle.
 */
export function createZoneIndicator(layerId: string, bounds: MovementBounds): Konva.Shape {
  const name = `${ZONE_INDICATOR_NAME_PREFIX}${layerId}`

  const baseProps = {
    name,
    x: bounds.x,
    y: bounds.y,
    stroke: ZONE_STROKE_COLOR,
    strokeWidth: ZONE_STROKE_WIDTH,
    dash: ZONE_DASH,
    fill: ZONE_FILL,
    opacity: 0, // hidden by default — show on hover/select
    listening: false, // indicator is visual only, not interactive
  }

  if (bounds.type === 'ellipse') {
    return new Konva.Ellipse({
      ...baseProps,
      // Konva.Ellipse x/y is the center point
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
      radiusX: bounds.width / 2,
      radiusY: bounds.height / 2,
    })
  }

  if (bounds.type === 'path' && bounds.pathData) {
    // pathData is already in canvas-px zone-local coordinates (pre-scaled by preparation-fns.server.ts).
    // Konva.Path renders data at the node's position (bounds.x, bounds.y) using scaleX/scaleY.
    // No additional scaling — scaleX/scaleY = 1 since path coordinates are already correct.
    return new Konva.Path({
      ...baseProps,
      data: bounds.pathData,
      scaleX: 1,
      scaleY: 1,
    })
  }

  // Default: rectangle
  return new Konva.Rect({
    ...baseProps,
    width: bounds.width,
    height: bounds.height,
  })
}

/**
 * Show the zone indicator for a layer (full opacity).
 * Consistent with admin's ZoneBorderShape which always shows at opacity 1.
 */
export function showZoneIndicator(konvaLayer: Konva.Layer, layerId: string): void {
  const shape = konvaLayer.findOne(`.${ZONE_INDICATOR_NAME_PREFIX}${layerId}`) as Konva.Shape | undefined
  if (!shape) return
  shape.opacity(1)
  konvaLayer.batchDraw()
}

/**
 * Hide zone indicator (opacity 0).
 */
export function hideZoneIndicator(konvaLayer: Konva.Layer, layerId: string): void {
  const shape = konvaLayer.findOne(`.${ZONE_INDICATOR_NAME_PREFIX}${layerId}`) as Konva.Shape | undefined
  if (!shape) return
  shape.opacity(0)
  konvaLayer.batchDraw()
}

/**
 * Remove zone indicator from layer entirely (e.g., on canvas clear).
 */
export function removeZoneIndicator(konvaLayer: Konva.Layer, layerId: string): void {
  const shape = konvaLayer.findOne(`.${ZONE_INDICATOR_NAME_PREFIX}${layerId}`) as Konva.Shape | undefined
  if (!shape) return
  shape.destroy()
  konvaLayer.batchDraw()
}
