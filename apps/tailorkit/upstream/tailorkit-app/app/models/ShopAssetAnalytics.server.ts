import mongoose from '~/bootstrap/db/connect-db.server'
import type { ClickContext } from './ClipartClickEvent'
import { AssetType } from './ClipartClickEvent'
import type { SortOrder } from 'mongoose'

export interface ShopAssetAnalyticsDocument {
  shopDomain: string
  assetId: string
  assetType: AssetType

  // Shop information for filtering
  shopEmail?: string
  shopOwner?: string

  // Aggregated metrics
  totalClicks: number
  clicksByContext: Record<string, number>

  // Time-based metrics
  firstClickedAt: Date
  lastClickedAt: Date

  updatedAt?: Date
  createdAt?: Date
}

const ShopAssetAnalyticsSchema = new mongoose.Schema<ShopAssetAnalyticsDocument>(
  {
    shopDomain: {
      type: String,
      required: true,
      index: true,
    },
    assetId: {
      type: String,
      required: true,
      index: true,
    },
    assetType: {
      type: String,
      required: true,
      enum: Object.values(AssetType),
      default: AssetType.CLIPART,
      index: true,
    },

    // Shop information for filtering
    shopEmail: {
      type: String,
      index: true,
    },
    shopOwner: {
      type: String,
      index: true,
    },

    // Aggregated metrics
    totalClicks: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
    clicksByContext: {
      type: Map,
      of: Number,
      default: {},
    },

    // Time-based metrics
    firstClickedAt: {
      type: Date,
      required: true,
      index: true,
    },
    lastClickedAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
)

// Compound indexes
ShopAssetAnalyticsSchema.index({ shopDomain: 1, assetId: 1 }, { unique: true })
ShopAssetAnalyticsSchema.index({ shopDomain: 1, totalClicks: -1 })
ShopAssetAnalyticsSchema.index({ assetId: 1, totalClicks: -1 })
ShopAssetAnalyticsSchema.index({ shopDomain: 1, lastClickedAt: -1 })
ShopAssetAnalyticsSchema.index({ shopEmail: 1, totalClicks: -1 })

const ShopAssetAnalyticsModel
  = mongoose.models.ShopAssetAnalytics
  || mongoose.model<ShopAssetAnalyticsDocument>('ShopAssetAnalytics', ShopAssetAnalyticsSchema)

export default ShopAssetAnalyticsModel

/**
 * Increment click count for a shop-asset combination
 * @param shopDomain - Shop domain
 * @param assetId - Asset ID
 * @param assetType - Asset type
 * @param context - Click context
 * @param shopInfo - Optional shop information (email, owner)
 */
export async function incrementShopAssetClick(
  shopDomain: string,
  assetId: string,
  assetType: AssetType,
  context: ClickContext,
  shopInfo?: { email?: string; owner?: string }
): Promise<void> {
  try {
    const now = new Date()

    const updateData: any = {
      $inc: {
        totalClicks: 1,
        [`clicksByContext.${context}`]: 1,
      },
      $set: {
        lastClickedAt: now,
      },
      $setOnInsert: {
        firstClickedAt: now,
      },
    }

    // Add shop info if provided
    if (shopInfo) {
      if (shopInfo.email) {
        updateData.$set.shopEmail = shopInfo.email
      }
      if (shopInfo.owner) {
        updateData.$set.shopOwner = shopInfo.owner
      }
    }

    await ShopAssetAnalyticsModel.findOneAndUpdate({ shopDomain, assetId, assetType }, updateData, {
      upsert: true,
      new: true,
    })
  } catch (error) {
    console.error('[ShopAssetAnalytics] Failed to increment shop asset click:', error)
  }
}

/**
 * Get top clicked assets for a shop
 */
export async function getTopAssetsForShop(
  shopDomain: string,
  options: {
    assetType?: AssetType
    limit?: number
    sortBy?: 'totalClicks' | 'lastClickedAt'
  } = {}
): Promise<ShopAssetAnalyticsDocument[]> {
  try {
    const { assetType, limit = 10, sortBy = 'totalClicks' } = options

    const filter: Record<string, unknown> = { shopDomain }
    if (assetType) filter.assetType = assetType

    const sortField: Record<string, SortOrder> = sortBy === 'totalClicks' ? { totalClicks: -1 } : { lastClickedAt: -1 }

    const assets = await ShopAssetAnalyticsModel.find(filter)
      .sort(sortField)
      .limit(limit)
      .lean<ShopAssetAnalyticsDocument[]>()

    return assets
  } catch (error) {
    console.error('[ShopAssetAnalytics] Failed to get top assets for shop:', error)
    return []
  }
}

/**
 * Get analytics for a specific asset in a shop
 */
export async function getShopAssetAnalytics(
  shopDomain: string,
  assetId: string
): Promise<ShopAssetAnalyticsDocument | null> {
  try {
    const analytics = await ShopAssetAnalyticsModel.findOne({ shopDomain, assetId }).lean<ShopAssetAnalyticsDocument>()

    return analytics
  } catch (error) {
    console.error('[ShopAssetAnalytics] Failed to get shop asset analytics:', error)
    return null
  }
}

/**
 * Get click distribution by context for a shop
 */
export async function getShopClickDistribution(
  shopDomain: string,
  assetType?: AssetType
): Promise<{ context: string; clicks: number }[]> {
  try {
    const filter: Record<string, unknown> = { shopDomain }
    if (assetType) filter.assetType = assetType

    const result = await ShopAssetAnalyticsModel.aggregate([
      { $match: filter },
      {
        $project: {
          clicksByContext: { $objectToArray: '$clicksByContext' },
        },
      },
      { $unwind: '$clicksByContext' },
      {
        $group: {
          _id: '$clicksByContext.k',
          clicks: { $sum: '$clicksByContext.v' },
        },
      },
      { $sort: { clicks: -1 } },
    ])

    return result.map(item => ({
      context: item._id,
      clicks: item.clicks,
    }))
  } catch (error) {
    console.error('[ShopAssetAnalytics] Failed to get shop click distribution:', error)
    return []
  }
}
