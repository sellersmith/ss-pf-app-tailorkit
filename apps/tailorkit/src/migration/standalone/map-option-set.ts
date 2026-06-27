// Native optionsets → app-platform option-sets value. Preserve the native record first, then overwrite
// only app-platform identity/scope fields so copied TailorKit UI keeps implicit runtime fields.
import type { NativeOptionSet } from '../native/native-graph'
import type { MappedOptionSetValue, StandaloneRecord } from './standalone-records'
import { TAILORKIT_OPTION_SET_COLLECTION } from '../../domain/product-personalizer'
import { idOf } from '../../domain/product-editor-save-payload-utils'

export function mapOptionSet(
  shopDomain: string,
  native: NativeOptionSet
): StandaloneRecord<MappedOptionSetValue> | null {
  const id = idOf(native._id) || idOf(native.id)
  if (!id) return null
  return {
    collection: TAILORKIT_OPTION_SET_COLLECTION,
    id,
    value: {
      ...native,
      _id: id,
      id,
      shopDomain,
    },
  }
}
