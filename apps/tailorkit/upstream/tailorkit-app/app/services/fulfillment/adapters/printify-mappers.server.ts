/**
 * Data normalization functions for mapping Printify SDK types to the shared fulfillment types.
 *
 * @see app/services/fulfillment/types.d.ts - Normalized types
 * @see app/modules/Fulfillments/Printify/ - Printify SDK types
 */

import type { Blueprint } from '~/modules/Fulfillments/Printify/catalog/getBlueprints'
import type { GetBlueprintResponse } from '~/modules/Fulfillments/Printify/catalog/getBlueprint'
import type { Variant } from '~/modules/Fulfillments/Printify/catalog/getBlueprintVariants'
import type { PrintProvider } from '~/modules/Fulfillments/Printify/catalog/getBlueprintProviders'
import type { GetOneResponse, OrderStatus } from '~/modules/Fulfillments/Printify/orders/getOne'
import type {
  NormalizedBlueprint,
  NormalizedOrder,
  NormalizedOrderStatus,
  NormalizedPrintProvider,
  NormalizedProduct,
  NormalizedProductDetails,
  NormalizedVariant,
} from '~/services/fulfillment/types'
import { EPROVIDER } from '~/constants/fulfillment-providers'
import {
  ProviderAuthError,
  ProviderError,
  ProviderNotFoundError,
  ProviderOrderError,
  ProviderRateLimitError,
} from '~/services/fulfillment/errors.server'

const PROVIDER = EPROVIDER.PRINTIFY

// ---------------------------------------------------------------------------
// Blueprint / Product Mappers
// ---------------------------------------------------------------------------

export function mapPrintifyBlueprint(blueprint: Blueprint): NormalizedProduct {
  return {
    externalId: String(blueprint.id),
    title: blueprint.title,
    description: blueprint.description,
    images: blueprint.images,
    variants: [],
    baseCost: 0,
    metadata: { brand: blueprint.brand, model: blueprint.model },
  }
}

export function mapPrintifyBlueprintToNormalized(blueprint: Blueprint): NormalizedBlueprint {
  return {
    id: blueprint.id,
    title: blueprint.title,
    description: blueprint.description,
    brand: blueprint.brand,
    model: blueprint.model,
    images: blueprint.images,
  }
}

export function mapPrintifyBlueprintDetails(
  blueprint: GetBlueprintResponse,
  variants?: Variant[],
  providers?: PrintProvider[]
): NormalizedProductDetails {
  return {
    externalId: String(blueprint.id),
    title: blueprint.title,
    description: blueprint.description,
    images: blueprint.images,
    variants: variants?.map(mapPrintifyVariant) ?? [],
    baseCost: 0,
    metadata: { brand: blueprint.brand, model: blueprint.model },
    printProviders: providers?.map(mapPrintifyProvider),
  }
}

// ---------------------------------------------------------------------------
// Variant Mapper
// ---------------------------------------------------------------------------

export function mapPrintifyVariant(variant: Variant): NormalizedVariant {
  return {
    externalId: String(variant.id),
    title: variant.title,
    sku: '',
    cost: 0,
    options: variant.options as Record<string, string>,
    inStock: true,
    placeholders: variant.placeholders.map(p => ({
      position: p.position,
      width: p.width,
      height: p.height,
    })),
    metadata: {},
  }
}

// ---------------------------------------------------------------------------
// Print Provider Mapper
// ---------------------------------------------------------------------------

function mapPrintifyProvider(provider: PrintProvider): NormalizedPrintProvider {
  return {
    id: provider.id,
    title: provider.title,
  }
}

// ---------------------------------------------------------------------------
// Order Mappers
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<OrderStatus, NormalizedOrderStatus> = {
  pending: 'pending',
  'on-hold': 'on-hold',
  'sending-to-production': 'in-production',
  'in-production': 'in-production',
  canceled: 'canceled',
  fulfilled: 'delivered',
  'partially-fulfilled': 'shipped',
  'payment-not-received': 'on-hold',
  'has-issues': 'failed',
}

export function mapPrintifyStatusToNormalized(status: string): NormalizedOrderStatus {
  return STATUS_MAP[status as OrderStatus] ?? 'pending'
}

export function mapPrintifyOrder(order: GetOneResponse): NormalizedOrder {
  const firstShipment = order.shipments?.[0]

  return {
    externalId: order.id,
    status: mapPrintifyStatusToNormalized(order.status),
    trackingNumber: firstShipment?.number,
    trackingUrl: firstShipment?.url,
    lineItems: order.line_items.map(item => ({
      variantExternalId: String(item.variant_id),
      quantity: item.quantity,
      printFiles: {},
      personalization: undefined,
    })),
    metadata: {
      totalPrice: order.total_price,
      totalShipping: order.total_shipping,
      totalTax: order.total_tax,
      createdAt: order.created_at,
      printifyStatus: order.status,
    },
  }
}

// ---------------------------------------------------------------------------
// Error Mapper
// ---------------------------------------------------------------------------

export function mapPrintifyErrorToProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error

  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()

  if (lower.includes('unauthorized') || lower.includes('401') || lower.includes('authentication')) {
    return new ProviderAuthError(PROVIDER, message)
  }
  if (lower.includes('rate limit') || lower.includes('429') || lower.includes('throttl')) {
    return new ProviderRateLimitError(PROVIDER)
  }
  if (lower.includes('not found') || lower.includes('404')) {
    return new ProviderNotFoundError(PROVIDER, message)
  }
  if (lower.includes('order')) {
    return new ProviderOrderError(PROVIDER, message, lower.includes('retry'))
  }

  return new ProviderError(message, PROVIDER, false)
}
