// Ports orchestration for bug #5-C (order line item enrichment). Runs ONLY on the Orders detail
// fast path (single order, `orders-list-api.ts`'s `filter__id` branch) — never on the paginated list —
// since it fans out to Shopify + scans the variant-integrations collection.
//
// Read-time (not capture-time): reusing the already-captured `product_id`/`variant_id` off each stored
// line item and re-fetching the product + integration on every detail view means existing orders (captured
// before this fix) render correctly too, not just future ones. The tradeoff is a live Shopify + app-data
// read per detail view instead of a persisted snapshot; acceptable for a single-order page.
import type { AppBackendPorts, AppContext, ShopifyResourceOption } from '../../../../web/server/src/app-platform/contracts'
import {
  createLineItemProductSnapshot,
  enrichTailorKitOrderLineItems,
  type TailorKitOrderLineItemIntegrationSnapshot,
  type TailorKitOrderLineItemProductSnapshot,
} from '../domain/order-line-item-enrichment'
import type { TailorKitOrderLineItem } from '../domain/order-record'
import {
  TAILORKIT_INTEGRATION_COLLECTION,
  TAILORKIT_VARIANT_INTEGRATION_COLLECTION,
  type TailorKitIntegrationRecord,
  type TailorKitVariantSnapshot,
} from '../domain/product-personalizer'
import { tailorkitAppDataCollections } from '../domain/migration-boundary'

const VARIANT_SCAN_PAGES = 20
const VARIANT_SCAN_PAGE_SIZE = 100

function numericIdFromGid(gid: string): string {
  const match = gid.match(/(\d+)$/)
  return match ? match[1] : gid
}

function toId(value: unknown): string {
  return value === undefined || value === null ? '' : String(value)
}

async function ensureCollection(ports: AppBackendPorts, ctx: AppContext, collection: string): Promise<void> {
  const definition = tailorkitAppDataCollections.find(item => item.collection === collection)
  if (!definition) throw new Error(`TailorKit app-data collection "${collection}" is not declared`)
  await ports.appData.registerCollection(ctx, definition)
}

async function loadProductSnapshotsByProductId(
  ports: AppBackendPorts,
  ctx: AppContext,
  productIds: string[]
): Promise<Map<string, TailorKitOrderLineItemProductSnapshot>> {
  const snapshots = new Map<string, TailorKitOrderLineItemProductSnapshot>()
  if (!productIds.length) return snapshots

  const products: ShopifyResourceOption[] = await ports.shopifyResources.productsByIds(ctx, { ids: productIds })
  products.forEach(product => snapshots.set(numericIdFromGid(product.id), createLineItemProductSnapshot(product)))
  return snapshots
}

/** Scans variant-integrations (cheap per-variant snapshots) for the requested `shopifyVariantId`s and
 * returns the owning integration record id for each match found. Bounded scan mirrors the repository's
 * own list()/listProductsByTemplate() pattern — there is no indexed field lookup on the app-data port. */
async function findIntegrationIdsByShopifyVariantId(
  ports: AppBackendPorts,
  ctx: AppContext,
  shopifyVariantIds: Set<string>
): Promise<Map<string, string>> {
  const integrationIdByVariantId = new Map<string, string>()
  if (!shopifyVariantIds.size) return integrationIdByVariantId

  await ensureCollection(ports, ctx, TAILORKIT_VARIANT_INTEGRATION_COLLECTION)
  let cursor: string | undefined
  for (let scanned = 0; scanned < VARIANT_SCAN_PAGES && integrationIdByVariantId.size < shopifyVariantIds.size; scanned += 1) {
    const page = await ports.appData.list<TailorKitVariantSnapshot & { integrationId?: string }>(
      ctx,
      TAILORKIT_VARIANT_INTEGRATION_COLLECTION,
      { cursor, limit: VARIANT_SCAN_PAGE_SIZE }
    )
    page.items.forEach(({ value }) => {
      if (!value.shopifyVariantId || !value.integrationId) return
      if (shopifyVariantIds.has(value.shopifyVariantId)) integrationIdByVariantId.set(value.shopifyVariantId, value.integrationId)
    })
    cursor = page.nextCursor
    if (!cursor) break
  }
  return integrationIdByVariantId
}

function editorPayloadVariants(record: TailorKitIntegrationRecord): unknown[] {
  const variants = (record.editorPayload as { variants?: unknown } | undefined)?.variants
  return Array.isArray(variants) ? variants : []
}

async function loadIntegrationSnapshotsByVariantId(
  ports: AppBackendPorts,
  ctx: AppContext,
  shopifyVariantIds: Set<string>
): Promise<Map<string, TailorKitOrderLineItemIntegrationSnapshot>> {
  const snapshotByVariantId = new Map<string, TailorKitOrderLineItemIntegrationSnapshot>()
  if (!shopifyVariantIds.size) return snapshotByVariantId

  const integrationIdByVariantId = await findIntegrationIdsByShopifyVariantId(ports, ctx, shopifyVariantIds)
  if (!integrationIdByVariantId.size) return snapshotByVariantId

  await ensureCollection(ports, ctx, TAILORKIT_INTEGRATION_COLLECTION)
  const recordById = new Map<string, TailorKitIntegrationRecord | null>()
  for (const integrationId of new Set(integrationIdByVariantId.values())) {
    recordById.set(integrationId, await ports.appData.get<TailorKitIntegrationRecord>(ctx, TAILORKIT_INTEGRATION_COLLECTION, integrationId))
  }

  integrationIdByVariantId.forEach((integrationId, shopifyVariantId) => {
    const record = recordById.get(integrationId)
    if (record) snapshotByVariantId.set(shopifyVariantId, { variants: editorPayloadVariants(record) })
  })
  return snapshotByVariantId
}

/**
 * A single unresolvable id (deleted product, legacy record with no `shopifyVariantId`) is expected and
 * handled by construction — the loader below just won't have that key in its map. A THROW (Shopify API
 * error, rate limit, revoked token, app-data failure) is different: it must not take down the whole
 * detail page, so the order still renders with the pre-fix blank title/properties instead of an error
 * screen. Mirrors the same contain-and-log pattern as `storefront-prepare-bridge.ts`.
 */
async function safely<T>(label: string, loader: () => Promise<Map<string, T>>): Promise<Map<string, T>> {
  try {
    return await loader()
  } catch (error) {
    console.error(`[tailorkit] order line item ${label} enrichment failed`, error)
    return new Map<string, T>()
  }
}

/**
 * Attaches a Shopify `product` snapshot and the TailorKit `integration` template to every line item on
 * an order so the copied `OrderDetailCard` can render the product title/image and group personalization
 * properties. Best-effort throughout: a line item whose product/integration can't be resolved, or a
 * failed fetch, is left as-is — `OrderDetailCard` renders it exactly as it did before this fix.
 */
export async function loadEnrichedTailorKitOrderLineItems(
  ports: AppBackendPorts,
  ctx: AppContext,
  lineItems: TailorKitOrderLineItem[]
): Promise<TailorKitOrderLineItem[]> {
  if (!lineItems.length) return lineItems

  const productIds = [...new Set(lineItems.map(item => toId(item.product_id)).filter(Boolean))]
  const variantIds = new Set(lineItems.map(item => toId(item.variant_id)).filter(Boolean))

  const [productByProductId, integrationByVariantId] = await Promise.all([
    safely('product', () => loadProductSnapshotsByProductId(ports, ctx, productIds)),
    safely('integration', () => loadIntegrationSnapshotsByVariantId(ports, ctx, variantIds)),
  ])

  return enrichTailorKitOrderLineItems(lineItems, productByProductId, integrationByVariantId)
}
