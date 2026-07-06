// Read-time enrichment for the Orders detail screen (bug #5-C). The copied `OrderDetailCard` reads
// `item.product.title` / `item.product.variants` for the thumbnail + title, and calls
// `getOptionPropertiesForPrintArea({ integration, properties, variantId })` (from the copied
// `api.public.print-image-generation/fns.ts`) to group the raw `properties[]` by print area. Capture
// never attached either field, so both render blank ("x 1" with no title, empty Properties). This is
// pure mapping (no ports) — the backend loader (`order-line-item-enrichment-loader.ts`) fetches the
// Shopify product snapshot + TailorKit integration record and calls these functions.
import type { TailorKitOrderLineItem } from './order-record'

/**
 * Minimal `product` shape `OrderDetailCard` reads: `product.title`, `(variant?.image ||
 * product?.featuredImage)?.url`, and `product.variants.find(v => v.id.indexOf(variant_id) > -1)`.
 * `variant.id` MUST stay the Shopify variant GID string — the legacy code matches by substring.
 */
export interface TailorKitOrderLineItemProductSnapshot {
  title: string
  featuredImage?: { url?: string }
  variants: Array<{ id: string; image?: { url?: string } }>
}

/**
 * `getOptionPropertiesForPrintArea` only reads `integration.variants` (an array it `.flat()`s and
 * searches with `variant.id.indexOf(variantId) > -1`), so this is the entire shape a line item needs.
 * The variant objects inside must match the upstream `VariantIntegration` shape (`printAreas[].template.
 * layers[]`) — supplied verbatim by the integration record's populated `editorPayload.variants`.
 */
export interface TailorKitOrderLineItemIntegrationSnapshot {
  variants: unknown[]
}

function toId(value: unknown): string {
  return value === undefined || value === null ? '' : String(value)
}

export function createLineItemProductSnapshot(product: {
  title: string
  featuredImage?: { url?: string }
  variants?: Array<{ id: string; imageUrl?: string }>
}): TailorKitOrderLineItemProductSnapshot {
  return {
    title: product.title,
    featuredImage: product.featuredImage?.url ? { url: product.featuredImage.url } : undefined,
    variants: (product.variants || []).map(variant => ({
      id: variant.id,
      image: variant.imageUrl ? { url: variant.imageUrl } : undefined,
    })),
  }
}

export function enrichTailorKitOrderLineItems(
  lineItems: TailorKitOrderLineItem[],
  productByProductId: Map<string, TailorKitOrderLineItemProductSnapshot>,
  integrationByVariantId: Map<string, TailorKitOrderLineItemIntegrationSnapshot>
): TailorKitOrderLineItem[] {
  return lineItems.map(item => {
    const product = productByProductId.get(toId(item.product_id))
    const integration = integrationByVariantId.get(toId(item.variant_id))
    if (!product && !integration) return item
    return {
      ...item,
      ...(product ? { product } : {}),
      ...(integration ? { integration } : {}),
    }
  })
}
