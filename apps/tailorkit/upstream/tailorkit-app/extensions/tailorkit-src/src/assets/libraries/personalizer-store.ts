type PrintAreaId = string
type LayerId = string

export interface PersonalizerSnapshot {
  metaData: Record<PrintAreaId, Record<LayerId, any>>
  displayData: Record<PrintAreaId, Record<LayerId, any>>
}

type Listener = (state: PersonalizerSnapshot) => void

interface InstanceEntry {
  state: PersonalizerSnapshot | null
  listeners: Set<Listener>
}

const instances: Record<string, InstanceEntry> = {}

const ensureInstance = (instanceId: string): InstanceEntry => {
  if (!instances[instanceId]) {
    instances[instanceId] = {
      state: null,
      listeners: new Set<Listener>(),
    }
  }
  return instances[instanceId]
}

/**
 * Shared in-memory snapshot store for syncing option state across
 * multiple TailorKit product-personalizer instances (inline and modal).
 *
 * Keyed by a stable instanceId: `${productId}::${variantId}`.
 */
export const PersonalizerStore = {
  /**
   * Get all instances.
   */
  getInstances(): Record<string, InstanceEntry> {
    return instances
  },

  /**
   * Get snapshot for an instance.
   */
  getState(instanceId: string): PersonalizerSnapshot | null {
    return ensureInstance(instanceId).state
  },

  /**
   * Set or replace snapshot for an instance and notify subscribers.
   */
  setSnapshot(instanceId: string, snapshot: PersonalizerSnapshot) {
    const entry = ensureInstance(instanceId)
    entry.state = snapshot
    entry.listeners.forEach(listener => listener(snapshot))
  },

  /**
   * Subscribe to snapshot updates for an instance. Returns an unsubscribe function.
   */
  subscribe(instanceId: string, listener: Listener): () => void {
    const entry = ensureInstance(instanceId)
    entry.listeners.add(listener)
    return () => entry.listeners.delete(listener)
  },
}

if (typeof window !== 'undefined') {
  window.__tailorkit__ = {
    ...(window.__tailorkit__ ?? {}),
    personalizer_store: PersonalizerStore,
  }
}
