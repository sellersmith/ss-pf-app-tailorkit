import type {
  TailorKitEditorState,
  TailorKitLayerIntegrationSnapshot,
  TailorKitMockupViewSnapshot,
  TailorKitPrintAreaSnapshot,
  TailorKitStorefrontSnapshot,
} from './product-editor-state'

export type TailorKitIntegrationStatus = 'published' | 'unpublished' | 'outdated'

export interface TailorKitVariantSnapshot {
  id: string
  /**
   * Shopify variant GID (`gid://shopify/ProductVariant/<numeric>`). The canonical `id` above is the
   * TailorKit internal identity (a UUID for editor-created variants) and is NOT the Shopify variant id.
   * Storefront Liquid reads `app.metafields.em_tailorkit[<shopify-numeric-variant-id>]`, so the snapshot
   * publisher MUST key the metafield by this field, not `id`. Optional only for legacy records.
   */
  shopifyVariantId?: string
  title: string
  productId: string
  productTitle: string
  productHandle?: string
  imageUrl?: string
  price?: string
  compareAtPrice?: string
}

export interface TailorKitTemplateSnapshot {
  id: string
  name: string
  updatedAt?: string
  mockupId?: string
  printAreaId?: string
  previewUrl?: string
  layerCount?: number
  category?: string
}

export interface TailorKitMockupSnapshot {
  id: string
  label: string
  variantIds: string[]
  printAreaIds?: string[]
}

export interface TailorKitEditorDraft {
  notes?: string
  editorState?: TailorKitEditorState
  payload?: Record<string, unknown>
}

export interface TailorKitPublishSnapshot {
  publishedAt: string
  variantIds: string[]
  templateIds: string[]
  mockupIds: string[]
  printAreaIds: string[]
  storefront: TailorKitStorefrontSnapshot
}

export interface TailorKitIntegrationRecord {
  id: string
  title: string
  status: TailorKitIntegrationStatus
  variants: TailorKitVariantSnapshot[]
  templates: TailorKitTemplateSnapshot[]
  mockups: TailorKitMockupSnapshot[]
  draft: TailorKitEditorDraft
  /**
   * Verbatim populated editor blob — the SOURCE OF TRUTH the ProductEditor reads back on reopen.
   * Built at save time by joining the normalized POST into the populated shape
   * (`populateTailorKitEditorPayload`). Optional only for records created before this field existed.
   */
  editorPayload?: Record<string, unknown>
  variantIdsPublished: string[]
  publishSnapshot?: TailorKitPublishSnapshot
  publishedAt: string | null
  unpublishedAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface TailorKitCreateIntegrationInput {
  id?: string
  title?: string
  variants: TailorKitVariantSnapshot[]
}

export interface TailorKitUpdateIntegrationInput {
  title?: string
  variants?: TailorKitVariantSnapshot[]
  templates?: TailorKitTemplateSnapshot[]
  mockups?: TailorKitMockupSnapshot[]
  draft?: TailorKitEditorDraft
  editorPayload?: Record<string, unknown>
}

export interface TailorKitProductPersonalizerListOptions {
  q?: string
  status?: TailorKitIntegrationStatus
  cursor?: string
  limit?: number
  page?: number
  sort?: string
  productId?: string
}

export const TAILORKIT_INTEGRATION_COLLECTION = 'integrations'
export const TAILORKIT_VARIANT_INTEGRATION_COLLECTION = 'variant-integrations'
export const TAILORKIT_MOCKUP_COLLECTION = 'mockups'
export const TAILORKIT_TEMPLATE_COLLECTION = 'templates'
export const TAILORKIT_OPTION_SET_COLLECTION = 'option-sets'
export const TAILORKIT_LAYER_COLLECTION = 'layers'
export const TAILORKIT_MOCKUP_VIEW_COLLECTION = 'mockup-views'
export const TAILORKIT_STOREFRONT_SNAPSHOT_COLLECTION = 'storefront-snapshots'
export const TAILORKIT_OVERLAY_LOOKUP_COLLECTION = 'overlay-lookups'

export type {
  TailorKitEditorState,
  TailorKitLayerIntegrationSnapshot,
  TailorKitMockupViewSnapshot,
  TailorKitPrintAreaSnapshot,
  TailorKitStorefrontSnapshot,
}
export {
  createDefaultTailorKitMockupView,
  createTailorKitId,
  createTailorKitIntegration,
  deleteTailorKitIntegration,
  normalizeTailorKitVariant,
  publishTailorKitIntegration,
  TAILORKIT_DEFAULT_MOCKUP_VIEW_TITLE,
  unpublishTailorKitIntegration,
  updateTailorKitIntegration,
} from './product-personalizer-record'
