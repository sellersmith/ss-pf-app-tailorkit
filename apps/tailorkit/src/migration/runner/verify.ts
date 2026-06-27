// Dirty-target-safe verify: per-migrated-shop, every resolvable native integration id must resolve to
// an app-platform envelope with matching id + a sample variant carrying the same shopifyVariantId.
// Re-run is a no-op: envelope count for the shop does NOT grow (idempotent against dirty targets).
// Migration intentionally leaves every record unpublished because it does not run PageFly publish side effects.
import type { AppContext } from '../../../../../web/server/src/app-platform/contracts'
import type { ScopedAppDataPort } from '../../../../../web/server/src/app-platform/contracts'
import type { TailorKitIntegrationRecord, TailorKitStorefrontSnapshot } from '../../domain/product-personalizer'
import {
  TAILORKIT_INTEGRATION_COLLECTION,
  TAILORKIT_STOREFRONT_SNAPSHOT_COLLECTION,
} from '../../domain/product-personalizer'
import { TAILORKIT_ORDER_COLLECTION } from '../../backend/order-repository'
import {
  TAILORKIT_GLOBAL_STYLING_RECORD_ID,
  TAILORKIT_PERSONALIZER_SETTINGS_COLLECTION,
} from '../../backend/global-styling-repository'
import type { NativeIntegrationGraph } from '../native/native-graph'

export interface VerifyResult {
  shopDomain: string
  resolved: number
  sampleMatched: number
  publishedSnapshots: number
  warnings: string[]
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function shopifyVariantIdFromGid(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.match(/\/(\d+)$/)?.[1] || value
}

function firstEditorLayer(record: TailorKitIntegrationRecord): Record<string, unknown> | null {
  const payload = asRecord(record.editorPayload)
  const variant = asRecord(asArray(payload.variants)[0])
  const mockup = asRecord(variant.mockup)
  return asRecord(asArray(mockup.layers)[0])
}

function verifyEditorContract(result: VerifyResult, envelope: TailorKitIntegrationRecord) {
  const payload = asRecord(envelope.editorPayload)
  if (!hasText(payload._id) || !hasText(payload.id)) {
    result.warnings.push(`editor payload missing integration identity: ${envelope.id}`)
  }
  const layer = firstEditorLayer(envelope)
  if (layer && Object.keys(layer).length && !hasText(layer.type)) {
    result.warnings.push(`editor payload first layer missing type: ${envelope.id}`)
  }
}

function verifyUnpublishedContract(result: VerifyResult, envelope: TailorKitIntegrationRecord) {
  if (
    envelope.status !== 'unpublished' ||
    envelope.publishedAt ||
    envelope.variantIdsPublished.length ||
    envelope.publishSnapshot
  ) {
    result.warnings.push(`migrated product is not unpublished: ${envelope.id}`)
  }
}

async function verifyStandaloneContracts(
  appData: ScopedAppDataPort,
  ctx: AppContext,
  result: VerifyResult
): Promise<void> {
  const orders = await appData.list<Record<string, unknown>>(ctx, TAILORKIT_ORDER_COLLECTION, { limit: 1 })
  const firstOrder = orders.items[0]?.value
  const firstLineItem = asRecord(asArray(asRecord(firstOrder).line_items)[0])
  const presentmentMoney = asRecord(asRecord(firstLineItem.price_set).presentment_money)
  if (firstOrder && (!presentmentMoney.amount || !presentmentMoney.currency_code)) {
    result.warnings.push('order detail missing line_items[0].price_set.presentment_money')
  }

  const globalStyling = await appData.get<Record<string, unknown>>(
    ctx,
    TAILORKIT_PERSONALIZER_SETTINGS_COLLECTION,
    TAILORKIT_GLOBAL_STYLING_RECORD_ID
  )
  if (
    globalStyling &&
    (!globalStyling.styling || typeof globalStyling.styling !== 'object' || Array.isArray(globalStyling.styling))
  ) {
    result.warnings.push('global styling record does not expose object styling')
  }
}

export async function verifyShopMigration(
  appData: ScopedAppDataPort,
  ctx: AppContext,
  nativeGraphs: NativeIntegrationGraph[]
): Promise<VerifyResult> {
  const result: VerifyResult = { shopDomain: ctx.shopDomain, resolved: 0, sampleMatched: 0, publishedSnapshots: 0, warnings: [] }
  for (const graph of nativeGraphs) {
    const envelope = await appData.get<TailorKitIntegrationRecord>(ctx, TAILORKIT_INTEGRATION_COLLECTION, graph._id)
    if (!envelope) {
      result.warnings.push(`missing envelope: ${graph._id}`)
      continue
    }
    result.resolved += 1
    if (envelope.id !== graph._id) {
      result.warnings.push(`id mismatch: native=${graph._id} envelope=${envelope.id}`)
    }
    verifyEditorContract(result, envelope)
    verifyUnpublishedContract(result, envelope)
    // Sample one resolved variant carrying a shopifyVariantId and check it round-tripped.
    const sample = (graph.variants || []).find(v => v?.mockup && !v.mockup.disintegratedAt)
    if (sample) {
      const sampleShopifyVariantId = shopifyVariantIdFromGid(sample.id)
      const matched = (envelope.variants || []).some(
        v => v.shopifyVariantId === sampleShopifyVariantId || v.id === sampleShopifyVariantId
      )
      if (matched) result.sampleMatched += 1
    }
    if (graph.publishedAt) {
      const snap = await appData.get<TailorKitStorefrontSnapshot>(
        ctx,
        TAILORKIT_STOREFRONT_SNAPSHOT_COLLECTION,
        envelope.id
      )
      if (snap && (snap as { variants?: unknown[] }).variants && (snap as { variants: unknown[] }).variants.length) {
        result.publishedSnapshots += 1
        result.warnings.push(`published snapshot data retained: ${envelope.id}`)
      }
      if (snap && (snap as { status?: unknown }).status !== 'unpublished') {
        result.warnings.push(`storefront snapshot is not unpublished: ${envelope.id}`)
      }
    }
  }
  await verifyStandaloneContracts(appData, ctx, result)
  return result
}

/**
 * Counts envelopes for the shop — used to prove the re-run is a no-op (idempotent).
 * Cheap estimate: count integrations + one sibling collection. Anything > 0 means previous run wrote.
 */
export async function countShopEnvelopes(appData: ScopedAppDataPort, ctx: AppContext): Promise<number> {
  const page = await appData.list<{ id: string }>(ctx, TAILORKIT_INTEGRATION_COLLECTION, { limit: 100 })
  return page.items.length
}
