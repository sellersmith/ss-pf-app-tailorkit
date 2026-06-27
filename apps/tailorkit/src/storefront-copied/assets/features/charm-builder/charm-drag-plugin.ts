/**
 * CharmDragPlugin — Snap-to-slot drag behavior for charm nodes (FIXED mode).
 *
 * Extracted from StorefrontInteractiveCanvasManager to keep the konva bundle
 * charm-free. This plugin is registered when the charm-builder feature loads.
 *
 * IMPORTANT: This file runs inside the charm-builder IIFE bundle. It must NOT
 * import runtime values from konva, StorefrontLayerState, or StorefrontUndoStack
 * directly — those would be duplicated (separate instances from the konva bundle).
 * All runtime deps are injected via CharmDragPluginContext.
 *
 * Behavior:
 * - On dragstart: shows slot indicator circles at available slot positions
 * - On dragmove: highlights the nearest slot as a drop target
 * - On dragend: snaps the charm to the nearest slot; swaps with occupant if any
 * - On reset/dispose: clears all registries and indicator circles
 */

import type { DragPlugin } from '../../utils/storefront-interactive-canvas-manager/constants'
import type { LayerTransform } from '../../stores/storefront-layer-state'
import { parseCharmId, findNearestSlot } from '../../utils/charm-drag-snap'
import type { CharmSlotPosition } from '../../utils/charm-drag-snap'
import { CHARM_RENDER_SIZE_FALLBACK } from '../../services/charm-layer-renderer'

/** Minimal Konva node interface — avoids importing Konva runtime */
interface KonvaNode {
  x(v?: number): number
  y(v?: number): number
  rotation(v?: number): number
  destroy(): void
  radius?(v: number): void
  fill?(v: string): void
  stroke?(v: string): void
  strokeWidth?(v: number): void
  dash?(v: number[]): void
  /** Konva attribute store — used to read the rotation-delegate marker. */
  getAttr?(name: string): unknown
  /**
   * Optional descendant lookup (Konva.Group). Used to reach the inner Konva.Image
   * when the renderer marked this group with the rotation-delegate attribute.
   */
  findOne?<T extends KonvaNode = KonvaNode>(selector: string): T | undefined
}

/**
 * Marker attribute set by the konva image renderer on groups whose rotation pivot
 * lives on a child Image (offsetX/Y). Must match `ROTATION_DELEGATE_ATTR` exported
 * from the image renderer module — kept as a string literal here because
 * charm-drag-plugin compiles into a separate IIFE bundle and cannot import runtime
 * values from the konva bundle. The contract is renderer-set, consumer-read; the
 * value's meaning is "delegate rotation updates to my inner Image".
 */
const ROTATION_DELEGATE_ATTR = '_rotationOnInnerImage'

/**
 * Apply rotation to the node that owns the rotation pivot. When the node was marked
 * by the image renderer (charm path), rotation is applied to its inner Konva.Image
 * where offsetX/Y matches the slot anchor — otherwise rotation lands on the node
 * itself. Without this delegation, setting rotation on a marked group would compound
 * with the inner image rotation and pivot at the bbox top-left, producing the
 * swap-rotation visual bug seen during slot swaps.
 */
function applyCharmRotation(node: KonvaNode, rotation: number): void {
  if (node.getAttr?.(ROTATION_DELEGATE_ATTR)) {
    const inner = node.findOne?.('Image')
    if (inner) {
      inner.rotation(rotation)
      return
    }
  }
  node.rotation(rotation)
}

/** Minimal Konva layer interface */
interface KonvaLayer {
  add(node: KonvaNode): void
  batchDraw(): void
}

/**
 * Context required by the charm drag plugin.
 * Provides access to shared Konva instance, state stores, and canvas layers.
 * All provided from the konva bundle's scope to avoid instance duplication.
 */
export interface CharmDragPluginContext {
  /** Create a Konva.Circle (uses the shared Konva instance from konva bundle) */
  createCircle(config: Record<string, unknown>): KonvaNode
  /** Get main canvas layer */
  getMainLayer(): KonvaLayer
  /** Get transformer layer */
  getTransformerLayer(): KonvaLayer | null
  /** Get interactive nodes registry */
  getInteractiveNodes(): Map<string, KonvaNode>
  /** Get current transform for a layer (StorefrontLayerState.getCurrent) */
  getCurrent(layerId: string): LayerTransform | undefined
  /** Update transform for a layer (StorefrontLayerState.updateTransform) */
  updateTransform(layerId: string, transform: LayerTransform): void
  /** Push undo delta (StorefrontUndoStack.push) */
  pushUndo(delta: {
    type: string
    layerId: string
    before: Record<string, unknown>
    after: Record<string, unknown>
  }): void
  /** Notify slot swap so slotAssignmentsCache stays in sync (called on drag-to-swap) */
  onSlotSwap?(charmLayerId: string, fromSlotIdx: number, toSlotIdx: number): void
}

export class CharmDragPlugin implements DragPlugin {
  /** Charm slot positions: charmLayerId → array of slot positions (indexed by slotIdx) */
  private charmSlotRegistry: Map<string, CharmSlotPosition[]> = new Map()

  /** Charm render size per layer: charmLayerId → size in px */
  private charmSizeRegistry: Map<string, number> = new Map()

  /** Temporary slot indicator circles shown during charm drag */
  private charmSlotIndicators: KonvaNode[] = []

  // eslint-disable-next-line no-useless-constructor
  constructor(private ctx: CharmDragPluginContext) {}

  // ─── Public: called by charm-layer-renderer ──────────────────────────────

  /** Register slot positions and charm size for a charm-node layer */
  setCharmSlots(layerId: string, slots: CharmSlotPosition[], charmSize?: number): void {
    this.charmSlotRegistry.set(layerId, slots)
    if (charmSize) this.charmSizeRegistry.set(layerId, charmSize)
  }

  // ─── DragPlugin interface ────────────────────────────────────────────────

  onDragStart(_node: KonvaNode, layerId: string, transform: LayerTransform | null): boolean {
    const ci = parseCharmId(layerId)
    if (!ci) return false

    const charmW = transform?.width || 0
    this.showCharmSlotIndicators(ci.layerId, ci.slotIdx, charmW)
    return true
  }

  onDragMove(
    node: KonvaNode,
    layerId: string,
    _transform: LayerTransform | null,
    dragStartTransform: LayerTransform | null
  ): void {
    const ci = parseCharmId(layerId)
    if (!ci) return

    const curState = this.ctx.getCurrent(layerId)
    const charmW = curState?.width || 0
    const slots = this.charmSlotRegistry.get(ci.layerId)
    const slotX = node.x() + charmW / 2
    const slotY = node.y()
    const startSlotX = (dragStartTransform?.x ?? 0) + charmW / 2
    const startSlotY = dragStartTransform?.y ?? 0
    const actualSlotIdx
      = dragStartTransform && slots
        ? slots.findIndex(s => Math.abs(startSlotX - s.x) < 1 && Math.abs(startSlotY - s.y) < 1)
        : ci.slotIdx
    this.highlightNearestIndicator(slotX, slotY, ci.layerId, actualSlotIdx, charmW)
  }

  onDragEnd(
    node: KonvaNode,
    layerId: string,
    _transform: LayerTransform | null,
    dragStartTransform: LayerTransform | null
  ): boolean {
    const charmInfo = parseCharmId(layerId)
    if (!charmInfo) return false

    this.handleCharmDragEnd(node, layerId, charmInfo, dragStartTransform)
    return true
  }

  onReset(): void {
    this.hideCharmSlotIndicators()
    this.charmSlotRegistry.clear()
    this.charmSizeRegistry.clear()
  }

  onDispose(): void {
    this.onReset()
  }

  // ─── Private: Charm drag-to-swap (FIXED mode) ──────────────────────────

  private handleCharmDragEnd(
    node: KonvaNode,
    layerId: string,
    charmInfo: { layerId: string; slotIdx: number },
    dragStartTransform: LayerTransform | null
  ): void {
    this.hideCharmSlotIndicators()

    const startTransform = dragStartTransform ?? this.ctx.getCurrent(layerId)
    const slots = this.charmSlotRegistry.get(charmInfo.layerId)
    const mainLayer = this.ctx.getMainLayer()

    if (!slots || !startTransform) {
      if (startTransform) {
        node.x(startTransform.x)
        node.y(startTransform.y)
      }
      mainLayer.batchDraw()
      return
    }

    const curState = this.ctx.getCurrent(layerId)
    const charmW = curState?.width || this.charmSizeRegistry.get(charmInfo.layerId) || CHARM_RENDER_SIZE_FALLBACK
    const charmH = curState?.height || charmW
    const halfW = charmW / 2

    const dropSlotX = node.x() + halfW
    const dropSlotY = node.y()
    const startSlotX = startTransform.x + halfW
    const startSlotY = startTransform.y

    const actualCurrentSlotIdx = slots.findIndex(s => Math.abs(startSlotX - s.x) < 1 && Math.abs(startSlotY - s.y) < 1)

    const snapThreshold = charmW * 1.5
    const targetSlotIdx = findNearestSlot(dropSlotX, dropSlotY, slots, actualCurrentSlotIdx, snapThreshold)

    if (targetSlotIdx === null) {
      node.x(startTransform.x)
      node.y(startTransform.y)
      mainLayer.batchDraw()
      return
    }

    const targetSlot = slots[targetSlotIdx]
    const targetTopLeftX = targetSlot.x - halfW
    const targetTopLeftY = targetSlot.y

    // Find node at target slot by POSITION
    let targetNode: KonvaNode | undefined
    let targetNodeId: string | undefined
    const charmPrefix = `charm-${charmInfo.layerId}-`
    const interactiveNodes = this.ctx.getInteractiveNodes()
    for (const [id, n] of interactiveNodes.entries()) {
      if (id === layerId || !id.startsWith(charmPrefix)) continue
      const state = this.ctx.getCurrent(id)
      if (!state) continue
      const nSlotX = state.x + (state.width || charmW) / 2
      const nSlotY = state.y
      if (Math.abs(nSlotX - targetSlot.x) < 1 && Math.abs(nSlotY - targetSlot.y) < 1) {
        targetNode = n
        targetNodeId = id
        break
      }
    }

    // Snap dragged charm to target slot. FIXED mode: slot is the canonical source of
    // rotation, so always sync to slot.r (default 0 when undefined). Using `??` instead
    // of `||` is critical so an explicit 0° slot resets the charm rather than preserving
    // a stale 15° from a prior slot — otherwise swapping leaves both charms tilted.
    node.x(targetTopLeftX)
    node.y(targetTopLeftY)
    const targetRotation = targetSlot.r ?? 0
    applyCharmRotation(node, targetRotation)
    const draggedNewTransform: LayerTransform = {
      ...(curState ?? startTransform),
      x: targetTopLeftX,
      y: targetTopLeftY,
      rotation: targetRotation,
    }
    this.ctx.updateTransform(layerId, draggedNewTransform)

    this.ctx.pushUndo({
      type: 'MOVE',
      layerId,
      before: { x: startTransform.x, y: startTransform.y },
      after: { x: targetTopLeftX, y: targetTopLeftY },
    })

    // If target slot has a charm → swap it to the dragged charm's original slot
    if (targetNode && targetNodeId) {
      const targetPrevTransform = this.ctx.getCurrent(targetNodeId)
      const sourceSlot = actualCurrentSlotIdx >= 0 ? slots[actualCurrentSlotIdx] : undefined
      const occupantRotation = sourceSlot?.r ?? 0
      targetNode.x(startTransform.x)
      targetNode.y(startTransform.y)
      applyCharmRotation(targetNode, occupantRotation)
      const targetNewTransform: LayerTransform = {
        ...(targetPrevTransform ?? { width: charmW, height: charmH, rotation: 0, x: 0, y: 0 }),
        x: startTransform.x,
        y: startTransform.y,
        rotation: occupantRotation,
      }
      this.ctx.updateTransform(targetNodeId, targetNewTransform)

      if (targetPrevTransform) {
        this.ctx.pushUndo({
          type: 'MOVE',
          layerId: targetNodeId,
          before: { x: targetPrevTransform.x, y: targetPrevTransform.y },
          after: { x: startTransform.x, y: startTransform.y },
        })
      }

      // Notify slotAssignmentsCache so swap survives re-renders
      const targetCharmInfo = parseCharmId(targetNodeId)
      if (targetCharmInfo) {
        this.ctx.onSlotSwap?.(
          charmInfo.layerId,
          actualCurrentSlotIdx >= 0 ? actualCurrentSlotIdx : charmInfo.slotIdx,
          targetSlotIdx
        )
      }
    }

    mainLayer.batchDraw()
    this.ctx.getTransformerLayer()?.batchDraw()
  }

  // ─── Private: Slot indicator circles ────────────────────────────────────

  private showCharmSlotIndicators(charmLayerId: string, _draggedSlotIdx: number, _draggedCharmSize?: number): void {
    this.hideCharmSlotIndicators()
    const slots = this.charmSlotRegistry.get(charmLayerId)
    if (!slots) return

    const mainLayer = this.ctx.getMainLayer()
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      // Node dot at attachment point — matches admin styling
      const nodeDot = this.ctx.createCircle({
        x: slot.x,
        y: slot.y,
        radius: 14,
        fill: '#FFE4C6',
        stroke: '#6366F1',
        strokeWidth: 1.5,
        dash: [4, 4],
        listening: false,
      })
      mainLayer.add(nodeDot)
      this.charmSlotIndicators.push(nodeDot)
    }
    mainLayer.batchDraw()
  }

  private hideCharmSlotIndicators(): void {
    for (const c of this.charmSlotIndicators) c.destroy()
    this.charmSlotIndicators = []
  }

  private highlightNearestIndicator(
    dropX: number,
    dropY: number,
    charmLayerId: string,
    currentSlotIdx: number,
    draggedCharmSize?: number
  ): void {
    const slots = this.charmSlotRegistry.get(charmLayerId)
    const charmSize = draggedCharmSize || this.charmSizeRegistry.get(charmLayerId) || CHARM_RENDER_SIZE_FALLBACK
    const targetIdx = findNearestSlot(dropX, dropY, slots ?? [], currentSlotIdx, charmSize * 1.5)

    for (let i = 0; i < this.charmSlotIndicators.length; i++) {
      const c = this.charmSlotIndicators[i]
      if (i === targetIdx) {
        // Highlighted: solid stroke, stronger fill (charm is near)
        c.fill?.('#FFD4A8')
        c.stroke?.('#4F46E5')
        c.strokeWidth?.(2.5)
        c.dash?.([])
      } else {
        // Default: dashed, peach fill
        c.fill?.('#FFE4C6')
        c.stroke?.('#6366F1')
        c.strokeWidth?.(1.5)
        c.dash?.([4, 4])
      }
    }
  }
}
