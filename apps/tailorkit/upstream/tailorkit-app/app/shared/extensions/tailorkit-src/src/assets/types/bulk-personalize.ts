import type { FieldsetSnapshot } from '../utils/hydrate-dom-fieldsets'

/**
 * Bulk personalization config received from the server via the customizer
 * Web Component's `data-bulk-config` attribute. Short-key shape matches the
 * metafield serialization in app/routes/api.integration/preparation-fns.server.ts.
 */
export interface BulkConfigPayload {
  /** enabled */
  e: boolean
  /** maxUnits */
  mu: number
  /** labelTemplate */
  lt: string
}

/** Normalized bulk config used at runtime; long key form for clarity. */
export interface BulkConfig {
  enabled: boolean
  maxUnits: number
  labelTemplate: string
}

/**
 * One unit of bulk personalization state.
 *
 * `fieldsets` is the captured DOM state of the fieldsets container at the
 * moment the user switched away from this unit. On unit switch back, we
 * restore this snapshot to the DOM and re-run OptionProcessor.processFieldsetData
 * to derive the personalization data for live preview + ATC payload.
 *
 * Storing DOM (instead of the derived data) keeps a single source of truth and
 * preserves option-type-specific UI state that is hard to roundtrip via metadata
 * alone (image option grids, color swatch focus, expanded accordions).
 */
export interface BulkUnit {
  /** Stable per-unit id (UUID) for diffing and DOM keying. */
  id: string
  /** Per-unit DOM snapshot. Null until the user has interacted with this unit at least once. */
  fieldsets: FieldsetSnapshot | null
  /** Optional per-unit preview asset URL injected at ATC time (Phase D). */
  previewUrl?: string
}

/**
 * Bulk store state for one customizer instance.
 *
 * Invariants:
 * - `units.length` equals the customer's quantity input (1..maxUnits).
 * - `activeIndex` is in range [0, units.length) at all times.
 * - When `allSame` is true and submit fires, all units mirror unit 0's snapshot.
 * - `bulkGroupId` is generated fresh per ATC submit (so cart adds get distinct group ids).
 */
export interface BulkStoreState {
  units: BulkUnit[]
  activeIndex: number
  allSame: boolean
  bulkGroupId: string | null
  config: BulkConfig
}

/** Listener signature for bulk store subscribers. */
export type BulkStoreListener = (state: BulkStoreState) => void
