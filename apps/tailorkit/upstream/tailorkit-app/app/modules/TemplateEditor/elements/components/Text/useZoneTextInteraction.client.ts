/**
 * useZoneTextInteraction
 *
 * Custom hook encapsulating all drag and transform interaction handlers for a
 * text node that lives inside a movement zone clip group (admin canvas preview mode
 * and design content mode).
 *
 * Handles:
 * - Zone-constrained dragBoundFunc (binary-search boundary projection)
 * - Real-time drag-move store sync (needed for SVGTextWithEffects re-render)
 * - Drag-end: commit position + defaultOffsetX/Y (suppressed in preview mode)
 * - Transform-end: rotation centering + resize snap-back + store commit
 *
 * In preview mode, store updates are still dispatched (visual sync), but
 * TEMPLATE_ELEMENT_DATA_CHANGED is suppressed so changes don't persist as design data.
 * The parent component handles snapshot/restore via designSnapshotRef.
 */

import Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useCallback, useEffect, useRef } from 'react'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { GUIDE_LINE_NAME } from '~/components/canvas/constants'
import { isInsideMovementBounds } from '~/components/canvas/elements/Text/utils/movement-zone-hit-test.client'
import { MUTATION_LAYER_FROM_INSPECTOR_EVENTS } from '~/modules/TemplateEditor/constants'
import type { TLayerStore } from '~/stores/modules/layer'
import type { MovementBounds } from '~/types/psd'
import { clearGuides } from '~/utils/canvas/snappingObject'

/**
 * Find the canvas-space reference frame for coord conversions. The wrapper's local
 * frame is what bounds.x/y/w/h are expressed in (template canvas pixels). Falling back
 * to stage when the wrapper has translation would offset box vs bounds and skew the
 * binary-search projection. Skips the movement-zone clip group (positioned at bounds.x/y
 * inside the wrapper).
 */
function findCanvasSpaceRef(node: Konva.Node): Konva.Node | null {
  let parent = node.getParent()
  while (parent && !(parent instanceof Konva.Layer)) {
    if (parent instanceof Konva.Group) {
      if (parent.clipFunc?.() !== null && parent.clipFunc?.() !== undefined) {
        parent = parent.getParent()
        continue
      }
      return parent
    }
    parent = parent.getParent()
  }
  return null
}

interface UseZoneTextInteractionParams {
  textRef: React.RefObject<Konva.Node | null>
  bounds: MovementBounds
  layerStore: TLayerStore
  isPreview: boolean
  layerId: string
}

/**
 * Zone-aware text interaction handlers for admin canvas.
 *
 * The drag constraint mirrors storefront drag-handlers.ts exactly:
 *   - Allowed positions are those where the text AABB center lies inside the zone
 *   - Binary-search projects the cursor onto the zone boundary when outside
 *
 * Transform-end handles two cases:
 *   - Rotation: scale to fit zone AABB, re-center in zone
 *   - Resize: snap center back inside zone if it drifted out
 */
export function useZoneTextInteraction({
  textRef,
  bounds,
  layerStore,
  isPreview,
  layerId,
}: UseZoneTextInteractionParams) {
  // Pre-built Path2D + offscreen canvas for polygon hit-testing (rebuilt when bounds change)
  const hitResourcesRef = useRef<{ path2D: Path2D | null; ctx: CanvasRenderingContext2D | null }>({
    path2D: null,
    ctx: null,
  })
  const lastValidCenterRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!bounds) return
    const { x: zx, y: zy, width: zw, height: zh, type = 'rectangle' } = bounds
    let path2D: Path2D | null = null
    let ctx: CanvasRenderingContext2D | null = null

    if (type === 'path' && bounds.pathData && bounds.pathViewBox?.width && bounds.pathViewBox?.height) {
      try {
        // Admin-side: pathData is in zone-local coords (0..pathViewBox.width, 0..pathViewBox.height).
        // Scale to fill current zone dimensions, then translate to canvas-space.
        // This differs from the storefront (zone-hit-test.ts) which only translates —
        // because preparation-fns.server.ts already pre-scales pathData to canvas-px for storefront.
        const m = new DOMMatrix().translate(zx, zy).scale(zw / bounds.pathViewBox.width, zh / bounds.pathViewBox.height)
        const scaled = new Path2D()
        scaled.addPath(new Path2D(bounds.pathData), m)
        path2D = scaled
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        ctx = canvas.getContext('2d')
      } catch {
        /* fallback to bbox */
      }
    }
    hitResourcesRef.current = { path2D, ctx }
  }, [bounds])

  // Inline hit-test using pre-built resources (mirrors storefront's isInsideZone)
  const isInZone = useCallback(
    (cx: number, cy: number): boolean => {
      const { x: zx, y: zy, width: zw, height: zh, type = 'rectangle' } = bounds
      if (type === 'ellipse') {
        const rx = zw / 2,
          ry = zh / 2
        const dx = cx - (zx + rx),
          dy = cy - (zy + ry)
        return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1
      }
      if (type === 'path' && hitResourcesRef.current.path2D && hitResourcesRef.current.ctx) {
        return hitResourcesRef.current.ctx.isPointInPath(hitResourcesRef.current.path2D, cx, cy)
      }
      return cx >= zx && cx <= zx + zw && cy >= zy && cy <= zy + zh
    },
    [bounds]
  )

  // dragBoundFunc: constrain text AABB center inside zone with binary-search boundary projection.
  // Uses position delta from getAbsolutePosition() — correct for rotated nodes where
  // AABB center offset from node origin ≠ box.width/2.
  const textDragBoundFunc = useCallback(
    (pos: { x: number; y: number }) => {
      const node = textRef.current
      if (!node) return pos
      const stage = node.getStage()
      if (!stage) return pos

      const sx = stage.scaleX() || 1
      const sy = stage.scaleY() || 1

      // Use wrapper-local frame (canvas-space matching bounds) as box reference.
      // Falling back to stage when a translation-only wrapper exists would shift box
      // away from bounds frame, skewing the binary-search projection.
      const canvasRef = findCanvasSpaceRef(node)
      const ref = canvasRef ?? stage
      const box = node.getClientRect({ relativeTo: ref })
      const absPos = node.getAbsolutePosition()
      const cx = box.x + box.width / 2 + (pos.x - absPos.x) / sx
      const cy = box.y + box.height / 2 + (pos.y - absPos.y) / sy

      if (isInZone(cx, cy)) {
        lastValidCenterRef.current = { x: cx, y: cy }
        return pos
      }

      // Binary search: project cursor onto zone boundary via ray from zone-center
      const zoneCx = bounds.x + bounds.width / 2
      const zoneCy = bounds.y + bounds.height / 2
      let lo = 0,
        hi = 1,
        bestCx = zoneCx,
        bestCy = zoneCy
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2
        const midCx = zoneCx + mid * (cx - zoneCx)
        const midCy = zoneCy + mid * (cy - zoneCy)
        if (isInZone(midCx, midCy)) {
          lo = mid
          bestCx = midCx
          bestCy = midCy
        } else {
          hi = mid
        }
      }

      return {
        x: pos.x + (bestCx - cx) * sx,
        y: pos.y + (bestCy - cy) * sy,
      }
    },
    [bounds, isInZone, textRef]
  )

  // Real-time store sync during drag — needed so SVGTextWithEffects re-renders at correct position
  const handleTextDragMove = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true
      const node = e.target as Konva.Node
      layerStore.dispatch({ type: 'UPDATE_LAYER', payload: { state: { left: node.x(), top: node.y() } } })
    },
    [layerStore]
  )

  // Commit final drag position to store + update defaultOffsetX/Y
  // In preview mode: updates store for visual sync, but suppresses TEMPLATE_ELEMENT_DATA_CHANGED
  const handleTextDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true
      const node = e.target as Konva.Node
      const layer = node.getLayer()
      if (layer) clearGuides(layer, GUIDE_LINE_NAME)

      const current = layerStore.getState()
      layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            left: node.x(),
            top: node.y(),
            shapeSettings: {
              ...(current.shapeSettings ?? {}),
              movementBounds: bounds,
              defaultOffsetX: node.x() - bounds.x,
              defaultOffsetY: node.y() - bounds.y,
            },
          },
        },
      })
      if (!isPreview) {
        Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.TEMPLATE_ELEMENT_DATA_CHANGED, {
          id: layerId,
          elementData: layerStore.getState(),
        })
      }
    },
    [bounds, isPreview, layerId, layerStore]
  )

  // Handle resize/rotate transform end.
  //   Rotation: scale text down so rotated AABB fits zone, then re-center in zone.
  //   Resize: binary-search snap center back inside zone if it drifted outside.
  // In preview mode: updates store for visual sync, suppresses TEMPLATE_ELEMENT_DATA_CHANGED.
  const handleTextTransformEnd = useCallback(
    (e: KonvaEventObject<Event>) => {
      e.cancelBubble = true
      const node = e.target as Konva.Node
      const scaleX = node.scaleX()
      const scaleY = node.scaleY()

      // Bake scale into width/height, then reset scale to 1
      node.scaleX(1)
      node.scaleY(1)

      let newWidth = Math.max(5, node.width() * scaleX)
      let newHeight = Math.max(5, node.height() * scaleY)
      const newRotation = node.rotation()

      if (bounds) {
        const prevRotation = layerStore.getState().rotate ?? 0
        const isRotation = Math.abs(newRotation - prevRotation) > 0.5

        if (isRotation) {
          // Scale text so its rotated AABB fits inside zone bounds
          const rad = Math.abs((newRotation * Math.PI) / 180)
          const cosR = Math.abs(Math.cos(rad))
          const sinR = Math.abs(Math.sin(rad))
          const aabbW = newWidth * cosR + newHeight * sinR
          const aabbH = newWidth * sinR + newHeight * cosR
          const fitScale = Math.min(bounds.width / aabbW, bounds.height / aabbH, 1.0)

          if (fitScale < 1) {
            newWidth *= fitScale
            newHeight *= fitScale
            node.width(newWidth)
            node.height(newHeight)
          }

          // Only re-center if the text's AABB center drifted outside zone after rotation.
          // This preserves the user's moved position when possible.
          const stage = node.getStage()
          const nodeBox = node.getClientRect({ relativeTo: stage ?? undefined })
          const cx = nodeBox.x + nodeBox.width / 2
          const cy = nodeBox.y + nodeBox.height / 2

          if (!isInsideMovementBounds(cx, cy, bounds)) {
            // Snap center back inside zone using binary-search projection
            const zCx = bounds.x + bounds.width / 2
            const zCy = bounds.y + bounds.height / 2
            let lo = 0,
              hi = 1,
              bestX = zCx,
              bestY = zCy
            for (let i = 0; i < 12; i++) {
              const mid = (lo + hi) / 2
              const mx = zCx + mid * (cx - zCx)
              const my = zCy + mid * (cy - zCy)
              if (isInsideMovementBounds(mx, my, bounds)) {
                lo = mid
                bestX = mx
                bestY = my
              } else {
                hi = mid
              }
            }
            node.x(node.x() + (bestX - cx))
            node.y(node.y() + (bestY - cy))
          }
        } else {
          // Resize: snap center back inside zone if it drifted out
          const stage = node.getStage()
          const nodeBox = node.getClientRect({ relativeTo: stage ?? undefined })
          const cx = nodeBox.x + nodeBox.width / 2
          const cy = nodeBox.y + nodeBox.height / 2
          // Uses isInsideMovementBounds (not isInZone) because this runs only once
          // on transform-end, not on every drag frame — no caching overhead concern.
          if (!isInsideMovementBounds(cx, cy, bounds)) {
            const zCx = bounds.x + bounds.width / 2
            const zCy = bounds.y + bounds.height / 2
            let lo = 0,
              hi = 1,
              bestX = zCx,
              bestY = zCy
            for (let i = 0; i < 12; i++) {
              const mid = (lo + hi) / 2
              const mx = zCx + mid * (cx - zCx)
              const my = zCy + mid * (cy - zCy)
              if (isInsideMovementBounds(mx, my, bounds)) {
                lo = mid
                bestX = mx
                bestY = my
              } else {
                hi = mid
              }
            }
            node.x(node.x() + (bestX - cx))
            node.y(node.y() + (bestY - cy))
          }
        }
      }

      const current = layerStore.getState()
      layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            left: node.x(),
            top: node.y(),
            width: newWidth,
            height: newHeight,
            rotate: newRotation,
            shapeSettings: {
              ...(current.shapeSettings ?? {}),
              movementBounds: bounds,
              defaultOffsetX: node.x() - bounds.x,
              defaultOffsetY: node.y() - bounds.y,
            },
          },
        },
      })
      if (!isPreview) {
        Transmitter.trigger(MUTATION_LAYER_FROM_INSPECTOR_EVENTS.TEMPLATE_ELEMENT_DATA_CHANGED, {
          id: layerId,
          elementData: layerStore.getState(),
        })
      }
    },
    [bounds, isPreview, layerId, layerStore]
  )

  return { textDragBoundFunc, handleTextDragMove, handleTextDragEnd, handleTextTransformEnd }
}
