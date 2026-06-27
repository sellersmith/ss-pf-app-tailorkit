/**
 * Shared fulfillment provider types for the multi-provider adapter architecture.
 * All providers implement IFulfillmentProvider and normalize to these types.
 *
 * @see app/services/fulfillment/registry.server.ts - Provider lookup
 * @see app/services/fulfillment/adapters/ - Provider implementations
 */

// ---------------------------------------------------------------------------
// Capability Flags
// ---------------------------------------------------------------------------

/** Boolean flags for provider-specific features. Check these instead of provider name. */
export interface ProviderCapabilities {
  /** Provider has a browsable blueprint/template catalog (Printify) */
  hasBlueprintCatalog: boolean
  /** Provider supports selecting a print provider for a blueprint (Printify) */
  hasPrintProviderSelection: boolean
  /** Provider supports engraving line mapping (ShineOn) */
  hasEngravingMapping: boolean
  /** Provider supports variant selection (all) */
  hasVariantSelection: boolean
  /** Provider supports order tracking (all) */
  hasOrderTracking: boolean
  /** Provider sends webhook status updates */
  hasWebhookSupport: boolean
  /** Provider supports render preview images (ShineOn) */
  hasRenderPreview: boolean
  /** Provider supports shipping rate calculation (Printify) */
  hasShippingCalculation: boolean
  /** Provider supports multiple artwork positions per item (PrintWay: front, back, hood, sleeves, etc.) */
  hasMultipleArtworkPositions: boolean
  /** Provider routes orders to nearest factory based on location (PrintWay) */
  hasLocationBasedRouting: boolean
}

// ---------------------------------------------------------------------------
// Normalized Product Types
// ---------------------------------------------------------------------------

export interface NormalizedProduct {
  externalId: string
  title: string
  description: string
  images: string[]
  variants: NormalizedVariant[]
  baseCost: number
  /** Provider-specific data that doesn't fit the shared shape */
  metadata: Record<string, unknown>
}

export interface NormalizedProductDetails extends NormalizedProduct {
  /** Print areas / placeholder zones for artwork */
  placeholders?: NormalizedPlaceholder[]
  /** Print providers available for this product (Printify) */
  printProviders?: NormalizedPrintProvider[]
  /** Engraving config (ShineOn) */
  engravingConfig?: EngravingConfig
}

export interface NormalizedVariant {
  externalId: string
  title: string
  sku: string
  cost: number
  options: Record<string, string>
  inStock: boolean
  placeholders?: NormalizedPlaceholder[]
  metadata: Record<string, unknown>
}

export interface NormalizedPlaceholder {
  position: string
  width: number
  height: number
  images?: NormalizedPlaceholderImage[]
}

export interface NormalizedPlaceholderImage {
  position: string
  src: string
  isDefault: boolean
}

// ---------------------------------------------------------------------------
// Normalized Order Types
// ---------------------------------------------------------------------------

export type NormalizedOrderStatus =
  | 'pending'
  | 'in-production'
  | 'shipped'
  | 'delivered'
  | 'canceled'
  | 'on-hold'
  | 'failed'

export interface NormalizedOrder {
  externalId: string
  status: NormalizedOrderStatus
  trackingNumber?: string
  trackingUrl?: string
  lineItems: NormalizedLineItem[]
  metadata: Record<string, unknown>
}

export interface NormalizedLineItem {
  variantExternalId: string
  quantity: number
  printFiles: Record<string, string>
  personalization?: Record<string, string>
}

// ---------------------------------------------------------------------------
// Provider-Specific (Capability-Guarded) Types
// ---------------------------------------------------------------------------

/** Printify blueprint (capability: hasBlueprintCatalog) */
export interface NormalizedBlueprint {
  id: number
  title: string
  description: string
  brand: string
  model: string
  images: string[]
}

/** Printify print provider (capability: hasPrintProviderSelection) */
export interface NormalizedPrintProvider {
  id: number
  title: string
  location?: { country: string; region: string }
}

/** ShineOn engraving config (capability: hasEngravingMapping) */
export interface EngravingConfig {
  engravingSiblingId: string
  maxLines: number
  maxCharsPerLine: number
  supportedFonts?: string[]
}

/** Render preview params (capability: hasRenderPreview) */
export interface RenderParams {
  productId: string
  printFileUrl: string
  options?: Record<string, string>
}

/** Shipping rate calculation (capability: hasShippingCalculation) */
export interface ShippingCalcParams {
  lineItems: Array<{ variantExternalId: string; quantity: number }>
  addressTo: ShippingAddress
}

export interface ShippingRate {
  type: string
  cost: number
  currency: string
}

export interface ShippingAddress {
  firstName: string
  lastName: string
  email?: string
  phone?: string
  country: string
  region?: string
  address1: string
  address2?: string
  city: string
  zip: string
}

// ---------------------------------------------------------------------------
// Fulfillment Data Pipeline Types
// ---------------------------------------------------------------------------

/** Input args for adapter.prepareVariantMetafield() — called at product import time. */
export interface PrepareVariantMetafieldArgs {
  /** Provider product ID (e.g., blueprint ID for Printify, template ID for ShineOn) */
  productId: string
  /** Provider-specific sub-provider ID (e.g., print provider ID for Printify, empty for ShineOn) */
  productProviderId: string
  /** The variant being imported */
  variant: {
    id: string
    title: string
    options: Record<string, string>
    placeholders?: Array<{ position: string; width: number; height: number }>
    [key: string]: unknown
  }
}

/** Input args for adapter.prepareFulfillmentData() — called at webhook order import time. */
export interface PrepareFulfillmentDataArgs {
  /** Parsed variant metafield value (provider-specific shape, e.g. { product_id, variant_id } for Printify, { sku, shineOnMapping } for ShineOn) */
  variantMeta: Record<string, unknown>
  /** Rendered artwork images keyed by print area position */
  printImages: Array<{
    printAreaName: string
    image: { src: string; width?: number; height?: number } | null
  }>
  /** Customer personalization from Shopify line item properties (flat key-value) */
  customerProperties: Record<string, string>
}

/** Input args for adapter.transformForSubmission() — called at order submission time. */
export interface TransformForSubmissionArgs {
  /** The fulfillment_order_data stored on the Order line item (output of prepareFulfillmentData) */
  fulfillmentData: Record<string, unknown>
  /** Line item quantity */
  quantity: number
}

// ---------------------------------------------------------------------------
// Method Params
// ---------------------------------------------------------------------------

export interface ListProductsParams {
  page?: number
  limit?: number
}

export interface SubmitOrderArgs {
  apiToken: string
  externalId: string
  lineItems: NormalizedLineItem[]
  shippingAddress: ShippingAddress
}

/** Minimal shape for the Shopify fulfillment order passed to adapters */
export interface FulfillmentOrderRef {
  orderId: string
  id: string
  [key: string]: unknown
}

/** Minimal shape for the provider integration record passed to adapters */
export interface FulfillmentProviderRef {
  apiToken?: string
  shopId?: string
  [key: string]: unknown
}

export interface FulfillOrderArgs {
  fulfillmentOrder: FulfillmentOrderRef
  shopDomain: string
  fulfillmentProvider: FulfillmentProviderRef
}

// ---------------------------------------------------------------------------
// Main Provider Interface
// ---------------------------------------------------------------------------

/**
 * Unified fulfillment provider interface.
 * All providers implement core methods; capability-guarded methods are optional.
 *
 * Usage:
 * ```ts
 * const adapter = getProvider(EPROVIDER.SHINEON)
 * if (adapter.capabilities.hasEngravingMapping) {
 *   const config = await adapter.getEngravingConfig!(productId, token)
 * }
 * ```
 */
export interface IFulfillmentProvider {
  readonly name: string
  readonly capabilities: ProviderCapabilities

  // -- Connection --
  validateConnection(apiToken: string): Promise<{ valid: boolean; error?: string }>

  // -- Catalog --
  listProducts(apiToken: string, params?: ListProductsParams): Promise<NormalizedProduct[]>
  getProductDetails(productId: string, apiToken: string): Promise<NormalizedProductDetails>

  // -- Orders --
  submitOrder(args: SubmitOrderArgs): Promise<{ externalOrderId: string }>
  getOrder(externalOrderId: string, apiToken: string): Promise<NormalizedOrder>
  cancelOrder(externalOrderId: string, apiToken: string): Promise<boolean>

  // -- Fulfillment dispatch --
  fulfillOrder(args: FulfillOrderArgs): Promise<void>

  // -- Fulfillment data pipeline (optional — adapters implement for generic webhook/submission dispatch) --

  /**
   * Prepare the variant metafield value written to Shopify at product import time.
   * Output is stored as JSON in namespace `tailorkit_variant_metafield` on each Shopify variant.
   * Read back at webhook order import time and passed to prepareFulfillmentData().
   */
  prepareVariantMetafield?(args: PrepareVariantMetafieldArgs): Record<string, unknown>

  /**
   * Prepare fulfillment order data from variant metafield + rendered artwork + customer properties.
   * Called at webhook order import time. Output is stored as `fulfillment_order_data` on Order line item.
   */
  prepareFulfillmentData?(args: PrepareFulfillmentDataArgs): Record<string, unknown>

  /**
   * Transform stored fulfillment_order_data into provider-specific submission payload.
   * Called at order submission time. Resolves any mappings (e.g., ShineOn engravings).
   */
  transformForSubmission?(args: TransformForSubmissionArgs): Record<string, unknown>

  // -- Capability-guarded optional methods --
  listBlueprints?(apiToken: string): Promise<NormalizedBlueprint[]>
  listPrintProviders?(blueprintId: string, apiToken: string): Promise<NormalizedPrintProvider[]>
  getEngravingConfig?(productId: string, apiToken: string): Promise<EngravingConfig>
  requestRender?(params: RenderParams, apiToken: string): Promise<{ renderUrl: string }>
  calculateShipping?(params: ShippingCalcParams, apiToken: string): Promise<ShippingRate[]>
}
