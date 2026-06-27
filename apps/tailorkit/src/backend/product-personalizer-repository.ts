// TailorKit backend code must access PageFly only through AppBackendPlugin ctx.ports.
import type { AppBackendPorts, AppContext } from '../../../../web/server/src/app-platform/contracts'
import {
  createTailorKitIntegration,
  deleteTailorKitIntegration,
  publishTailorKitIntegration,
  TAILORKIT_INTEGRATION_COLLECTION,
  TAILORKIT_LAYER_COLLECTION,
  TAILORKIT_MOCKUP_VIEW_COLLECTION,
  TAILORKIT_MOCKUP_COLLECTION,
  TAILORKIT_STOREFRONT_SNAPSHOT_COLLECTION,
  TAILORKIT_TEMPLATE_COLLECTION,
  TAILORKIT_VARIANT_INTEGRATION_COLLECTION,
  unpublishTailorKitIntegration,
  updateTailorKitIntegration,
  type TailorKitCreateIntegrationInput,
  type TailorKitIntegrationRecord,
  type TailorKitProductPersonalizerListOptions,
  type TailorKitUpdateIntegrationInput,
} from '../domain/product-personalizer'
import { tailorkitAppDataCollections } from '../domain/migration-boundary'
import {
  createTailorKitCreateInputFromSavePayload,
  createTailorKitUpdateInputFromSavePayload,
  isTailorKitProductEditorSaveRequest,
  type TailorKitProductEditorSaveRequest,
} from '../domain/product-editor-save-payload'
import { publishTailorKitStorefrontMetafields } from './storefront-snapshot-publisher'

export type TailorKitUpdateIntegrationRequest = TailorKitUpdateIntegrationInput | TailorKitProductEditorSaveRequest

export interface TailorKitDeleteIntegrationsResult {
  deletedIds: string[]
  deletedVariantIds: string[]
  skippedIds: string[]
  notFoundIds: string[]
}

export interface TailorKitProductPersonalizerRepository {
  list(options?: TailorKitProductPersonalizerListOptions): Promise<{
    items: TailorKitIntegrationRecord[]
    total: number
    nextCursor?: string
  }>
  get(id: string): Promise<TailorKitIntegrationRecord | null>
  create(input: TailorKitCreateIntegrationInput): Promise<TailorKitIntegrationRecord>
  update(id: string, input: TailorKitUpdateIntegrationRequest): Promise<TailorKitIntegrationRecord | null>
  publish(id: string): Promise<TailorKitIntegrationRecord | null>
  unpublish(id: string): Promise<TailorKitIntegrationRecord | null>
  deleteMany(ids: string[]): Promise<TailorKitDeleteIntegrationsResult>
}

async function ensureCollections(ports: AppBackendPorts, ctx: AppContext) {
  await Promise.all(tailorkitAppDataCollections.map(definition => ports.appData.registerCollection(ctx, definition)))
}

function matchesFilter(record: TailorKitIntegrationRecord, options: TailorKitProductPersonalizerListOptions) {
  if (record.deletedAt) return false
  if (options.status && record.status !== options.status) return false
  if (options.productId && !record.variants.some(variant => variant.productId === options.productId)) return false
  const keyword = options.q?.trim().toLowerCase()
  if (!keyword) return true
  return [record.title, ...record.variants.map(variant => `${variant.productTitle} ${variant.title}`)]
    .join(' ')
    .toLowerCase()
    .includes(keyword)
}

function normalizeListLimit(limit?: number): number {
  if (limit === undefined) return 50
  return Math.max(1, Math.min(Math.floor(limit), 100))
}

function normalizeListPage(page?: number): number {
  if (page === undefined) return 1
  return Math.max(1, Math.floor(page))
}

function compareBySort(sort?: string) {
  const [field, direction] = (sort || 'updatedAt__desc').split('__')
  const sortField = field === 'createdAt' ? 'createdAt' : 'updatedAt'
  const sortDirection = direction === 'asc' ? 1 : -1

  return (left: TailorKitIntegrationRecord, right: TailorKitIntegrationRecord) =>
    sortDirection * left[sortField].localeCompare(right[sortField])
}

function toStorefrontSnapshotRecord(record: TailorKitIntegrationRecord) {
  if (record.publishSnapshot?.storefront) {
    return { ...record.publishSnapshot.storefront, updatedAt: record.updatedAt }
  }

  return {
    integrationId: record.id,
    title: record.title,
    status: record.status,
    generatedAt: record.updatedAt,
    variants: [],
    mockups: [],
    templates: [],
    printAreas: [],
    updatedAt: record.updatedAt,
  }
}

export function createTailorKitProductPersonalizerRepository(
  ports: AppBackendPorts,
  ctx: AppContext
): TailorKitProductPersonalizerRepository {
  async function put(record: TailorKitIntegrationRecord) {
    await ensureCollections(ports, ctx)
    const editorState = record.draft.editorState
    // The record carries the populated `editorPayload` blob (source of truth the editor reopens).
    // The per-entity collections below are kept because they have LIVE readers:
    // - variant-integrations: editor init `allVariantsIntegrated` + cross-integration variant lookups
    // - templates: the template library list/detail/usage endpoints
    // (mockups/mockup-views/layers have no readers but are cheap, harmless redundancy.)
    await ports.appData.put(ctx, TAILORKIT_INTEGRATION_COLLECTION, record.id, record)
    await Promise.all([
      ...record.variants.map(variant =>
        ports.appData.put(ctx, TAILORKIT_VARIANT_INTEGRATION_COLLECTION, variant.id, {
          ...variant,
          integrationId: record.id,
          updatedAt: record.updatedAt,
        })
      ),
      ...record.mockups.map(mockup =>
        ports.appData.put(ctx, TAILORKIT_MOCKUP_COLLECTION, mockup.id, {
          ...mockup,
          integrationId: record.id,
          updatedAt: record.updatedAt,
        })
      ),
      ...record.templates.map(template =>
        ports.appData.put(ctx, TAILORKIT_TEMPLATE_COLLECTION, template.id, {
          ...template,
          integrationId: record.id,
          updatedAt: record.updatedAt,
        })
      ),
      ...(editorState?.layerIntegrations || []).map(layer =>
        ports.appData.put(ctx, TAILORKIT_LAYER_COLLECTION, layer.id, {
          ...layer,
          integrationId: record.id,
          updatedAt: record.updatedAt,
        })
      ),
      ...(editorState?.mockupViews || []).map(view =>
        ports.appData.put(ctx, TAILORKIT_MOCKUP_VIEW_COLLECTION, view.id, {
          ...view,
          integrationId: record.id,
          updatedAt: record.updatedAt,
        })
      ),
      ports.appData.put(ctx, TAILORKIT_STOREFRONT_SNAPSHOT_COLLECTION, record.id, toStorefrontSnapshotRecord(record)),
    ])
    return record
  }

  return {
    async list(options = {}) {
      await ensureCollections(ports, ctx)
      const limit = normalizeListLimit(options.limit)
      const pageNumber = normalizeListPage(options.page)
      const offset = (pageNumber - 1) * limit
      const items: TailorKitIntegrationRecord[] = []
      let cursor = options.cursor
      let nextCursor: string | undefined

      /**
       * Copied TailorKit ListTable uses page/total semantics, while ScopedAppDataPort exposes cursor pages.
       * Scan a bounded window so filters/sort/pagination are computed without exposing unscoped reads.
       */
      for (let scannedPage = 0; scannedPage < 20; scannedPage += 1) {
        const page = await ports.appData.list<TailorKitIntegrationRecord>(ctx, TAILORKIT_INTEGRATION_COLLECTION, {
          cursor,
          limit: 100,
        })
        items.push(...page.items.map(item => item.value).filter(record => matchesFilter(record, options)))
        nextCursor = page.nextCursor
        cursor = page.nextCursor

        if (!cursor) break
      }

      const sortedItems = items.sort(compareBySort(options.sort))

      return {
        items: sortedItems.slice(offset, offset + limit),
        total: sortedItems.length,
        nextCursor,
      }
    },
    async get(id) {
      await ensureCollections(ports, ctx)
      const record = await ports.appData.get<TailorKitIntegrationRecord>(ctx, TAILORKIT_INTEGRATION_COLLECTION, id)
      return record && !record.deletedAt ? record : null
    },
    async create(input) {
      return put(createTailorKitIntegration(input))
    },
    async update(id, input) {
      let baseRecord = await this.get(id)
      if (!baseRecord) {
        if (!isTailorKitProductEditorSaveRequest(input)) return null
        baseRecord = createTailorKitIntegration(
          createTailorKitCreateInputFromSavePayload(input.tailorkitSavePayload, id)
        )
      }
      const updateInput = isTailorKitProductEditorSaveRequest(input)
        ? createTailorKitUpdateInputFromSavePayload(input.tailorkitSavePayload, baseRecord)
        : input
      return put(updateTailorKitIntegration(baseRecord, updateInput))
    },
    async publish(id) {
      const current = await this.get(id)
      if (!current) return null
      const published = publishTailorKitIntegration(current)
      const staleVariantIds = current.variantIdsPublished.filter(
        variantId => !published.variants.some(variant => variant.id === variantId)
      )
      await publishTailorKitStorefrontMetafields(
        ports,
        ctx,
        published,
        'tailorkit-product-personalizer-publish',
        staleVariantIds
      )
      return put(published)
    },
    async unpublish(id) {
      const current = await this.get(id)
      if (!current) return null
      const unpublished = unpublishTailorKitIntegration(current)
      await publishTailorKitStorefrontMetafields(
        ports,
        ctx,
        unpublished,
        'tailorkit-product-personalizer-unpublish',
        current.variantIdsPublished
      )
      return put(unpublished)
    },
    async deleteMany(ids) {
      await ensureCollections(ports, ctx)
      const deletedIds: string[] = []
      const deletedVariantIds: string[] = []
      const skippedIds: string[] = []
      const notFoundIds: string[] = []
      const uniqueIds = [...new Set(ids.map(id => id.trim()).filter(Boolean))]

      for (const id of uniqueIds) {
        const current = await ports.appData.get<TailorKitIntegrationRecord>(ctx, TAILORKIT_INTEGRATION_COLLECTION, id)

        if (!current || current.deletedAt) {
          notFoundIds.push(id)
          continue
        }

        if (current.status !== 'unpublished' || current.publishedAt) {
          skippedIds.push(id)
          continue
        }

        const deleted = deleteTailorKitIntegration(current)
        const deletedAt = deleted.deletedAt || deleted.updatedAt
        await ports.appData.put(ctx, TAILORKIT_INTEGRATION_COLLECTION, deleted.id, deleted)
        await Promise.all([
          ...current.variants.map(variant =>
            ports.appData.put(ctx, TAILORKIT_VARIANT_INTEGRATION_COLLECTION, variant.id, {
              ...variant,
              integrationId: current.id,
              updatedAt: deletedAt,
              deletedAt,
            })
          ),
          ...current.mockups.map(mockup =>
            ports.appData.put(ctx, TAILORKIT_MOCKUP_COLLECTION, mockup.id, {
              ...mockup,
              integrationId: current.id,
              updatedAt: deletedAt,
              deletedAt,
            })
          ),
          ...current.templates.map(template =>
            ports.appData.put(ctx, TAILORKIT_TEMPLATE_COLLECTION, template.id, {
              ...template,
              integrationId: current.id,
              updatedAt: deletedAt,
              deletedAt,
            })
          ),
          ...(current.draft.editorState?.layerIntegrations || []).map(layer =>
            ports.appData.put(ctx, TAILORKIT_LAYER_COLLECTION, layer.id, {
              ...layer,
              integrationId: current.id,
              updatedAt: deletedAt,
              deletedAt,
            })
          ),
          ...(current.draft.editorState?.mockupViews || []).map(view =>
            ports.appData.put(ctx, TAILORKIT_MOCKUP_VIEW_COLLECTION, view.id, {
              ...view,
              integrationId: current.id,
              updatedAt: deletedAt,
              deletedAt,
            })
          ),
          ports.appData.put(ctx, TAILORKIT_STOREFRONT_SNAPSHOT_COLLECTION, current.id, {
            integrationId: current.id,
            title: current.title,
            status: 'unpublished',
            generatedAt: deletedAt,
            variants: [],
            mockups: [],
            templates: [],
            printAreas: [],
            layerIntegrations: [],
            mockupViews: [],
            deletedAt,
            updatedAt: deletedAt,
          }),
        ])
        if (current.variantIdsPublished.length) {
          await publishTailorKitStorefrontMetafields(
            ports,
            ctx,
            deleted,
            'tailorkit-product-personalizer-delete',
            current.variantIdsPublished
          )
        }
        deletedIds.push(id)
        deletedVariantIds.push(...current.variants.map(variant => variant.id))
      }

      return { deletedIds, deletedVariantIds, skippedIds, notFoundIds }
    },
  }
}
