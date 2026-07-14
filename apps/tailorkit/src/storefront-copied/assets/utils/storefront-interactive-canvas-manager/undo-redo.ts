/**
 * Undo/Redo delta application logic for StorefrontInteractiveCanvasManager.
 *
 * Applies transform deltas in reverse (undo) or forward (redo) direction,
 * handling CONTENT, DELETE, MOVE, RESIZE, ROTATE, and RESET delta types.
 */

import Konva from 'konva'
import { StorefrontLayerState } from '../../stores/storefront-layer-state'
import type { UndoDelta } from '../../stores/storefront-undo-stack'
import type { ManagerContext } from './constants'

/**
 * Apply an undo delta in reverse — restores the "before" state.
 *
 * Handles:
 * - CONTENT: calls delta.undoFn() callback (DOM-based undo)
 * - DELETE: restores hidden node to visible
 * - MOVE/RESIZE/ROTATE/RESET: restores previous transform values
 *
 * For Image nodes, width/height are set directly.
 * For Group nodes, scaleX/scaleY are computed from width ratio vs defaults.
 */
export function applyDeltaInReverse(delta: UndoDelta, ctx: ManagerContext): void {
  const { layerId, before, type } = delta

  // CONTENT delta — DOM-based undo; caller's undoFn handles all DOM + re-render
  if (type === 'CONTENT') {
    if (delta.undoFn) {
      ctx.deselectAll()
      delta.undoFn()
    }
    return
  }

  const node = ctx.interactiveNodes.get(layerId)
  if (!node) return

  if (type === 'DELETE') {
    // Undo delete = restore node
    node.visible(true)
    StorefrontLayerState.restoreDeleted(layerId)
  } else {
    // Restore previous transform
    if (before.x !== undefined) node.x(before.x)
    if (before.y !== undefined) node.y(before.y)
    if (before.rotation !== undefined) node.rotation(before.rotation)
    node.scaleX(1)
    node.scaleY(1)
    if (node instanceof Konva.Image) {
      if (before.width !== undefined) node.width(before.width)
      if (before.height !== undefined) node.height(before.height)
    } else if (node instanceof Konva.Group) {
      // Groups resize via scaleX/Y, not explicit width/height — recompute scale from stored width vs default.
      const defaultTransform = StorefrontLayerState.getDefault(layerId)
      if (defaultTransform && before.width !== undefined && before.height !== undefined) {
        const defaultW = defaultTransform.width > 0 ? defaultTransform.width : 1
        const defaultH = defaultTransform.height > 0 ? defaultTransform.height : 1
        const scaleX = before.width / defaultW
        const scaleY = before.height / defaultH
        if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
          node.scaleX(scaleX)
          node.scaleY(scaleY)
        }
      }
    }

    // For MOVE deltas, before/after only carry x/y — width is undefined. Fall back to
    // current state to avoid zeroing out stored dimensions.
    const currentTransform = StorefrontLayerState.getCurrent(layerId)
    const stateWidth = before.width ?? (node instanceof Konva.Image ? node.width() : (currentTransform?.width ?? 0))
    const stateHeight = before.height ?? (node instanceof Konva.Image ? node.height() : (currentTransform?.height ?? 0))
    StorefrontLayerState.updateTransform(layerId, {
      x: before.x ?? node.x(),
      y: before.y ?? node.y(),
      width: stateWidth,
      height: stateHeight,
      rotation: before.rotation ?? node.rotation(),
    })
  }

  ctx.getMainLayer().batchDraw()
  ctx.transformerLayer?.batchDraw()
  if (ctx.selectedNode === node && ctx.transformer) {
    ctx.transformer.forceUpdate()
    ctx.layerControls?.updatePosition()
  }
}

/**
 * Apply an undo delta forward — applies the "after" state (redo).
 *
 * Mirrors applyDeltaInReverse but uses the "after" snapshot.
 *
 * Handles:
 * - CONTENT: calls delta.redoFn() callback (DOM-based redo)
 * - DELETE: hides node again (re-deletes)
 * - MOVE/RESIZE/ROTATE/RESET: applies forward transform values
 */
export function applyDeltaForward(delta: UndoDelta, ctx: ManagerContext): void {
  const { layerId, after, type } = delta

  // CONTENT delta — DOM-based redo; caller's redoFn handles all DOM + re-render
  if (type === 'CONTENT') {
    if (delta.redoFn) {
      ctx.deselectAll()
      delta.redoFn()
    }
    return
  }

  const node = ctx.interactiveNodes.get(layerId)
  if (!node) return

  if (type === 'DELETE') {
    // Redo delete = hide again
    if (ctx.selectedNode === node) ctx.deselectAll()
    node.visible(false)
    StorefrontLayerState.markDeleted(layerId)
  } else {
    if (after.x !== undefined) node.x(after.x)
    if (after.y !== undefined) node.y(after.y)
    if (after.rotation !== undefined) node.rotation(after.rotation)
    node.scaleX(1)
    node.scaleY(1)
    if (node instanceof Konva.Image) {
      if (after.width !== undefined) node.width(after.width)
      if (after.height !== undefined) node.height(after.height)
    } else if (node instanceof Konva.Group) {
      // Groups resize via scaleX/Y, not explicit width/height — recompute scale from stored width vs default.
      const defaultTransform = StorefrontLayerState.getDefault(layerId)
      if (defaultTransform && after.width !== undefined && after.height !== undefined) {
        const defaultW = defaultTransform.width > 0 ? defaultTransform.width : 1
        const defaultH = defaultTransform.height > 0 ? defaultTransform.height : 1
        const scaleX = after.width / defaultW
        const scaleY = after.height / defaultH
        if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
          node.scaleX(scaleX)
          node.scaleY(scaleY)
        }
      }
    }

    // For MOVE deltas, before/after only carry x/y — width is undefined. Fall back to
    // current state to avoid zeroing out stored dimensions.
    const currentTransform = StorefrontLayerState.getCurrent(layerId)
    const stateWidth = after.width ?? (node instanceof Konva.Image ? node.width() : (currentTransform?.width ?? 0))
    const stateHeight = after.height ?? (node instanceof Konva.Image ? node.height() : (currentTransform?.height ?? 0))
    StorefrontLayerState.updateTransform(layerId, {
      x: after.x ?? node.x(),
      y: after.y ?? node.y(),
      width: stateWidth,
      height: stateHeight,
      rotation: after.rotation ?? node.rotation(),
    })
  }

  ctx.getMainLayer().batchDraw()
  ctx.transformerLayer?.batchDraw()
  if (ctx.selectedNode === node && ctx.transformer) {
    ctx.transformer.forceUpdate()
    ctx.layerControls?.updatePosition()
  }
}
