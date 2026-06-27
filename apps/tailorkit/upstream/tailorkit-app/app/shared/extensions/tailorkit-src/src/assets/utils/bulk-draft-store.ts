/**
 * Bulk drawer draft persistence.
 *
 * Saves the in-progress per-unit personalization state to localStorage so the
 * customer doesn't lose their work on page refresh, accidental drawer close,
 * or short detours to other tabs. Cleared after a successful Add-to-Cart.
 *
 * Scoped by (productId, variantId) so different products / variant pickers
 * don't collide. Schema is versioned to allow future format migration.
 *
 * KISS: pure functions, no listeners. Drawer calls save/load/clear at the
 * right moments. Failures (quota, private-mode, disabled storage) are
 * swallowed silently — losing a draft must never break the drawer.
 */

const STORAGE_KEY_PREFIX = 'tlk-bulk-draft:'
const SCHEMA_VERSION = 1
/** Drafts older than 24h are discarded on load. Image S3 URLs typically stay
 * valid much longer, but stale text drafts surprise the customer. */
const TTL_MS = 24 * 60 * 60 * 1000

/** Stored snapshot of the bulk drawer's user-facing state for one (product, variant). */
export interface BulkDraft {
  /** Schema version; bump when shape changes incompatibly. */
  v: number
  /** Epoch ms when the draft was last written. */
  ts: number
  /** Quantity selected at save time. */
  qty: number
  /** "All units share the same personalization" toggle. */
  allSame: boolean
  /** Per-unit text values keyed by unit index then "${printAreaId}:${layerId}". */
  text: Record<number, Record<string, string>>
  /** Per-unit image upload state keyed identically to `text`. */
  images: Record<number, Record<string, { url: string; name: string; displayLabel?: string }>>
}

function buildKey(productId: string, variantId: string): string | null {
  if (!productId || !variantId) return null
  return `${STORAGE_KEY_PREFIX}${productId}:${variantId}`
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Persist a draft. No-ops when storage is unavailable or full so the drawer
 * remains usable in private-browsing windows and quota-exhausted environments.
 */
export function saveDraft(productId: string, variantId: string, draft: Omit<BulkDraft, 'v' | 'ts'>): void {
  const key = buildKey(productId, variantId)
  const storage = getStorage()
  if (!key || !storage) return
  const payload: BulkDraft = { v: SCHEMA_VERSION, ts: Date.now(), ...draft }
  try {
    storage.setItem(key, JSON.stringify(payload))
  } catch {
    // Quota exceeded or serialization error — skip silently.
  }
}

/**
 * Load a draft, validating schema version and TTL. Returns null when no draft
 * exists, the schema is from a different version, or the entry is older than TTL.
 * Stale entries are removed so they don't accumulate.
 */
export function loadDraft(productId: string, variantId: string): BulkDraft | null {
  const key = buildKey(productId, variantId)
  const storage = getStorage()
  if (!key || !storage) return null
  let raw: string | null = null
  try {
    raw = storage.getItem(key)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<BulkDraft>
    if (!parsed || parsed.v !== SCHEMA_VERSION) {
      // Different schema — drop it so a future load doesn't keep returning null.
      try {
        storage.removeItem(key)
      } catch {
        // Removal failed (rare); the stale entry will eventually expire on its own.
      }
      return null
    }
    if (typeof parsed.ts !== 'number' || Date.now() - parsed.ts > TTL_MS) {
      try {
        storage.removeItem(key)
      } catch {
        // Removal failed (rare); the stale entry will eventually expire on its own.
      }
      return null
    }
    // Defensive defaults: a corrupted draft should never crash the drawer.
    return {
      v: parsed.v,
      ts: parsed.ts,
      qty: typeof parsed.qty === 'number' ? parsed.qty : 2,
      allSame: Boolean(parsed.allSame),
      text: (parsed.text && typeof parsed.text === 'object' ? parsed.text : {}) as BulkDraft['text'],
      images: (parsed.images && typeof parsed.images === 'object' ? parsed.images : {}) as BulkDraft['images'],
    }
  } catch {
    return null
  }
}

/** Remove the draft for a (product, variant). Called after successful ATC. */
export function clearDraft(productId: string, variantId: string): void {
  const key = buildKey(productId, variantId)
  const storage = getStorage()
  if (!key || !storage) return
  try {
    storage.removeItem(key)
  } catch {
    // Swallow — failing to clear is not catastrophic; TTL will eventually evict it.
  }
}
