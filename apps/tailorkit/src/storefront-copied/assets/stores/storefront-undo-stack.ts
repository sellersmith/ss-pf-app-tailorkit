/**
 * StorefrontUndoStack — Delta-based undo/redo stack
 *
 * Supports unlimited steps using deltas (not full snapshots) to minimize memory usage.
 * Tracks move, resize, rotate, delete, reset, and content-change operations.
 *
 * CONTENT deltas use callback functions (not serialized data) because:
 *   - Stack is in-memory only (never serialized) — closures are safe.
 *   - Content lives in the DOM (fieldset[value] attr); callbacks encapsulate the
 *     exact DOM element ref + the before/after value for each change site.
 *   - Callers (text input, option selector, image upload) each know the right
 *     element to update and can pass drawLivePreview / Transmitter calls inline.
 */

import { FEATURE_FLAGS } from '../constants/feature-flags'

export type DeltaType = 'MOVE' | 'RESIZE' | 'ROTATE' | 'DELETE' | 'RESET' | 'CONTENT'

export interface LayerTransformSnapshot {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  visible: boolean
}

export interface UndoDelta {
  type: DeltaType
  layerId: string
  before: Partial<LayerTransformSnapshot> & { deleted?: boolean }
  after: Partial<LayerTransformSnapshot> & { deleted?: boolean }
  /**
   * CONTENT deltas only — called by applyDeltaInReverse to restore previous content.
   * Must update the relevant DOM fieldset(s) and trigger a canvas re-render.
   */
  undoFn?: () => void
  /**
   * CONTENT deltas only — called by applyDeltaForward to re-apply the newer content.
   * Must update the relevant DOM fieldset(s) and trigger a canvas re-render.
   */
  redoFn?: () => void
}

type UndoListener = (canUndo: boolean, canRedo: boolean) => void

class StorefrontUndoStackImpl {
  private stack: UndoDelta[] = []
  /** Points to the last applied delta index. -1 = empty. */
  private cursor: number = -1
  private listeners: Set<UndoListener> = new Set()

  /** Clears any redo history above the cursor. */
  push(delta: UndoDelta): void {
    // Truncate redo history when new action is performed
    this.stack.splice(this.cursor + 1)
    this.stack.push(delta)
    this.cursor = this.stack.length - 1
    this.notify()
  }

  /** Returns the delta to apply in reverse. */
  undo(): UndoDelta | null {
    if (!this.canUndo()) return null
    const delta = this.stack[this.cursor]
    this.cursor--
    this.notify()
    return delta
  }

  /** Returns the delta to re-apply. */
  redo(): UndoDelta | null {
    if (!this.canRedo()) return null
    this.cursor++
    const delta = this.stack[this.cursor]
    this.notify()
    return delta
  }

  /** Called on ATC to reset interaction history. */
  clear(): void {
    this.stack = []
    this.cursor = -1
    this.notify()
  }

  canUndo(): boolean {
    return this.cursor >= 0
  }

  canRedo(): boolean {
    return this.cursor < this.stack.length - 1
  }

  /** Subscribe to canUndo/canRedo state changes. Returns unsubscribe fn. */
  subscribe(listener: UndoListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Re-emit current state to all subscribers (e.g. after DOM context switch). */
  renotify(): void {
    this.notify()
  }

  private notify(): void {
    const canUndo = this.canUndo()
    const canRedo = this.canRedo()
    this.listeners.forEach(l => l(canUndo, canRedo))
  }
}

// ─── Window-backed registry ────────────────────────────────────────────────
//
// Same cross-bundle registry pattern as StorefrontLayerState — see that file
// for full rationale.
//
// Backward-compatible: all existing call sites continue to import
// `StorefrontUndoStack` (the default instance) unchanged.
//
declare global {
  interface Window {
    __tlk_undo_stack_registry__?: Map<string, unknown>
  }
}

if (!window.__tlk_undo_stack_registry__) {
  window.__tlk_undo_stack_registry__ = new Map()
}

/** Creates lazily on first access. Non-default IDs coerced to 'default' when MULTI_INSTANCE is off. */
export function getStorefrontUndoStack(instanceId: string = 'default'): StorefrontUndoStackImpl {
  // Kill switch: when multi-instance is disabled, all instances share 'default'
  const resolvedId = !FEATURE_FLAGS.MULTI_INSTANCE && instanceId !== 'default' ? 'default' : instanceId

  if (!window.__tlk_undo_stack_registry__!.has(resolvedId)) {
    window.__tlk_undo_stack_registry__!.set(resolvedId, new StorefrontUndoStackImpl())
  }
  return window.__tlk_undo_stack_registry__!.get(resolvedId)! as StorefrontUndoStackImpl
}

/** Calls clear() before removing so subscribers receive final empty state. */
export function destroyStorefrontUndoStack(instanceId: string): void {
  const inst = window.__tlk_undo_stack_registry__?.get(instanceId) as StorefrontUndoStackImpl | undefined
  if (inst) {
    inst.clear()
    window.__tlk_undo_stack_registry__!.delete(instanceId)
  }
}

/** Backward-compatible singleton — shared across tailorkit.js and tailorkit-konva.js via window registry. */
export const StorefrontUndoStack: StorefrontUndoStackImpl = getStorefrontUndoStack('default')
