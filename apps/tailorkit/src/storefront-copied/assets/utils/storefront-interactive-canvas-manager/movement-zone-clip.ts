/**
 * Wraps a text node in a FIXED Konva.Group with clipFunc so text outside the
 * movement zone boundary is hidden. The clip group stays at (bounds.x, bounds.y)
 * and the text node is the drag target — keeping clipFunc stationary while text pans.
 * Zone indicator is added to the layer OUTSIDE the clip group so it's always visible.
 */

import type Konva from 'konva'
import { TailorKitKonva as KonvaRuntime } from '../../../shared/libraries/konva/runtime-konva'
import type { MovementBounds } from '../../stores/storefront-layer-state'

const CLIP_GROUP_NAME_PREFIX = 'movement-zone-clip-'

// Attribute on clip groups so resolveInteractiveTarget in manager.ts skips them
export const MOVEMENT_ZONE_CLIP_ATTR = '_isMovementZoneClip'

// Build clipFunc in GROUP-LOCAL coords (origin = zone top-left = 0,0 inside clip group)
function buildClipFunc(bounds: MovementBounds): (ctx: Konva.Context) => void {
  const { type, width, height, pathData } = bounds

  return (ctx: Konva.Context) => {
    // Skip clipping on hit canvas so text outside zone is still clickable
    const isHitCanvas = Boolean((ctx as any)._canvas?.isHit)
    if (isHitCanvas) {
      ctx.rect(-10000, -10000, 20000, 20000)
      return
    }

    if (type === 'ellipse') {
      ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2)
    } else if (type === 'path' && pathData) {
      // pathData is pre-scaled to canvas-px by preparation-fns.server.ts — no scale here
      // Two-step: clip raw context via Path2D, add bbox for Konva's own clip() call
      const raw = (ctx as any)._context as CanvasRenderingContext2D
      if (!raw) {
        ctx.rect(0, 0, width, height)
      } else {
        raw.clip(new Path2D(pathData), 'nonzero')
        ctx.rect(0, 0, width, height)
      }
    } else {
      ctx.rect(0, 0, width, height)
    }
  }
}

/**
 * Wrap a Konva node in a fixed movement zone clip group.
 * Returns the clip group and the text node (interactive drag target).
 * Register `interactiveTarget` — NOT clipGroup — as interactive.
 */
export function wrapNodeInMovementZoneClip(
  node: Konva.Node,
  layerId: string,
  bounds: MovementBounds,
  container: Konva.Layer | Konva.Group
): { clipGroup: Konva.Group; interactiveTarget: Konva.Node } {
  const nodeX = node.x()
  const nodeY = node.y()

  node.remove()

  const clipGroup = new KonvaRuntime.Group({
    name: `${CLIP_GROUP_NAME_PREFIX}${layerId}`,
    x: bounds.x,
    y: bounds.y,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    clipFunc: buildClipFunc(bounds) as any,
  })

  clipGroup.setAttr(MOVEMENT_ZONE_CLIP_ATTR, true)

  node.x(nodeX - bounds.x)
  node.y(nodeY - bounds.y)

  clipGroup.add(node as Konva.Shape | Konva.Group)
  container.add(clipGroup)

  // Override drawHit: null clipFunc on hit canvas so text outside zone is still clickable.
  // clipFunc clips both scene and hit canvases — this fix keeps scene clipping intact.
  ;(clipGroup as any).drawHit = function (...args: unknown[]) {
    const savedClipFunc = (this as Konva.Group).clipFunc()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(this as Konva.Group).clipFunc(null as any)
    try {
      ;(Object.getPrototypeOf(this) as { drawHit: (...a: unknown[]) => void }).drawHit.call(this, ...args)
    } finally {
      ;(this as Konva.Group).clipFunc(savedClipFunc)
    }
  }

  return { clipGroup, interactiveTarget: node }
}

/** Find the movement zone clip group for a given layer ID. */
export function findMovementZoneClipGroup(
  container: Konva.Layer | Konva.Group,
  layerId: string
): Konva.Group | undefined {
  return container.findOne<Konva.Group>(`.${CLIP_GROUP_NAME_PREFIX}${layerId}`) ?? undefined
}
