import type { ShopDocument } from './Shop'
import mongoose from '~/bootstrap/db/connect-db.server'
import PSD from './PSD.server'
import Layer from './Layer.server'
import Image from '~/models/Image.server'
import OptionSet from './OptionSet.server'
import Shop, { getShopData } from './Shop.server'
import { uuid } from '~/utils/uuid'
import { canUse } from './PricingPlan.fns'
import { isClipart, isStoreAsset, TEMPLATE_TYPE } from '~/routes/api.templates/constants'
import { createOrUpdateAsset, deleteAssets } from './Asset.server'
import { CUSTOMERIO_EVENTS } from '~/modules/customer.io/constants'
import { postEventToCustomerIo } from '~/modules/customer.io/api.server'
import { INVALID_SHOP_ERROR, OVER_LIMIT_ERROR } from '~/constants/errors'
import { updateUserMilestoneIfShopHasCreatedTemplate } from '~/routes/api.user-journey/journeys/achieve-first-sale/fns.server'

const TemplateSchema = new mongoose.Schema(
  {
    _id: String,
    name: {
      type: String,
      index: true,
    },
    dimension: {
      width: { type: Number },
      height: { type: Number },
      measurementUnit: { type: String },
      resolution: { type: Number },
    },
    previewUrl: {
      type: String,
      index: true,
    },
    thumbnailUrl: {
      type: String,
    },
    psds: [
      {
        type: String,
        ref: 'PSD',
      },
    ],
    layers: [
      {
        type: String,
        ref: 'Layer',
      },
    ],
    previewProductImage: {
      type: Object,
      default: null,
    },
    type: {
      type: String,
      index: true,
      enum: Object.values(TEMPLATE_TYPE),
      default: TEMPLATE_TYPE.TEMPLATE,
    },
    /**
     * The category of the template
     * If a template has category, it means that the template is a public clipart
     */
    category: {
      type: String,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    // The shop domain that owns the template
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    activeVariantIntegration: [
      {
        _id: String,
        productId: String,
      },
    ],
    metadata: {
      useAiFeature: { type: Boolean, default: false },
      templateDescription: {
        content: { type: String },
        createdAt: { type: Date },
      },
    },
  },
  { _id: false, timestamps: true, strict: false }
)

const Template = mongoose.models.Template || mongoose.model('Template', TemplateSchema)

export const getTemplateDetails = async (args: { ids: string[]; shopDomain: string }) => {
  const { ids, shopDomain } = args

  if (ids.length > 0) {
    const templates = await Template.find(
      { shopDomain, _id: { $in: ids } },
      'name psds layers dimension previewUrl thumbnailUrl previewProductImage type category activeVariantIntegration createdAt'
    )
      .populate({
        path: 'psds',
        model: PSD,
      })
      .populate({
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
      })
      .lean()

    const _templates = []
    // Migrate template if needed
    if (templates && templates.length > 0) {
      for (let template of templates) {
        if (!template.layers?.length && template.psds?.length) {
          // Migrate layer data from PSD documents to template document
          template.layers = template.psds.reduce((layers: string[], psd: any) => layers.concat(psd.layers), [])

          await template.save()

          // Repopulate layer data
          template = Object.assign(
            template.toObject(),
            (
              await Template.findOne({ shopDomain, _id: template._id }, 'layers').populate({
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
              })
            ).toObject()
          )
        }
        template.isFromTailorkit = isStoreAsset(shopDomain)
        _templates.push(template)
      }

      // Get mockups using the template
    }

    return _templates
  }

  return []
}

export default Template

export async function createTemplateOrClipart(shopDomain: string, templateData: any) {
  let isFirstTemplate = false

  // Get shop usage
  const shopData = await getShopData(shopDomain)

  if (!shopData) {
    throw new Error(INVALID_SHOP_ERROR)
  }

  // Create a new template or clipart
  templateData._id = templateData._id || uuid()

  const isClipartType = isClipart(templateData.type)
  const isPremadeTemplateType = isStoreAsset(shopDomain)

  if (isClipartType || isPremadeTemplateType) {
    const templateType = isClipartType ? TEMPLATE_TYPE.CLIPART : TEMPLATE_TYPE.TEMPLATE
    const assetData = {
      previewUrl: templateData.previewUrl,
      ...(isClipartType ? { numberOfUses: 1 } : { type: TEMPLATE_TYPE.PREMADE_TEMPLATE }),
    }

    // Create new clipart
    await createOrUpdateAsset(
      shopDomain,
      {
        ...templateData,
        // Pass empty/Reset activeVariantIntegration array
        activeVariantIntegration: [],
        model: 'Template',
        type: templateType,
        shopDomain,
      },
      assetData
    )
  } else {
    // Check shop usage
    if (!canUse({ shopData, feature: 'templates' })) {
      throw new Error(OVER_LIMIT_ERROR)
    }

    // Create new template
    const template = await Template.create({
      ...templateData,
      // Pass empty/Reset activeVariantIntegration array
      activeVariantIntegration: [],
      shopDomain,
    })

    // Update shop usage
    await updateTemplateUsage(shopDomain, shopData)

    const occurredEvents = shopData?.appConfig?.occurredEvents || {}

    // Check if this is the first template created
    if (!occurredEvents[CUSTOMERIO_EVENTS.CREATED_FIRST_TEMPLATE]) {
      // Send created_first_template event to customer.io
      postEventToCustomerIo({
        shopDomain,
        noDuplicate: true,
        eventData: { createdAt: template.createdAt },
        eventName: CUSTOMERIO_EVENTS.CREATED_FIRST_TEMPLATE,
      }).catch(console.error)

      // Add user milestone
      updateUserMilestoneIfShopHasCreatedTemplate(shopData).catch(console.error)
      isFirstTemplate = true
    }
  }

  return { isFirstTemplate, templateId: templateData._id }
}

export async function deleteTemplatesOrCliparts(args: {
  shopDomain: string
  templateIds: string[]
  layerIds: string[]
  psdIds: string[]
  deleteForever?: boolean
}) {
  const { shopDomain, templateIds, layerIds = [], psdIds = [], deleteForever = false } = args

  // Get shop usage
  const shopData = await getShopData(shopDomain)

  if (!shopData) {
    throw new Error(INVALID_SHOP_ERROR)
  }

  // Delete cliparts
  await deleteAssets(shopDomain, templateIds, deleteForever)

  // Delete templates
  if (deleteForever) {
    await Template.deleteMany({ shopDomain, _id: { $in: templateIds } })
    await Layer.deleteMany({ shopDomain, _id: { $in: layerIds } })
    await PSD.deleteMany({ shopDomain, _id: { $in: psdIds } })
  } else {
    await Template.updateMany({ shopDomain, _id: { $in: templateIds } }, { deletedAt: new Date() })
    await Layer.updateMany({ shopDomain, _id: { $in: layerIds } }, { deletedAt: new Date() })
    await PSD.updateMany({ shopDomain, _id: { $in: psdIds } }, { deletedAt: new Date() })
  }

  // Update shop usage
  await updateTemplateUsage(shopDomain, shopData)
}

export async function updateTemplateUsage(shopDomain: string, shopData: null | ShopDocument = null) {
  shopData = shopData || (await getShopData(shopDomain))

  if (shopData) {
    const numTemplates = await Template.countDocuments({ shopDomain, type: TEMPLATE_TYPE.TEMPLATE, deletedAt: null })

    await Shop.updateOne({ shopDomain }, { usages: { ...shopData.usages, templates: numTemplates } })
  }
}

/**
 * Clone a clipart template to a user's own account
 * This is a convenience function that can be used throughout the application
 * @param clipartId - The ID of the clipart template to clone
 * @param targetShopDomain - The shop domain to clone the template to
 * @returns Object containing the new template information
 */
export async function cloneClipartTemplate(clipartId: string, targetShopDomain: string) {
  // Import the cloning function to avoid circular dependencies
  const { cloneClipartToTemplate } = await import('~/routes/api.templates/fns.server')

  return cloneClipartToTemplate(clipartId, targetShopDomain)
}
