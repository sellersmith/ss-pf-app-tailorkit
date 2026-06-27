// Bridges the PageFly integration record to the ported TailorKit publish transform.
//
// The storefront Liquid renders option-sets, conditional logic, scaled coordinates, and image/mask
// config that ONLY the upstream `prepareMetafieldDataBeforePublishingIntegrationV2` produces. The
// earlier hand-written `toLayerPayload` emitted a stripped-down shape that crashed the runtime canvas
// (`.map` on undefined). This bridge feeds the verbatim editor blob (`record.editorPayload.variants`,
// the populated SOURCE OF TRUTH) through the ported transform so the metafield value matches the
// original app byte-for-byte.
import type { TailorKitIntegrationRecord } from '../domain/product-personalizer'
import { prepareMetafieldDataBeforePublishingIntegrationV2 } from './storefront-prepare/routes/api.integration/preparation-fns.server'
import type { VariantIntegration } from './storefront-prepare/types/integration'

/** Per-variant storefront metafield value keyed by Shopify numeric variant id. */
export type TailorKitPreparedVariantData = Record<string, Record<string, { mockup: Record<string, unknown> | null }>>

function editorPayloadVariants(record: TailorKitIntegrationRecord): VariantIntegration[] {
  // editorPayload is an untyped JSON blob (Record<string, unknown>); `.variants` is the populated
  // editor variant list whose shape matches the upstream VariantIntegration the transform expects.
  const payload = record.editorPayload as { variants?: unknown } | undefined
  const variants = payload?.variants
  return Array.isArray(variants) ? (variants as VariantIntegration[]) : []
}

/**
 * Runs the ported upstream transform over the record's editor blob. Returns the full multi-variant
 * metafield map ({ [shopifyVariantId]: { [shopifyVariantId]: { mockup } } }). Returns an empty object
 * when the record has no editorPayload (legacy records saved before the blob existed) so the caller
 * can fall back to publishing empty variant metafields.
 */
export function prepareTailorKitStorefrontVariantData(record: TailorKitIntegrationRecord): TailorKitPreparedVariantData {
  const variants = editorPayloadVariants(record)
  if (!variants.length) return {}

  // The transform is a deep synchronous walk over the untyped editor blob. A blob shape the per-field
  // guards don't cover would throw and reject the merchant's publish — the exact failure class this
  // fix removes. Contain it: on throw, log and return {} so the publisher writes empty variant
  // metafields (same as a legacy record) instead of failing the whole publish.
  try {
    // AI pre-made prompts and AI-credit gating are not ported yet; pass the upstream defaults (no
    // prompts, credits undefined) so the transform behaves exactly as the original with AI features off.
    return prepareMetafieldDataBeforePublishingIntegrationV2(variants) as TailorKitPreparedVariantData
  } catch (error) {
    console.error('[tailorkit] storefront prepare transform failed; publishing empty variant data', error)
    return {}
  }
}
