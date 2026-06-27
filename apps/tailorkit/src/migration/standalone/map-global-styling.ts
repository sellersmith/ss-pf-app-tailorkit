// Native globalstylings.styling → app-platform personalizer-settings/global-styling.
// Preserve the native styling record first, then overwrite the app-platform record id and scoped shop.
import type { NativeGlobalStyling } from '../native/native-graph'
import type { MappedGlobalStylingValue, StandaloneRecord } from './standalone-records'
import {
  TAILORKIT_GLOBAL_STYLING_RECORD_ID,
  TAILORKIT_PERSONALIZER_SETTINGS_COLLECTION,
} from '../../backend/global-styling-repository'

export function mapGlobalStyling(native: NativeGlobalStyling | null): StandaloneRecord<MappedGlobalStylingValue> | null {
  if (!native || !native.styling || typeof native.styling !== 'object') return null
  return {
    collection: TAILORKIT_PERSONALIZER_SETTINGS_COLLECTION,
    id: TAILORKIT_GLOBAL_STYLING_RECORD_ID,
    value: {
      ...native,
      id: TAILORKIT_GLOBAL_STYLING_RECORD_ID,
      shopDomain: native.shopDomain,
      styling: native.styling,
      updatedAt: typeof native.updatedAt === 'string' ? native.updatedAt : new Date(0).toISOString(),
    },
  }
}
