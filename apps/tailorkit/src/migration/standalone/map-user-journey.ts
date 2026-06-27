// Native user_journey → app-platform user-journeys value. KEYED BY journey `type` (not _id) because the
// live reader get/puts by type (product-personalizer-api.ts:206,238). Preserve native first, then
// overwrite app-platform identity/scope fields and backfill copied UI defaults.
import type { NativeUserJourney } from '../native/native-graph'
import type { MappedUserJourneyValue, StandaloneRecord } from './standalone-records'

const TAILORKIT_USER_JOURNEY_COLLECTION = 'user-journeys'

export function mapUserJourney(
  shopDomain: string,
  native: NativeUserJourney
): StandaloneRecord<MappedUserJourneyValue> | null {
  const type = typeof native.type === 'string' ? native.type : undefined
  if (!type) return null
  return {
    collection: TAILORKIT_USER_JOURNEY_COLLECTION,
    id: type,
    value: {
      ...native,
      id: type,
      type,
      shopDomain,
      data: Array.isArray(native.data) ? native.data : [],
      currentStep: typeof native.currentStep === 'string' ? native.currentStep : null,
      progress: typeof native.progress === 'number' ? native.progress : 0,
      isFinished: Boolean(native.isFinished),
      showOnboarding: typeof native.showOnboarding === 'boolean' ? native.showOnboarding : true,
      createdAt: typeof native.createdAt === 'string' ? native.createdAt : undefined,
      updatedAt: typeof native.updatedAt === 'string' ? native.updatedAt : undefined,
    },
  }
}
