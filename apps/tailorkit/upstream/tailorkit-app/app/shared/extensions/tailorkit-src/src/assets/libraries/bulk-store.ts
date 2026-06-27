import type {
  BulkConfig,
  BulkConfigPayload,
  BulkStoreListener,
  BulkStoreState,
  BulkUnit,
} from '../types/bulk-personalize'

const DEFAULT_CONFIG: BulkConfig = {
  enabled: false,
  maxUnits: 50,
  labelTemplate: 'Unit {index} of {total}',
}

const generateUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `bulk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

const createUnit = (): BulkUnit => ({ id: generateUuid(), fieldsets: null })

/**
 * Parse the storefront-side bulk config attribute. Defends against malformed JSON,
 * missing fields, and out-of-range values. Returns null when bulk is disabled or
 * the payload is unusable.
 */
export function parseBulkConfig(raw: string | null | undefined): BulkConfig | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as Partial<BulkConfigPayload>
    if (!data || data.e !== true) return null
    const maxUnitsRaw = typeof data.mu === 'number' ? data.mu : Number.parseInt(String(data.mu ?? ''), 10)
    const maxUnits = Number.isFinite(maxUnitsRaw) ? Math.max(1, Math.min(maxUnitsRaw, 50)) : DEFAULT_CONFIG.maxUnits
    const labelTemplate
      = typeof data.lt === 'string' && data.lt.trim().length > 0 ? data.lt.trim() : DEFAULT_CONFIG.labelTemplate
    return { enabled: true, maxUnits, labelTemplate }
  } catch {
    return null
  }
}

/**
 * Per-instance bulk store. Holds N units of personalization state plus active
 * index, allSame flag, and bulkGroupId. Mirrors the architecture of PersonalizerStore
 * but adds the unit-array dimension required by bulk mode.
 *
 * Storage is keyed by the same `instanceId` as PersonalizerStore (`${productId}::${variantId}`).
 * Multiple customizer instances on one page (inline + modal) share the same per-instance
 * bulk store entry, mirroring the single-mode behavior.
 */
class BulkPersonalizerStoreImpl {
  private instances: Record<string, BulkStoreState> = {}
  private listeners: Record<string, Set<BulkStoreListener>> = {}

  private ensureInstance(instanceId: string, config: BulkConfig | null): BulkStoreState {
    if (!this.instances[instanceId]) {
      this.instances[instanceId] = {
        units: [createUnit()],
        activeIndex: 0,
        allSame: false,
        bulkGroupId: null,
        config: config ?? DEFAULT_CONFIG,
      }
    } else if (config) {
      this.instances[instanceId].config = config
    }
    return this.instances[instanceId]
  }

  private emit(instanceId: string) {
    const state = this.instances[instanceId]
    if (!state) return
    this.listeners[instanceId]?.forEach(l => l(state))
  }

  /** Initialize or update bulk state for an instance. Idempotent. */
  init(instanceId: string, config: BulkConfig): BulkStoreState {
    return this.ensureInstance(instanceId, config)
  }

  getState(instanceId: string): BulkStoreState | null {
    return this.instances[instanceId] ?? null
  }

  /**
   * Resize the units array to match `quantity`. Preserves existing entries from
   * the head; truncates from the tail; pads with empty units when growing.
   * Clamps `quantity` to [1, config.maxUnits].
   */
  resize(instanceId: string, quantity: number): BulkStoreState | null {
    const state = this.instances[instanceId]
    if (!state) return null
    const target = Math.max(1, Math.min(quantity, state.config.maxUnits))
    if (target === state.units.length) return state

    if (target < state.units.length) {
      state.units = state.units.slice(0, target)
    } else {
      const additions: BulkUnit[] = []
      for (let i = state.units.length; i < target; i++) additions.push(createUnit())
      state.units = state.units.concat(additions)
    }
    if (state.activeIndex >= state.units.length) state.activeIndex = state.units.length - 1
    this.emit(instanceId)
    return state
  }

  /**
   * Persist the DOM fieldsets snapshot of the currently active unit.
   * Called right before switching to another unit, so the outgoing unit's
   * state is preserved.
   */
  persistActiveFieldsets(instanceId: string, fieldsets: BulkUnit['fieldsets']): BulkStoreState | null {
    const state = this.instances[instanceId]
    if (!state) return null
    const idx = state.activeIndex
    if (!state.units[idx]) return state
    state.units[idx] = { ...state.units[idx], fieldsets }
    this.emit(instanceId)
    return state
  }

  /** Switch the active unit. Caller must hydrate the DOM separately. */
  setActiveIndex(instanceId: string, index: number): BulkStoreState | null {
    const state = this.instances[instanceId]
    if (!state) return null
    const clamped = Math.max(0, Math.min(index, state.units.length - 1))
    if (clamped === state.activeIndex) return state
    state.activeIndex = clamped
    this.emit(instanceId)
    return state
  }

  /** Toggle the global "all engravings exact same" flag. */
  setAllSame(instanceId: string, allSame: boolean): BulkStoreState | null {
    const state = this.instances[instanceId]
    if (!state) return null
    state.allSame = Boolean(allSame)
    this.emit(instanceId)
    return state
  }

  /** Reset the bulk session (called after successful ATC). */
  reset(instanceId: string) {
    if (!this.instances[instanceId]) return
    const config = this.instances[instanceId].config
    this.instances[instanceId] = {
      units: [createUnit()],
      activeIndex: 0,
      allSame: false,
      bulkGroupId: null,
      config,
    }
    this.emit(instanceId)
  }

  /** Generate a fresh group id (call right before building the ATC payload). */
  rotateBulkGroupId(instanceId: string): string | null {
    const state = this.instances[instanceId]
    if (!state) return null
    state.bulkGroupId = generateUuid()
    this.emit(instanceId)
    return state.bulkGroupId
  }

  subscribe(instanceId: string, listener: BulkStoreListener): () => void {
    if (!this.listeners[instanceId]) this.listeners[instanceId] = new Set()
    this.listeners[instanceId].add(listener)
    return () => {
      this.listeners[instanceId]?.delete(listener)
    }
  }
}

export const BulkPersonalizerStore = new BulkPersonalizerStoreImpl()

if (typeof window !== 'undefined') {
  window.__tailorkit__ = {
    ...(window.__tailorkit__ ?? {}),
    bulk_store: BulkPersonalizerStore,
  }
}
