/**
 * Data normalization functions for mapping PrintWay SDK types to shared fulfillment types.
 */
import type {
  NormalizedProduct,
  NormalizedProductDetails,
  NormalizedVariant,
  NormalizedOrder,
  NormalizedOrderStatus,
  NormalizedPlaceholder,
  NormalizedLineItem,
} from '~/services/fulfillment/types'
import {
  ProviderError,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderNotFoundError,
  ProviderOrderError,
  ProviderValidationError,
} from '~/services/fulfillment/errors.server'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import type { Product, Variant, Location, Order, OrderItemResponse } from '@sellersmith/printway-sdk'

/** SDK Order type extended with order_status (present in API response but missing from SDK type) */
type OrderWithStatus = Order & { order_status?: string }

const PROVIDER = EPROVIDER.PRINTWAY

/** Maps a PrintWay product to the normalized product format. */
export function mapPrintWayProduct(product: Product): NormalizedProduct {
  return {
    externalId: product._id || product.code,
    title: product.product_name,
    description: '',
    images: product.mockup_url ? [product.mockup_url] : [],
    variants: (product.variants || []).map(mapPrintWayVariant),
    baseCost: extractBaseCost(product.variants),
    metadata: {
      code: product.code,
      templateMockupUrl: product.template_mockup_url,
    },
  }
}

/** Maps a PrintWay product to detailed format including print area placeholders. */
export function mapPrintWayProductDetails(product: Product): NormalizedProductDetails {
  const base = mapPrintWayProduct(product)
  const placeholders = extractPlaceholders(product.variants)
  return { ...base, placeholders }
}

/** Maps a PrintWay variant to the normalized variant format. */
export function mapPrintWayVariant(variant: Variant): NormalizedVariant {
  const options: Record<string, string> = {}
  for (const attr of variant.attributes || []) {
    options[attr.name] = attr.value
  }

  // Use first available location's cost and print areas as default
  const firstLocation = variant.locations?.[0]
  const placeholders = extractVariantPlaceholders(firstLocation)

  return {
    externalId: variant.variant_id,
    title: variant.variant_title,
    sku: variant.item_sku,
    cost: firstLocation?.base_cost || 0,
    options,
    inStock: variant.availability === 'in_stock',
    placeholders,
    metadata: {
      locations: (variant.locations || []).map(loc => ({
        name: loc.name,
        code: loc.code,
        madeInLocation: loc.made_in_location,
        productLocations: loc.product_location,
        baseCost: loc.base_cost,
        tierCost: loc.tier_cost,
      })),
      itemSku: variant.item_sku,
    },
  }
}

/** Maps a PrintWay order to the normalized order format. */
export function mapPrintWayOrder(order: OrderWithStatus): NormalizedOrder {
  const lineItems: NormalizedLineItem[] = (order.order_items || []).map((item: OrderItemResponse) => ({
    variantExternalId: item.item_sku,
    quantity: 1,
    printFiles: {
      ...(item.artwork_front ? { artwork_front: item.artwork_front } : {}),
      ...(item.artwork_back ? { artwork_back: item.artwork_back } : {}),
    },
    personalization: {},
  }))

  const firstTracking = (order.trackings || [])[0]

  return {
    externalId: order.pw_order_id || '',
    status: mapPrintWayStatusToNormalized(order.order_status || ''),
    trackingNumber: firstTracking?.tracking_number,
    trackingUrl: firstTracking?.tracking_url,
    lineItems,
    metadata: {
      orderName: order.order_name,
      rawStatus: order.order_status,
    },
  }
}

/** Maps a PrintWay order status string to the normalized status enum. */
export function mapPrintWayStatusToNormalized(status: string): NormalizedOrderStatus {
  switch (status?.toLowerCase()) {
    case 'pending':
    case 'processing':
      return 'pending'
    case 'in_production':
    case 'producing':
      return 'in-production'
    case 'shipped':
    case 'delivered':
      return 'shipped'
    case 'cancelled':
    case 'canceled':
      return 'canceled'
    case 'on_hold':
    case 'hold':
      return 'on-hold'
    case 'failed':
    case 'error':
      return 'failed'
    default:
      return 'pending'
  }
}

/** Wraps a PrintWay SDK error into the appropriate ProviderError subtype. */
export function mapPrintWayErrorToProviderError(error: unknown): ProviderError {
  const message = error instanceof Error ? error.message : String(error)
  const errObj = error as Record<string, unknown>
  const status = (errObj?.status ?? errObj?.statusCode) as number | undefined

  if (status === 401 || status === 403) return new ProviderAuthError(PROVIDER, message)
  if (status === 404) return new ProviderNotFoundError(PROVIDER, message)
  if (status === 429) return new ProviderRateLimitError(PROVIDER)
  if (status === 422 || status === 400) return new ProviderValidationError(PROVIDER, message)
  if (status && status >= 500) return new ProviderOrderError(PROVIDER, message, true)
  return new ProviderError(message, PROVIDER, false)
}

// -- Internal helpers --

function extractBaseCost(variants?: Variant[]): number {
  if (!variants?.length) return 0
  return variants[0]?.locations?.[0]?.base_cost || 0
}

/** Collects unique print areas across all variants/locations. */
function extractPlaceholders(variants?: Variant[]): NormalizedPlaceholder[] {
  const seen = new Map<string, NormalizedPlaceholder>()
  for (const variant of variants || []) {
    for (const location of variant.locations || []) {
      for (const pa of location.print_areas || []) {
        if (!seen.has(pa.area)) {
          seen.set(pa.area, {
            position: pa.area.toLowerCase(),
            width: pa.width,
            height: pa.height,
          })
        }
      }
    }
  }
  return Array.from(seen.values())
}

/** Extracts print area placeholders from a single variant location. */
function extractVariantPlaceholders(location?: Location): NormalizedPlaceholder[] {
  if (!location?.print_areas) return []
  return location.print_areas.map(pa => ({
    position: pa.area.toLowerCase(),
    width: pa.width,
    height: pa.height,
  }))
}
