/**
 * Minimal charm product reference stored in metafield.
 * Contains ONLY stable Shopify IDs that never change.
 * All display data (title, price, thumbnail) is fetched at runtime.
 */
export interface StorefrontCharmProduct {
  _id: string
  /** Shopify product GID (e.g. "gid://shopify/Product/12345") */
  productId: string
  /** Numeric variant ID for /cart/add.js (e.g. "67890") */
  variantId: string
  /** Number of default placements from admin (derived from transforms count) */
  defaultQuantity?: number
}

/** Compact charm slot node as serialized in metafield */
export interface StorefrontCharmNode {
  _id: string
  x: number
  y: number
  slotLimit: number
  label: string
  defaultCharmId?: string
}

/** Full charm config from metafield */
export interface StorefrontCharmConfig {
  layerId: string
  displayStyle: 'FIXED' | 'FREE'
  label?: string
  maxCharms?: number
  allowMultiple: boolean
  nodes?: StorefrontCharmNode[]
  products: StorefrontCharmProduct[]
}

/**
 * Full charm product data enriched at runtime from the Storefront API.
 * Extends the minimal metafield reference with live display data.
 */
export interface CharmProductFullData extends StorefrontCharmProduct {
  title: string
  /** Price amount string in customer's market currency */
  price: string
  currencyCode: string
  thumbnailUrl: string
  availableForSale: boolean
  /** Compare-at price if product is on sale */
  compareAtPrice?: string
  /** Authoritative numeric variant ID from Storefront API */
  liveVariantId?: string
  /** Inventory quantity available (null = not tracked, allow unlimited) */
  quantityAvailable?: number | null
}

/** Charm selection entry for event dispatch */
export interface CharmSelection {
  productId: string
  variantId: string
  title: string
  price: string
  currencyCode: string
  quantity: number
  /** Thumbnail URL for canvas rendering (from Storefront API) */
  thumbnailUrl: string
}

/** Event detail shape dispatched on tailorkit-charm-change */
export interface CharmChangeDetail {
  layerId: string
  printAreaId: string
  selections: CharmSelection[]
  /** Total charm cost in merchant currency */
  totalCost: number
  /** Total charm count across all selections */
  totalCount: number
}

/** Diagnostic info returned alongside fetch result so UI/support can pinpoint failure cause */
export type CharmFetchFailureReason =
  | 'no-products-configured'
  /** Direct Storefront fetch skipped because no access token was found in the DOM */
  | 'storefront-token-missing'
  /** Direct Storefront fetch returned a non-OK HTTP status */
  | 'storefront-api-http-error'
  /** Proxy fallback returned a non-OK HTTP status */
  | 'proxy-http-error'
  /** Both direct and proxy fetches failed — final user-facing error state */
  | 'all-fetches-failed'
  | 'empty-response'
  | 'partial-match'
  | 'network-error'

export interface CharmFetchDiagnostic {
  reason: CharmFetchFailureReason
  /** Human-readable description for merchant/support */
  message: string
  /** Optional context (HTTP status, counts, etc.) for DevTools console */
  context?: Record<string, unknown>
}

export interface CharmFetchResult {
  products: Map<string, CharmProductFullData>
  diagnostic: CharmFetchDiagnostic | null
}
