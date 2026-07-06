// TailorKit backend code must access PageFly only through AppBackendPlugin ctx.ports.
import type {
  AppApiRequest,
  AppBackendRegisterContext,
  ShopifyFileUploadInput,
  ShopifyResourceOption,
  ShopifyResourceSetupOptions,
} from '../../../../web/server/src/app-platform/contracts'
import { TAILORKIT_CAPABILITIES } from '../domain/capabilities'
import { tailorkitAppDataCollections } from '../domain/migration-boundary'
import {
  createTailorKitProductEditorLoaderData,
  createTailorKitProductEditorRootLoaderData,
} from '../domain/product-editor-loader-adapter'
import { getTailorKitThemeConfig } from './theme-config-api'
import {
  type TailorKitIntegrationRecord,
  TAILORKIT_INTEGRATION_COLLECTION,
  TAILORKIT_LAYER_COLLECTION,
  TAILORKIT_OVERLAY_LOOKUP_COLLECTION,
  TAILORKIT_OPTION_SET_COLLECTION,
  TAILORKIT_TEMPLATE_COLLECTION,
  TAILORKIT_VARIANT_INTEGRATION_COLLECTION,
  type TailorKitTemplateSnapshot,
  type TailorKitVariantSnapshot,
} from '../domain/product-personalizer'
import {
  createTailorKitPersonalizedProductListItem,
  parseTailorKitListOptions,
} from '../domain/product-personalizer-list-adapter'
import {
  createTailorKitProductPersonalizerRepository,
  type TailorKitUpdateIntegrationRequest,
} from './product-personalizer-repository'
import {
  isTailorKitProductEditorSaveRequest,
  isValidTailorKitSavePayload,
} from '../domain/product-editor-save-payload'
import {
  checkPersonalizedProductTaste,
  TAILORKIT_PERSONALIZED_PRODUCTS_METER,
} from '../domain/personalized-product-taste-guard'
import { compressData } from '../../upstream/tailorkit-app/app/utils/file-types/zip'

function routeId(request: AppApiRequest): string {
  const parts = String(request.params.path || '')
    .split('/')
    .filter(Boolean)
  return decodeURIComponent(parts[1] || '')
}

function queryText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function numberQuery(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function queryList(value: unknown): string[] {
  return typeof value === 'string'
    ? value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    : []
}

function bodyObject<T>(body: unknown): T {
  return (body && typeof body === 'object' ? body : {}) as T
}

function bodyText(body: unknown, key: string): string {
  const record = bodyObject<Record<string, unknown>>(body)
  return typeof record[key] === 'string' ? record[key].trim() : ''
}

function parseUploadFiles(body: unknown): ShopifyFileUploadInput[] {
  const value = bodyObject<Record<string, unknown>>(body).files
  if (!Array.isArray(value)) return []

  return value.flatMap(entry => {
    if (!entry || typeof entry !== 'object') return []
    const file = entry as Record<string, unknown>
    const name = typeof file.name === 'string' ? file.name : ''
    const type = typeof file.type === 'string' ? file.type : ''
    const dataBase64 = typeof file.dataBase64 === 'string' ? file.dataBase64 : ''
    if (!name || !dataBase64) return []
    return [{ name, type, dataBase64 }]
  })
}

function bodyList(body: unknown, key: string): string[] {
  const value = bodyObject<Record<string, unknown>>(body)[key]
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && Boolean(item))
  if (typeof value !== 'string') return []

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string' && Boolean(item))
  } catch {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  }

  return []
}

async function registerTailorKitAppDataCollections(app: AppBackendRegisterContext, request: AppApiRequest) {
  await Promise.all(
    tailorkitAppDataCollections.map(definition => app.ports.appData.registerCollection(request.context, definition))
  )
}

type TailorKitSetupVariantOption = ShopifyResourceSetupOptions['variants'][number]

const TAILORKIT_BULK_ACTIONS = {
  delete: 'deletePersonalizedProducts',
  publish: 'publishPersonalizedProducts',
  unpublish: 'unpublishPersonalizedProducts',
} as const

const TAILORKIT_PRODUCT_MUTATION_ACTIONS = {
  duplicateExistingProduct: 'duplicate_existing_product',
} as const

const TAILORKIT_DEFAULT_PRODUCT_STATUSES = ['ACTIVE', 'DRAFT', 'UNLISTED'] as const
const TAILORKIT_DUPLICATE_PRODUCT_STATUSES = new Set<string>(TAILORKIT_DEFAULT_PRODUCT_STATUSES)
const TAILORKIT_ALL_PRODUCT_VARIANTS_PAGE_SIZE = 15
const TAILORKIT_USER_JOURNEY_COLLECTION = 'user-journeys'

interface TailorKitUserJourneyRecord {
  id: string
  type: string
  data: unknown[]
  currentStep: string | null
  progress: number
  isFinished: boolean
  showOnboarding: boolean
  createdAt: string
  updatedAt: string
}

type TailorKitDuplicateProductBody = {
  action?: string
  productId?: string
  newTitle?: string
  options?: {
    newHandle?: string
    newStatus?: string
    includeImages?: boolean
    includeTranslations?: boolean
    synchronous?: boolean
  }
}

type TailorKitOptionSetRecord = Record<string, unknown> & {
  _id?: string
  id?: string
  deletedAt?: string
  updatedAt?: string
  createdAt?: string
}

type TailorKitTemplateSaveBody = {
  templateData?: Record<string, unknown>
  useAiFeature?: boolean
}

type TailorKitLayerRecord = Record<string, unknown> & {
  deletedAt?: string
  optionSet?: unknown
  optionSets?: unknown
  data?: Record<string, unknown>
}

function normalizeJourneyProgress(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeJourneyData(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function normalizeJourneyCurrentStep(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function journeyTypesFromQuery(value: unknown): string[] {
  return typeof value === 'string'
    ? value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    : []
}

async function readTailorKitUserJourney(
  app: AppBackendRegisterContext,
  request: AppApiRequest,
  type: string
): Promise<TailorKitUserJourneyRecord | null> {
  await registerTailorKitAppDataCollections(app, request)
  return app.ports.appData.get<TailorKitUserJourneyRecord>(
    request.context,
    TAILORKIT_USER_JOURNEY_COLLECTION,
    type
  )
}

async function saveTailorKitUserJourney(app: AppBackendRegisterContext, request: AppApiRequest) {
  const body = bodyObject<Record<string, unknown>>(request.body)
  const type = typeof body.type === 'string' ? body.type.trim() : ''

  if (!type) {
    return {
      status: 400,
      body: { success: false, message: 'Missing TailorKit user journey type' },
    }
  }

  const now = new Date().toISOString()
  const current = await readTailorKitUserJourney(app, request, type)
  const userJourney: TailorKitUserJourneyRecord = {
    id: type,
    type,
    data: normalizeJourneyData(body.data),
    currentStep: normalizeJourneyCurrentStep(body.currentStep),
    progress: normalizeJourneyProgress(body.progress),
    isFinished: body.isFinished === true,
    showOnboarding: false,
    createdAt: current?.createdAt || now,
    updatedAt: now,
  }

  await app.ports.appData.put(request.context, TAILORKIT_USER_JOURNEY_COLLECTION, type, userJourney)

  return { body: { success: true, userJourney } }
}

function bulkDeleteIntegrationId(input: unknown): string {
  const value = Array.isArray(input) ? input[0] : input
  if (!value || typeof value !== 'object') return ''
  const record = value as {
    integrationId?: unknown
    id?: unknown
    _id?: unknown
    denormalizedData?: { integration?: { id?: unknown; _id?: unknown } }
  }
  const id =
    record.denormalizedData?.integration?._id ||
    record.denormalizedData?.integration?.id ||
    record.integrationId ||
    record._id ||
    record.id
  return typeof id === 'string' ? id.trim() : ''
}

function bulkDeleteIntegrationIds(body: unknown): string[] {
  const record = bodyObject<{ mockups?: unknown }>(body)
  const mockups = Array.isArray(record.mockups) ? record.mockups : []
  return [...new Set(mockups.map(bulkDeleteIntegrationId).filter(Boolean))]
}

function toVariantOption(option: TailorKitSetupVariantOption) {
  return {
    id: option.id,
    title: option.title,
    productId: option.parentId || '',
    productTitle: option.parentTitle || '',
    productHandle: option.parentHandle,
    imageUrl: option.imageUrl,
    price: option.price,
    compareAtPrice: option.compareAtPrice,
  }
}

function toTailorKitProduct(product: ShopifyResourceOption, integratedVariantIds: Set<string> = new Set()) {
  const featuredImage = product.featuredImage || (product.imageUrl ? { url: product.imageUrl } : undefined)
  const productSnapshot = {
    id: product.id,
    title: product.title,
    handle: product.handle,
    status: product.status,
    vendor: product.vendor,
    productType: product.productType,
    hasOnlyDefaultVariant: product.hasOnlyDefaultVariant,
    featuredImage,
  }

  return {
    ...productSnapshot,
    variants: (product.variants || []).map(variant => ({
      id: variant.id,
      title: variant.title,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      image: variant.imageUrl ? { url: variant.imageUrl } : undefined,
      selectedOptions: variant.selectedOptions,
      integrated: integratedVariantIds.has(variant.id),
      product: productSnapshot,
    })),
  }
}

// The copied ProductNVariantSelector (Charm builder + variant selector) reads TailorKit's raw
// `IProduct` shape: `variants: { nodes: [...] }` with a `displayName` per variant, not the flat
// `toTailorKitProduct` shape used by the plain existing-product selector. Mirrors upstream
// `api.getProducts()` GraphQL projection closely enough for the client's filter/search logic.
function toTailorKitProductVariantsListProduct(product: ShopifyResourceOption) {
  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    status: product.status,
    vendor: product.vendor,
    productType: product.productType,
    hasOnlyDefaultVariant: product.hasOnlyDefaultVariant,
    featuredImage: product.featuredImage || (product.imageUrl ? { url: product.imageUrl } : undefined),
    variants: {
      nodes: (product.variants || []).map(variant => ({
        id: variant.id,
        title: variant.title,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        displayName:
          product.hasOnlyDefaultVariant || variant.title === 'Default Title'
            ? product.title
            : `${product.title} - ${variant.title}`,
      })),
    },
  }
}

function productGidFromQuery(value: unknown): string {
  const id = queryText(value)
  if (!id) return ''
  return id.startsWith('gid://shopify/Product/') ? id : `gid://shopify/Product/${id}`
}

function productImagesFromSnapshot(product: ShopifyResourceOption) {
  const images: Array<{ id: string; url: string; altText: string | null }> = []
  const seenUrls = new Set<string>()

  const addImage = (id: string, url?: string, altText?: string | null) => {
    if (!url || seenUrls.has(url)) return
    seenUrls.add(url)
    images.push({ id, url, altText: altText ?? null })
  }

  addImage(`${product.id}/featured-image`, product.featuredImage?.url || product.imageUrl, product.featuredImage?.altText)
  ;(product.variants || []).forEach(variant => {
    addImage(`${variant.id}/image`, variant.imageUrl, variant.title || null)
  })

  return images
}

function toTailorKitProductVariant(itemId: string, variant: TailorKitVariantSnapshot & Record<string, unknown>) {
  const id = typeof variant.id === 'string' && variant.id ? variant.id : itemId
  const product = {
    id: variant.productId,
    title: variant.productTitle,
    handle: variant.productHandle,
    featuredImage: variant.imageUrl ? { url: variant.imageUrl } : undefined,
  }

  return {
    ...variant,
    id,
    title: variant.title,
    image: variant.imageUrl ? { url: variant.imageUrl } : undefined,
    product: variant.product && typeof variant.product === 'object' ? variant.product : product,
  }
}

function toDuplicateProductOptions(options: TailorKitDuplicateProductBody['options'] = {}) {
  const newStatus =
    typeof options.newStatus === 'string' && TAILORKIT_DUPLICATE_PRODUCT_STATUSES.has(options.newStatus)
      ? (options.newStatus as 'ACTIVE' | 'DRAFT' | 'UNLISTED')
      : undefined

  return {
    newHandle: typeof options.newHandle === 'string' && options.newHandle.trim() ? options.newHandle.trim() : undefined,
    newStatus,
    includeImages: options.includeImages === true,
    includeTranslations: options.includeTranslations === true,
    synchronous: options.synchronous !== false,
  }
}

async function collectIntegratedVariantIds(app: AppBackendRegisterContext, request: AppApiRequest) {
  await registerTailorKitAppDataCollections(app, request)
  const variantIds = new Set<string>()
  let cursor: string | undefined

  for (let pageNumber = 0; pageNumber < 20; pageNumber += 1) {
    const page = await app.ports.appData.list<{ id?: string; deletedAt?: string }>(
      request.context,
      TAILORKIT_VARIANT_INTEGRATION_COLLECTION,
      { cursor, limit: 100 }
    )

    for (const item of page.items) {
      if (item.value.deletedAt) continue
      variantIds.add(item.id)
      if (item.value.id) variantIds.add(item.value.id)
    }

    if (!page.nextCursor) break
    cursor = page.nextCursor
  }

  return variantIds
}

async function listVariantIntegrations(app: AppBackendRegisterContext, request: AppApiRequest) {
  await registerTailorKitAppDataCollections(app, request)
  const variants: Array<Record<string, unknown>> = []
  let cursor: string | undefined

  for (let pageNumber = 0; pageNumber < 20; pageNumber += 1) {
    const page = await app.ports.appData.list<Record<string, unknown>>(
      request.context,
      TAILORKIT_VARIANT_INTEGRATION_COLLECTION,
      { cursor, limit: 100 }
    )

    variants.push(
      ...page.items
        .filter(item => !item.value.deletedAt)
        .map(item => ({
          id: typeof item.value.id === 'string' ? item.value.id : item.id,
          ...item.value,
        }))
    )

    if (!page.nextCursor) break
    cursor = page.nextCursor
  }

  return variants
}

async function listIntegrationProductVariants(app: AppBackendRegisterContext, request: AppApiRequest) {
  await registerTailorKitAppDataCollections(app, request)

  const variantIds = bodyList(request.body, 'variantIds')
  const productVariants = (
    await Promise.all(
      variantIds.map(async variantId => {
        const variant = await app.ports.appData.get<TailorKitVariantSnapshot & Record<string, unknown>>(
          request.context,
          TAILORKIT_VARIANT_INTEGRATION_COLLECTION,
          variantId
        )

        if (!variant || (typeof variant.deletedAt === 'string' && variant.deletedAt)) return null
        return toTailorKitProductVariant(variantId, variant)
      })
    )
  ).filter(Boolean)

  return { body: { success: true, productVariants } }
}

async function listIntegrationProducts(app: AppBackendRegisterContext, request: AppApiRequest) {
  const products = await app.ports.shopifyResources.productsByIds(request.context, {
    ids: bodyList(request.body, 'productIds'),
  })

  return { body: { success: true, products: products.map(product => toTailorKitProduct(product)) } }
}

/**
 * Backs FETCH_ALL_PRODUCT_VARIANTS for the copied ProductNVariantSelector (Charm builder +
 * variant selector). Upstream posts multipart FormData (not JSON) with pageInfo/isFetchNextPage/
 * search filters and returns a pako-compressed, base64-encoded productsList; the client
 * (fetchProductVariants.ts) decompresses it and expects each product's variants nested under
 * `variants.nodes` with a `displayName`, matching TailorKit's raw `IProduct` shape.
 */
async function listAllProductVariants(app: AppBackendRegisterContext, request: AppApiRequest) {
  const body = bodyObject<{
    pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }
    isFetchNextPage?: unknown
    withArchived?: unknown
  }>(request.body)

  const productName = bodyText(request.body, 'productName')
  const variantName = bodyText(request.body, 'variantName')
  const queryString = bodyText(request.body, 'queryString')
  const productId = bodyText(request.body, 'productId')
  const withArchived = body.withArchived === true || body.withArchived === 'true'
  const isFetchNextPage = body.isFetchNextPage === true || body.isFetchNextPage === 'true'
  const after = isFetchNextPage && body.pageInfo?.hasNextPage ? body.pageInfo.endCursor || undefined : undefined

  const result = await app.ports.shopifyResources.products(request.context, {
    query: productName || queryString || variantName || undefined,
    productId: productId || undefined,
    status: withArchived ? ['ACTIVE', 'DRAFT', 'UNLISTED', 'ARCHIVED'] : [...TAILORKIT_DEFAULT_PRODUCT_STATUSES],
    after,
    first: TAILORKIT_ALL_PRODUCT_VARIANTS_PAGE_SIZE,
  })

  const productsList = result.products.map(product => toTailorKitProductVariantsListProduct(product))
  const compressedProductsList = Buffer.from(compressData(productsList)).toString('base64')

  return {
    body: {
      success: true,
      compressedProductsList,
      pageInfo: result.pageInfo,
      isCompressed: true,
    },
  }
}

async function listProductsByTemplate(app: AppBackendRegisterContext, request: AppApiRequest) {
  const templateId = queryText(request.query.templateId)

  if (!templateId) {
    return { status: 400, body: { success: false, message: 'Missing templateId' } }
  }

  await registerTailorKitAppDataCollections(app, request)
  const matchedIntegrations: TailorKitIntegrationRecord[] = []
  let cursor: string | undefined

  for (let pageNumber = 0; pageNumber < 20; pageNumber += 1) {
    const page = await app.ports.appData.list<TailorKitIntegrationRecord>(
      request.context,
      TAILORKIT_INTEGRATION_COLLECTION,
      { cursor, limit: 100 }
    )

    matchedIntegrations.push(...page.items.map(item => item.value).filter(integration => !integration.deletedAt))

    if (!page.nextCursor) break
    cursor = page.nextCursor
  }

  const integrations = matchedIntegrations.filter(integration => integrationUsesTemplate(integration, templateId))
  const productIds = [...new Set(integrations.flatMap(integration => integration.variants.map(variant => variant.productId)))]

  if (!productIds.length) return { body: { success: true, items: [], hasMore: false } }

  const products = await app.ports.shopifyResources.productsByIds(request.context, { ids: productIds })

  return {
    body: {
      success: true,
      items: products.map(product => {
        const integration = integrations.find(item => item.variants.some(variant => variant.productId === product.id))
        const integratedVariantIds = integration ? integrationVariantIds(integration) : new Set<string>()

        return {
          ...toTailorKitProduct(product, integratedVariantIds),
          mockupId: integration?.mockups[0]?.id,
          integrationId: integration?.id,
          publishedAt: integration?.publishedAt,
        }
      }),
      hasMore: false,
    },
  }
}

function optionSetFieldMatches(value: unknown, optionSetId: string): boolean {
  if (typeof value === 'string') return value === optionSetId
  if (Array.isArray(value)) return value.some(item => optionSetFieldMatches(item, optionSetId))
  if (!value || typeof value !== 'object') return false

  const record = value as Record<string, unknown>
  return optionSetFieldMatches(record._id, optionSetId) || optionSetFieldMatches(record.id, optionSetId)
}

function layerReferencesOptionSet(layer: TailorKitLayerRecord, optionSetId: string): boolean {
  const data = layer.data && typeof layer.data === 'object' ? layer.data : {}
  const candidates = [
    layer.optionSet,
    layer.optionSets,
    data.optionSet,
    data.optionSets,
    data.optionSetId,
    data.currentOptionSetId,
  ]

  return candidates.some(value => optionSetFieldMatches(value, optionSetId))
}

async function countOptionSetLayerUsage(app: AppBackendRegisterContext, request: AppApiRequest) {
  const optionSetId = bodyText(request.body, 'optionSetId')

  if (!optionSetId) return { status: 400, body: { success: false, message: 'Missing optionSetId' } }

  await registerTailorKitAppDataCollections(app, request)
  let layerCounting = 0
  let cursor: string | undefined

  for (let pageNumber = 0; pageNumber < 20; pageNumber += 1) {
    const page = await app.ports.appData.list<TailorKitLayerRecord>(request.context, TAILORKIT_LAYER_COLLECTION, {
      cursor,
      limit: 100,
    })

    layerCounting += page.items.filter(
      item => !item.value.deletedAt && layerReferencesOptionSet(item.value, optionSetId)
    ).length

    if (!page.nextCursor) break
    cursor = page.nextCursor
  }

  return { body: { success: true, optionSet: { layerCounting } } }
}

function collectPublishedIntegrationTemplateIds(integration: TailorKitIntegrationRecord & Record<string, unknown>) {
  const ids = new Set<string>()

  integration.templates?.forEach(template => {
    if (template.id) ids.add(template.id)
  })
  integration.publishSnapshot?.templateIds?.forEach(templateId => ids.add(templateId))

  const storefrontTemplates = (
    integration.publishSnapshot?.storefront as { templates?: Array<{ id?: string }> } | undefined
  )?.templates
  storefrontTemplates?.forEach(template => {
    if (template.id) ids.add(template.id)
  })

  return ids
}

function integrationApiReference(itemId: string, integration: TailorKitIntegrationRecord) {
  const id = integration.id || itemId

  return {
    _id: id,
    id,
    publishedAt: integration.publishedAt,
  }
}

function integrationIsPublished(integration: TailorKitIntegrationRecord) {
  return !integration.deletedAt && Boolean(integration.publishedAt || integration.status === 'published')
}

function integrationVariantIds(integration: TailorKitIntegrationRecord) {
  return new Set([
    ...integration.variants.map(variant => variant.id),
    ...integration.variantIdsPublished,
  ])
}

function integrationUsesAnyVariantId(integration: TailorKitIntegrationRecord, variantIds: Set<string>) {
  if (!variantIds.size) return false

  for (const variantId of integrationVariantIds(integration)) {
    if (variantIds.has(variantId)) return true
  }

  return false
}

function integrationUsesTemplate(integration: TailorKitIntegrationRecord, templateId: string) {
  if (!templateId) return false
  if (collectPublishedIntegrationTemplateIds(integration).has(templateId)) return true

  const editorState = integration.draft.editorState
  if (editorState?.templateIds.includes(templateId)) return true

  return Boolean(editorState?.templateSnapshots.some(template => template.id === templateId))
}

function idsFromUnknown(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  if (Array.isArray(value)) return value.flatMap(idsFromUnknown)
  if (!value || typeof value !== 'object') return []

  const record = value as Record<string, unknown>
  return [record._id, record.id].flatMap(idsFromUnknown)
}

async function resolveVariantIds(
  app: AppBackendRegisterContext,
  request: AppApiRequest,
  rawVariantIds: Iterable<string>
) {
  await registerTailorKitAppDataCollections(app, request)
  const variantIds = new Set([...rawVariantIds].filter(Boolean))

  await Promise.all(
    [...variantIds].map(async variantId => {
      const variant = await app.ports.appData.get<TailorKitVariantSnapshot & Record<string, unknown>>(
        request.context,
        TAILORKIT_VARIANT_INTEGRATION_COLLECTION,
        variantId
      )

      if (!variant || (typeof variant.deletedAt === 'string' && variant.deletedAt)) return
      if (typeof variant.id === 'string' && variant.id) variantIds.add(variant.id)
    })
  )

  return variantIds
}

async function listIntegrationsByPredicate(
  app: AppBackendRegisterContext,
  request: AppApiRequest,
  predicate: (integration: TailorKitIntegrationRecord, itemId: string) => boolean
) {
  await registerTailorKitAppDataCollections(app, request)
  const integrations: Array<ReturnType<typeof integrationApiReference>> = []
  let cursor: string | undefined

  for (let pageNumber = 0; pageNumber < 20; pageNumber += 1) {
    const page = await app.ports.appData.list<TailorKitIntegrationRecord>(
      request.context,
      TAILORKIT_INTEGRATION_COLLECTION,
      { cursor, limit: 100 }
    )

    for (const item of page.items) {
      if (!predicate(item.value, item.id)) continue
      integrations.push(integrationApiReference(item.id, item.value))
    }

    if (!page.nextCursor) break
    cursor = page.nextCursor
  }

  return integrations
}

async function listPublishedIntegrationsByVariantIds(app: AppBackendRegisterContext, request: AppApiRequest) {
  const variantIds = await resolveVariantIds(app, request, bodyList(request.body, 'variantIds'))

  if (!variantIds.size) return { body: { success: true, integrations: [] } }

  const integrations = await listIntegrationsByPredicate(
    app,
    request,
    integration => integrationIsPublished(integration) && integrationUsesAnyVariantId(integration, variantIds)
  )

  return { body: { success: true, integrations } }
}

async function listPublishedIntegrationsByTemplate(app: AppBackendRegisterContext, request: AppApiRequest) {
  const templateId = bodyText(request.body, 'templateId')

  if (!templateId) return { body: { success: true, integrations: [] } }

  await registerTailorKitAppDataCollections(app, request)
  const template = await app.ports.appData.get<Record<string, unknown>>(
    request.context,
    TAILORKIT_TEMPLATE_COLLECTION,
    templateId
  )
  const activeVariantIds = await resolveVariantIds(app, request, idsFromUnknown(template?.activeVariantIntegration))

  const integrations = await listIntegrationsByPredicate(
    app,
    request,
    (integration, itemId) =>
      integrationIsPublished(integration) &&
      (integrationUsesTemplate(integration, templateId) ||
        itemId === template?.integrationId ||
        integration.id === template?.integrationId ||
        integrationUsesAnyVariantId(integration, activeVariantIds))
  )

  return { body: { success: true, integrations } }
}

async function checkSharedTemplateIntegrations(app: AppBackendRegisterContext, request: AppApiRequest) {
  await registerTailorKitAppDataCollections(app, request)

  const integrationId = bodyText(request.body, 'integrationId')
  const templateIds = new Set(bodyList(request.body, 'templateIds'))
  if (!templateIds.size) return { body: { success: true, sharedIntegrationIds: [] } }

  const sharedIntegrationIds = new Set<string>()
  let cursor: string | undefined

  for (let pageNumber = 0; pageNumber < 20; pageNumber += 1) {
    const page = await app.ports.appData.list<TailorKitIntegrationRecord & Record<string, unknown>>(
      request.context,
      TAILORKIT_INTEGRATION_COLLECTION,
      { cursor, limit: 100 }
    )

    for (const item of page.items) {
      const integration = item.value
      const id = integration.id || item.id
      if (id === integrationId || integration.status !== 'published' || integration.deletedAt) continue

      const integrationTemplateIds = collectPublishedIntegrationTemplateIds(integration)
      if ([...templateIds].some(templateId => integrationTemplateIds.has(templateId))) {
        sharedIntegrationIds.add(id)
      }
    }

    if (!page.nextCursor) break
    cursor = page.nextCursor
  }

  return { body: { success: true, sharedIntegrationIds: [...sharedIntegrationIds] } }
}

async function checkTemplateUsage(app: AppBackendRegisterContext, request: AppApiRequest) {
  const templateId = bodyText(request.body, 'templateId')

  if (!templateId) {
    return { status: 400, body: { success: false, error: 'Template ID is required' } }
  }

  await registerTailorKitAppDataCollections(app, request)

  const printAreaIds = new Set<string>()
  let cursor: string | undefined

  for (let pageNumber = 0; pageNumber < 20; pageNumber += 1) {
    const page = await app.ports.appData.list<TailorKitTemplateSnapshot>(
      request.context,
      TAILORKIT_TEMPLATE_COLLECTION,
      { cursor, limit: 100 }
    )

    for (const item of page.items) {
      const template = item.value
      const id = template.id || item.id

      if ((template as TailorKitTemplateSnapshot & { deletedAt?: string }).deletedAt) continue
      if (id === templateId && template.printAreaId) {
        printAreaIds.add(template.printAreaId)
      }
    }

    if (!page.nextCursor) break
    cursor = page.nextCursor
  }

  return {
    body: {
      success: true,
      templateId,
      printAreaIds: [...printAreaIds],
      usageCount: printAreaIds.size,
      isUsedElsewhere: printAreaIds.size > 1,
    },
  }
}

async function saveOverlayTransparentRegions(app: AppBackendRegisterContext, request: AppApiRequest) {
  const payload = bodyObject<{ previewUrl?: unknown; transparentRegions?: unknown }>(request.body)
  const previewUrl = typeof payload.previewUrl === 'string' ? payload.previewUrl.trim() : ''

  if (previewUrl && payload.transparentRegions !== undefined) {
    await registerTailorKitAppDataCollections(app, request)
    await app.ports.appData.put(request.context, TAILORKIT_OVERLAY_LOOKUP_COLLECTION, previewUrl, {
      previewUrl,
      metadata: { transparentRegions: payload.transparentRegions },
      updatedAt: new Date().toISOString(),
    })
  }

  return { body: { success: true } }
}

function templateNameFilter(value: unknown): string | undefined {
  const text = queryText(value)
  if (!text) return undefined

  return (
    text
      .replace(/^string__has__/, '')
      .trim()
      .toLowerCase() || undefined
  )
}

function toTailorKitTemplateApiItem(itemId: string, template: TailorKitTemplateSnapshot & Record<string, unknown>) {
  const record = template as Record<string, unknown>
  const id = typeof record._id === 'string' ? record._id : template.id || itemId
  const name = typeof template.name === 'string' && template.name.trim() ? template.name.trim() : 'Untitled template'
  const thumbnailUrl =
    typeof record.thumbnailUrl === 'string'
      ? record.thumbnailUrl
      : typeof template.previewUrl === 'string'
        ? template.previewUrl
        : undefined

  return {
    ...template,
    _id: id,
    id,
    name,
    thumbnailUrl,
  }
}

async function listTemplates(app: AppBackendRegisterContext, request: AppApiRequest) {
  await registerTailorKitAppDataCollections(app, request)

  const pageNumber = Math.max(1, Math.floor(numberQuery(request.query.page, 1)))
  const limit = Math.max(1, Math.min(Math.floor(numberQuery(request.query.limit, 20)), 100))
  const searchName = templateNameFilter(request.query.filter__name)
  const targetCount = pageNumber * limit + 1
  const templates: ReturnType<typeof toTailorKitTemplateApiItem>[] = []
  let cursor: string | undefined

  for (let pageIndex = 0; pageIndex < 20 && templates.length < targetCount; pageIndex += 1) {
    const page = await app.ports.appData.list<TailorKitTemplateSnapshot & Record<string, unknown>>(
      request.context,
      TAILORKIT_TEMPLATE_COLLECTION,
      { cursor, limit: 100 }
    )

    for (const item of page.items) {
      const value = item.value
      if (typeof value.deletedAt === 'string' && value.deletedAt) continue

      const template = toTailorKitTemplateApiItem(item.id, value)
      if (searchName && !template.name.toLowerCase().includes(searchName)) continue

      templates.push(template)
    }

    if (!page.nextCursor) break
    cursor = page.nextCursor
  }

  const start = (pageNumber - 1) * limit
  const items = templates.slice(start, start + limit)

  return {
    body: {
      success: true,
      items,
      templates: items,
      total: templates.length,
      page: pageNumber,
      limit,
    },
  }
}

async function getTemplate(app: AppBackendRegisterContext, request: AppApiRequest) {
  const templateId = routeId(request)
  if (!templateId) return { status: 400, body: { success: false, message: 'Missing template id' } }

  await registerTailorKitAppDataCollections(app, request)

  const template = await app.ports.appData.get<TailorKitTemplateSnapshot & Record<string, unknown>>(
    request.context,
    TAILORKIT_TEMPLATE_COLLECTION,
    templateId
  )

  if (!template || (typeof template.deletedAt === 'string' && template.deletedAt)) {
    return { body: { data: null } }
  }

  return { body: { data: toTailorKitTemplateApiItem(templateId, template) } }
}

async function saveTemplate(app: AppBackendRegisterContext, request: AppApiRequest) {
  const templateId = routeId(request)
  if (!templateId) return { status: 400, body: { success: false, message: 'Missing template id' } }

  const payload = bodyObject<TailorKitTemplateSaveBody>(request.body)
  const templateData = payload.templateData && typeof payload.templateData === 'object' ? payload.templateData : null

  if (!templateData) {
    return { status: 400, body: { success: false, message: 'Missing templateData' } }
  }

  await registerTailorKitAppDataCollections(app, request)

  const existing = await app.ports.appData.get<TailorKitTemplateSnapshot & Record<string, unknown>>(
    request.context,
    TAILORKIT_TEMPLATE_COLLECTION,
    templateId
  )
  const now = new Date().toISOString()
  const template = {
    ...(existing || {}),
    ...templateData,
    id: templateId,
    _id: templateId,
    shopDomain: request.context.shopDomain,
    createdAt: existing?.createdAt || (typeof templateData.createdAt === 'string' ? templateData.createdAt : now),
    updatedAt: now,
    metadata: {
      ...(existing?.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
      ...(templateData.metadata && typeof templateData.metadata === 'object' ? templateData.metadata : {}),
      ...(payload.useAiFeature ? { savedWithAiFeature: true } : {}),
    },
  }

  const saved = await app.ports.appData.put(request.context, TAILORKIT_TEMPLATE_COLLECTION, templateId, template)
  const previewUrl = typeof saved.previewUrl === 'string' ? saved.previewUrl : ''
  const thumbnailUrl = typeof saved.thumbnailUrl === 'string' ? saved.thumbnailUrl : ''

  return {
    body: {
      success: true,
      data: { previewUrl, thumbnailUrl, showConfetti: !existing },
      previewUrl,
      thumbnailUrl,
      showConfetti: !existing,
    },
  }
}

async function listTemplatesByIds(app: AppBackendRegisterContext, request: AppApiRequest) {
  const templateIds = Array.from(new Set(bodyList(request.body, 'templateIds')))
  if (!templateIds.length) return { body: { success: true, templates: [] } }

  await registerTailorKitAppDataCollections(app, request)

  const templates = await Promise.all(
    templateIds.map(async templateId => {
      const template = await app.ports.appData.get<TailorKitTemplateSnapshot & Record<string, unknown>>(
        request.context,
        TAILORKIT_TEMPLATE_COLLECTION,
        templateId
      )

      if (!template || (typeof template.deletedAt === 'string' && template.deletedAt)) return null

      return toTailorKitTemplateApiItem(templateId, template)
    })
  )

  return {
    body: {
      success: true,
      templates: templates.filter((template): template is NonNullable<typeof template> => Boolean(template)),
    },
  }
}

async function listOptionSets(app: AppBackendRegisterContext, request: AppApiRequest) {
  await registerTailorKitAppDataCollections(app, request)

  const ids = new Set(queryList(request.query.ids))
  const limit = Math.max(1, Math.min(numberQuery(request.query.limit, 250), 250))
  const pageNumber = Math.max(1, Math.floor(numberQuery(request.query.page, 1)))
  const offset = (pageNumber - 1) * limit
  const optionSets: TailorKitOptionSetRecord[] = []
  let cursor: string | undefined

  for (let scannedPage = 0; scannedPage < 20; scannedPage += 1) {
    const page = await app.ports.appData.list<TailorKitOptionSetRecord>(
      request.context,
      TAILORKIT_OPTION_SET_COLLECTION,
      { cursor, limit: 100 }
    )

    optionSets.push(
      ...page.items
        .map(item => ({ ...item.value, _id: item.value._id || item.value.id || item.id }))
        .filter(item => !item.deletedAt)
        .filter(item => !ids.size || ids.has(String(item._id || item.id || '')))
        .map(item => ({
          _id: item._id,
          label: item.label,
          labelOnStoreFront: item.labelOnStoreFront,
          shopDomain: request.context.shopDomain,
          type: item.type,
          data: item.data,
          values: item.values,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          status: item.status,
          editingMode: item.editingMode,
          additionalPricingEnabled: item.additionalPricingEnabled,
        }))
    )

    if (!page.nextCursor) break
    cursor = page.nextCursor
  }

  const sorted = optionSets.sort((left, right) =>
    String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''))
  )

  return {
    body: {
      page: pageNumber,
      total: sorted.length,
      items: sorted.slice(offset, offset + limit),
    },
  }
}

function provisionalRouteBlocked(route: string) {
  return {
    status: 501,
    body: {
      success: false,
      route,
      reason: 'tailorkit-copied-route-host-not-ready',
      message: 'TailorKit copied ProductSelector/create route is not hosted yet.',
    },
  }
}

async function createRootLoaderData(app: AppBackendRegisterContext, request: AppApiRequest) {
  const shop = await app.ports.shopContext.getSafeContext(request.context, ['identity', 'localization', 'plan', 'app'])
  const appConfig = await getTailorKitThemeConfig(request.context, app, app.app.manifest.themeSurfaces).catch(
    () => undefined
  )

  return createTailorKitProductEditorRootLoaderData({
    shopDomain: shop.identity.shopDomain,
    currency: shop.localization.currency,
    locale: shop.localization.locale,
    timezone: shop.localization.timezone,
    appHandle: process.env.APP_HANDLE,
    storeAssetDomain: process.env.STORE_ASSET_DOMAIN,
    planName: shop.plan.planName,
    planTier: shop.plan.tier,
    subscriptionGeneration: shop.app.subscriptionGeneration,
    appConfig,
  })
}

export function registerTailorKitProductPersonalizerApi(app: AppBackendRegisterContext) {
  app.api.route({
    method: 'GET',
    path: '/product-options',
    capability: TAILORKIT_CAPABILITIES.readProductOptions,
    async handler(request) {
      const options = await app.ports.shopifyResources.setupOptions(request.context, queryText(request.query.q))

      return {
        body: {
          success: true,
          products: options.products,
          variants: options.variants.map(toVariantOption),
        },
      }
    },
  })

  app.api.route({
    method: 'GET',
    path: '/shopify-products',
    capability: TAILORKIT_CAPABILITIES.readProductOptions,
    async handler(request) {
      const products = await app.ports.shopifyResources.productsByIds(request.context, {
        ids: queryList(request.query.ids),
      })

      return { body: products.map(product => toTailorKitProduct(product)) }
    },
  })

  app.api.route({
    method: 'GET',
    path: '/shopify-product-images',
    capability: TAILORKIT_CAPABILITIES.readProductOptions,
    async handler(request) {
      const productId = productGidFromQuery(request.query.productId)
      if (!productId) return { body: { images: [] } }

      const [product] = await app.ports.shopifyResources.productsByIds(request.context, { ids: [productId] })
      return { body: { images: product ? productImagesFromSnapshot(product) : [] } }
    },
  })

  /**
   * Backs the copied checkUserHasProduct client (GET /api/shopify?action=checkUserHasProduct), which
   * only needs to know whether the store has at least one product. Reuses the same shopifyResources.products
   * capability as the existing /shopify-products route, but caps the query at a single product.
   */
  app.api.route({
    method: 'GET',
    path: '/shopify-has-product',
    capability: TAILORKIT_CAPABILITIES.readProductOptions,
    async handler(request) {
      const result = await app.ports.shopifyResources.products(request.context, {
        first: 1,
        status: [...TAILORKIT_DEFAULT_PRODUCT_STATUSES],
      })

      return { body: { success: true, data: result.products.length > 0 } }
    },
  })

  /**
   * Backs the copied useAppHandle hook (GET /api/shopify?action=getAppHandle). Upstream's loader
   * returns the app handle as a bare JSON string (no {success,data} envelope) and the client assigns
   * the response directly, so this mirrors that shape instead of the generic success/data wrapper.
   */
  app.api.route({
    method: 'GET',
    path: '/shopify-app-handle',
    capability: TAILORKIT_CAPABILITIES.readProductOptions,
    handler() {
      return { body: process.env.APP_HANDLE || '' }
    },
  })

  app.api.route({
    method: 'GET',
    path: '/products',
    capability: TAILORKIT_CAPABILITIES.readProductOptions,
    async handler(request) {
      const source = queryText(request.query.source) || 'existing'

      if (source !== 'existing') {
        return {
          status: 400,
          body: { success: false, message: `Unsupported TailorKit product source: ${source}` },
        }
      }

      const status = queryList(request.query.status)
      const result = await app.ports.shopifyResources.products(request.context, {
        query: queryText(request.query.search),
        category: queryList(request.query.category),
        productId: queryText(request.query.productId),
        status: status.length ? status : [...TAILORKIT_DEFAULT_PRODUCT_STATUSES],
        after: queryText(request.query.after),
        first: numberQuery(request.query.limit, 25),
      })
      const integratedVariantIds = await collectIntegratedVariantIds(app, request)

      return {
        body: {
          success: true,
          items: result.products.map(product => toTailorKitProduct(product, integratedVariantIds)),
          hasMore: result.pageInfo.hasNextPage && result.pageInfo.endCursor,
          pageInfo: result.pageInfo,
        },
      }
    },
  })

  app.api.route({
    method: 'GET',
    path: '/dummy-products-suggestions',
    capability: TAILORKIT_CAPABILITIES.readProductOptions,
    handler() {
      return {
        body: {
          success: true,
          items: [],
        },
      }
    },
  })

  app.api.route({
    method: 'POST',
    path: '/products',
    capability: TAILORKIT_CAPABILITIES.writePersonalizedProducts,
    async handler(request) {
      const payload = bodyObject<TailorKitDuplicateProductBody>(request.body)

      if (payload.action !== TAILORKIT_PRODUCT_MUTATION_ACTIONS.duplicateExistingProduct) {
        return {
          status: 400,
          body: {
            success: false,
            message: `Unsupported TailorKit products mutation: ${payload.action || '<missing>'}`,
          },
        }
      }

      const productId = typeof payload.productId === 'string' ? payload.productId.trim() : ''
      const newTitle = typeof payload.newTitle === 'string' ? payload.newTitle.trim() : ''

      if (!productId || !newTitle) {
        return { status: 400, body: { success: false, message: 'Missing productId or newTitle' } }
      }

      const result = await app.ports.shopifyResources.duplicateProduct(request.context, {
        productId,
        newTitle,
        options: toDuplicateProductOptions(payload.options),
      })

      return { body: { success: true, ...result } }
    },
  })

  app.api.route({
    method: 'GET',
    path: '/product-categories',
    capability: TAILORKIT_CAPABILITIES.readProductOptions,
    async handler(request) {
      const source = queryText(request.query.source) || 'existing'

      if (source !== 'existing') {
        return {
          status: 400,
          body: { success: false, message: `Unsupported TailorKit product category source: ${source}` },
        }
      }

      return {
        body: {
          success: true,
          items: await app.ports.shopifyResources.productCategories(request.context),
        },
      }
    },
  })

  app.api.route({
    method: 'GET',
    path: '/providers',
    capability: TAILORKIT_CAPABILITIES.readProductOptions,
    handler() {
      return {
        body: {
          success: true,
          items: [],
        },
      }
    },
  })

  app.api.route({
    method: 'GET',
    path: '/prompt-presets',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    handler() {
      return {
        body: {
          success: true,
          items: [],
        },
      }
    },
  })

  app.api.route({
    method: 'POST',
    path: '/font-combination-suggestions',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    handler() {
      return {
        body: {
          success: true,
          clipartIds: [],
          cliparts: [],
          fromCache: false,
        },
      }
    },
  })

  app.api.route({
    method: 'POST',
    path: '/files/query-media',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    async handler(request) {
      const body = bodyObject<{ pageInfo?: { hasNextPage?: boolean; endCursor?: string }; isFetchNextPage?: unknown }>(
        request.body
      )
      const queryValue = bodyText(request.body, 'queryValue')
      const isFetchNextPage = body.isFetchNextPage === true || body.isFetchNextPage === 'true'
      const after = isFetchNextPage && body.pageInfo?.hasNextPage ? body.pageInfo.endCursor : undefined

      const result = await app.ports.shopifyResources.mediaFiles(request.context, {
        query: queryValue || undefined,
        after,
      })

      return {
        body: {
          success: true,
          mediaList: { nodes: result.nodes, pageInfo: result.pageInfo },
        },
      }
    },
  })

  app.api.route({
    method: 'GET',
    path: '/charm-products',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    async handler(request) {
      const ids = queryList(request.query.ids)
      if (!ids.length) {
        return { body: { products: [], error: null } }
      }

      const products = await app.ports.shopifyResources.charmProducts(request.context, ids)
      return { body: { products, error: null } }
    },
  })

  app.api.route({
    method: 'POST',
    path: '/files/colour-guide-upload',
    capability: TAILORKIT_CAPABILITIES.writePersonalizedProducts,
    async handler(request) {
      const [file] = parseUploadFiles(request.body)
      if (!file) {
        return { status: 400, body: { success: false, error: 'file required' } }
      }

      const result = await app.ports.shopifyResources.uploadColourGuide(request.context, file, {
        shopDomain: request.context.shopDomain,
      })
      return { body: result }
    },
  })

  app.api.route({
    method: 'POST',
    path: '/files/upload',
    capability: TAILORKIT_CAPABILITIES.writePersonalizedProducts,
    async handler(request) {
      const files = parseUploadFiles(request.body)

      if (!files.length) {
        return {
          status: 400,
          body: { success: false, message: 'No files were uploaded' },
        }
      }

      const result = await app.ports.shopifyResources.uploadFiles(request.context, files, {
        shopDomain: request.context.shopDomain,
      })

      return { body: { success: true, data: result } }
    },
  })

  app.api.route({
    method: 'POST',
    path: '/files/query-fonts',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    handler() {
      return {
        body: {
          success: true,
          data: {
            fontFiles: [],
            pageInfo: { hasNextPage: false },
          },
        },
      }
    },
  })

  app.api.route({
    method: 'POST',
    path: '/files/query-masks',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    handler() {
      return {
        body: {
          success: true,
          data: {
            maskFiles: [],
            pageInfo: { hasNextPage: false },
          },
        },
      }
    },
  })

  app.api.route({
    method: 'GET',
    path: '/tutorials',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    handler() {
      return {
        body: {
          success: true,
          data: [],
        },
      }
    },
  })

  app.api.route({
    method: 'GET',
    path: '/user-journey',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    async handler(request) {
      const types = journeyTypesFromQuery(request.query.types)

      if (types.length) {
        const userJourneys = (
          await Promise.all(types.map(type => readTailorKitUserJourney(app, request, type)))
        ).filter((journey): journey is TailorKitUserJourneyRecord => Boolean(journey))

        return { body: { success: true, userJourneys } }
      }

      const type = queryText(request.query.type)
      if (!type) return { body: { success: true, userJourney: null } }

      return {
        body: {
          success: true,
          userJourney: await readTailorKitUserJourney(app, request, type),
        },
      }
    },
  })

  app.api.route({
    method: 'POST',
    path: '/user-journey',
    capability: TAILORKIT_CAPABILITIES.writePersonalizedProducts,
    async handler(request) {
      return saveTailorKitUserJourney(app, request)
    },
  })

  app.api.route({
    method: 'GET',
    path: '/personalized-products',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    async handler(request) {
      const repo = createTailorKitProductPersonalizerRepository(app.ports, request.context)
      const listOptions = parseTailorKitListOptions(request.query)
      const result = await repo.list({
        ...listOptions,
        limit: listOptions.limit || numberQuery(request.query.limit, 50),
      })
      const items = result.items.map(createTailorKitPersonalizedProductListItem)
      return { body: { success: true, items, total: result.total, nextCursor: result.nextCursor } }
    },
  })

  app.api.route({
    method: 'POST',
    path: '/personalized-products',
    capability: TAILORKIT_CAPABILITIES.writePersonalizedProducts,
    async handler() {
      return provisionalRouteBlocked('POST /personalized-products')
    },
  })

  app.api.route({
    method: 'POST',
    path: '/integrations-bulk',
    capability: TAILORKIT_CAPABILITIES.publishPersonalizedProducts,
    async handler(request) {
      const action = queryText(request.query.action)

      if (action === TAILORKIT_BULK_ACTIONS.delete) {
        const integrationIds = bulkDeleteIntegrationIds(request.body)

        if (!integrationIds.length) {
          return {
            body: {
              success: false,
              message: 'No disintegrated mockups found with the provided IDs',
            },
          }
        }

        const result = await createTailorKitProductPersonalizerRepository(app.ports, request.context).deleteMany(
          integrationIds
        )

        return {
          body: {
            success: true,
            deletedMockups: result.deletedIds,
            deletedVariants: result.deletedVariantIds,
            affectedIntegrations: result.deletedIds,
            skippedIntegrations: result.skippedIds,
            notFoundIntegrations: result.notFoundIds,
          },
        }
      }

      if (action !== TAILORKIT_BULK_ACTIONS.publish && action !== TAILORKIT_BULK_ACTIONS.unpublish) {
        return { status: 400, body: { success: false, message: 'Unsupported TailorKit integrations bulk action' } }
      }

      const integrationId = bodyText(request.body, 'integrationId')

      if (!integrationId) {
        return { status: 400, body: { success: false, message: 'Missing integrationId' } }
      }

      const repo = createTailorKitProductPersonalizerRepository(app.ports, request.context)
      const item =
        action === TAILORKIT_BULK_ACTIONS.publish
          ? await repo.publish(integrationId)
          : await repo.unpublish(integrationId)

      return item ? { body: { success: true, item } } : { status: 404, body: { success: false, message: 'Not found' } }
    },
  })

  app.api.route({
    method: 'GET',
    path: '/personalized-products/:id',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    async handler(request) {
      const item = await createTailorKitProductPersonalizerRepository(app.ports, request.context).get(routeId(request))
      if (!item) return { body: null }

      const rootLoaderData = await createRootLoaderData(app, request)

      return {
        body: {
          success: true,
          item,
          editorLoader: createTailorKitProductEditorLoaderData(
            item,
            {
              mockup: request.query.mockup,
              mockupId: request.query.mockupId,
              tab: request.query.tab,
              printAreaId: request.query.printAreaId,
              templateId: request.query.templateId,
              viewId: request.query.viewId,
            },
            rootLoaderData
          ),
        },
      }
    },
  })

  app.api.route({
    method: 'GET',
    path: '/variant-integrations',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    async handler(request) {
      return {
        body: {
          success: true,
          variants: await listVariantIntegrations(app, request),
        },
      }
    },
  })

  app.api.route({
    method: 'POST',
    path: '/integration-product-variants',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    async handler(request) {
      return listIntegrationProductVariants(app, request)
    },
  })

  app.api.route({
    method: 'POST',
    path: '/integration-all-product-variants',
    capability: TAILORKIT_CAPABILITIES.readProductOptions,
    async handler(request) {
      return listAllProductVariants(app, request)
    },
  })

  app.api.route({
    method: 'POST',
    path: '/integration-products',
    capability: TAILORKIT_CAPABILITIES.readProductOptions,
    async handler(request) {
      return listIntegrationProducts(app, request)
    },
  })

  app.api.route({
    method: 'GET',
    path: '/products-by-template',
    capability: TAILORKIT_CAPABILITIES.readProductOptions,
    async handler(request) {
      return listProductsByTemplate(app, request)
    },
  })

  app.api.route({
    method: 'POST',
    path: '/shared-template-integrations',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    async handler(request) {
      return checkSharedTemplateIntegrations(app, request)
    },
  })

  app.api.route({
    method: 'POST',
    path: '/published-integrations-by-variant-ids',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    async handler(request) {
      return listPublishedIntegrationsByVariantIds(app, request)
    },
  })

  app.api.route({
    method: 'POST',
    path: '/published-integrations-by-template',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    async handler(request) {
      return listPublishedIntegrationsByTemplate(app, request)
    },
  })

  app.api.route({
    method: 'GET',
    path: '/overlay-lookup',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    handler() {
      return {
        body: {
          success: true,
          overlays: [],
        },
      }
    },
  })

  app.api.route({
    method: 'POST',
    path: '/overlay-lookup',
    capability: TAILORKIT_CAPABILITIES.writePersonalizedProducts,
    async handler(request) {
      return saveOverlayTransparentRegions(app, request)
    },
  })

  app.api.route({
    method: 'POST',
    path: '/template-usage',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    async handler(request) {
      return checkTemplateUsage(app, request)
    },
  })

  app.api.route({
    method: 'GET',
    path: '/templates',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    async handler(request) {
      return listTemplates(app, request)
    },
  })

  app.api.route({
    method: 'GET',
    path: '/templates/:id',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    async handler(request) {
      return getTemplate(app, request)
    },
  })

  app.api.route({
    method: 'POST',
    path: '/templates/:id/save',
    capability: TAILORKIT_CAPABILITIES.writePersonalizedProducts,
    async handler(request) {
      return saveTemplate(app, request)
    },
  })

  app.api.route({
    method: 'GET',
    path: '/option-sets',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    async handler(request) {
      return listOptionSets(app, request)
    },
  })

  app.api.route({
    method: 'POST',
    path: '/option-set-layer-usage',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    async handler(request) {
      return countOptionSetLayerUsage(app, request)
    },
  })

  app.api.route({
    method: 'POST',
    path: '/templates-by-ids',
    capability: TAILORKIT_CAPABILITIES.readPersonalizedProducts,
    async handler(request) {
      return listTemplatesByIds(app, request)
    },
  })

  app.api.route({
    method: 'PUT',
    path: '/personalized-products/:id',
    capability: TAILORKIT_CAPABILITIES.writePersonalizedProducts,
    async handler(request) {
      const body = bodyObject<TailorKitUpdateIntegrationRequest>(request.body)
      if (isTailorKitProductEditorSaveRequest(body) && !isValidTailorKitSavePayload(body.tailorkitSavePayload)) {
        return { status: 400, body: { success: false, message: 'Malformed TailorKit save payload: variants array required' } }
      }
      const repo = createTailorKitProductPersonalizerRepository(app.ports, request.context)

      // Taste gate: only NEW personalized products count toward the meter. Updates to an existing
      // record are never blocked. Quota policy is host-owned, surfaced via the safe context.
      const id = routeId(request)
      const existing = await repo.get(id)
      if (!existing) {
        const shop = await app.ports.shopContext.getSafeContext(request.context, ['app'])
        const quota = shop.app.meterQuotas?.[TAILORKIT_PERSONALIZED_PRODUCTS_METER]
        const ceiling = await checkPersonalizedProductTaste(app, request.context, quota)
        if (ceiling.blocked) {
          return {
            status: 402,
            body: { success: false, message: 'Upgrade required to add more personalized products', meterCeiling: ceiling.event },
          }
        }
      }

      const item = await repo.update(id, body)
      return item ? { body: { success: true, item } } : { status: 404, body: { success: false, message: 'Not found' } }
    },
  })

  app.api.route({
    method: 'POST',
    path: '/personalized-products/:id/publish',
    capability: TAILORKIT_CAPABILITIES.publishPersonalizedProducts,
    async handler(request) {
      const item = await createTailorKitProductPersonalizerRepository(app.ports, request.context).publish(
        routeId(request)
      )
      return item ? { body: { success: true, item } } : { status: 404, body: { success: false, message: 'Not found' } }
    },
  })

  app.api.route({
    method: 'POST',
    path: '/personalized-products/:id/unpublish',
    capability: TAILORKIT_CAPABILITIES.publishPersonalizedProducts,
    async handler(request) {
      const item = await createTailorKitProductPersonalizerRepository(app.ports, request.context).unpublish(
        routeId(request)
      )
      return item ? { body: { success: true, item } } : { status: 404, body: { success: false, message: 'Not found' } }
    },
  })
}
