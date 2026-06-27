// Native order → app-platform orders value. THIN wrapper: reuses createTailorKitOrderRecord (the native
// order doc ≈ Shopify orders/create webhook payload). KEYED by String(native.id) (Shopify numeric order
// id) because the order repo get/upsert key on `id`, NOT _id (order-repository.ts:88).
import type { NativeOrder } from '../native/native-graph'
import type { MappedOrderValue, StandaloneRecord } from './standalone-records'
import { createTailorKitOrderRecord } from '../../domain/order-record'

const TAILORKIT_ORDER_COLLECTION = 'orders'

export function mapOrder(shopDomain: string, native: NativeOrder): StandaloneRecord<MappedOrderValue> | null {
  const id = native.id !== undefined && native.id !== null ? String(native.id) : ''
  if (!id) return null
  return {
    collection: TAILORKIT_ORDER_COLLECTION,
    id,
    value: createTailorKitOrderRecord(shopDomain, native),
  }
}

/**
 * Streams a shop's orders in bounded batches so the runner never loads all orders in memory.
 * Drops any order without a usable Shopify id (mapOrder → null). Accepts any AsyncIterable of native
 * order docs so the runner can pass mongoose Cursor OR a test fake.
 */
export async function* mapOrdersBatched(
  shopDomain: string,
  cursor: AsyncIterable<NativeOrder | Record<string, unknown>>,
  batchSize = 200
): AsyncGenerator<StandaloneRecord<MappedOrderValue>[]> {
  let batch: StandaloneRecord<MappedOrderValue>[] = []
  for await (const doc of cursor) {
    const record = mapOrder(shopDomain, doc as NativeOrder)
    if (!record) continue
    batch.push(record)
    if (batch.length >= batchSize) {
      yield batch
      batch = []
    }
  }
  if (batch.length) yield batch
}
