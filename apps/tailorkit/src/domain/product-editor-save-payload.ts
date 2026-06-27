import type {
  TailorKitCreateIntegrationInput,
  TailorKitIntegrationRecord,
  TailorKitUpdateIntegrationInput,
  TailorKitVariantSnapshot,
} from './product-personalizer'
import { createTailorKitSavePayloadSlices } from './product-editor-save-payload-mappers'
import { populateTailorKitEditorPayload } from './product-editor-populate'
import { asArray, asRecord, idOf, shopifyVariantIdOf, text, type JsonRecord } from './product-editor-save-payload-utils'

export interface TailorKitProductEditorSavePayload {
  notInEditor?: boolean
  integration?: JsonRecord
  printAreas?: JsonRecord[]
  variants?: JsonRecord[]
  mockups?: JsonRecord[]
  layers?: JsonRecord[]
  mockupViews?: JsonRecord[]
}

export interface TailorKitProductEditorSaveRequest {
  tailorkitSavePayload: TailorKitProductEditorSavePayload
}

const tabByIndex = ['design', 'mockup', 'preview'] as const

function selectedTab(value: unknown) {
  return typeof value === 'number' ? tabByIndex[value] : undefined
}

function notesFromPayload(payload: TailorKitProductEditorSavePayload) {
  return typeof payload.integration?.notes === 'string' ? payload.integration.notes : undefined
}

function productTitleFromVariant(variant: JsonRecord, payload: TailorKitProductEditorSavePayload) {
  const product = asRecord(variant.product)
  return text(variant.productTitle) || text(product.title) || text(payload.integration?.title)
}

function imageUrlFromVariant(variant: JsonRecord) {
  const image = asRecord(variant.image)
  const product = asRecord(variant.product)
  const featuredImage = asRecord(product.featuredImage)
  return text(variant.imageUrl) || text(image.src) || text(image.url) || text(featuredImage.url)
}

export function isTailorKitProductEditorSaveRequest(input: unknown): input is TailorKitProductEditorSaveRequest {
  return Boolean(asRecord(input).tailorkitSavePayload)
}

/**
 * Minimal generic validation before persisting the editor blob: it must be an object carrying a
 * `variants` array. No deep per-model shape coupling — keeps the blob mechanism generic across models.
 */
export function isValidTailorKitSavePayload(payload: TailorKitProductEditorSavePayload): boolean {
  return Boolean(payload) && typeof payload === 'object' && Array.isArray(payload.variants)
}

/** Builds the initial integration record input when TailorKit saves a brand-new ProductEditor session. */
export function createTailorKitCreateInputFromSavePayload(
  payload: TailorKitProductEditorSavePayload,
  id: string
): TailorKitCreateIntegrationInput {
  const variants = asArray(payload.variants)
    .map<TailorKitVariantSnapshot | null>(variant => {
      const product = asRecord(variant.product)
      const id = idOf(variant._id) || idOf(variant.id)
      const productId = text(variant.productId) || idOf(product._id) || idOf(product.id)
      if (!id || !productId) return null
      return {
        id,
        shopifyVariantId: shopifyVariantIdOf(variant),
        productId,
        title: text(variant.title) || text(variant.displayName) || 'Default Title',
        productTitle: productTitleFromVariant(variant, payload) || 'Untitled product',
        productHandle: text(variant.productHandle) || text(product.handle),
        imageUrl: imageUrlFromVariant(variant),
        price: text(variant.price),
        compareAtPrice: text(variant.compareAtPrice),
      }
    })
    .filter((variant): variant is TailorKitVariantSnapshot => Boolean(variant))

  return {
    id,
    title: text(payload.integration?.title),
    variants,
  }
}

/** Converts TailorKit ProductEditor save payload into PageFly app-platform update input. */
export function createTailorKitUpdateInputFromSavePayload(
  payload: TailorKitProductEditorSavePayload,
  current: TailorKitIntegrationRecord
): TailorKitUpdateIntegrationInput {
  const slices = createTailorKitSavePayloadSlices(payload, current)
  return {
    title: text(payload.integration?.title),
    editorPayload: populateTailorKitEditorPayload(payload),
    variants: slices.variants.length ? slices.variants : undefined,
    mockups: Array.isArray(payload.mockups) ? slices.mockups : undefined,
    templates: Array.isArray(payload.printAreas) || Array.isArray(payload.layers) ? slices.templates : undefined,
    draft: {
      notes: notesFromPayload(payload),
      editorState: {
        activeTab: selectedTab(payload.integration?.selectedTab),
        selectedVariantIds: slices.variants.length
          ? slices.variants.map(variant => variant.id)
          : current.variants.map(variant => variant.id),
        templateIds: slices.templates.map(template => template.id),
        templateSnapshots: slices.templates,
        printAreas: slices.printAreas,
        layerIntegrations: slices.layerIntegrations,
        mockupViews: slices.mockupViews,
        mockupId: idOf(asArray(payload.mockups)[0]?._id) || current.mockups[0]?.id,
      },
    },
  }
}
