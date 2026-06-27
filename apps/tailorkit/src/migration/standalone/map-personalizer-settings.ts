// Native shop.appConfig.appMetafields → app-platform personalizer-settings value. Single per-shop record
// id 'app-settings' (TAILORKIT_APP_SETTINGS_RECORD_ID). Matches the readTailorKitAppSettings shape
// ({ id, appMetafields, updatedAt }) so the Storefront tab + /theme-config read resolve after migration.
import type { NativePersonalizerSettings } from '../native/native-graph'
import type { MappedPersonalizerSettingsValue, StandaloneRecord } from './standalone-records'
import {
  TAILORKIT_APP_SETTINGS_RECORD_ID,
} from '../../backend/app-settings-repository'
import { TAILORKIT_PERSONALIZER_SETTINGS_COLLECTION } from '../../backend/global-styling-repository'

export function mapPersonalizerSettings(
  native: NativePersonalizerSettings | null
): StandaloneRecord<MappedPersonalizerSettingsValue> | null {
  if (!native) return null
  const appConfig = (native.appConfig && typeof native.appConfig === 'object' ? native.appConfig : {}) as Record<
    string,
    unknown
  >
  const appMetafields =
    appConfig.appMetafields && typeof appConfig.appMetafields === 'object'
      ? (appConfig.appMetafields as Record<string, unknown>)
      : {}
  // No app_settings configured natively → nothing to migrate (reader falls back to defaults).
  if (!Object.keys(appMetafields).length) return null
  return {
    collection: TAILORKIT_PERSONALIZER_SETTINGS_COLLECTION,
    id: TAILORKIT_APP_SETTINGS_RECORD_ID,
    value: {
      ...native,
      id: TAILORKIT_APP_SETTINGS_RECORD_ID,
      appMetafields,
      updatedAt: typeof native.updatedAt === 'string' ? native.updatedAt : new Date(0).toISOString(),
    },
  }
}
