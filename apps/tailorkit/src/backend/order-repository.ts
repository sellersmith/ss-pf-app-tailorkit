// Thin repository for captured TailorKit orders over the scoped app-data port. Mirrors the
// global-styling repository: register the collection (per-port-instance registries start empty in a
// fresh host context, e.g. the webhook-intent host), then read/write the order record keyed by the
// Shopify numeric order id. Shop/app/generation scope is injected by the port via `ctx` — the id is
// the only key. Replaces upstream `Order.findOne` / `Order.updateOne(..., { upsert: true })`.
import type { AppBackendPorts, AppContext } from '../../../../web/server/src/app-platform/contracts'
import { tailorkitAppDataCollections } from '../domain/migration-boundary'
import type { TailorKitOrderRecord } from '../domain/order-record'

export const TAILORKIT_ORDER_COLLECTION = 'orders'

async function ensureOrderCollection(ports: AppBackendPorts, ctx: AppContext): Promise<void> {
  const definition = tailorkitAppDataCollections.find(item => item.collection === TAILORKIT_ORDER_COLLECTION)
  if (!definition) throw new Error('TailorKit orders collection is not declared in migration boundary')
  await ports.appData.registerCollection(ctx, definition)
}

/** Filter + pagination inputs the Orders ListTable sends (parsed from `filter__*` query grammar). */
export interface TailorKitOrderListOptions {
  /** Free-text order-name search (`filter__name=string__has__<v>`). */
  q?: string
  /** Financial-status CSV (`filter__financial_status=paid,refunded`). */
  financialStatus?: string[]
  /** Total-price inclusive range (`filter__total_price=amount__range__<min>~<max>`). */
  totalPriceRange?: [number, number]
  /** Sort token, e.g. `id__desc`, `total_price__asc`, `name__asc`. */
  sort?: string
  /** 1-based page (ListTable page semantics). */
  page?: number
  limit?: number
}

export interface TailorKitOrderListResult {
  items: TailorKitOrderRecord[]
  total: number
}

const ORDER_LIST_SCAN_PAGES = 20
const ORDER_LIST_SCAN_PAGE_SIZE = 100
const ORDER_LIST_DEFAULT_LIMIT = 50

function matchesOrderFilter(record: TailorKitOrderRecord, options: TailorKitOrderListOptions): boolean {
  if (options.q) {
    const name = (record.name || '').toLowerCase()
    if (!name.includes(options.q.toLowerCase())) return false
  }
  if (options.financialStatus?.length) {
    const status = (record.financial_status || '').toLowerCase()
    if (!options.financialStatus.some(candidate => candidate.toLowerCase() === status)) return false
  }
  if (options.totalPriceRange) {
    const [min, max] = options.totalPriceRange
    const total = Number(record.total_price)
    if (!Number.isFinite(total) || total < min || total > max) return false
  }
  return true
}

// `id` is the Shopify numeric order id (captured as a string). Sort numerically so `id desc` orders newest-first.
function compareOrders(sort?: string): (a: TailorKitOrderRecord, b: TailorKitOrderRecord) => number {
  const [field = 'id', direction = 'desc'] = (sort || 'id__desc').split('__')
  const sign = direction === 'asc' ? 1 : -1
  return (a, b) => {
    switch (field) {
      case 'total_price':
        return ((Number(a.total_price) || 0) - (Number(b.total_price) || 0)) * sign
      case 'appGeneratedRevenue':
        return ((a.appGeneratedRevenue || 0) - (b.appGeneratedRevenue || 0)) * sign
      case 'name':
        return (a.name || '').localeCompare(b.name || '') * sign
      case 'id':
      default:
        return ((Number(a.id) || 0) - (Number(b.id) || 0)) * sign
    }
  }
}

export interface TailorKitOrderRepository {
  getById(id: string): Promise<TailorKitOrderRecord | null>
  upsert(record: TailorKitOrderRecord): Promise<TailorKitOrderRecord>
  list(options?: TailorKitOrderListOptions): Promise<TailorKitOrderListResult>
}

export function createTailorKitOrderRepository(ports: AppBackendPorts, ctx: AppContext): TailorKitOrderRepository {
  return {
    async getById(id: string): Promise<TailorKitOrderRecord | null> {
      await ensureOrderCollection(ports, ctx)
      return ports.appData.get<TailorKitOrderRecord>(ctx, TAILORKIT_ORDER_COLLECTION, id)
    },
    async upsert(record: TailorKitOrderRecord): Promise<TailorKitOrderRecord> {
      await ensureOrderCollection(ports, ctx)
      return ports.appData.put<TailorKitOrderRecord>(ctx, TAILORKIT_ORDER_COLLECTION, record.id, record)
    },
    // Mirrors the Product Personalizer repo: the scoped app-data port pages by cursor, the copied ListTable
    // expects page/total. Scan a bounded window, filter + sort in memory, then slice the requested page.
    async list(options = {}): Promise<TailorKitOrderListResult> {
      await ensureOrderCollection(ports, ctx)
      const limit = options.limit && options.limit > 0 ? options.limit : ORDER_LIST_DEFAULT_LIMIT
      const page = options.page && options.page > 0 ? options.page : 1
      const offset = (page - 1) * limit

      const matched: TailorKitOrderRecord[] = []
      let cursor: string | undefined
      for (let scanned = 0; scanned < ORDER_LIST_SCAN_PAGES; scanned += 1) {
        const result = await ports.appData.list<TailorKitOrderRecord>(ctx, TAILORKIT_ORDER_COLLECTION, {
          cursor,
          limit: ORDER_LIST_SCAN_PAGE_SIZE,
        })
        matched.push(...result.items.map(entry => entry.value).filter(record => matchesOrderFilter(record, options)))
        cursor = result.nextCursor
        if (!cursor) break
      }

      const sorted = matched.sort(compareOrders(options.sort))
      return { items: sorted.slice(offset, offset + limit), total: sorted.length }
    },
  }
}
