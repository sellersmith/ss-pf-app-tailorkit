import {
  createEditorStateSnapshot,
  createStorefrontSnapshot,
  type TailorKitMockupViewSnapshot,
} from './product-editor-state'
import type {
  TailorKitCreateIntegrationInput,
  TailorKitIntegrationRecord,
  TailorKitUpdateIntegrationInput,
  TailorKitVariantSnapshot,
} from './product-personalizer'

const idPrefix = 'tk'
export const TAILORKIT_DEFAULT_MOCKUP_VIEW_TITLE = 'Default view'

export function createTailorKitId(seed?: string): string {
  if (seed?.trim()) return seed.trim()
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`
  return `${idPrefix}_${random.replace(/[^a-zA-Z0-9_-]/g, '')}`
}

export function normalizeTailorKitVariant(input: Partial<TailorKitVariantSnapshot>): TailorKitVariantSnapshot {
  const id = String(input.id || '').trim()
  const productId = String(input.productId || '').trim()

  if (!id || !productId) {
    throw new Error('Product Personalizer variants require variant id and product id')
  }

  return {
    id,
    shopifyVariantId: input.shopifyVariantId?.trim() || undefined,
    productId,
    title: String(input.title || 'Default Title').trim() || 'Default Title',
    productTitle: String(input.productTitle || 'Untitled product').trim() || 'Untitled product',
    productHandle: input.productHandle,
    imageUrl: input.imageUrl,
    price: input.price,
    compareAtPrice: input.compareAtPrice,
  }
}

/** TailorKit ProductEditor expects every mockup to have at least one view before layers are added. */
export function createDefaultTailorKitMockupView(
  mockupId: string,
  layerIds: string[] = []
): TailorKitMockupViewSnapshot {
  return {
    id: createTailorKitId(),
    mockupId,
    title: TAILORKIT_DEFAULT_MOCKUP_VIEW_TITLE,
    layerIds,
    enableClippingMask: false,
    overrides: {},
  }
}

export function createTailorKitIntegration(input: TailorKitCreateIntegrationInput): TailorKitIntegrationRecord {
  const variants = input.variants.map(normalizeTailorKitVariant)
  if (!variants.length) throw new Error('Select at least one product variant')

  const now = new Date().toISOString()
  const title = input.title?.trim() || variants[0]?.productTitle || 'Untitled personalized product'
  const mockupId = createTailorKitId()
  const defaultView = createDefaultTailorKitMockupView(mockupId)

  return {
    id: createTailorKitId(input.id),
    title,
    status: 'unpublished',
    variants,
    templates: [],
    mockups: [{ id: mockupId, label: title, variantIds: variants.map(variant => variant.id), printAreaIds: [] }],
    draft: {
      editorState: {
        mockupId,
        selectedVariantIds: variants.map(variant => variant.id),
        templateIds: [],
        printAreas: [],
        templateSnapshots: [],
        layerIntegrations: [],
        mockupViews: [defaultView],
      },
    },
    variantIdsPublished: [],
    publishedAt: null,
    unpublishedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

export function updateTailorKitIntegration(
  current: TailorKitIntegrationRecord,
  input: TailorKitUpdateIntegrationInput
): TailorKitIntegrationRecord {
  const variants = input.variants ? input.variants.map(normalizeTailorKitVariant) : current.variants
  const editorState = input.draft?.editorState
    ? createEditorStateSnapshot(current, input.draft.editorState)
    : current.draft.editorState
  const templates = input.templates || editorState?.templateSnapshots || current.templates
  const mockups = input.mockups || current.mockups
  const updatedAt = new Date().toISOString()
  const hasUnpublishedChanges = current.publishedAt
    ? new Date(updatedAt).getTime() >= new Date(current.publishedAt).getTime()
    : false

  return {
    ...current,
    title: input.title?.trim() || current.title,
    variants,
    templates,
    mockups,
    editorPayload: input.editorPayload ?? current.editorPayload,
    draft: { ...current.draft, ...input.draft, editorState },
    status: current.publishedAt && hasUnpublishedChanges ? 'outdated' : current.status,
    updatedAt,
  }
}

export function publishTailorKitIntegration(current: TailorKitIntegrationRecord): TailorKitIntegrationRecord {
  const now = new Date().toISOString()
  const editorState = createEditorStateSnapshot(current, current.draft.editorState)
  const variantIds = current.variants.map(variant => variant.id)
  const templateIds = editorState.templateIds
  const mockupIds = current.mockups.map(mockup => mockup.id)
  const printAreaIds = editorState.printAreas.map(printArea => printArea.id)
  const storefront = createStorefrontSnapshot(
    { ...current, status: 'published', draft: { ...current.draft, editorState } },
    now
  )

  return {
    ...current,
    status: 'published',
    publishedAt: now,
    unpublishedAt: null,
    variantIdsPublished: variantIds,
    draft: { ...current.draft, editorState },
    publishSnapshot: { publishedAt: now, variantIds, templateIds, mockupIds, printAreaIds, storefront },
    updatedAt: now,
  }
}

export function unpublishTailorKitIntegration(current: TailorKitIntegrationRecord): TailorKitIntegrationRecord {
  const now = new Date().toISOString()
  return {
    ...current,
    status: 'unpublished',
    publishedAt: null,
    unpublishedAt: now,
    variantIdsPublished: [],
    publishSnapshot: undefined,
    updatedAt: now,
  }
}

export function deleteTailorKitIntegration(current: TailorKitIntegrationRecord): TailorKitIntegrationRecord {
  const now = new Date().toISOString()
  return {
    ...current,
    status: 'unpublished',
    publishedAt: null,
    unpublishedAt: now,
    variantIdsPublished: [],
    publishSnapshot: undefined,
    deletedAt: now,
    updatedAt: now,
  }
}
