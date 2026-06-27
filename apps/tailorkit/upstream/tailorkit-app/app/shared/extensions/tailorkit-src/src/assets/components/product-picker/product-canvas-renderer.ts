/**
 * Product Picker Canvas Renderer
 *
 * Renders selected product images at slot positions on the Konva canvas.
 * Called from layer-renderer.ts when processing 'product-picker' layer type.
 *
 * Also provides a global registry so layer-renderer.ts can look up the
 * state manager for a given layer ID without a direct reference.
 */

import Konva from 'konva'
import type { KonvaCanvasManager } from '../../../shared/libraries/konva/core/konva-canvas-manager'
import type { ProductPickerStateManager, SlotPosition, SlotAssignment } from './product-picker-state'

// ─── State Manager Registry ──────────────────────────────────────

const stateManagerRegistry = new Map<string, ProductPickerStateManager>()

export function registerProductPickerStateManager(layerId: string, manager: ProductPickerStateManager): void {
  stateManagerRegistry.set(layerId, manager)
}

export function unregisterProductPickerStateManager(layerId: string): void {
  stateManagerRegistry.delete(layerId)
}

export function getProductPickerStateManager(layerId: string): ProductPickerStateManager | null {
  return stateManagerRegistry.get(layerId) || null
}

// ─── Canvas Rendering ────────────────────────────────────────────

/**
 * Render product picker layer on the Konva canvas.
 *
 * For filled slots, renders the selected product image at the slot position.
 * For empty slots, renders a dashed rectangle placeholder.
 *
 * Slot positions are stored as percentages (0-100) of the template dimensions.
 * We convert them to absolute pixel coordinates using the layer's design dimensions.
 */
export async function renderProductPickerLayer(
  canvasManager: KonvaCanvasManager,
  stateManager: ProductPickerStateManager,
  designWidth: number,
  designHeight: number
): Promise<void> {
  const state = stateManager.getState()
  if (!state.previewEnabled) return

  const slots = state.slotPositions
  const assignments = stateManager.getSlotAssignments()
  const assignmentMap = new Map(assignments.map(a => [a.slotIndex, a]))

  for (const slot of slots) {
    const assignment = assignmentMap.get(slot.si)
    const pos = slotToAbsolute(slot, designWidth, designHeight)

    if (assignment) {
      await renderFilledSlot(canvasManager, pos, assignment)
    } else {
      renderEmptySlot(canvasManager, pos, slot.si)
    }
  }
}

// ─── Slot Position Conversion ────────────────────────────────────

interface AbsoluteSlotPosition {
  x: number
  y: number
  width: number
  height: number
}

function slotToAbsolute(slot: SlotPosition, designWidth: number, designHeight: number): AbsoluteSlotPosition {
  return {
    x: (slot.l / 100) * designWidth,
    y: (slot.tp / 100) * designHeight,
    width: (slot.w / 100) * designWidth,
    height: (slot.h / 100) * designHeight,
  }
}

// ─── Filled Slot (Product Image) ─────────────────────────────────

async function renderFilledSlot(
  canvasManager: KonvaCanvasManager,
  pos: AbsoluteSlotPosition,
  assignment: SlotAssignment
): Promise<void> {
  const imageUrl = assignment.product.img
  if (!imageUrl) {
    renderEmptySlot(canvasManager, pos, assignment.slotIndex)
    return
  }

  await canvasManager.addImageLayer({
    url: imageUrl,
    x: pos.x,
    y: pos.y,
    width: pos.width,
    height: pos.height,
  })
}

// ─── Empty Slot (Placeholder) ────────────────────────────────────

function renderEmptySlot(
  canvasManager: KonvaCanvasManager,
  pos: AbsoluteSlotPosition,
  slotIndex: number
): void {
  const container = getCanvasContainer(canvasManager)
  if (!container) return

  const group = new Konva.Group({
    x: pos.x,
    y: pos.y,
    width: pos.width,
    height: pos.height,
    listening: false,
  })

  // Dashed border placeholder
  group.add(
    new Konva.Rect({
      x: 0,
      y: 0,
      width: pos.width,
      height: pos.height,
      stroke: '#ccc',
      strokeWidth: 1,
      dash: [6, 4],
      fill: 'rgba(0, 0, 0, 0.02)',
      cornerRadius: 4,
      listening: false,
    })
  )

  // Slot label
  const label = `${slotIndex + 1}`
  group.add(
    new Konva.Text({
      x: 0,
      y: 0,
      width: pos.width,
      height: pos.height,
      text: label,
      fontSize: Math.min(pos.width, pos.height) * 0.3,
      fill: '#ccc',
      align: 'center',
      verticalAlign: 'middle',
      listening: false,
    })
  )

  container.add(group)
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Access the current drawing container from the canvas manager.
 * The public API exposes `addImageLayer` but for raw Konva shapes
 * we need the underlying layer/group. We use the mainLayer via
 * a documented accessor if available, otherwise fall back.
 */
function getCanvasContainer(canvasManager: KonvaCanvasManager): Konva.Layer | Konva.Group | null {
  // KonvaCanvasManager exposes getMainLayer() for direct access
  if (typeof (canvasManager as any).getMainLayer === 'function') {
    return (canvasManager as any).getMainLayer()
  }
  // Fallback: access the stage's first layer
  if (typeof (canvasManager as any).stage?.getLayers === 'function') {
    const layers = (canvasManager as any).stage.getLayers()
    return layers[0] || null
  }
  return null
}
