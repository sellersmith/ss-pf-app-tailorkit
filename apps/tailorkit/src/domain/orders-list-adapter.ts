// Parses the copied Orders ListTable query grammar into repository options, and projects a captured order
// record into the row shape the copied `RowMarkupDesktop`/`RowMarkupMobile` read. Co-located in domain to
// keep the backend api file thin — mirrors `product-personalizer-list-adapter.ts`.
//
// ListTable query grammar (from upstream `withDataSource.tsx`):
//   limit=<n>&page=<n>&sort=<field>__<dir>&filter__name=string__has__<v>
//   &filter__financial_status=<csv>&filter__total_price=amount__range__<min>~<max>
// Detail screen sends: filter__id=string__eq__<id> (single-record fast path).
import type { TailorKitOrderRecord } from './order-record'
import type { TailorKitOrderListOptions } from '../backend/order-repository'

export interface TailorKitOrdersListQueryInput {
  [key: string]: unknown
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Strips an optional `string__has__` / `string__eq__` operator prefix and decodes the value. */
function parseStringFilter(value: unknown, operator: 'has' | 'eq'): string {
  const raw = text(value)
  const prefix = `string__${operator}__`
  if (!raw) return ''
  return raw.startsWith(prefix) ? decodeURIComponent(raw.slice(prefix.length)).trim() : decodeURIComponent(raw).trim()
}

function parseCsv(value: unknown): string[] {
  return text(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function parseAmountRange(value: unknown): [number, number] | undefined {
  const raw = text(value)
  const prefix = 'amount__range__'
  const body = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw
  const [minRaw, maxRaw] = body.split('~')
  const min = Number(minRaw)
  const max = Number(maxRaw)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined
  return [Math.min(min, max), Math.max(min, max)]
}

function positiveInt(value: unknown): number | undefined {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  return Math.max(1, Math.floor(parsed))
}

/** The `filter__id=string__eq__<id>` detail-screen fast path. Returns the id when present, else ''. */
export function parseTailorKitOrderIdFilter(query: TailorKitOrdersListQueryInput): string {
  return parseStringFilter(query.filter__id, 'eq')
}

export function parseTailorKitOrderListOptions(query: TailorKitOrdersListQueryInput): TailorKitOrderListOptions {
  return {
    q: parseStringFilter(query.filter__name, 'has') || undefined,
    financialStatus: parseCsv(query.filter__financial_status),
    totalPriceRange: parseAmountRange(query.filter__total_price),
    sort: text(query.sort) || undefined,
    page: positiveInt(query.page),
    limit: positiveInt(query.limit),
  }
}

/**
 * Row shape the copied Orders ListTable rows read. Captured records already carry these fields verbatim
 * (the webhook projection in `order-record.ts`), so this is near-identity. NO `fulfillment_status` —
 * the pruned screens never read it.
 */
export interface TailorKitOrderListRow {
  id: string
  name?: string
  created_at?: string
  customer?: TailorKitOrderRecord['customer']
  financial_status?: string
  total_price?: string
  currency?: string
  presentment_currency?: string
  line_items: TailorKitOrderRecord['line_items']
  appGeneratedRevenue?: number
  appGeneratedRevenueInShopCurrency?: number
  appGeneratedRevenueInOrderCurrency?: number
}

export function createTailorKitOrderListRow(record: TailorKitOrderRecord): TailorKitOrderListRow {
  return {
    id: record.id,
    name: record.name,
    created_at: record.created_at,
    customer: record.customer,
    financial_status: record.financial_status,
    total_price: record.total_price,
    currency: record.currency,
    presentment_currency: record.presentment_currency,
    line_items: record.line_items,
    appGeneratedRevenue: record.appGeneratedRevenue,
    appGeneratedRevenueInShopCurrency: record.appGeneratedRevenueInShopCurrency,
    appGeneratedRevenueInOrderCurrency: record.appGeneratedRevenueInOrderCurrency,
  }
}
