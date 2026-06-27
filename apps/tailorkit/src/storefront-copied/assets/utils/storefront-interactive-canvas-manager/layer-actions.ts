/**
 * Layer action helpers for StorefrontInteractiveCanvasManager.
 *
 * Provides reset and delete operations for interactive layers,
 * including undo delta creation for each action.
 */

import type Konva from 'konva'
import { TailorKitKonva as KonvaRuntime } from '../../../shared/libraries/konva/runtime-konva'
import { StorefrontLayerState } from '../../stores/storefront-layer-state'
import { StorefrontUndoStack } from '../../stores/storefront-undo-stack'
import { getCharmProductMap } from '../../services/charm-layer-renderer'
import { getFeature } from '../feature-loader'
import type { ManagerContext } from './constants'

/**
 * Reset layer to merchant default position/size/rotation.
 * Text content and image source are preserved — only transform is reset.
 *
 * Pushes a RESET delta to the undo stack for undo support.
 */
export function resetLayer(layerId: string, ctx: ManagerContext): void {
  const node = ctx.interactiveNodes.get(layerId)
  if (!node) return

  const before = StorefrontLayerState.getCurrent(layerId)
  const defaults = StorefrontLayerState.resetToDefault(layerId)
  if (!defaults) return

  // Apply defaults to Konva node
  node.x(defaults.x)
  node.y(defaults.y)
  node.rotation(defaults.rotation)
  // Reset scale to 1 (removes any accumulated scale from previous transforms)
  node.scaleX(1)
  node.scaleY(1)
  // For Konva.Image: also restore explicit width/height
  if (node instanceof KonvaRuntime.Image) {
    node.width(defaults.width)
    node.height(defaults.height)
  }
  // For Konva.Group: scaleX/Y reset above is sufficient to restore original visual size

  // Ensure node is visible (in case it was previously deleted and re-added)
  node.visible(true)

  ctx.getMainLayer().batchDraw()
  ctx.transformerLayer?.batchDraw()

  // Update transformer position if this node is selected
  if (ctx.selectedNode === node && ctx.transformer) {
    ctx.transformer.forceUpdate()
    ctx.layerControls?.updatePosition()
  }

  // Push undo delta
  if (before) {
    StorefrontUndoStack.push({
      type: 'RESET',
      layerId,
      before: {
        x: before.x,
        y: before.y,
        width: before.width,
        height: before.height,
        rotation: before.rotation,
      },
      after: {
        x: defaults.x,
        y: defaults.y,
        width: defaults.width,
        height: defaults.height,
        rotation: defaults.rotation,
      },
    })
  }
}

/**
 * Delete a layer immediately without confirmation dialog.
 * Uses soft-delete (hides node) and pushes DELETE delta to undo stack for undo support.
 */
export function deleteLayer(layerId: string, ctx: ManagerContext): void {
  const node = ctx.interactiveNodes.get(layerId)
  if (!node) {
    console.warn(`[TailorKit] deleteLayer: node not found for layerId="${layerId}"`)
    return
  }

  const before = StorefrontLayerState.getCurrent(layerId)

  // Deselect if this is the selected node
  if (ctx.selectedNode === node) {
    ctx.deselectAll()
  }

  // Hide node visually (soft-delete for undo support)
  node.visible(false)
  StorefrontLayerState.markDeleted(layerId)

  ctx.getMainLayer().batchDraw()
  ctx.transformerLayer?.batchDraw()

  // Detect charm node deletion and notify CharmPicker via custom event.
  // Charm undo is handled by CHARM_CHANGE_EVENT flow (product-personalizer pushes CONTENT undo),
  // so we skip the DELETE undo delta for charm nodes to avoid duplicate undo entries.
  const isCharmNode = layerId.startsWith('charm-')
  if (isCharmNode) {
    // Free the exact slot before dispatching event (prevents wrong slot being freed)
    const charmModule = getFeature('charm-builder')
    if (charmModule?.freeSlotInCache) {
      const lastDash = layerId.lastIndexOf('-')
      if (lastDash > 0) {
        const slotIdx = parseInt(layerId.slice(lastDash + 1), 10)
        const prefix = layerId.startsWith('charm-free-') ? 'charm-free-' : 'charm-'
        const charmLayerId = layerId.slice(prefix.length, lastDash)
        if (!isNaN(slotIdx) && charmLayerId) {
          charmModule.freeSlotInCache(charmLayerId, slotIdx)
        }
      }
    }

    const productId = getCharmProductMap().get(layerId)
    if (productId) {
      document.dispatchEvent(
        new CustomEvent('tailorkit-charm-removed', {
          detail: { productId },
        })
      )
    }
  }

  // Push undo delta (skip for charm nodes — charm undo handled via CHARM_CHANGE_EVENT flow)
  if (!isCharmNode && before) {
    StorefrontUndoStack.push({
      type: 'DELETE',
      layerId,
      before: {
        x: before.x,
        y: before.y,
        width: before.width,
        height: before.height,
        rotation: before.rotation,
        deleted: false,
      },
      after: {
        ...before,
        deleted: true,
      },
    })
  }
}
