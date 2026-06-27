/**
 * Charm Layer Renderer — Storefront Canvas
 *
 * Renders charm-node layers on the storefront Konva canvas:
 * - FIXED mode: renders charm thumbnails at slot positions (nd[].x, nd[].y)
 * - FREE mode: renders charms at admin-configured positions (lp[].tr[]) with
 *   full move/resize/rotate interactivity. Buyer drag positions are cached across
 *   re-renders via freeModePositionsCache.
 *
 * Also registers charm images as interactive using StorefrontInteractiveCanvasManager,
 * bypassing the LAYER_INTERACTION flag.
 * FIXED mode: move only (snap-to-slot). FREE mode: move + resize + rotate.
 *
 * Node positions and charm size are pre-scaled server-side (preparation-fns)
 * to match the print-area coordinate system used by all other layers.
 */

import type { LayerRendererContext } from './layer-renderer'
import type { Layer } from '../type'
import type { KonvaCanvasManager } from '../../shared/libraries/konva/core/konva-canvas-manager'
import type { CharmChangeDetail, CharmSelection } from '../../shared/components/CharmPicker/charm-picker-types'
import { FEATURE_FLAGS } from '../constants/feature-flags'
import { CharmDragPlugin } from '../features/charm-builder/charm-drag-plugin'
import { getAnchorYOffset, getCharmKonvaPivot } from '../features/charm-builder/charm-anchor-utils'
import { StorefrontLayerState } from '../stores/storefront-layer-state'

/** Fallback charm size if server doesn't provide one (legacy data) */
export const CHARM_RENDER_SIZE_FALLBACK = 180

/** Debug logging prefix — enable verbose logs by setting `localStorage.TK_DEBUG_CHARM = '1'` */
const DEBUG_PREFIX = '[TailorKit Charm Renderer]'

/** Returns true when verbose debug logging is enabled in DevTools */
function isCharmDebugEnabled(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem('TK_DEBUG_CHARM') === '1'
  } catch {
    return false
  }
}

/** Verbose-only log — silent unless TK_DEBUG_CHARM=1 is set in localStorage */
function debugLog(message: string, ...rest: unknown[]): void {
  if (isCharmDebugEnabled()) console.log(`${DEBUG_PREFIX} ${message}`, ...rest)
}

/**
 * Global charmId → Shopify productId map for cross-module communication.
 * Used by deleteLayer() to identify which product a charm node belongs to.
 * Stored on window to guarantee single instance (avoids bundler module duplication).
 */
export function getCharmProductMap(): Map<string, string> {
  const w = window as any
  if (!w.__tkCharmPidMap) w.__tkCharmPidMap = new Map<string, string>()
  return w.__tkCharmPidMap
}

/** Persistent slot→productId mapping per layer. Window global to share across bundles. */
function getSlotAssignmentsCache(): Map<string, (string | null)[]> {
  const w = window as any
  if (!w.__tkSlotAssignmentsCache) w.__tkSlotAssignmentsCache = new Map<string, (string | null)[]>()
  return w.__tkSlotAssignmentsCache
}

/** Per-instance position for FREE mode charms (buyer drag overrides preserved across re-renders) */
type FreeModePosition = { pid: string; x: number; y: number; r: number; s: number }

/**
 * Persistent per-layer list of FREE mode charm positions.
 * Index-ordered to match expanded selections array. Survives canvas re-renders
 * so buyer drag positions are not reset when other charms are added/removed.
 */
const freeModePositionsCache = new Map<string, FreeModePosition[]>()

/**
 * Resolve charm state for a given layer ID from the renderer context.
 * Prefers charmStateMap (multi-builder) over charmState (single-builder legacy).
 */
function resolveCharmStateForLayer(ctx: LayerRendererContext, layerId: string): CharmChangeDetail | null | undefined {
  if (ctx.charmStateMap) {
    return ctx.charmStateMap.get(layerId) ?? null
  }
  return ctx.charmState
}

// Register pre-clear hook so cache syncs live buyer drag positions before
// StorefrontLayerState.clearAll() destroys them during canvas re-render.
// This runs in the same bundle as freeModePositionsCache, so it accesses
// the correct Map instance (unlike a cross-bundle import which would fail).
StorefrontLayerState.onBeforeClear(() => syncFreeModeCache())

/**
 * Get current FREE mode charm positions for a layer.
 * Used by form-manager to serialize positions into order line item properties
 * so the print pipeline can reconstruct the exact charm placement.
 *
 * Merges live buyer drag positions from StorefrontLayerState so that
 * positions are accurate even after the buyer drags/resizes/rotates charms
 * (the cache itself is only written at render time).
 */
export function getFreeModePositions(layerId: string): FreeModePosition[] {
  const cached = freeModePositionsCache.get(layerId) || []
  if (!cached.length) return cached

  // Merge live buyer drag positions from StorefrontLayerState
  return cached.map((pos, idx) => {
    const charmId = `charm-free-${layerId}-${idx}`
    const live = StorefrontLayerState.getCurrent(charmId)
    const def = StorefrontLayerState.getDefault(charmId)
    if (!live || !def) return pos

    // Only override if buyer actually moved/resized/rotated
    const moved = Math.abs(live.x - def.x) > 0.5 || Math.abs(live.y - def.y) > 0.5
    const resized = Math.abs(live.width - def.width) > 0.5
    const rotated = Math.abs(live.rotation - def.rotation) > 0.1
    if (!moved && !resized && !rotated) return pos

    // Convert Konva top-left → center coordinates
    return {
      pid: pos.pid,
      x: live.x + live.width / 2,
      y: live.y + live.height / 2,
      r: live.rotation,
      s: def.width > 0 ? (live.width / def.width) * pos.s : pos.s,
    }
  })
}

/**
 * Sync freeModePositionsCache with live buyer drag positions from StorefrontLayerState.
 *
 * MUST be called before StorefrontLayerState.clearAll() during canvas re-render.
 * Without this, the cache retains stale admin-default positions because clearAll()
 * destroys the live transform data before renderFreeModeCharms can read it.
 *
 * After sync, the cache contains accurate buyer-dragged center coordinates,
 * so the greedy-match algorithm in renderFreeModeCharms preserves correct positions
 * when charm order changes (e.g., adding a 2nd charm A shifts charm B's index).
 */
export function syncFreeModeCache(): void {
  for (const [layerId, cached] of freeModePositionsCache) {
    let changed = false
    const synced = cached.map((pos, idx) => {
      const charmId = `charm-free-${layerId}-${idx}`
      const live = StorefrontLayerState.getCurrent(charmId)
      const def = StorefrontLayerState.getDefault(charmId)
      if (!live || !def) return pos

      const moved = Math.abs(live.x - def.x) > 0.5 || Math.abs(live.y - def.y) > 0.5
      const resized = Math.abs(live.width - def.width) > 0.5
      const rotated = Math.abs(live.rotation - def.rotation) > 0.1
      if (!moved && !resized && !rotated) return pos

      changed = true
      const newS = def.width > 0 ? (live.width / def.width) * pos.s : pos.s
      return {
        pid: pos.pid,
        x: live.x + live.width / 2,
        y: live.y + live.height / 2,
        r: live.rotation,
        s: newS,
      }
    })
    if (changed) {
      freeModePositionsCache.set(layerId, synced)
    }
  }
}

/**
 * Get current slot→productId mapping for a layer.
 * Used by form-manager to serialize per-slot assignments into order properties
 * so the print pipeline can reconstruct the exact charm arrangement.
 */
export function getSlotAssignments(layerId: string): (string | null)[] {
  return getSlotAssignmentsCache().get(layerId) || []
}

/** Free a specific slot in the cache. Called by deleteLayer() for precise slot removal. */
export function freeSlotInCache(layerId: string, slotIdx: number): void {
  const slots = getSlotAssignmentsCache().get(layerId)
  if (slots && slotIdx >= 0 && slotIdx < slots.length) {
    slots[slotIdx] = null
  }
}

/**
 * Render a charm-node layer on the storefront canvas.
 * Dispatches to FIXED or FREE mode based on layer settings.
 */
export async function renderCharmNodeLayer(ctx: LayerRendererContext, layer: Layer): Promise<void> {
  if (!FEATURE_FLAGS.CHARM_BUILDER_STOREFRONT) {
    debugLog('renderCharmNodeLayer SKIPPED — CHARM_BUILDER_STOREFRONT flag is OFF')
    return
  }

  const settings = (layer as any).s || {}
  const displayStyle = settings.ds || 'FIXED'
  const nodes: Array<{ i: string; x: number; y: number; sl: number; l: string; r?: number }> = (layer as any).nd || []
  const linkedProducts: Array<{ pid?: string; cs?: number; tr?: unknown[] }> = (layer as any).lp || []
  const layerId = layer.i ?? ''
  const charmState = ctx.charmStateMap?.get(layerId) ?? ctx.charmState
  const selectionCount = charmState?.selections?.length ?? 0
  const totalQty = charmState?.selections?.reduce((s, sel) => s + (sel.quantity || 0), 0) ?? 0
  const emptyThumbs = charmState?.selections?.filter(sel => !sel.thumbnailUrl).length ?? 0

  debugLog(`renderCharmNodeLayer called for layer "${layerId}"`, {
    displayStyle,
    nodes: nodes.length,
    linkedProducts: linkedProducts.length,
    charmStateLayerId: charmState?.layerId,
    selectionCount,
    totalQty,
    emptyThumbnailUrls: emptyThumbs,
  })

  if (selectionCount > 0 && emptyThumbs > 0) {
    console.warn(
      `${DEBUG_PREFIX} ${emptyThumbs} of ${selectionCount} selected charms have empty thumbnailUrl — `
        + 'they will not render on canvas. Likely cause: Storefront API did not return image for product.'
    )
  }

  if (displayStyle === 'FIXED') {
    await renderFixedModeCharms(ctx, layer, nodes, settings)
  }

  if (displayStyle === 'FREE') {
    await renderFreeModeCharms(ctx, layer, settings)
  }
}

/**
 * FIXED mode: render charm thumbnails at pre-defined slot positions.
 * Expands quantity-based selections into individual slot assignments.
 * Each charm renders at its own product-specific size (per-product cs from server).
 */
async function renderFixedModeCharms(
  ctx: LayerRendererContext,
  layer: Layer,
  nodes: Array<{ i: string; x: number; y: number; sl: number; l: string; r?: number }>,
  settings: { cs?: number; ap?: 'top' | 'center' | 'bottom' }
): Promise<void> {
  if (nodes.length === 0) {
    debugLog(`FIXED mode SKIPPED for layer "${layer.i}" — no slot nodes defined`)
    return
  }
  debugLog(`FIXED mode rendering for layer "${layer.i}"`, { slotCount: nodes.length })

  // Build product → size lookup from linked products (per-product cs from server preparation)
  const linkedProducts: Array<{ pid?: string; cs?: number }> = (layer as any).lp || []
  const productSizeMap = new Map<string, number>()
  for (const lp of linkedProducts) {
    if (lp.pid && lp.cs) productSizeMap.set(lp.pid, lp.cs)
  }

  // Build internal-ref-ID → Shopify-product-ID lookup for default charm mapping
  const refIdToPid = new Map<string, string>()
  for (const lp of linkedProducts) {
    if ((lp as any).i && lp.pid) refIdToPid.set((lp as any).i, lp.pid)
  }

  // Build node defaults: slot index → Shopify product ID (from nd[].dc via lp[].i→pid mapping)
  const nodeDefaults = new Map<number, string>()
  for (let i = 0; i < nodes.length; i++) {
    const dc = (nodes[i] as any).dc as string | undefined
    if (dc) {
      const pid = refIdToPid.get(dc)
      if (pid) nodeDefaults.set(i, pid)
    }
  }

  // Resolve persistent slot assignments (charms keep their slot across re-renders)
  // Uses charmStateMap for multi-builder support, falls back to charmState for legacy.
  const layerCharmState = resolveCharmStateForLayer(ctx, layer.i ?? '')
  const instances = resolveSlotAssignments(layerCharmState, layer.i, nodes.length, nodeDefaults)

  // Fallback charm size from layer-level setting
  const fallbackCharmSize = settings.cs || CHARM_RENDER_SIZE_FALLBACK

  // Clear stale preserved transforms so deleted charms don't hide re-assigned slots
  const charmIdPrefix = `charm-${layer.i}-`
  if ('clearPreservedTransformsForPrefix' in ctx.canvasManager) {
    ;(ctx.canvasManager as any).clearPreservedTransformsForPrefix(charmIdPrefix)
  }

  // Mark empty slots as deleted to prevent ghost data in cart properties
  for (const existingId of StorefrontLayerState.getAllLayerIds()) {
    if (!existingId.startsWith(charmIdPrefix)) continue
    const idx = parseInt(existingId.slice(charmIdPrefix.length), 10)
    if (!isNaN(idx) && idx >= 0 && idx < nodes.length && !instances[idx]) {
      StorefrontLayerState.markDeleted(existingId)
    }
  }

  // Collect node center positions for snap-to-slot and indicator circles
  const nodeCenters: Array<{ x: number; y: number; r?: number }> = []

  for (let slotIdx = 0; slotIdx < nodes.length; slotIdx++) {
    const slot = nodes[slotIdx]
    const instance = instances[slotIdx]

    // Use per-product size when available, otherwise layer fallback
    const charmSize = (instance?.productId && productSizeMap.get(instance.productId)) || fallbackCharmSize

    // slot.x/y are node attachment points (from server preparation)
    const anchorPosition = settings.ap
    const anchorYOffset = getAnchorYOffset(anchorPosition, charmSize / 2)
    nodeCenters.push({ x: slot.x, y: slot.y + anchorYOffset, r: slot.r })

    // X: center on node. Y: adjusted by anchor position (top/center/bottom)
    const topLeftX = slot.x - charmSize / 2
    const topLeftY = slot.y + anchorYOffset

    if (!instance) {
      debugLog(`FIXED mode slot[${slotIdx}] empty — no charm assigned`)
      continue
    }
    if (!instance.thumbnailUrl) {
      console.warn(
        `${DEBUG_PREFIX} FIXED mode slot[${slotIdx}] skipping — empty thumbnailUrl for product ${instance.productId}`
      )
      continue
    }
    debugLog(`FIXED mode addImageLayer slot[${slotIdx}]`, {
      pid: instance.productId,
      url: instance.thumbnailUrl,
      x: topLeftX,
      y: topLeftY,
      size: charmSize,
    })

    const charmId = `charm-${layer.i}-${slotIdx}`
    const slotRotation = slot.r ?? 0
    const defaultTransform = { x: topLeftX, y: topLeftY, width: charmSize, height: charmSize, rotation: slotRotation }

    // Register as interactive before addImageLayer (consumed by next addImageLayer call)
    registerCharmInteractive(ctx.canvasManager, charmId, defaultTransform, 'FIXED')

    // Pivot the rotation at the slot anchor point so the charm swings around its
    // attachment to the slot (like a pendant on a chain), instead of rotating around
    // its own bbox center. Editor + storefront + print all share the same pivot helper.
    await ctx.canvasManager.addImageLayer({
      url: instance.thumbnailUrl,
      x: topLeftX,
      y: topLeftY,
      width: charmSize,
      height: charmSize,
      rotation: slotRotation,
      rotationOrigin: getCharmKonvaPivot(anchorPosition, charmSize),
    })
    // Map charmId → productId so deleteLayer() can notify CharmPicker.
    // Uses window global to avoid module-instance and Konva-node-identity issues.
    getCharmProductMap().set(charmId, instance.productId)
  }

  // Register charm drag plugin for snap-to-slot behavior
  if (layer.i && 'registerDragPlugin' in ctx.canvasManager) {
    const manager = ctx.canvasManager as any
    let plugin: CharmDragPlugin = manager._charmDragPlugin
    if (!plugin) {
      plugin = new CharmDragPlugin({
        createCircle: (config: Record<string, unknown>) => manager.createKonvaCircle(config),
        getMainLayer: () => manager.getMainLayer(),
        getTransformerLayer: () => manager.getTransformerLayer(),
        getInteractiveNodes: () => manager.getInteractiveNodes(),
        getCurrent: (id: string) => manager.getLayerCurrent(id),
        updateTransform: (id: string, t: any) => manager.updateLayerTransform(id, t),
        pushUndo: (delta: any) => manager.pushUndoDelta(delta),
        onSlotSwap: (charmLayerId: string, fromIdx: number, toIdx: number) => {
          // Update slotAssignmentsCache so swap survives canvas re-renders
          const slots = getSlotAssignmentsCache().get(charmLayerId)
          if (slots && fromIdx >= 0 && toIdx >= 0 && fromIdx < slots.length && toIdx < slots.length) {
            const temp = slots[fromIdx]
            slots[fromIdx] = slots[toIdx]
            slots[toIdx] = temp
          }
        },
      })
      manager.registerDragPlugin('charm', plugin)
      manager._charmDragPlugin = plugin
    }
    plugin.setCharmSlots(layer.i, nodeCenters, fallbackCharmSize)
  }
}

/**
 * Resolve charm slot assignments with persistence across re-renders.
 *
 * Instead of rebuilding slot→charm mapping from scratch each render (which
 * causes visual "swaps"), this maintains a persistent mapping so charms
 * stay at their assigned slot when other charms are added/removed.
 *
 * Algorithm:
 * 1. On first init, pre-fill slots from node defaults (dc field) so default
 *    charms render at their merchant-assigned slot positions
 * 2. Remove slots for products that were deselected or over-quantity
 * 3. Assign new/under-quantity products to first available empty slots
 * 4. Return sparse array (null = empty slot) matching node indices
 *
 * @param nodeDefaults - Map of slotIndex → Shopify productId from nd[].dc
 */
function resolveSlotAssignments(
  charmState: CharmChangeDetail | null | undefined,
  layerId: string | undefined,
  maxSlots: number,
  nodeDefaults?: Map<number, string>
): (CharmSelection | null)[] {
  const cacheKey = layerId || ''
  const cache = getSlotAssignmentsCache()

  if (!charmState || charmState.layerId !== layerId) {
    cache.delete(cacheKey)
    return []
  }

  // Initialize or resize slot cache
  let slots = cache.get(cacheKey)
  if (!slots || slots.length !== maxSlots) {
    slots = new Array(maxSlots).fill(null)

    // Pre-fill from node defaults (dc) so default charms land at their intended slots
    if (nodeDefaults) {
      for (const [slotIdx, pid] of nodeDefaults) {
        if (slotIdx >= 0 && slotIdx < maxSlots) {
          slots[slotIdx] = pid
        }
      }
    }

    cache.set(cacheKey, slots)
  }

  // Build productId → selection + target quantity lookup
  const selMap = new Map<string, CharmSelection>()
  const targetQty = new Map<string, number>()
  for (const sel of charmState.selections) {
    selMap.set(sel.productId, sel)
    targetQty.set(sel.productId, sel.quantity)
  }

  // Phase 1: Remove over-quota or deselected products (free up slots)
  const currentQty = new Map<string, number>()
  for (let i = 0; i < slots.length; i++) {
    const pid = slots[i]
    if (!pid) continue
    const count = (currentQty.get(pid) || 0) + 1
    const target = targetQty.get(pid) || 0
    if (count > target) {
      slots[i] = null // Free this slot
    } else {
      currentQty.set(pid, count)
    }
  }

  // Phase 2: Assign under-quota products to first available empty slots
  for (const sel of charmState.selections) {
    const assigned = currentQty.get(sel.productId) || 0
    let needed = sel.quantity - assigned
    for (let i = 0; i < slots.length && needed > 0; i++) {
      if (slots[i] === null) {
        slots[i] = sel.productId
        needed--
      }
    }
  }

  // Phase 3: Convert slot assignments → selection instances (null = empty slot)
  return slots.map(pid => (pid ? (selMap.get(pid) ?? null) : null))
}

/**
 * Register a charm image as interactive (move/resize/rotate).
 * Bypasses LAYER_INTERACTION flag — gated by CHARM_BUILDER_STOREFRONT instead.
 * Uses duck-typed check for StorefrontInteractiveCanvasManager.
 *
 * FIXED mode: move only (snap-to-slot), no resize/rotate.
 * FREE mode: full move + resize + rotate.
 */
function registerCharmInteractive(
  canvasManager: KonvaCanvasManager,
  charmId: string,
  defaultTransform: { x: number; y: number; width: number; height: number; rotation: number },
  displayStyle: 'FIXED' | 'FREE' = 'FIXED'
): void {
  if (!('setNextLayerInteractive' in canvasManager)) return

  const flags
    = displayStyle === 'FREE'
      ? { movable: true, resizable: true, rotatable: true }
      : { movable: true, resizable: false, rotatable: false }
  ;(canvasManager as any).setNextLayerInteractive(charmId, flags, defaultTransform)
}

/**
 * FREE mode: render buyer-selected charms at admin-configured default positions.
 *
 * Each charm instance is placed at the matching product's tr[] transform from
 * the linked products list. Buyer drag positions are preserved across re-renders
 * via freeModePositionsCache (matched by pid + index).
 *
 * Algorithm:
 * 1. Expand selections by quantity → flat [{pid, thumbnailUrl}] array
 * 2. Cap at maxCharms
 * 3. Match existing cache entries by pid (greedy first-match) to preserve buyer drags
 * 4. Unmatched instances get defaults from tr[] or staggered fallback
 * 5. Write resolved positions back to cache
 */
async function renderFreeModeCharms(
  ctx: LayerRendererContext,
  layer: Layer,
  settings: { mc?: number; cs?: number }
): Promise<void> {
  const cacheKey = layer.i || ''

  // Typed linked product with per-product size and admin default transforms
  type LinkedProduct = {
    i?: string
    pid?: string
    cs?: number
    tr?: Array<{ id?: string; x: number; y: number; r: number; s: number }>
  }
  const linkedProducts: LinkedProduct[] = (layer as any).lp || []

  // Build product → size lookup
  const productSizeMap = new Map<string, number>()
  for (const lp of linkedProducts) {
    if (lp.pid && lp.cs) productSizeMap.set(lp.pid, lp.cs)
  }

  // Guard: no charm state or mismatched layer
  // Uses charmStateMap for multi-builder support, falls back to charmState for legacy.
  const freeLayerCharmState = resolveCharmStateForLayer(ctx, layer.i ?? '')
  if (!freeLayerCharmState || freeLayerCharmState.layerId !== layer.i) {
    debugLog(`FREE mode SKIPPED for layer "${layer.i}" — no matching charm state`, {
      hasState: !!freeLayerCharmState,
      stateLayerId: freeLayerCharmState?.layerId,
      expectedLayerId: layer.i,
    })
    freeModePositionsCache.delete(cacheKey)
    return
  }

  const maxCharms = settings.mc ?? 99
  const fallbackCharmSize = settings.cs || CHARM_RENDER_SIZE_FALLBACK
  debugLog(`FREE mode rendering for layer "${layer.i}"`, {
    maxCharms,
    fallbackCharmSize,
    selections: freeLayerCharmState.selections.length,
    linkedProducts: linkedProducts.length,
  })

  // Expand selections by quantity → flat instance list, capped at maxCharms
  type CharmInstance = { pid: string; thumbnailUrl: string }
  const expandedInstances: CharmInstance[] = []
  for (const sel of freeLayerCharmState.selections) {
    for (let q = 0; q < sel.quantity && expandedInstances.length < maxCharms; q++) {
      expandedInstances.push({ pid: sel.productId, thumbnailUrl: sel.thumbnailUrl })
    }
    if (expandedInstances.length >= maxCharms) break
  }

  // Read existing cached positions merged with live buyer drag positions.
  // Using getFreeModePositions() instead of raw cache ensures that when
  // instance order changes (e.g., adding a 2nd charm A shifts charm B's index),
  // the greedy match below uses the ACTUAL buyer-dragged positions — not stale
  // initial positions — so each charm keeps its correct position.
  const existingCache = getFreeModePositions(cacheKey)

  // Build product → unused tr[] transforms lookup (for assigning defaults to new instances)
  const productTrUsage = new Map<string, number>()

  // 2-pass resolution: resolve cached/tr[] positions first, then assign fallbacks.
  // This ensures fallback overlap-avoidance can see ALL occupied positions (including
  // cached entries at later indices), preventing new charms from landing on existing ones.
  const resolvedPositions: (FreeModePosition | null)[] = new Array(expandedInstances.length).fill(null)
  const usedCacheIndices = new Set<number>()

  // --- Pass 1: Resolve all cached and tr[] positions ---
  for (let idx = 0; idx < expandedInstances.length; idx++) {
    const instance = expandedInstances[idx]

    // Try to find a matching pid in existing cache (prefer same index first)
    let cachedPos: FreeModePosition | undefined
    const sameIndexEntry = existingCache[idx]
    if (sameIndexEntry && sameIndexEntry.pid === instance.pid) {
      cachedPos = sameIndexEntry
      usedCacheIndices.add(idx)
    } else {
      for (let ci = 0; ci < existingCache.length; ci++) {
        if (!usedCacheIndices.has(ci) && existingCache[ci].pid === instance.pid) {
          cachedPos = existingCache[ci]
          usedCacheIndices.add(ci)
          break
        }
      }
    }

    if (cachedPos) {
      resolvedPositions[idx] = cachedPos
      productTrUsage.set(instance.pid, (productTrUsage.get(instance.pid) || 0) + 1)
      continue
    }

    // No cached position — try admin tr[] defaults
    const lp = linkedProducts.find(p => p.pid === instance.pid)
    const trList = lp?.tr || []
    const trUsed = productTrUsage.get(instance.pid) || 0
    const trEntry = trList[trUsed]

    if (trEntry) {
      productTrUsage.set(instance.pid, trUsed + 1)
      resolvedPositions[idx] = { pid: instance.pid, x: trEntry.x, y: trEntry.y, r: trEntry.r, s: trEntry.s }
    }
    // else: leave as null → handled in Pass 2
  }

  // --- Pass 2: Assign fallback positions for unresolved entries ---
  // Now ALL cached/tr[] positions are known, so overlap check sees everything.
  // Get original (unscaled) canvas dimensions — same pattern as drag-handlers.ts L107-108
  const stage = ctx.canvasManager.getStage()
  const canvasW = stage.width() / (stage.scaleX() || 1)
  const canvasH = stage.height() / (stage.scaleY() || 1)

  for (let idx = 0; idx < resolvedPositions.length; idx++) {
    if (resolvedPositions[idx] !== null) continue

    const instance = expandedInstances[idx]
    const charmSize = productSizeMap.get(instance.pid) || fallbackCharmSize
    const centerX = canvasW / 2
    const centerY = canvasH / 2

    let x = centerX
    let y = centerY
    const overlapThreshold = charmSize * 0.6
    let attempts = 0
    while (attempts < 20) {
      const cx = x
      const cy = y
      const overlaps = resolvedPositions.some(
        p => p !== null && Math.abs(p.x - cx) < overlapThreshold && Math.abs(p.y - cy) < overlapThreshold
      )
      if (!overlaps) break
      attempts++
      const angle = attempts * 1.2
      const radius = charmSize * 0.8 * Math.ceil(attempts / 6)
      x = centerX + Math.cos(angle) * radius
      y = centerY + Math.sin(angle) * radius
      x = Math.max(charmSize / 2, Math.min(x, canvasW - charmSize / 2))
      y = Math.max(charmSize / 2, Math.min(y, canvasH - charmSize / 2))
    }

    resolvedPositions[idx] = { pid: instance.pid, x, y, r: 0, s: 1 }
  }

  // Persist resolved positions for next re-render (Pass 2 guarantees no nulls remain)
  const finalPositions = resolvedPositions as FreeModePosition[]
  freeModePositionsCache.set(cacheKey, finalPositions)

  // Clear preserved transforms for charm IDs BEFORE rendering.
  // Manager's _preservedTransforms uses index-based IDs (charm-free-layerId-0, -1, ...).
  // When a new charm is inserted, indices shift — old preserved transforms would be
  // applied to WRONG charms (e.g., heart's transform applied to new bow).
  // Our freeModePositionsCache handles position/size preservation correctly, so we
  // clear the manager's preserved transforms to prevent interference.
  const charmIdPrefix = `charm-free-${layer.i}-`
  if ('clearPreservedTransformsForPrefix' in ctx.canvasManager) {
    ;(ctx.canvasManager as any).clearPreservedTransformsForPrefix(charmIdPrefix)
  }

  // Mark stale StorefrontLayerState entries for removal.
  // If previous render had more charms than current (e.g., buyer removed one),
  // leftover entries at higher indices would be orphaned. Mark them deleted so
  // getChangedLayers() doesn't serialize stale transforms into cart properties.
  for (const existingId of StorefrontLayerState.getAllLayerIds()) {
    if (!existingId.startsWith(charmIdPrefix)) continue
    const idx = parseInt(existingId.slice(charmIdPrefix.length), 10)
    if (!isNaN(idx) && idx >= expandedInstances.length) {
      StorefrontLayerState.markDeleted(existingId)
    }
  }

  // Render each instance
  for (let idx = 0; idx < expandedInstances.length; idx++) {
    const instance = expandedInstances[idx]
    const pos = finalPositions[idx]
    const charmSize = productSizeMap.get(instance.pid) || fallbackCharmSize
    const scaledSize = charmSize * pos.s

    const charmId = `charm-free-${layer.i}-${idx}`
    const defaultTransform = {
      x: pos.x - scaledSize / 2,
      y: pos.y - scaledSize / 2,
      width: scaledSize,
      height: scaledSize,
      rotation: pos.r,
    }

    if (!instance.thumbnailUrl) {
      console.warn(`${DEBUG_PREFIX} FREE mode skipping charm[${idx}] — empty thumbnailUrl for product ${instance.pid}`)
      continue
    }
    debugLog(`FREE mode addImageLayer charm[${idx}]`, {
      pid: instance.pid,
      url: instance.thumbnailUrl,
      pos,
      scaledSize,
    })

    registerCharmInteractive(ctx.canvasManager, charmId, defaultTransform, 'FREE')

    await ctx.canvasManager.addImageLayer({
      url: instance.thumbnailUrl,
      x: defaultTransform.x,
      y: defaultTransform.y,
      width: scaledSize,
      height: scaledSize,
      rotation: pos.r,
      rotationOrigin: 'center',
    })
    // Map charmId → productId so deleteLayer() can notify CharmPicker.
    getCharmProductMap().set(charmId, instance.pid)
  }
}
