/**
 * Data normalization functions for mapping ShineOn SDK types to shared fulfillment types.
 */
import type {
  NormalizedProduct,
  NormalizedProductDetails,
  NormalizedVariant,
  NormalizedOrder,
  NormalizedOrderStatus,
  NormalizedLineItem,
  NormalizedPlaceholder,
  EngravingConfig,
} from '~/services/fulfillment/types'
import type { ProductTemplate, Sku, Order, OrderStatus } from '@sellersmith/shineon-sdk'
import {
  ProviderError,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderNotFoundError,
  ProviderOrderError,
  ProviderValidationError,
} from '~/services/fulfillment/errors.server'
import { classifyShineOnError } from '~/services/shineon/error-classifier.server'
import { EPROVIDER } from '~/constants/fulfillment-providers'

const PROVIDER = EPROVIDER.SHINEON

/** Maps a ShineOn product template to the normalized product format. */
export function mapShineOnProduct(template: ProductTemplate): NormalizedProduct {
  return {
    externalId: String(template.id),
    title: buildTitle(template),
    description: buildDescription(template),
    images: extractImages(template),
    variants: [],
    baseCost: Number(template.base_cost) || 0,
    metadata: {
      parentId: template.parent_id,
      parentLabel: template.parent_label,
      productTemplate: template.product_template,
      metalType: template.metafields?.metal,
      productType: template.metafields?.type,
      hasEngravings: !!template.engraving_sibling_id,
      buyerUploads: !!template.buyer_uploads,
    },
  }
}

/** Maps a ShineOn product template with optional SKUs to normalized product details. */
export function mapShineOnProductDetails(template: ProductTemplate, skus?: Sku[]): NormalizedProductDetails {
  const base = mapShineOnProduct(template)
  const variants = skus ? skus.map(mapShineOnVariant) : []
  const placeholders: NormalizedPlaceholder[] = [
    {
      position: 'front',
      width: template.optimized_width,
      height: template.optimized_height,
    },
  ]
  const engravingConfig: EngravingConfig | undefined = template.engraving_sibling_id
    ? { engravingSiblingId: String(template.engraving_sibling_id), maxLines: deriveMaxLines(skus), maxCharsPerLine: 20 }
    : undefined

  return { ...base, variants, placeholders, engravingConfig }
}

/** Maps a ShineOn SKU to the normalized variant format. */
export function mapShineOnVariant(sku: Sku): NormalizedVariant {
  const options: Record<string, string> = {}
  if (sku.properties.metal) options.metal = sku.properties.metal
  if (sku.properties.shape) options.shape = sku.properties.shape
  if (sku.properties.size_option) options.size = String(sku.properties.size_option)
  return {
    externalId: sku.sku,
    title: sku.title,
    sku: sku.sku,
    cost: Number(sku.base_cost) || 0,
    options,
    inStock: true,
    placeholders: sku.artwork
      ? [{ position: 'front', width: sku.artwork.optimized_width, height: sku.artwork.optimized_height }]
      : [],
    metadata: {
      productId: String(sku.product_id),
      buyerUploads: sku.properties.buyer_uploads,
      engravings: sku.properties.engravings,
      maskSrcUrl: sku.artwork?.mask_src_url,
    },
  }
}

/** Maps a ShineOn order to the normalized order format. */
export function mapShineOnOrder(order: Order): NormalizedOrder {
  const lineItems: NormalizedLineItem[] = order.line_items.map(item => ({
    variantExternalId: item.sku,
    quantity: item.quantity,
    printFiles: {},
    personalization: Object.fromEntries(
      Object.entries(item.properties || {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    ),
  }))
  // Tracking info is on line items in SDK
  const trackedItem = order.line_items.find(item => item.tracking_number)
  return {
    externalId: String(order.id),
    status: mapShineOnStatusToNormalized(order.status),
    trackingNumber: trackedItem?.tracking_number,
    trackingUrl: undefined,
    lineItems,
    metadata: {
      externalOrderId: order.source_id,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      carrier: trackedItem?.tracking_company,
    },
  }
}

/** Maps a ShineOn order status to the normalized status enum. */
export function mapShineOnStatusToNormalized(status: OrderStatus): NormalizedOrderStatus {
  switch (status) {
    case 'on_hold':
    case 'awaiting_payment':
      return 'pending'
    case 'in_production':
      return 'in-production'
    case 'shipped':
      return 'shipped'
    case 'cancelled':
      return 'canceled'
    default:
      return 'pending'
  }
}

/** Wraps a ShineOn error into the appropriate ProviderError subtype. */
export function mapShineOnErrorToProviderError(error: unknown): ProviderError {
  const classified = classifyShineOnError(error)
  switch (classified.category) {
    case 'auth':
      return new ProviderAuthError(PROVIDER, classified.message)
    case 'not_found':
      return new ProviderNotFoundError(PROVIDER, classified.message)
    case 'rate_limit':
      return new ProviderRateLimitError(PROVIDER)
    case 'validation':
    case 'duplicate':
      return new ProviderValidationError(PROVIDER, classified.message)
    case 'server_error':
    case 'network':
    case 'timeout':
      return new ProviderOrderError(PROVIDER, classified.message, true)
    default:
      return new ProviderError(classified.message, PROVIDER, classified.retryable)
  }
}

// -- Internal helpers --

function buildTitle(template: ProductTemplate): string {
  if (template.parent_label) return template.parent_label
  if (template.title) return template.title
  const meta = template.metafields || {}
  const parts: string[] = []
  if (meta.type && meta.type !== 'other') parts.push(capitalize(meta.type))
  if (meta.metal && meta.metal !== 'other') parts.push(`- ${capitalize(meta.metal)}`)
  return parts.length > 0 ? parts.join(' ') : `ShineOn Product ${template.product_template}`
}

function buildDescription(template: ProductTemplate): string {
  const meta = template.metafields || {}
  const parts: string[] = []
  if (meta.type) parts.push(`Product type: ${meta.type}`)
  if (meta.metal) parts.push(`Metal: ${meta.metal}`)
  if (template.buyer_uploads) parts.push('Supports custom artwork upload')
  if (template.engraving_sibling_id) parts.push('Supports engraving')
  return parts.join('. ')
}

function extractImages(template: ProductTemplate): string[] {
  const defaultTransform = template.transformations?.find(t => t.default === true)
  const layers = defaultTransform?.layers
  if (layers?.main) return [layers.main]
  if (template.artwork_mask_src) return [template.artwork_mask_src]
  return []
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function deriveMaxLines(skus?: Sku[]): number {
  if (!skus || skus.length === 0) return 4
  let max = 0
  for (const sku of skus) {
    const engravings = Number(sku.properties.engravings) || 0
    if (engravings > max) max = engravings
  }
  return max || 4
}
