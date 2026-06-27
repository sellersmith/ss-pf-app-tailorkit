/**
 * Drag handler attachment for interactive canvas layers.
 *
 * Handles drag start/end position tracking, undo delta creation,
 * and center-point bounds checking to keep layers within the canvas.
 */

import Konva from 'konva'
import type { LayerTransform, LayerInteractionFlags } from '../../stores/storefront-layer-state'
import { StorefrontLayerState } from '../../stores/storefront-layer-state'
import { StorefrontUndoStack } from '../../stores/storefront-undo-stack'
import type { LayerTransformSnapshot } from '../../stores/storefront-undo-stack'
import type { DragPlugin } from './constants'
import { buildZoneHitResources, isInsideZone } from './zone-hit-test'
import { Transmitter } from '../../libraries/transmitter'
import { findScaledAncestorGroup } from './scaled-ancestor'
import { MOVEMENT_ZONE_CLIP_ATTR } from './movement-zone-clip'

/**
 * Find the Konva Group that defines canvas-space (template pixel) reference frame.
 *
 * Walks up from `node` to the nearest layer-wrapper Group, skipping the
 * movement-zone clip group (which sits at bounds.x/y inside the wrapper).
 *
 * The wrapper's local coordinate space is what `flags.movementBounds` is expressed in,
 * so passing it as `relativeTo` to getClientRect makes box coords directly comparable
 * to bounds without any offset correction.
 *
 * `findScaledAncestorGroup` alone is insufficient because the wrapper may have only
 * a translation (no scale). Falling back to stage there leaves box coords in
 * stage-local with the wrapper offset baked in, while bounds remain in wrapper-local.
 * That mismatch caused the binary-search projection to drift the constrained position
 * away from the proposed drag direction (visible as drag-down being clamped upward).
 *
 * Uses `MOVEMENT_ZONE_CLIP_ATTR` rather than `clipFunc()` to detect the clip group,
 * which is race-safe against any code path that temporarily clears clipFunc (e.g.,
 * hit-canvas overrides). The attr is set once at clip-group construction and never
 * cleared.
 */
function findCanvasSpaceRef(node: Konva.Node): Konva.Node | null {
  let parent = node.getParent()
  while (parent && !(parent instanceof Konva.Layer)) {
    if (parent instanceof Konva.Group) {
      if (parent.getAttr(MOVEMENT_ZONE_CLIP_ATTR)) {
        parent = parent.getParent()
        continue
      }
      return parent
    }
    parent = parent.getParent()
  }
  return null
}

/**
 * Attach drag event handlers to an interactive node.
 *
 * - Captures position at drag start for undo delta
 * - Updates state and pushes MOVE delta on drag end
 * - Bounds check: keeps layer center-point inside canvas bounds
 *   (prevents full drag-off-canvas while allowing edge overflow)
 * - When movementBounds is set: applies path-aware zone constraint via dragBoundFunc
 *   (uses isPointInPath for path/ellipse zones + last-valid-position cache so text
 *    always stays inside the actual zone shape, never outside the clip boundary)
 * - Calls registered DragPlugin hooks for extensible behavior (e.g., charm snap-to-slot)
 *
 * @param node - The Konva node to attach drag handlers to.
 * @param layerId - Stable layer ID for state tracking.
 * @param defaultTransform - Merchant-default transform (fallback for state).
 * @param getStage - Getter for the Konva stage (dynamic to handle autoResize).
 * @param getPlugins - Getter for registered drag plugins (dynamic to handle late registration).
 * @param flags - Layer interaction flags (used for movementBounds zone constraint).
 */
export function attachDragHandlers(
  node: Konva.Node,
  layerId: string,
  defaultTransform: LayerTransform,
  getStage: () => Konva.Stage,
  getPlugins: () => DragPlugin[],
  flags?: LayerInteractionFlags
): void {
  // Zone-aware path drag constraint.
  // Only applied when movementBounds is defined — otherwise falls through to the
  // center-point canvas clamp in dragmove (which handles the full-canvas case).
  //
  // Strategy: last-valid-position cache (Canva pattern).
  //   - On each drag frame, convert screen pos → canvas-space node center
  //   - Test center against zone using isPointInPath / ellipse eq / bbox
  //   - If inside → allow move, update cached valid center
  //   - If outside → return last valid position (text "sticks" at boundary)
  //
  // Coordinate notes:
  //   dragBoundFunc pos     = screen pixels (stage.x() + canvas_x * scaleX)
  //   getClientRect(relativeTo:stage) = canvas-space (stage transform inverted)
  //   movementBounds x/y/w/h = canvas-space (template pixel units)
  //   pathData               = zone-local (0,0 = top-left of zone bbox)
  if (flags?.movementBounds && flags.movable) {
    const bounds = flags.movementBounds

    // Pre-build Path2D and offscreen canvas once at setup time (not on every drag frame)
    const hitResources = buildZoneHitResources(bounds)

    // Last valid canvas-space center.
    // Initialized from the node's actual position at dragstart so that if the first
    // drag frame lands outside the zone, text returns to where it was (not zone center).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let lastValidCenter: { x: number; y: number } | null = null

    node.on('dragstart.boundReset', () => {
      // Get center in template-space so it matches zone bounds coordinates.
      // Use the layer wrapper Group as ref — its local frame is the canvas-space
      // that bounds.x/y/w/h are expressed in. Falls back to stage when no wrapper.
      const stage = node.getStage()
      if (!stage) return
      const canvasRef = findCanvasSpaceRef(node)
      const ref = canvasRef ?? stage
      const box = node.getClientRect({ relativeTo: ref })
      lastValidCenter = {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      }
    })

    node.dragBoundFunc(pos => {
      const stage = node.getStage()
      if (!stage) return pos

      const sx = stage.scaleX() || 1
      const sy = stage.scaleY() || 1

      // Account for __groupScale so cx/cy are in template-space (matching bounds)
      const scaledGroup = findScaledAncestorGroup(node)
      const gx = scaledGroup ? scaledGroup.scaleX() || 1 : 1
      const gy = scaledGroup ? scaledGroup.scaleY() || 1 : 1
      const totalSx = sx * gx
      const totalSy = sy * gy

      // Get current box in canvas-space (wrapper-local). Critical: bounds and box must
      // be in the SAME reference frame for the binary-search projection to produce a
      // correct boundary point. Using stage as ref when the wrapper has translation
      // would offset box by the wrapper's translation, projecting onto a phantom zone.
      const canvasRef = findCanvasSpaceRef(node)
      const ref = canvasRef ?? stage
      const box = node.getClientRect({ relativeTo: ref })
      const absPos = node.getAbsolutePosition()
      const cx = box.x + box.width / 2 + (pos.x - absPos.x) / totalSx
      const cy = box.y + box.height / 2 + (pos.y - absPos.y) / totalSy

      if (isInsideZone(cx, cy, bounds, hitResources)) {
        lastValidCenter = { x: cx, y: cy }
        return pos
      }

      // Binary search to find zone boundary point
      const zoneCx = bounds.x + bounds.width / 2
      const zoneCy = bounds.y + bounds.height / 2
      let lo = 0
      let hi = 1
      let bestCx = zoneCx
      let bestCy = zoneCy
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2
        const midCx = zoneCx + mid * (cx - zoneCx)
        const midCy = zoneCy + mid * (cy - zoneCy)
        if (isInsideZone(midCx, midCy, bounds, hitResources)) {
          lo = mid
          bestCx = midCx
          bestCy = midCy
        } else {
          hi = mid
        }
      }

      // Convert template-space delta back to screen-space
      return {
        x: pos.x + (bestCx - cx) * totalSx,
        y: pos.y + (bestCy - cy) * totalSy,
      }
    })
  }

  // Note: stageWidth/Height are computed dynamically in dragmove to handle
  // autoResize changes after handler setup. We use the original canvas size
  // (stage size ÷ scale) since node coordinates are in the un-scaled space.

  // Capture position at drag start for undo delta
  let dragStartTransform: LayerTransform | null = null

  /** The plugin that claimed this drag (returned true from onDragStart) */
  let activePlugin: DragPlugin | null = null

  node.on('dragstart.interactive', () => {
    const cur = StorefrontLayerState.getCurrent(layerId)
    dragStartTransform = cur ? { ...cur } : null

    // Let plugins claim this drag
    activePlugin = null
    for (const plugin of getPlugins()) {
      if (plugin.onDragStart?.(node, layerId, dragStartTransform)) {
        activePlugin = plugin
        break
      }
    }
  })

  node.on('dragend.interactive', () => {
    // If a plugin claimed this drag, let it handle dragend
    if (activePlugin) {
      const cur = StorefrontLayerState.getCurrent(layerId) ?? defaultTransform
      const handled = activePlugin.onDragEnd?.(node, layerId, cur, dragStartTransform)
      activePlugin = null
      if (handled) return
    }

    const newX = node.x()
    const newY = node.y()
    const cur = StorefrontLayerState.getCurrent(layerId) ?? defaultTransform

    const newTransform: LayerTransform = {
      ...cur,
      x: newX,
      y: newY,
    }

    StorefrontLayerState.updateTransform(layerId, newTransform)

    if (dragStartTransform) {
      const before: Partial<LayerTransformSnapshot> = {
        x: dragStartTransform.x,
        y: dragStartTransform.y,
      }
      const after: Partial<LayerTransformSnapshot> = { x: newX, y: newY }

      // Only push delta if position actually changed
      if (Math.abs(newX - dragStartTransform.x) > 0.5 || Math.abs(newY - dragStartTransform.y) > 0.5) {
        StorefrontUndoStack.push({
          type: 'MOVE',
          layerId,
          before,
          after,
        })

        // Track buyer text movement within zone — fires once per drag that changes position
        if (flags?.movementBounds) {
          Transmitter.trigger('tailorkit-storefront-usage', { feature: 'MOVEMENT_ZONE' })
        }
      }
    }
  })

  // Bounds check: center-point of layer must stay inside canvas.
  // Uses getClientRect() to handle both Image and Group nodes correctly,
  // including rotated/scaled groups where direct width() is unreliable.
  node.on('dragmove.interactive', () => {
    const stage = getStage()
    // Compute original canvas size dynamically (handles autoResize after setup)
    const originalWidth = stage.width() / (stage.scaleX() || 1)
    const originalHeight = stage.height() / (stage.scaleY() || 1)

    // Get axis-aligned bounding box in stage coordinates
    const box = node.getClientRect({ relativeTo: stage })
    const halfW = box.width / 2
    const halfH = box.height / 2

    // Current center in stage coordinates
    const cx = box.x + halfW
    const cy = box.y + halfH

    // Charm layers: full containment (entire charm stays within canvas)
    // Other layers: center-point containment (allows edge overflow)
    const isCharmLayer = layerId.startsWith('charm-')
    const minX = isCharmLayer ? halfW : 0
    const maxX = isCharmLayer ? originalWidth - halfW : originalWidth
    const minY = isCharmLayer ? halfH : 0
    const maxY = isCharmLayer ? originalHeight - halfH : originalHeight
    const clampedCx = Math.min(Math.max(cx, minX), maxX)
    const clampedCy = Math.min(Math.max(cy, minY), maxY)

    if (clampedCx !== cx || clampedCy !== cy) {
      // Delta is stage-space; convert to node-local space (accounting for __groupScale)
      const sg = findScaledAncestorGroup(node)
      const gsx = sg ? sg.scaleX() || 1 : 1
      const gsy = sg ? sg.scaleY() || 1 : 1
      node.x(node.x() + (clampedCx - cx) / gsx)
      node.y(node.y() + (clampedCy - cy) / gsy)
    }

    // Let active plugin handle dragmove (e.g., highlight nearest slot)
    if (activePlugin) {
      const cur = StorefrontLayerState.getCurrent(layerId) ?? null
      activePlugin.onDragMove?.(node, layerId, cur, dragStartTransform)
    }
  })
}
