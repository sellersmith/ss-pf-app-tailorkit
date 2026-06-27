// TailorKit order capture record. Copy-faithful projection of the upstream Order schema
// (`apps/tailorkit/upstream/.../models/Order.server.ts`) reduced to the capture + revenue scope:
// identity, currency, the personalized line items (with their properties + print images), and the
// app-generated revenue figures. Fulfillment-provider and billing-aggregate fields are intentionally
// dropped (billing permanently OUT per Q3; fulfillment OUT). The verbatim webhook payload is retained
// under `raw` as a forward-compat safety net so no future reader is blocked by this projection.
//
// Types are co-located here in `.ts` to match the sibling `product-personalizer.ts` convention.

/** Print image ref attached to a personalized line item (copy of upstream PrintImageSchema). */
export interface TailorKitOrderPrintImage {
  printAreaId?: string
  printAreaName?: string
  image?: {
    originalSrc?: string
    width?: number
    height?: number
  }
  /** SVG version of the print image (optional, for vector output). */
  svg?: {
    originalSrc?: string
  }
}

/** A single line-item property (Shopify cart property: name + value). */
export interface TailorKitOrderLineItemProperty {
  name: string
  value: string
}

/**
 * Personalized line item projection — the fields revenue + capture read.
 *
 * The capture persist path (`order-capture-shim.toStoredOrder`) spreads the VERBATIM Shopify
 * `orders/create` line item, so a stored line item also carries the rich Shopify fields below
 * (`price_set`, `current_quantity`, `product`, `integration`, ...). The copied Orders detail screen
 * (`OrderDetailCard`) reads those, so they are declared optional here to keep the type honest about
 * what is actually stored — even though the basic fields above are all the revenue/capture math needs.
 */
export interface TailorKitOrderLineItem {
  [key: string]: unknown
  id?: number
  admin_graphql_api_id?: string
  title?: string
  name?: string
  sku?: string
  price?: string
  quantity?: number
  current_quantity?: number
  product_id?: number
  variant_id?: number
  variant_title?: string
  vendor?: string
  properties?: TailorKitOrderLineItemProperty[]
  print_images?: TailorKitOrderPrintImage[]
  /** Verbatim Shopify presentment/shop money set — present on stored (captured) line items. */
  price_set?: unknown
  /** Verbatim Shopify product snapshot the detail screen reads (title, variants, featuredImage). */
  product?: unknown
  /** TailorKit integration snapshot attached at capture time. */
  integration?: unknown
}

/** Embedded customer snapshot (no separate Customer collection in app-platform). */
export interface TailorKitOrderCustomerSnapshot {
  id?: number
  email?: string
  first_name?: string
  last_name?: string
}

/** Captured TailorKit order record stored in the `orders` app-data collection. */
export interface TailorKitOrderRecord {
  [key: string]: unknown
  /** Shopify numeric order id — the app-data record id (capture upsert key). */
  id: string
  admin_graphql_api_id?: string
  name?: string
  currency?: string
  presentment_currency?: string
  financial_status?: string
  created_at?: string
  processed_at?: string
  total_price?: string
  shopDomain: string
  customer?: TailorKitOrderCustomerSnapshot
  line_items: TailorKitOrderLineItem[]
  /** True when ≥1 line item carries a TailorKit (or OneTick) property — set by capture, not the mapper. */
  isTailorKitOrder?: boolean
  appGeneratedRevenue?: number
  appGeneratedRevenueInOrderCurrency?: number
  appGeneratedRevenueInShopCurrency?: number
  /** Verbatim webhook payload — forward-compat safety net (V3). */
  raw?: unknown
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function mapPrintImage(value: unknown): TailorKitOrderPrintImage | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as Record<string, unknown>
  const image = (entry.image && typeof entry.image === 'object' ? entry.image : {}) as Record<string, unknown>
  const svg = (entry.svg && typeof entry.svg === 'object' ? entry.svg : {}) as Record<string, unknown>
  return {
    printAreaId: asString(entry.printAreaId),
    printAreaName: asString(entry.printAreaName),
    image: { originalSrc: asString(image.originalSrc), width: asNumber(image.width), height: asNumber(image.height) },
    svg: { originalSrc: asString(svg.originalSrc) },
  }
}

function mapProperty(value: unknown): TailorKitOrderLineItemProperty | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as Record<string, unknown>
  const name = typeof entry.name === 'string' ? entry.name : ''
  const propValue = typeof entry.value === 'string' ? entry.value : String(entry.value ?? '')
  return name ? { name, value: propValue } : null
}

function mapPriceSet(entry: Record<string, unknown>, currencyCode: string | undefined): unknown {
  const priceSet = asRecord(entry.price_set)
  const presentmentMoney = asRecord(priceSet.presentment_money)
  const amount = asString(presentmentMoney.amount) || asString(entry.price)
  const currency_code = asString(presentmentMoney.currency_code) || currencyCode

  return {
    ...priceSet,
    presentment_money: {
      ...presentmentMoney,
      ...(amount ? { amount } : {}),
      ...(currency_code ? { currency_code } : {}),
    },
  }
}

function mapLineItem(value: unknown, currencyCode: string | undefined): TailorKitOrderLineItem {
  const entry = asRecord(value)
  const properties = Array.isArray(entry.properties)
    ? entry.properties.map(mapProperty).filter((p): p is TailorKitOrderLineItemProperty => p !== null)
    : []
  const printImages = Array.isArray(entry.print_images)
    ? entry.print_images.map(mapPrintImage).filter((p): p is TailorKitOrderPrintImage => p !== null)
    : []
  return {
    ...entry,
    properties,
    print_images: printImages,
    current_quantity: asNumber(entry.current_quantity) ?? asNumber(entry.quantity),
    price_set: mapPriceSet(entry, currencyCode),
  }
}

function mapCustomer(value: unknown): TailorKitOrderCustomerSnapshot | undefined {
  if (!value || typeof value !== 'object') return undefined
  const entry = value as Record<string, unknown>
  return {
    id: asNumber(entry.id),
    email: asString(entry.email),
    first_name: asString(entry.first_name),
    last_name: asString(entry.last_name),
  }
}

/**
 * Maps a raw `orders/create` webhook payload into the promoted projection. Revenue + `isTailorKitOrder`
 * are NOT set here — capture (phase-03) computes them. The verbatim payload is retained under `raw`.
 */
export function createTailorKitOrderRecord(shopDomain: string, payload: unknown): TailorKitOrderRecord {
  const order = asRecord(payload)
  const currencyCode = asString(order.presentment_currency) || asString(order.currency)
  const lineItems = Array.isArray(order.line_items) ? order.line_items.map(item => mapLineItem(item, currencyCode)) : []
  return {
    ...order,
    id: String(order.id ?? ''),
    shopDomain,
    customer: mapCustomer(order.customer),
    line_items: lineItems,
    raw: payload,
  }
}
