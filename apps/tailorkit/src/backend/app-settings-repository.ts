// TailorKit storefront app settings (modal/zoom/confirmation/redirect/colour-guide/emoji) persist in
// app-scoped data and mirror to the `em_tailorkit.app_settings` app metafield the copied storefront Liquid
// reads (`customizer.liquid` → `app.metafields.em_tailorkit.app_settings.value`). This repository is the
// single read/write path so the Storefront-tab `UPDATE_APP_METAFIELDS` save and the `/theme-config` read
// stay in sync — mirroring how `global-styling-repository` pairs with the global styling channel.
import type { AppBackendPorts, AppContext, AppDataMetafieldInput } from '../../../../web/server/src/app-platform/contracts'
import { tailorkitAppDataCollections } from '../domain/migration-boundary'
import { TAILORKIT_PERSONALIZER_SETTINGS_COLLECTION, readTailorKitGlobalStyling } from './global-styling-repository'
import { TAILORKIT_APP_SETTINGS_METAFIELD } from './storefront-metafield-keys'

export const TAILORKIT_APP_SETTINGS_RECORD_ID = 'app-settings'

export interface TailorKitAppSettingsRecord {
  id: typeof TAILORKIT_APP_SETTINGS_RECORD_ID
  appMetafields: Record<string, unknown>
  updatedAt: string
}

/**
 * App-data collections register per port instance (closure-scoped map), so a host context distinct from
 * the request that served preferences-api starts with an empty registry. Reading before registering
 * throws "collection is not registered"; callers outside the personalizer request path register first.
 */
async function ensurePersonalizerSettingsCollection(ports: AppBackendPorts, ctx: AppContext): Promise<void> {
  const definition = tailorkitAppDataCollections.find(
    item => item.collection === TAILORKIT_PERSONALIZER_SETTINGS_COLLECTION
  )
  if (!definition) throw new Error('TailorKit personalizer settings collection is not declared in migration boundary')
  await ports.appData.registerCollection(ctx, definition)
}

export async function readTailorKitAppSettings(
  ports: AppBackendPorts,
  ctx: AppContext
): Promise<TailorKitAppSettingsRecord | null> {
  await ensurePersonalizerSettingsCollection(ports, ctx)
  return ports.appData.get<TailorKitAppSettingsRecord>(
    ctx,
    TAILORKIT_PERSONALIZER_SETTINGS_COLLECTION,
    TAILORKIT_APP_SETTINGS_RECORD_ID
  )
}

/** Mirrors the app-settings blob to the `em_tailorkit.app_settings` metafield read by storefront Liquid. */
export function createTailorKitAppSettingsMetafield(
  appMetafields: Record<string, unknown>,
  reason: string
): AppDataMetafieldInput {
  return {
    namespace: TAILORKIT_APP_SETTINGS_METAFIELD.namespace,
    key: TAILORKIT_APP_SETTINGS_METAFIELD.key,
    type: 'json',
    owner: 'app-installation',
    value: appMetafields,
    reason,
  }
}

/**
 * The storefront `em_tailorkit.app_settings` metafield is the UNION upstream stores under
 * `appConfig.appMetafields`, not just the Storefront-tab form blob. The copied Liquid reads more than the
 * form's own keys off `app_settings.value`:
 *  - `customizer.liquid` → `app_settings.globalStyling.heading.text` (the SSR personalization title), and
 *  - `print-areas.liquid` → `app_settings.aiPersonalizerProduct`.
 * `globalStyling` lives in its OWN app-data record (the styling sub-view / GlobalStyling channel), so the
 * mirror must fold it back in here or the SSR title silently regresses to the theme block default. We read
 * the current global styling and overlay it so the mirror always carries an up-to-date `globalStyling`.
 * (`aiPersonalizerProduct` has no in-scope writer in this port, so it stays absent — pre-existing.)
 */
async function buildTailorKitAppSettingsMirror(
  ports: AppBackendPorts,
  ctx: AppContext,
  appMetafields: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const globalStyling = await readTailorKitGlobalStyling(ports, ctx)
  const mirror: Record<string, unknown> = { ...appMetafields }
  if (globalStyling?.styling) mirror.globalStyling = globalStyling.styling
  return mirror
}

/**
 * Merges the incoming partial appMetafields onto the stored blob (the Storefront tab saves the whole form
 * object, but a shallow merge keeps any keys written by other surfaces — each top-level key is one card's
 * settings, so per-key replacement matches upstream `$set appConfig.appMetafields.<key>`), persists it, and
 * mirrors the union (form blob + global styling) to the storefront metafield. Returns the merged blob.
 */
export async function writeTailorKitAppSettings(
  ports: AppBackendPorts,
  ctx: AppContext,
  appMetafields: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const current = await readTailorKitAppSettings(ports, ctx)
  const merged = { ...(current?.appMetafields || {}), ...appMetafields }

  const next: TailorKitAppSettingsRecord = {
    id: TAILORKIT_APP_SETTINGS_RECORD_ID,
    appMetafields: merged,
    updatedAt: new Date().toISOString(),
  }

  await ports.appData.put(ctx, TAILORKIT_PERSONALIZER_SETTINGS_COLLECTION, TAILORKIT_APP_SETTINGS_RECORD_ID, next)
  await ports.appMetafields.setMany(ctx, [
    createTailorKitAppSettingsMetafield(
      await buildTailorKitAppSettingsMirror(ports, ctx, merged),
      'tailorkit-app-settings-updated'
    ),
  ])

  return merged
}

/**
 * Re-publishes the `em_tailorkit.app_settings` mirror after the global styling channel changes (the styling
 * sub-view writes `global_styling`, which the SSR title reads via `app_settings.globalStyling`). Keeps the
 * mirror's form-blob keys intact and only refreshes the folded-in `globalStyling`.
 */
export async function syncTailorKitAppSettingsGlobalStylingMirror(
  ports: AppBackendPorts,
  ctx: AppContext
): Promise<void> {
  const current = await readTailorKitAppSettings(ports, ctx)
  await ports.appMetafields.setMany(ctx, [
    createTailorKitAppSettingsMetafield(
      await buildTailorKitAppSettingsMirror(ports, ctx, current?.appMetafields || {}),
      'tailorkit-app-settings-global-styling-sync'
    ),
  ])
}
