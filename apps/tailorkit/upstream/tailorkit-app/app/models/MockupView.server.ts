import mongoose from '~/bootstrap/db/connect-db.server'
import Mockup from './Mockup.server'
import LayerIntegration from './LayerIntegration.server'
import { uuid } from '~/utils/uuid'
import type { IntegrationDataSaver, ViewLayerOverride } from '~/types/integration'

export type MockupViewDocument = {
  _id: string
  title: string
  mockup: string
  baseImage?: {
    url: string
    width: number
    height: number
    altText?: string
  }
  backgroundImage?: {
    url: string
    width: number
    height: number
    altText?: string
  }
  maskImage?: {
    url: string
    width: number
    height: number
    altText?: string
  }
  enableClippingMask?: boolean
  layers: string[]
  overrides: Record<string, ViewLayerOverride>
  shopDomain: string
}

const LayerOverrideSchema = new mongoose.Schema<ViewLayerOverride>(
  {
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    rotation: Number,
    visible: Boolean,
    mask: {
      x: Number,
      y: Number,
      width: Number,
      height: Number,
      rotation: Number,
      _id: false,
    },
  },
  { _id: false }
)

const MockupViewSchema = new mongoose.Schema<MockupViewDocument>(
  {
    _id: String,
    title: {
      type: String,
      index: true,
      required: true,
    },
    mockup: {
      type: String,
      index: true,
      required: true,
      ref: 'Mockup',
    },
    baseImage: {
      url: { type: String, index: true },
      width: Number,
      height: Number,
      altText: String,
    },
    backgroundImage: {
      url: { type: String, index: true },
      width: Number,
      height: Number,
      altText: String,
    },
    maskImage: {
      url: { type: String, index: true },
      width: Number,
      height: Number,
      altText: String,
    },
    enableClippingMask: Boolean,
    layers: [
      {
        type: String,
        index: true,
        ref: 'LayerIntegration',
      },
    ],
    overrides: {
      type: Map,
      of: LayerOverrideSchema,
      default: {},
    },
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
  },
  { _id: false, timestamps: true }
)

const MockupView = mongoose.models.MockupView || mongoose.model('MockupView', MockupViewSchema)

export default MockupView

/**
 * Bulk upsert mockup views as provided from frontend payload.
 * Keeps logic minimal: exactly set provided fields, sanitize arrays, and enforce shopDomain.
 */
export async function bulkUpsertMockupViews(
  views: NonNullable<IntegrationDataSaver['mockupViews']>,
  shopDomain: string
) {
  if (!Array.isArray(views) || views.length === 0) return

  const operations = views.map(v => {
    const { _id: viewId, ...rest } = v as any
    const safeLayers = Array.isArray((v as any).layers) ? (v as any).layers.filter(Boolean) : []

    return {
      updateOne: {
        filter: { _id: viewId },
        update: {
          $set: {
            ...rest,
            layers: safeLayers,
            shopDomain,
          },
          $setOnInsert: { _id: viewId },
        },
        upsert: true,
        timestamps: false,
      },
    }
  })

  if (operations.length > 0) {
    await (MockupView as any).bulkWrite(operations)
  }
}

/**
 * Update `Mockup.views` ordering for all affected mockups based on provided views.
 * It groups view ids by their parent mockup and writes ordering exactly as provided.
 */
export async function updateMockupViewsOrdering(views: NonNullable<IntegrationDataSaver['mockupViews']>) {
  if (!Array.isArray(views) || views.length === 0) return

  const mockupToViews = new Map<string, string[]>()
  for (const v of views) {
    const mockupId = (v as any)?.mockup
    const viewId = (v as any)?._id
    if (!mockupId || !viewId) continue
    const list = mockupToViews.get(mockupId) || []
    list.push(viewId)
    mockupToViews.set(mockupId, list)
  }

  const ops = Array.from(mockupToViews.entries()).map(([mockupId, viewIds]) => ({
    updateOne: {
      filter: { _id: mockupId },
      update: { $set: { views: viewIds } },
      timestamps: false,
    },
  }))

  if (ops.length > 0) {
    await (Mockup as any).bulkWrite(ops)
  }
}

export async function migrateMockupsToViews() {
  try {
    if (process.env.MIGRATE_MOCKUPS_TO_VIEWS === 'yes') return
    console.log('🔄 Starting migrateMockupsToViews...')
    console.time('migrateMockupsToViews')

    const batchSize = 200
    const filter: Record<string, unknown> = {
      $or: [{ views: { $exists: false } }, { views: { $size: 0 } }],
    }

    const projection = {
      _id: 1,
      baseImage: 1,
      maskImage: 1,
      backgroundImage: 1,
      enableClippingMask: 1,
      layers: 1,
      shopDomain: 1,
      label: 1,
      views: 1,
    }

    const cursor = (Mockup as any).find(filter, projection).lean().cursor()

    // Stream over matching mockups; do not load entire collection into memory

    let toInsert: any[] = []
    let toUpdate: any[] = []
    let toUpdateLayerTypes: any[] = []

    for await (const m of cursor) {
      // Build layer docs once; needed both for inserting a first view and for legacy mask fixes
      const layerIds: string[] = Array.isArray(m.layers) ? m.layers.filter(Boolean) : []
      const layerDocs = layerIds.length
        ? await LayerIntegration.find(
            { _id: { $in: layerIds } },
            {
              _id: 1,
              x: 1,
              y: 1,
              width: 1,
              height: 1,
              rotation: 1,
              type: 1,
              name: 1,
              'data.src': 1,
              'data.alt': 1,
              'mask.x': 1,
              'mask.y': 1,
              'mask.width': 1,
              'mask.height': 1,
              'mask.rotation': 1,
            }
          ).lean()
        : []

      // Skip inserting a first view if one already exists, but still fix legacy mask image layers
      const hasExistingView = await MockupView.exists({ mockup: m._id })
      const shouldInsertFirstView = !hasExistingView

      const viewId = uuid()

      const overrides = (layerDocs || []).reduce(
        (acc: Record<string, ViewLayerOverride>, ld: any) => {
          const base: ViewLayerOverride = {
            x: typeof ld.x === 'number' ? ld.x : undefined,
            y: typeof ld.y === 'number' ? ld.y : undefined,
            width: typeof ld.width === 'number' ? ld.width : undefined,
            height: typeof ld.height === 'number' ? ld.height : undefined,
            rotation: typeof ld.rotation === 'number' ? ld.rotation : undefined,
          }

          // When legacy clipping was enabled, carry over mask geometry into overrides
          if (m.enableClippingMask && ld?.mask) {
            base.mask = ld.mask
          }

          acc[ld._id] = base
          return acc
        },
        {} as Record<string, ViewLayerOverride>
      )

      // Derive legacy mask image from the first unnamed image layer (old behavior)
      const legacyMaskLayer = (layerDocs || []).find(
        (ld: any) => ld?.type === 'image' && (!ld?.name || String(ld.name).trim() === '') && ld?.data?.src
      )

      const maskImage = legacyMaskLayer
        ? {
            url: legacyMaskLayer.data.src as string,
            width: legacyMaskLayer.width,
            height: legacyMaskLayer.height,
            altText: legacyMaskLayer.data.alt as string | undefined,
          }
        : undefined

      if (shouldInsertFirstView) {
        toInsert.push({
          _id: viewId,
          title: m.label || 'View 1',
          mockup: m._id,
          baseImage: m.baseImage,
          ...(maskImage ? { maskImage } : {}),
          backgroundImage: m.backgroundImage,
          enableClippingMask: m.enableClippingMask,
          layers: layerIds,
          overrides,
          shopDomain: m.shopDomain,
        })

        toUpdate.push({
          updateOne: {
            filter: { _id: m._id },
            update: { $set: { views: [viewId] } },
            timestamps: false,
          },
        })
      }

      // If we found a legacy mask image layer, migrate its type to 'mask' (geometry layer)
      if (legacyMaskLayer?._id && legacyMaskLayer.type !== 'mask') {
        toUpdateLayerTypes.push({
          updateOne: {
            filter: { _id: legacyMaskLayer._id },
            update: { $set: { type: 'mask', name: legacyMaskLayer.name || 'Mask layer' } },
            timestamps: false,
          },
        })
      }

      if (toInsert.length >= batchSize) {
        if (toInsert.length) {
          await MockupView.insertMany(toInsert, { ordered: false })
        }
        if (toUpdate.length) {
          await (Mockup as any).bulkWrite(toUpdate)
        }
        if (toUpdateLayerTypes.length > 0) {
          await (LayerIntegration as any).bulkWrite(toUpdateLayerTypes)
        }
        toInsert = []
        toUpdate = []
        toUpdateLayerTypes = []
      }
    }

    if (toInsert.length > 0) {
      await MockupView.insertMany(toInsert, { ordered: false })
    }
    if (toUpdate.length > 0) {
      await (Mockup as any).bulkWrite(toUpdate)
    }
    if (toUpdateLayerTypes.length > 0) {
      await (LayerIntegration as any).bulkWrite(toUpdateLayerTypes)
    }
  } catch (e) {
    console.error('Failed to migrate mockups to views:', e)
  }
  console.log('🔄 migrateMockupsToViews completed')
  console.timeEnd('migrateMockupsToViews')
  process.env.MIGRATE_MOCKUPS_TO_VIEWS = 'yes'
}
