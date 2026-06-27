// Populated native TailorKit graph types (read side of the migration).
// These mirror the `.populate()` tree from upstream Integration.server.ts:getDetailIntegration,
// loosened to plain records because the migration reads with fresh schemas (not upstream models).

export interface NativeTemplate {
  _id: string
  name?: string
  title?: string
  previewUrl?: string
  dimension?: unknown
  layers?: unknown
  type?: string
  updatedAt?: string
  [key: string]: unknown
}

export interface NativeLayerIntegration {
  _id: string
  layerId?: string
  type?: string
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  name?: string
  // data.templateId is populated into the full Template object by the join.
  data?: { templateId?: NativeTemplate | string | null; src?: string; alt?: string; [key: string]: unknown }
  [key: string]: unknown
}

export interface NativeMockupView {
  _id: string
  title?: string
  mockup?: string
  baseImage?: unknown
  backgroundImage?: unknown
  maskImage?: unknown
  enableClippingMask?: boolean
  overrides?: Record<string, unknown>
  // layers populated to LayerIntegration objects.
  layers?: NativeLayerIntegration[]
  [key: string]: unknown
}

export interface NativeMockup {
  _id: string
  label?: string
  baseImage?: unknown
  backgroundImage?: unknown
  enableClippingMask?: boolean
  /** Soft-delete marker; disintegrated mockups are skipped when building the composite. */
  disintegratedAt?: string | null
  // layers + views populated to objects.
  layers?: NativeLayerIntegration[]
  views?: NativeMockupView[]
  [key: string]: unknown
}

export interface NativePrintArea {
  _id: string
  name?: string
  label?: string
  width?: number
  height?: number
  // template populated to the full Template object.
  template?: NativeTemplate | string | null
  [key: string]: unknown
}

export interface NativeVariantIntegration {
  _id: string
  /** Shopify variant GID (`gid://shopify/ProductVariant/<n>`). */
  id: string
  productId?: string
  title?: string
  price?: string
  compareAtPrice?: string
  metafields?: unknown
  // mockup + printAreas populated to objects.
  mockup?: NativeMockup | null
  printAreas?: NativePrintArea[]
  [key: string]: unknown
}

export interface NativeIntegrationGraph {
  _id: string
  shopDomain: string
  title?: string
  notes?: string
  selectedTab?: number
  publishedAt?: string | null
  unpublishedAt?: string | null
  variantIdsPublished?: string[]
  /** Integration.variants[] holds Shopify GID strings; populated to VariantIntegration objects. */
  variants?: NativeVariantIntegration[]
  /**
   * The RAW Shopify variant GID list before populate dropped unmatched refs. Set by readIntegrationGraph
   * so the inverter can count orphans (refs with no resolvable VariantIntegration). Length ≥ variants.length.
   */
  variantRefs?: string[]
  [key: string]: unknown
}

export interface NativeOptionSet {
  _id: string
  type?: string
  label?: string
  labelOnStoreFront?: string
  values?: unknown
  data?: unknown
  editingMode?: unknown
  additionalPricingEnabled?: boolean
  originalBaseState?: unknown
  originalClipGroup?: unknown
  shopDomain?: string
  createdAt?: string
  updatedAt?: string
  [key: string]: unknown
}

export interface NativeUserJourney {
  _id: string
  shopDomain?: string
  [key: string]: unknown
}

export interface NativePersonalizerSettings {
  _id?: string
  shopDomain?: string
  [key: string]: unknown
}

export interface NativeGlobalStyling {
  _id?: string
  shopDomain?: string
  styling?: Record<string, unknown>
  updatedAt?: string
  [key: string]: unknown
}

export interface NativeOrder {
  _id: string
  /** Shopify numeric order id (top-level `id`, Number) — the app-data record key. */
  id?: number | string
  shopDomain?: string
  line_items?: unknown
  [key: string]: unknown
}

export interface NativeShop {
  _id?: string
  shopDomain?: string
  uninstalledAt?: string | null
  [key: string]: unknown
}
