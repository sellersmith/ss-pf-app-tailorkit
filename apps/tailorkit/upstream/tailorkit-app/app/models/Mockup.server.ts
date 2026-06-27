import type { UpdateQuery } from 'mongoose'
import mongoose from '~/bootstrap/db/connect-db.server'
import type { IntegrationDataSaver, MockUp as MockUpType } from '~/types/integration'
import LayerIntegration from './LayerIntegration.server'
import Template from './Template.server'
import VariantIntegration from './VariantIntegration.server'

type MockupDocument = Partial<MockUpType> & {
  _id: string
  label?: string
  baseImage?: {
    url: string
    width: number
    height: number
    altText: string
  }
  layers?: string[]
  shopDomain: string
}

export interface DenormalizedData {
  variants: Array<{
    _id: string
    productId: string
    id: string
  }>
  templates: Array<{
    _id: string
    name: string
    alias?: string
    isHidden?: boolean
  }>
  integration: {
    _id: string
    name: string
  } | null
}

const MockupSchema = new mongoose.Schema<Omit<MockupDocument, ''>>(
  {
    _id: String,
    label: {
      type: String,
      index: true,
    },
    storefrontLabel: {
      type: String,
      index: true,
    },
    variantLabel: {
      type: String,
      index: true,
    },
    // @deprecated
    baseImage: {
      url: {
        type: String,
        index: true,
      },
      width: Number,
      height: Number,
      altText: String,
    },
    // @deprecated
    backgroundImage: {
      url: {
        type: String,
        index: true,
      },
      width: Number,
      height: Number,
      altText: String,
    },
    // @deprecated
    enableClippingMask: Boolean,
    layers: [
      {
        type: String,
        index: true,
        ref: 'LayerIntegration',
      },
    ],
    views: [
      {
        type: String,
        index: true,
        ref: 'MockupView',
      },
    ],
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    /**
     * @deprecated
     */
    disintegratedAt: {
      type: Date,
      index: true,
    },
    denormalizedData: {
      variants: [
        {
          _id: {
            type: String,
            index: true,
          },
          productId: {
            type: String,
            index: true,
          },
          id: {
            type: String,
            index: true,
          },
        },
      ],
      templates: [
        {
          _id: {
            type: String,
            index: true,
          },
          name: {
            type: String,
            index: true,
          },
        },
      ],
      integration: {
        _id: {
          type: String,
          index: true,
        },
        name: {
          type: String,
          index: true,
        },
      },
    },
    // Metadata for caching AI suggestions and future extensions
    // fontCombinationSuggestions is a Map keyed by mockupId:productId (e.g., "mockup-123:product-456")
    // Canvas only renders with first variant, so all variants share the same cache
    metadata: {
      fontCombinationSuggestions: {
        type: Map,
        of: {
          clipartIds: [String],
          generatedAt: Number,
          productId: String, // Track productId for webhook invalidation
          variantHash: String, // Track integrated variant set; invalidate cache when variant set changes
          reasoning: String, // Optional reasoning for why these suggestions were chosen
        },
      },
    },
  },
  { _id: false, timestamps: true, strict: false }
)

// Pre middleware – save update info
MockupSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate() as UpdateQuery<typeof this.model.schema.obj>
  const disintegratedAt = update?.$set?.disintegratedAt ?? update?.disintegratedAt
  const isDisintegrated = disintegratedAt !== undefined

  // Save to context to use in post hook
  ;(this as any)._isDisintegratedUpdate = isDisintegrated
})

// Post middleware – only update if disintegratedAt is set
MockupSchema.post('findOneAndUpdate', async function (doc) {
  const isDisintegrated = (this as any)._isDisintegratedUpdate

  // Only update if disintegratedAt is set and there are layers and shopDomain
  if (!isDisintegrated || !doc?.layers?.length || !doc.shopDomain) {
    return
  }

  // Get all templates that have layers from this mockup
  const templates = await LayerIntegration.distinct('data.templateId', {
    _id: { $in: doc.layers },
    shopDomain: doc.shopDomain,
  })

  const affectedTemplates = [...new Set(templates)]

  for (const templateId of affectedTemplates) {
    if (templateId) {
      await updateTemplateActiveVariantsFromMockup(templateId)
    }
  }
})

const Mockup = mongoose.models.Mockup || mongoose.model('Mockup', MockupSchema)

export default Mockup

// Helper function to update activeVariantIntegration from mockup
export async function updateTemplateActiveVariantsFromMockup(templateId: string) {
  // First get template's shopDomain
  const template = await Template.findOne({ _id: templateId }, { shopDomain: 1 })
  if (!template?.shopDomain) return

  const activeVariants = await Mockup.aggregate([
    // Match mockups that have layers from this template
    {
      $match: {
        shopDomain: template.shopDomain,
        layers: {
          $in: await LayerIntegration.distinct('_id', {
            'data.templateId': templateId,
            shopDomain: template.shopDomain,
          }),
        },
      },
    },
    {
      $project: {
        _id: 1,
        disintegratedAt: 1,
      },
    },
    // Match only active mockups
    {
      $match: {
        disintegratedAt: null,
      },
    },
    {
      $lookup: {
        from: VariantIntegration.collection.collectionName,
        let: { mockupId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$mockup', '$$mockupId'] },
            },
          },
          {
            $project: {
              _id: 1,
              productId: 1,
            },
          },
        ],
        as: 'variants',
      },
    },
    {
      $unwind: '$variants',
    },
    // Project to get variant fields
    {
      $project: {
        _id: '$variants._id',
        productId: '$variants.productId',
      },
    },
    // Group to remove duplicates
    {
      $group: {
        _id: '$_id',
        productId: { $first: '$productId' },
      },
    },
  ])

  await Template.updateOne(
    { _id: templateId },
    { $set: { activeVariantIntegration: activeVariants } },
    { timestamps: false }
  )
}

// Batch helper: recompute activeVariantIntegration for a list of templateIds
export async function recomputeTemplatesActiveVariants(templateIds: string[]) {
  const uniqueIds = [...new Set((templateIds || []).filter(Boolean))]
  for (const templateId of uniqueIds) {
    await updateTemplateActiveVariantsFromMockup(templateId)
  }
}

export async function upsertMockup(mockup: IntegrationDataSaver['mockups'][0], shopDomain: string) {
  return new Promise((resolve, reject) => {
    // Exclude _id from update data to avoid MongoDB ImmutableField error
    const { _id, ...mockupWithoutId } = mockup
    const updateData = { ...mockupWithoutId, shopDomain, disintegratedAt: null }

    Mockup.findOneAndUpdate({ _id: mockup._id }, updateData, { upsert: true, new: true })
      .then(value => resolve(value))
      .catch(err => {
        console.error('❌ Mockup upsert error:', err.message, { mockupId: mockup._id })
        reject(err)
      })
  })
}
