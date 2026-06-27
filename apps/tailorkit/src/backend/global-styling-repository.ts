// TailorKit global styling persists in app-scoped data and mirrors to the `em_tailorkit.global_styling`
// app metafield that storefront Liquid reads. This repository is the single read/write path so the
// preferences API and the storefront activation publisher stay in sync.
import type { AppBackendPorts, AppContext } from '../../../../web/server/src/app-platform/contracts'
import { tailorkitAppDataCollections } from '../domain/migration-boundary'

export const TAILORKIT_PERSONALIZER_SETTINGS_COLLECTION = 'personalizer-settings'
export const TAILORKIT_GLOBAL_STYLING_RECORD_ID = 'global-styling'

export interface TailorKitGlobalStylingRecord {
  id: typeof TAILORKIT_GLOBAL_STYLING_RECORD_ID
  styling: Record<string, unknown>
  updatedAt: string
}

/**
 * App-data collections register per port instance (closure-scoped map), so a fresh host context — e.g.
 * the storefront activation publisher's host, distinct from the request that served preferences-api —
 * starts with an empty registry. Reading before registering throws "collection is not registered".
 * Callers running outside the preferences/personalizer request path MUST register first.
 */
async function ensurePersonalizerSettingsCollection(ports: AppBackendPorts, ctx: AppContext): Promise<void> {
  const definition = tailorkitAppDataCollections.find(
    item => item.collection === TAILORKIT_PERSONALIZER_SETTINGS_COLLECTION
  )
  if (!definition) throw new Error('TailorKit personalizer settings collection is not declared in migration boundary')
  await ports.appData.registerCollection(ctx, definition)
}

export async function readTailorKitGlobalStyling(
  ports: AppBackendPorts,
  ctx: AppContext
): Promise<TailorKitGlobalStylingRecord | null> {
  await ensurePersonalizerSettingsCollection(ports, ctx)
  return ports.appData.get<TailorKitGlobalStylingRecord>(
    ctx,
    TAILORKIT_PERSONALIZER_SETTINGS_COLLECTION,
    TAILORKIT_GLOBAL_STYLING_RECORD_ID
  )
}
