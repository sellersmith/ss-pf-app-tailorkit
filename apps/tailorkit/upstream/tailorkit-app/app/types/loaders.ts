import type { ShopDocument } from '~/models/Shop'

/**
 * Type definition for the root loader data
 */
export interface RootLoaderData {
  apiKey?: string
  locale: string
  maintenanceMode: boolean
  PUBLIC_ENV: Record<string, unknown>
  polarisStyles: string
  crispChatStyles: string
  globalStyles: string
  isPublic?: boolean
  params?: unknown
  crispWebsiteId?: string
  shopifyPartnerId?: string
  shopData?: ShopDocument | null
  mixPanelAccessToken?: string
  PROPERTY_PREFIX?: string
  /** Whether the $1 first month promotional deal window is open (before June 25 2026) */
  isDealActive?: boolean
  /** Whether this shop has never had a paid subscription (eligible for $1 deal) */
  isDealEligible?: boolean
  /** Remaining trial days for this shop, or null if not on trial */
  remainingTrialDays?: number | null
}
