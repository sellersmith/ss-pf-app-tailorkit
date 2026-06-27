import type { ShopDocument } from './Shop'
import type { AssetDocument } from './Asset'
import mongoose from '~/bootstrap/db/connect-db.server'
import Shop, { increaseAssetsMutationPerDay, getShopData } from './Shop.server'
import { uuid } from '~/utils/uuid'
import { canUse } from './PricingPlan.fns'
import { INVALID_REQUEST, INVALID_SHOP_ERROR, MISSING_MODEL_ERROR, OVER_LIMIT_ERROR } from '~/constants/errors'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import overlays from './Asset.define'

const assetSchema = new mongoose.Schema<AssetDocument>(
  {
    name: {
      type: String,
      index: true,
      required: true,
    },
    /**
     * `type` is the asset type, e.g. `clipart`, `thumbnail`, `option-set`, `overlay`, etc.
     */
    type: {
      type: String,
      index: true,
      required: true,
    },
    /**
     * `tags` are keyword to indentify the asset.
     */
    tags: [
      {
        type: String,
        index: true,
      },
    ],
    /**
     * `alias` is a string to identify the asset. Useful when upserting an asset.
     */
    alias: {
      type: String,
      index: true,
    },
    /**
     * `model` is the Mongoose model name, e.g. `Template`, `Thumbnail`, `OptionSet`, etc.
     */
    model: {
      type: String,
      index: true,
    },
    /**
     * `refId` is the ID of the asset in the related model collection
     */
    refId: {
      type: String,
      index: true,
    },
    shopDomain: {
      type: String,
      index: true,
      required: true,
    },
    previewUrl: {
      type: String,
      index: true,
    },
    numberOfUses: {
      type: Number,
      index: true,
    },
    deletedAt: {
      type: Date,
      index: true,
    },
    width: Number,
    height: Number,
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
)

const Asset = mongoose.models.Asset || mongoose.model<AssetDocument>('Asset', assetSchema)

export default Asset

export async function createOrUpdateAsset(
  shopDomain: string,
  assetData: AssetDocument & any,
  options?: any,
  // Some cases, we don't need to upsert to model, e.g. update template of asset store to pre-made template
  upsertToModel = true
) {
  // Get shop usage
  const shopData = await getShopData(shopDomain)

  if (!shopData) {
    throw new Error(INVALID_SHOP_ERROR)
  }

  // Check shop usage
  assetData._id = assetData._id || uuid()
  const isUpdatingAsset = await Asset.findOne({ refId: assetData._id })

  if (!isUpdatingAsset && !canUse({ shopData, feature: 'assets' })) {
    throw new Error(OVER_LIMIT_ERROR)
  }

  // Create or update an asset
  const { name, type, model, ...rest } = assetData

  if (!model) {
    throw new Error(MISSING_MODEL_ERROR)
  }

  const asset = findAssetModel(model)?.findOneAndUpdate(
    { _id: assetData._id, shopDomain },
    { ...rest, name, type },
    { upsert: upsertToModel }
  )

  await Asset.updateOne(
    { refId: assetData._id, shopDomain },
    {
      name,
      type,
      model,
      ...(options || {}),
    },
    { upsert: true }
  )

  // Update shop usage
  if (!isUpdatingAsset) {
    await updateAssetUsage(shopDomain, shopData)
  }

  return asset
}

export async function deleteAssets(shopDomain: string, assetIds: string[], deleteForever = false) {
  // Get shop usage
  const shopData = await getShopData(shopDomain)

  if (!shopData) {
    throw new Error(INVALID_SHOP_ERROR)
  }

  // Get asset data
  const assets = await Asset.find({ refId: { $in: assetIds } })

  if (assets.length) {
    assets.forEach(async asset => {
      const { model } = asset

      // Delete current asset
      if (deleteForever) {
        await findAssetModel(model)?.deleteOne({ shopDomain, _id: asset.refId })
      } else {
        await findAssetModel(model)?.updateOne({ shopDomain, _id: asset.refId }, { deletedAt: new Date() })
      }
    })

    if (deleteForever) {
      await Asset.deleteMany({ shopDomain, refId: { $in: assetIds } })
    } else {
      await Asset.updateMany({ shopDomain, refId: { $in: assetIds } }, { deletedAt: new Date() })
    }

    // Update shop usage
    await updateAssetUsage(shopDomain, shopData)
  }
}

export function findAssetModel(modelName: string) {
  let assetModel = mongoose.models[modelName]

  if (!modelName) {
    // Try to find model by collection name
    for (const p in mongoose.models) {
      if (mongoose.models[p].collection.collectionName === modelName) {
        assetModel = mongoose.models[p]

        break
      }
    }
  }

  return assetModel
}

export async function updateAssetUsage(shopDomain: string, shopData: null | ShopDocument = null) {
  shopData = shopData || (await getShopData(shopDomain))

  if (shopData) {
    const numAssets = await Asset.countDocuments({ shopDomain, deletedAt: null })

    await Shop.updateOne({ shopDomain }, { usages: { ...shopData.usages, assets: numAssets } })
  }
}

async function checkAndRemoveUniqueIndex(modelName: string, fieldName: string) {
  try {
    // Get indexes of the model
    const indexes = await findAssetModel(modelName)?.collection.indexes()

    if (!indexes) {
      return
    }

    // Find index on the fieldName has unique: true
    const fieldIndex = indexes.find(
      index => JSON.stringify(index.key) === JSON.stringify({ [fieldName]: 1 }) && index.unique
    )

    if (fieldIndex) {
      // Drop index unique
      await findAssetModel(modelName)?.collection.dropIndex(fieldIndex.name as string)

      // Create index fieldName without unique
      await findAssetModel(modelName)?.collection.createIndex({ [fieldName]: 1 }, { background: true })
    }
  } catch (error) {
    console.error('Failed to check and remove unique index:', error)
  }
}

// Set maximum request mutate assets per day is 1000
export const MAXIMUM_REQUEST_MUTATE_ASSETS_PER_DAY = 1000

export const validateMaximumRequestMutateAssetsPerDay = async (shop: ShopDocument | string | null) => {
  try {
    if (!shop) {
      throw new Error(INVALID_SHOP_ERROR)
    }

    if (typeof shop === 'string') {
      shop = await getShopData(shop)

      if (!shop) {
        throw new Error(INVALID_SHOP_ERROR)
      }
    }

    // Check if shop request number is larger than limitation or not
    if (shop.usages?.assetsMutationPerDay && shop.usages.assetsMutationPerDay > MAXIMUM_REQUEST_MUTATE_ASSETS_PER_DAY) {
      throw new Error(INVALID_REQUEST)
    }

    return true
  } catch (e) {
    throw new Error(formatErrorMessage(e))
  }
}

/**
 * 1. Evaluate the request if user can create more in a day
 * 2. Count request number each store
 *
 * Request number will be reset to 0 each day
 *
 * @param shopDomain string
 */
export const evaluateRequestForMutatingAssets = async (shopDomain: string, incNumber?: number) => {
  try {
    await validateMaximumRequestMutateAssetsPerDay(shopDomain)

    // Count request number
    await increaseAssetsMutationPerDay(shopDomain, incNumber)
  } catch (e) {
    throw new Error(formatErrorMessage(e))
  }
}

export async function runCreateLibraryAssets() {
  /**
   * The refId field is unique in the Asset collection before.
   * But now, it's not unique anymore.
   * So, we need to check and remove unique index on refId.
   */
  if (!process.env.CHECK_AND_REMOVE_UNIQUE_INDEX_ON_REF_ID) {
    await checkAndRemoveUniqueIndex('Asset', 'refId')

    process.env.CHECK_AND_REMOVE_UNIQUE_INDEX_ON_REF_ID = 'yes'
  }

  // Create assets from existing option sets and cliparts
  if (!process.env.CREATED_LIBRARY_ASSETS) {
    // Import built-in overlays.
    for (const overlay of overlays) {
      const { alias, ...rest } = overlay

      await Asset.updateOne({ alias }, rest, { upsert: true })
    }

    process.env.CREATED_LIBRARY_ASSETS = 'yes'
  }
}

export async function fallbackStoreAssetDomain() {
  // Create store asset
  if (!process.env.STORE_ASSET_DOMAIN) {
    // On development server, I should create an own store asset instead of getting default sample store asset
    // This is a fallback for production server
    process.env.STORE_ASSET_DOMAIN = 'sample-store-tailorkit.myshopify.com'
  }
}

// Add runCreateLibraryAssets to serverInitiator
// serverInitiator.addInitiator(fallbackStoreAssetDomain)
