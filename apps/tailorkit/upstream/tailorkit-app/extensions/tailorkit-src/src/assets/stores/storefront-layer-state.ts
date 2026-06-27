/**
 * StorefrontLayerStateStore — Session state for interactive layer transforms.
 *
 * Session-local only — does NOT persist to localStorage/IndexedDB.
 * Reset restores position/size/rotation; text content and image source are unchanged.
 *
 * Print render: Registry refactor preserves LayerTransform shape — no renderLayer() impact.
 */

import { FEATURE_FLAGS } from '../constants/feature-flags'

export interface LayerTransform {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

/** Zone shape type for buyer text movement zone */
export type MovementZoneType = 'rectangle' | 'ellipse' | 'path'

/**
 * Bounding zone for buyer text movement (scaled px, already scaled by preparation-fns).
 * Acts as clipping mask — text outside zone is hidden.
 * Defined locally (no cross-bundle imports from app/).
 */
export interface MovementBounds {
  type: MovementZoneType
  x: number
  y: number
  width: number
  height: number
  /** SVG d attribute — only for type === 'path' */
  pathData?: string
  pathViewBox?: { width: number; height: number }
}

export interface LayerInteractionFlags {
  /** Allow customer to drag/move the layer */
  movable: boolean
  /** Allow customer to resize the layer */
  resizable: boolean
  /** Allow customer to rotate the layer */
  rotatable: boolean
  /** Movement zone — clipping mask + soft drag boundary (already scaled) */
  movementBounds?: MovementBounds
  /** Initial text x = movementBounds.x + defaultOffsetX (already scaled) */
  defaultOffsetX?: number
  /** Initial text y = movementBounds.y + defaultOffsetY (already scaled) */
  defaultOffsetY?: number
  /** Scale factor used to convert template coords → storefront canvas px (X axis) */
  originalScaleX?: number
  /** Scale factor used to convert template coords → storefront canvas px (Y axis) */
  originalScaleY?: number
}

type LayerStateListener = (layerId: string) => void

class StorefrontLayerStateImpl {
  /** Current runtime transforms keyed by layerId */
  private current: Map<string, LayerTransform> = new Map()

  /** Merchant defaults keyed by layerId — used for Reset */
  private defaults: Map<string, LayerTransform> = new Map()

  /** Per-layer interaction capability flags */
  private flags: Map<string, LayerInteractionFlags> = new Map()

  /** Layer IDs that have been deleted in this session */
  private deleted: Set<string> = new Set()

  /** Change listeners */
  private listeners: Set<LayerStateListener> = new Set()

  /** Hooks called before clearAll() — allows caches in other bundles to sync live data */
  private beforeClearHooks: Set<() => void> = new Set()

  // ─── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a layer with its default transform and flags.
   * Called once when layer is added to the canvas.
   */
  register(layerId: string, defaultTransform: LayerTransform, flags: LayerInteractionFlags): void {
    this.defaults.set(layerId, { ...defaultTransform })
    this.current.set(layerId, { ...defaultTransform })
    this.flags.set(layerId, { ...flags })
  }

  // ─── State access ──────────────────────────────────────────────────────────

  getCurrent(layerId: string): LayerTransform | undefined {
    return this.current.get(layerId)
  }

  getDefault(layerId: string): LayerTransform | undefined {
    return this.defaults.get(layerId)
  }

  getFlags(layerId: string): LayerInteractionFlags | undefined {
    return this.flags.get(layerId)
  }

  isDeleted(layerId: string): boolean {
    return this.deleted.has(layerId)
  }

  /** All layer IDs currently registered (including deleted). */
  getAllLayerIds(): string[] {
    return Array.from(this.current.keys())
  }

  /**
   * Returns layers that have been changed from their defaults.
   * Used by Add to Cart middleware — only serialize deltas to minimize Shopify property size.
   */
  getChangedLayers(): Array<{ layerId: string; transform: LayerTransform; deleted: boolean }> {
    const results: Array<{ layerId: string; transform: LayerTransform; deleted: boolean }> = []

    for (const [layerId, currentTransform] of this.current.entries()) {
      if (this.deleted.has(layerId)) {
        results.push({ layerId, transform: currentTransform, deleted: true })
        continue
      }

      const defaultTransform = this.defaults.get(layerId)
      if (!defaultTransform) continue

      // Only include if there's a meaningful delta
      const hasChanged
        = Math.abs(currentTransform.x - defaultTransform.x) > 0.5
        || Math.abs(currentTransform.y - defaultTransform.y) > 0.5
        || Math.abs(currentTransform.width - defaultTransform.width) > 0.5
        || Math.abs(currentTransform.height - defaultTransform.height) > 0.5
        || Math.abs(currentTransform.rotation - defaultTransform.rotation) > 0.1

      if (hasChanged) {
        results.push({ layerId, transform: currentTransform, deleted: false })
      }
    }

    return results
  }

  // ─── Mutations ─────────────────────────────────────────────────────────────

  updateTransform(layerId: string, transform: Partial<LayerTransform>): void {
    const existing = this.current.get(layerId)
    if (!existing) return
    this.current.set(layerId, { ...existing, ...transform })
    this.notify(layerId)
  }

  markDeleted(layerId: string): void {
    this.deleted.add(layerId)
    this.notify(layerId)
  }

  restoreDeleted(layerId: string): void {
    this.deleted.delete(layerId)
    this.notify(layerId)
  }

  resetToDefault(layerId: string): LayerTransform | undefined {
    const def = this.defaults.get(layerId)
    if (!def) return undefined
    this.current.set(layerId, { ...def })
    this.deleted.delete(layerId)
    this.notify(layerId)
    return { ...def }
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Register a hook to run before clearAll().
   * Used by charm-layer-renderer to sync freeModePositionsCache with live
   * transforms before they are destroyed. Works across bundle boundaries
   * because StorefrontLayerState is a window-backed singleton.
   */
  onBeforeClear(hook: () => void): () => void {
    this.beforeClearHooks.add(hook)
    return () => this.beforeClearHooks.delete(hook)
  }

  /** Clear everything — call when canvas is re-rendered from scratch. */
  clearAll(): void {
    // Fire pre-clear hooks so caches can sync live data before it's destroyed
    this.beforeClearHooks.forEach(hook => hook())

    this.current.clear()
    this.defaults.clear()
    this.flags.clear()
    this.deleted.clear()
  }

  // ─── Subscriptions ─────────────────────────────────────────────────────────

  subscribe(listener: LayerStateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(layerId: string): void {
    this.listeners.forEach(l => l(layerId))
  }
}

// ─── Window-backed registry ────────────────────────────────────────────────
//
// StorefrontInteractiveCanvasManager lives in tailorkit-konva.js (feature bundle)
// while addProductToCartMiddleware.ts lives in tailorkit.js (main bundle).
// Both need to share the SAME store instance per instanceId so ATC reads the
// layer changes that the interactive canvas writes. We use the window global as
// a shared Map registry so the first bundle to run creates each instance and
// subsequent bundles reuse it — no matter which loads first.
//
// To maintain backward compatibility, all existing call sites continue to import
// `StorefrontLayerState` (the default instance) unchanged.
//
declare global {
  interface Window {
    __tlk_layer_state_registry__?: Map<string, unknown>
  }
}

if (!window.__tlk_layer_state_registry__) {
  window.__tlk_layer_state_registry__ = new Map()
}

/** Creates lazily on first access. Non-default IDs coerced to 'default' when MULTI_INSTANCE is off. */
export function getStorefrontLayerState(instanceId: string = 'default'): StorefrontLayerStateImpl {
  // Kill switch: when multi-instance is disabled, all instances share 'default'
  const resolvedId = !FEATURE_FLAGS.MULTI_INSTANCE && instanceId !== 'default' ? 'default' : instanceId

  if (!window.__tlk_layer_state_registry__!.has(resolvedId)) {
    window.__tlk_layer_state_registry__!.set(resolvedId, new StorefrontLayerStateImpl())
  }
  return window.__tlk_layer_state_registry__!.get(resolvedId) as StorefrontLayerStateImpl
}

/** Calls clearAll() before removing so pre-clear hooks fire. */
export function destroyStorefrontLayerState(instanceId: string): void {
  const inst = window.__tlk_layer_state_registry__?.get(instanceId) as StorefrontLayerStateImpl | undefined
  if (inst) {
    inst.clearAll()
    window.__tlk_layer_state_registry__!.delete(instanceId)
  }
}

/** Backward-compatible singleton — shared across tailorkit.js and tailorkit-konva.js via window registry. */
export const StorefrontLayerState: StorefrontLayerStateImpl = getStorefrontLayerState('default')
