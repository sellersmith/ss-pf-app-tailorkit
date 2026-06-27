// Record shapes emitted by the standalone mappers. Each becomes one appData.put(collection, id, value).
import type { TailorKitOrderRecord } from '../../domain/order-record'

/** A single keyed write the runner applies via the scoped app-data port. */
export interface StandaloneRecord<T = unknown> {
  collection: string
  id: string
  value: T
}

/** option-sets value shape — near-1:1 with native optionsets; `status` is intentionally absent (reader tolerant). */
export interface MappedOptionSetValue {
  [key: string]: unknown
  _id: string
  id?: string
  label?: unknown
  labelOnStoreFront?: unknown
  shopDomain: string
  type?: unknown
  data?: unknown
  values?: unknown
  editingMode?: unknown
  additionalPricingEnabled?: unknown
  originalBaseState?: unknown
  originalClipGroup?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

/** user-journeys value shape — keyed by journey `type` (matches the live reader's get/put key). */
export interface MappedUserJourneyValue {
  [key: string]: unknown
  id: string
  type: string
  data: unknown[]
  currentStep: string | null
  progress: number
  isFinished: boolean
  showOnboarding: boolean
  createdAt?: string
  updatedAt?: string
}

/** personalizer-settings value shape — single per-shop record id 'app-settings'. */
export interface MappedPersonalizerSettingsValue {
  [key: string]: unknown
  id: 'app-settings'
  appMetafields: Record<string, unknown>
  updatedAt: string
}

/** personalizer-settings value shape — single per-shop record id 'global-styling'. */
export interface MappedGlobalStylingValue {
  [key: string]: unknown
  id: 'global-styling'
  shopDomain?: string
  styling: Record<string, unknown>
  updatedAt: string
}

export type MappedOrderValue = TailorKitOrderRecord
