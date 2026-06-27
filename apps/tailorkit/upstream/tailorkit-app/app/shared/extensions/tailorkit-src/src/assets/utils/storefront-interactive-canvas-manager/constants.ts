/**
 * Constants, types, and shared context interface for StorefrontInteractiveCanvasManager modules.
 */

import type Konva from 'konva'
import type { LayerInteractionFlags, LayerTransform } from '../../stores/storefront-layer-state'
import type { StorefrontLayerControls } from '../../components/layer-controls/StorefrontLayerControls'

// ─── Constants ───────────────────────────────────────────────────────────────

export const TRANSFORMER_STROKE = '#005bd3'
export const ANCHOR_FILL = '#ffffff'
export const ANCHOR_SIZE_DEFAULT = 10
export const ANCHOR_SIZE_MOBILE = 16 // Larger touch targets for mobile usability
export const MIN_LAYER_SIZE = 10 // px — minimum resize dimension
export const isMobile = typeof window !== 'undefined' && 'ontouchstart' in window

// ─── Types ───────────────────────────────────────────────────────────────────

/** Pending interactive registration — used by setNextLayerInteractive() */
export interface PendingInteractiveReg {
  layerId: string
  flags: LayerInteractionFlags
  defaultTransform: LayerTransform
}

export type SelectionChangeListener = (layerId: string | null) => void

/**
 * Shared context passed from the manager class to extracted helper functions.
 * Provides access to the class state that helpers need without tight coupling.
 *
 * IMPORTANT: This is a point-in-time snapshot created by `_getContext()`.
 * Values like `selectedNode` may change after the context is created.
 * All consumer functions must consume the context synchronously.
 */
export interface ManagerContext {
  interactiveNodes: Map<string, Konva.Node>
  selectedNode: Konva.Node | null
  transformer: Konva.Transformer | null
  transformerLayer: Konva.Layer | null
  layerControls: StorefrontLayerControls | null
  getMainLayer(): Konva.Layer
  deselectAll(): void
}

// ─── Drag Plugin System ──────────────────────────────────────────────────────

/**
 * Plugin interface for extending drag behavior on the interactive canvas.
 * Plugins are registered via `registerDragPlugin()` and called synchronously
 * during drag events. This allows feature modules (e.g., charm-builder) to
 * inject drag logic without coupling to the manager's core code.
 */
export interface DragPlugin {
  /** Called on dragstart. Return true to indicate this plugin handles the layer. */
  onDragStart?(node: Konva.Node, layerId: string, transform: LayerTransform | null): boolean | void
  /** Called on dragmove. Only called if onDragStart returned true for this drag. */
  onDragMove?(
    node: Konva.Node,
    layerId: string,
    transform: LayerTransform | null,
    dragStartTransform: LayerTransform | null
  ): void
  /** Called on dragend. Return true to indicate this plugin fully handled the drop (skips default undo push). */
  onDragEnd?(
    node: Konva.Node,
    layerId: string,
    transform: LayerTransform | null,
    dragStartTransform: LayerTransform | null
  ): boolean | void
  /** Called when canvas resets (clear). Plugin should clean up any state. */
  onReset?(): void
  /** Called when manager is disposed. Plugin should clean up all resources. */
  onDispose?(): void
}
