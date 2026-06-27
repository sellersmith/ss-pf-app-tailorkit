import mongoose from '~/bootstrap/db/connect-db.server'
import type {
  IntegrationDataSaver,
  Integration as IntegrationType,
  VariantIntegration as VariantIntegrationType,
} from '~/types/integration'
import Image from './Image.server'
import Layer from './Layer.server'
import LayerIntegration from './LayerIntegration.server'
import Mockup from './Mockup.server'
import OptionSet from './OptionSet.server'
import PSD from './PSD.server'
import Template from './Template.server'
import VariantIntegration from './VariantIntegration.server'
import PrintArea from './PrintArea.server'
import isEmpty from 'lodash/isEmpty'

type IntegrationDocument = Partial<IntegrationType> & {
  _id: string
  title: string
  variants: string[]
  publishedAt?: Date
  /**
   * Tracks when the integration was last unpublished
   *
   * Used for marketing analytics:
   * - Calculate "Days Active" (unpublishedAt - publishedAt)
   * - Identify churned products (unpublished after being published)
   * - Cohort retention analysis
   *
   * Lifecycle:
   * - Set to current date when unpublishing
   * - Cleared (null) when republishing
   * - null if never unpublished or currently published
   */
  unpublishedAt?: Date | null
  variantIdsPublished?: string[]
  /**
   * PTE (Publish to Earn) Campaign tracking
   *
   * Tracks which campaigns this integration was published during.
   * Used to properly decrement campaign counts when unpublishing.
   *
   * Example flow:
   * 1. Publish during Valentine campaign → pteCampaigns = ['pte-valentine-2026']
   * 2. Unpublish → Read pteCampaigns to know which campaigns to decrement
   * 3. After unpublish → pteCampaigns = [] (cleared)
   *
   * Why needed: If user publishes during Campaign A, then Campaign A ends and Campaign B starts,
   * when user unpublishes we need to know to decrement Campaign A (not Campaign B).
   */
  pteCampaigns?: string[]
  /** Product image dimension mismatch alert — set by PRODUCTS_UPDATE webhook handler */
  dimensionAlert?: {
    detectedAt: Date
    productImageDims: { width: number; height: number }
    setupImageDims: { width: number; height: number }
    productId: string
    mockupViewId: string
  } | null
  shopDomain: string
}

const IntegrationSchema = new mongoose.Schema<Omit<IntegrationDocument, ''>>(
  {
    _id: String,
    title: {
      type: String,
      index: true,
      required: true,
    },
    variants: [
      {
        type: String,
        required: true,
        index: true,
        ref: 'VariantIntegration',
      },
    ],
    config: {
      shouldNotShowModalConfirmPublishAgain: Boolean,
      shouldNotShowModalConfirmRePublishAgain: Boolean,
    },
    publishedAt: {
      type: Date,
      index: true,
    },
    // Marketing analytics - track when unpublished for churn analysis
    unpublishedAt: {
      type: Date,
      index: true,
      default: null,
    },
    // PTE Campaign tracking - stores which campaigns this integration was published during
    // Allows proper decrement when unpublishing (see type definition for details)
    pteCampaigns: {
      type: [String],
      index: true,
      default: [],
    },
    // Product image dimension mismatch alert — set by PRODUCTS_UPDATE webhook handler
    dimensionAlert: {
      type: new mongoose.Schema(
        {
          detectedAt: Date,
          productImageDims: { width: Number, height: Number },
          setupImageDims: { width: Number, height: Number },
          productId: String,
          mockupViewId: String,
        },
        { _id: false }
      ),
      default: null,
    },
    shopDomain: {
      type: String,
      index: true,
    },
    variantIdsPublished: {
      type: [String],
      index: true,
    },
  },
  { _id: false, timestamps: true }
)

// Compound index for analytics queries - optimizes cohort analysis and engagement tracking
IntegrationSchema.index(
  { pteCampaigns: 1, publishedAt: 1, unpublishedAt: 1 },
  { background: true, name: 'pte_analytics_compound' }
)

const Integration = mongoose.models.Integration || mongoose.model('Integration', IntegrationSchema)

export default Integration

export async function upsertIntegration(integration: IntegrationDataSaver['integration'], shopDomain: string) {
  return new Promise((resolve, reject) => {
    // Exclude _id from update data to avoid MongoDB ImmutableField error
    const { _id, ...integrationWithoutId } = integration
    const updateData = { ...integrationWithoutId, shopDomain }

    Integration.findOneAndUpdate({ _id: integration._id }, updateData, { upsert: true })
      .then(value => resolve(value))
      .catch(err => {
        console.error('❌ Integration upsert error:', err.message, { integrationId: integration._id })
        reject(err)
      })
  })
}

export async function getIntegrationById(_id: string, shopDomain: string) {
  const integration = await Integration.findOne({
    _id: _id,
    shopDomain: shopDomain,
  }).populate({
    path: 'variants',
    model: VariantIntegration,
    localField: 'variants',
    foreignField: 'id',
    select: 'id _id',
  })
  const { variants, ...restData } = integration?.toObject() || {}
  const variantIntegrationIds = variants?.map((v: any) => v._id)
  const variantShopifyIds = variants?.map((v: any) => v.id)

  let isAnyTemplateUpdated = false

  // Get templates through activeVariantIntegration field
  if (variantIntegrationIds?.length) {
    const templates = await Template.find({
      shopDomain,
      'activeVariantIntegration._id': { $in: variantIntegrationIds },
    })
      .select('updatedAt')
      .lean()

    // Add templates to integration
    integration.templates = templates
  }

  if (integration?.templates?.length) {
    /**
     * Check if any templates have been updated since the integration's publish date,
     * based on the template's update date and the integration's publish date.
     */
    const lastPublishAtIntegration = integration.publishedAt
    const lastUpdatedAtTemplates = integration.templates.map((t: any) => t.updatedAt)

    isAnyTemplateUpdated
      = lastPublishAtIntegration
      && lastUpdatedAtTemplates.some((updatedAt: any) => new Date(updatedAt) > new Date(lastPublishAtIntegration))
  }

  return { ...restData, isAnyTemplateUpdated, variants: variantShopifyIds }
}

export async function getDetailIntegration(args: {
  _id: string
  shopDomain: string
  populateTemplate?: boolean
  mockupId?: string
}) {
  const { _id, shopDomain, populateTemplate, mockupId } = args

  const templatePopulatePipeline = {
    populate: [
      {
        path: 'psds',
        model: PSD,
      },
      {
        path: 'layers',
        model: Layer,
        populate: [
          {
            path: 'image',
            model: Image,
          },
          {
            path: 'optionSet',
            model: OptionSet,
          },
        ],
      },
    ],
  }

  const integrationDetails = await Integration.findOne({
    _id: _id,
    shopDomain: shopDomain,
  })
    .populate({
      path: 'variants',
      model: VariantIntegration,
      localField: 'variants', // field in IntegrationSchema
      foreignField: 'id', // field in VariantIntegrationSchema
      ...(mockupId ? { match: { mockup: mockupId } } : {}),
      populate: [
        {
          path: 'mockup',
          model: Mockup,
          select: '-denormalizedData,-baseImage,-backgroundImage,-enableClippingMask',
          populate: [
            {
              path: 'layers',
              model: LayerIntegration,
              populate: {
                path: 'data.templateId', // populating templateId in LayerIntegration
                model: Template,
                select: '-activeVariantIntegration',
                ...(populateTemplate ? templatePopulatePipeline : {}),
              },
            },
            {
              path: 'views',
              model: 'MockupView',
              populate: [
                {
                  path: 'layers',
                  model: LayerIntegration,
                },
              ],
            },
          ],
        },
        {
          path: 'printAreas',
          model: PrintArea,
          populate: {
            path: 'template', // populating templateId in print area
            model: Template,
            ...(populateTemplate ? templatePopulatePipeline : {}),
          },
        },
      ],
    })
    .exec()

  if (populateTemplate && integrationDetails) {
    // Get all templates in integration
    const templates = integrationDetails?.variants
      ?.map((v: VariantIntegrationType) =>
        Array.isArray(v?.mockup?.layers) ? v.mockup.layers.map((l: any) => l.data.templateId) : []
      )
      ?.flat()
      .filter(Boolean)

    const templatesUpdatedAtList = templates.map((t: any) => t.updatedAt)
    const isAnyTemplateUpdated
      = integrationDetails.publishedAt
      && templatesUpdatedAtList.some((updatedAt: any) => new Date(updatedAt) > new Date(integrationDetails.publishedAt))

    integrationDetails.isAnyTemplateUpdated = isAnyTemplateUpdated
  }

  return integrationDetails
}

export async function deletedVariantsNotUsed(variantIds: any[], shopDomain?: string) {
  const conditions = shopDomain ? { shopDomain, id: { $in: variantIds } } : { id: { $in: variantIds } }
  await VariantIntegration.deleteMany(conditions)
}

export async function deleteMockupsNotUsed(mockupIds: string[], shopDomain: string) {
  const conditions = shopDomain ? { shopDomain, _id: { $in: mockupIds } } : { _id: { $in: mockupIds } }
  await Mockup.deleteMany(conditions)
}

export async function deleteLayersNotUsed(layerIds: string[], shopDomain: string) {
  const conditions = shopDomain ? { shopDomain, _id: { $in: layerIds } } : { _id: { $in: layerIds } }
  await LayerIntegration.deleteMany(conditions)
}

export async function deletePrintAreasNotUsed(printAreaIds: string[], shopDomain: string) {
  const conditions = shopDomain ? { shopDomain, _id: { $in: printAreaIds } } : { _id: { $in: printAreaIds } }
  await PrintArea.deleteMany(conditions)
}

/**
 * Updates variantIdsPublished field for all published integrations to match their variants array
 * @param shopDomain Optional shop domain to filter integrations
 * @returns Number of integrations updated
 * @throws Error if database operations fail
 */
export async function populateVariantIdsPublished(shopDomain?: string) {
  try {
    // Build query condition
    const query = { publishedAt: { $ne: null }, ...(shopDomain ? { shopDomain } : {}) }

    // Get all published integrations
    const integrations = await Integration.find(query).lean()

    if (isEmpty(integrations)) {
      return
    }

    // Prepare bulk operations
    const bulkOps = integrations.map(integration => ({
      updateOne: {
        filter: { _id: integration._id },
        update: { $set: { variantIdsPublished: integration.variants } },
        timestamps: false,
      },
    }))

    // Execute bulk update
    await Integration.bulkWrite(bulkOps)
  } catch (error) {
    console.error('Failed to populate variantIdsPublished:', error)
    throw error
  }
}

// Add helper to look up published integrations that reference a template via its variant integrations
export async function getPublishedIntegrationsByVariantIds(variantIds: string[], shopDomain: string) {
  if (!variantIds?.length) return []

  const variantIntegrationObjectIds = variantIds.filter(Boolean)

  const variantShopifyIds = await VariantIntegration.find({ _id: { $in: variantIntegrationObjectIds } }, 'id').lean()

  if (!variantShopifyIds.length) return []

  // 3️⃣  Find all integrations that include at least one of these Shopify variant IDs and are published
  return Integration.find(
    {
      shopDomain,
      variants: { $in: variantShopifyIds.map(v => v.id) },
      publishedAt: { $ne: null },
    },
    '_id publishedAt'
  ).lean()
}

// Add helper to look up published integrations that reference a template via its variant integrations
export async function getPublishedIntegrationsOfTemplate(templateId: string, shopDomain: string) {
  // 1️⃣  Fetch the template and get VariantIntegration _ids it references
  const template: any = await Template.findOne({ _id: templateId, shopDomain }, 'activeVariantIntegration').lean()

  if (!template?.activeVariantIntegration?.length) return []

  const variantIntegrationObjectIds = template.activeVariantIntegration
    .map((v: { _id?: string }) => v?._id)
    .filter(Boolean)

  if (!variantIntegrationObjectIds.length) return []

  // 2️⃣  Convert those VariantIntegration _ids → Shopify variant IDs stored in VariantIntegration.id
  const variantDocs = await VariantIntegration.find({ _id: { $in: variantIntegrationObjectIds } }, 'id').lean()

  const variantShopifyIds = variantDocs.map((v: any) => v.id).filter(Boolean)

  if (!variantShopifyIds.length) return []

  // 3️⃣  Find all integrations that include at least one of these Shopify variant IDs and are published
  return Integration.find(
    {
      shopDomain,
      variants: { $in: variantShopifyIds },
      publishedAt: { $ne: null },
    },
    '_id publishedAt'
  ).lean()
}

// async function runDeleteVariantsNotUsedAnyWhere() {
//   // Script check to delete variants that can not be used any integration
//   if (!process.env.DELETED_VARIANTS_NOT_USED) {
//     ;(async function deleteVariantsNotUsedAnyWhere() {
//       const allVariants = await VariantIntegration.find().lean()

//       const integrations = await Integration.find()
//         .populate({
//           path: 'variants',
//           model: VariantIntegration,
//           localField: 'variants', // field in IntegrationSchema
//           foreignField: 'id',
//         })
//         .lean()

//       if (integrations) {
//         const variantsIntegrated = integrations.flatMap(integration => integration.variants)
//         const filteredVariants = allVariants.filter(variant => !variantsIntegrated.find(vI => vI.id === variant.id))
//         const filteredVariantIds: any[] = filteredVariants.map(variant => variant.id) || []

//         if (filteredVariantIds.length) {
//           await deletedVariantsNotUsed(filteredVariantIds)
//         }
//       }
//     })()

//     process.env.DELETED_VARIANTS_NOT_USED = 'yes'
//   }
// }

// Add runDeleteVariantsNotUsedAnyWhere to serverInitiator
// serverInitiator.addInitiator(runDeleteVariantsNotUsedAnyWhere)
