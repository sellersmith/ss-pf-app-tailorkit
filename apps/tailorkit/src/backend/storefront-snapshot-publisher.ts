// TailorKit storefront Liquid reads variant-level app metafields from `em_tailorkit/<variantId>`.
import type { AppBackendPorts, AppContext, AppDataMetafieldInput } from '../../../../web/server/src/app-platform/contracts'
import type { TailorKitIntegrationRecord, TailorKitVariantSnapshot } from '../domain/product-personalizer'

import { prepareTailorKitStorefrontVariantData } from './storefront-prepare-bridge'
import { TAILORKIT_STOREFRONT_METAFIELD_NAMESPACE } from './storefront-metafield-keys'

export { TAILORKIT_STOREFRONT_METAFIELD_NAMESPACE }

function toNumericShopifyId(id: string): string {
  const value = String(id || '').trim()
  const match = value.match(/\/(\d+)$/)
  return match ? match[1] : value
}

/**
 * Storefront Liquid keys variant metafields by the Shopify numeric variant id
 * (`app.metafields.em_tailorkit[<numeric>]`). The record's canonical `variant.id` is the TailorKit
 * internal identity (a UUID for editor-created variants), so prefer the captured `shopifyVariantId`.
 * Falls back to `id` for legacy records whose variants predate the `shopifyVariantId` field.
 */
function toStorefrontVariantKey(variant: TailorKitVariantSnapshot): string {
  return toNumericShopifyId(variant.shopifyVariantId || variant.id)
}

function createFallbackPreparedVariantData(record: TailorKitIntegrationRecord) {
  const storefront = record.publishSnapshot?.storefront
  if (!storefront) return {}

  const printAreas = (storefront.printAreas || []).map(printArea => ({
    i: printArea.id,
    templateId: printArea.templateId,
  }))
  const templateLayers = (storefront.printAreas || [])
    .filter(printArea => printArea.templateId)
    .map(printArea => ({
      t: 'template',
      templateId: printArea.templateId,
      data: { printAreaId: printArea.id },
    }))
  const mockupId = storefront.mockups[0]?.id || record.mockups[0]?.id || record.id

  return Object.fromEntries(
    record.variants.map(variant => {
      const key = toStorefrontVariantKey(variant)
      return [
        key,
        {
          [key]: {
            mockup: {
              _id: mockupId,
              printAreas,
              lis: templateLayers.map(layer => ({ ...layer, v: key })),
            },
          },
        },
      ]
    })
  )
}

export function createTailorKitStorefrontMetafields(
  record: TailorKitIntegrationRecord,
  reason: string,
  staleVariantIds: string[] = []
): AppDataMetafieldInput[] {
  // Published variant values come from the ported upstream transform fed the editor blob, so the
  // metafield matches the original app (full option-sets/conditional-logic/scaled coords). The
  // transform keys by Shopify numeric variant id — the same key the storefront Liquid reads.
  const published = record.status === 'published' && record.publishSnapshot?.storefront
  const preparedByKey = published ? prepareTailorKitStorefrontVariantData(record) : {}
  const fallbackByKey = published ? createFallbackPreparedVariantData(record) : {}

  const activeVariantKeys = new Set(record.variants.map(toStorefrontVariantKey))
  const activeMetafields = record.variants.map<AppDataMetafieldInput>(variant => {
    const key = toStorefrontVariantKey(variant)
    return {
      namespace: TAILORKIT_STOREFRONT_METAFIELD_NAMESPACE,
      key,
      type: 'json',
      owner: 'app-installation',
      value: preparedByKey[key] ?? fallbackByKey[key] ?? [],
      reason,
    }
  })

  const staleMetafields = staleVariantIds
    .map(toNumericShopifyId)
    .filter(key => key && !activeVariantKeys.has(key))
    .map<AppDataMetafieldInput>(key => ({
      namespace: TAILORKIT_STOREFRONT_METAFIELD_NAMESPACE,
      key,
      type: 'json',
      owner: 'app-installation',
      value: [],
      reason,
    }))

  return [...activeMetafields, ...staleMetafields]
}

export async function publishTailorKitStorefrontMetafields(
  ports: AppBackendPorts,
  ctx: AppContext,
  record: TailorKitIntegrationRecord,
  reason: string,
  staleVariantIds: string[] = []
) {
  const metafields = createTailorKitStorefrontMetafields(record, reason, staleVariantIds)
  if (!metafields.length) return []
  return ports.appMetafields.setMany(ctx, metafields)
}
