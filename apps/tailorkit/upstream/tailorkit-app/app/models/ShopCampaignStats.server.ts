import mongoose from '~/bootstrap/db/connect-db.server'
import type { ShopCampaignStatsDocument } from './ShopCampaignStats'
import type { CampaignAnalytics } from '~/types/campaign-analytics'
import { PTE_BADGE_BOUNDARIES } from '~/bootstrap/constants/achievements'

const shopCampaignStatsSchema = new mongoose.Schema<ShopCampaignStatsDocument>(
  {
    shopDomain: {
      type: String,
      required: true,
      index: true,
    },
    campaignId: {
      type: String,
      required: true,
      index: true,
    },
    currentPublishedCount: {
      type: Number,
      required: true,
      default: 0,
    },
    peakPublishedCount: {
      type: Number,
      required: true,
      default: 0,
    },
    firstPublishedAt: Date,
    lastPublishedAt: Date,
  },
  {
    timestamps: true,
    collection: 'shop_campaign_stats',
  }
)

// Compound unique index for fast lookups
shopCampaignStatsSchema.index({ shopDomain: 1, campaignId: 1 }, { unique: true, background: true })

// Index for analytics queries by campaign
shopCampaignStatsSchema.index({ campaignId: 1, peakPublishedCount: 1 }, { background: true })
shopCampaignStatsSchema.index({ campaignId: 1, currentPublishedCount: 1 }, { background: true })

const ShopCampaignStats
  = mongoose.models.ShopCampaignStats
  || mongoose.model<ShopCampaignStatsDocument>('ShopCampaignStats', shopCampaignStatsSchema)

export default ShopCampaignStats

/**
 * Get or create campaign stats for a shop
 * Creates document if it doesn't exist
 */
export async function getOrCreateCampaignStats(
  shopDomain: string,
  campaignId: string
): Promise<ShopCampaignStatsDocument> {
  const stats = await ShopCampaignStats.findOneAndUpdate(
    { shopDomain, campaignId },
    {
      $setOnInsert: {
        currentPublishedCount: 0,
        peakPublishedCount: 0,
      },
    },
    { upsert: true, new: true }
  )

  return stats
}

/**
 * Increment campaign counts when publishing a product
 * Uses atomic aggregation pipeline to prevent race conditions
 *
 * IMPORTANT: This function is designed to handle concurrent requests safely.
 * The aggregation pipeline ensures that increment and max calculations
 * happen atomically in the database, preventing data loss from race conditions.
 */
export async function incrementCampaignCounts(
  shopDomain: string,
  campaignId: string,
  publishedAt: Date
): Promise<void> {
  // ✅ ATOMIC UPDATE - Using MongoDB aggregation pipeline
  // This prevents race conditions when multiple requests publish simultaneously
  await ShopCampaignStats.findOneAndUpdate(
    { shopDomain, campaignId },
    [
      {
        $set: {
          // Increment current count atomically in database
          currentPublishedCount: {
            $cond: {
              if: { $gt: ['$currentPublishedCount', null] },
              then: { $add: ['$currentPublishedCount', 1] },
              else: 1,
            },
          },
          lastPublishedAt: publishedAt,
          // Set firstPublishedAt only on first publish (if not already set)
          // Using $ifNull to ensure it's set even on upsert
          firstPublishedAt: {
            $ifNull: ['$firstPublishedAt', publishedAt],
          },
        },
      },
      {
        $set: {
          // Update peak count if current exceeds peak (atomic max calculation)
          // This ensures persistent badges - peak never decreases
          peakPublishedCount: {
            $max: ['$peakPublishedCount', '$currentPublishedCount'],
          },
        },
      },
    ],
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  )
}

/**
 * Decrement campaign counts when unpublishing a product
 * Uses atomic aggregation pipeline to prevent race conditions
 *
 * IMPORTANT: peakPublishedCount never decreases - this ensures persistent badges.
 * Users keep their badges even if they unpublish products.
 */
export async function decrementCampaignCounts(shopDomain: string, campaignId: string): Promise<void> {
  // ✅ ATOMIC UPDATE - Using MongoDB aggregation pipeline
  // Decrement with $max to ensure count never goes negative
  const result = await ShopCampaignStats.findOneAndUpdate(
    { shopDomain, campaignId },
    [
      {
        $set: {
          // Decrement but never go below 0 (atomic operation)
          currentPublishedCount: {
            $max: [0, { $subtract: ['$currentPublishedCount', 1] }],
          },
          // Note: peakPublishedCount intentionally NOT modified (persistent badges)
        },
      },
    ],
    { new: true }
  )

  if (!result) {
    console.warn(`[PTE] No campaign stats found for ${shopDomain}/${campaignId}`)
    return
  }
}

/**
 * Get campaign stats for a shop
 * Returns all campaigns if campaignId not specified
 */
export async function getShopCampaignStats(
  shopDomain: string,
  campaignId?: string
): Promise<ShopCampaignStatsDocument[]> {
  const query = campaignId ? { shopDomain, campaignId } : { shopDomain }

  return ShopCampaignStats.find(query).lean() as unknown as ShopCampaignStatsDocument[]
}

/**
 * Get analytics for a campaign
 * Returns aggregated statistics across all participating shops
 */
export async function getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
  const results = await ShopCampaignStats.aggregate([
    { $match: { campaignId } },
    {
      $facet: {
        overview: [
          {
            $group: {
              _id: null,
              totalParticipatingStores: { $sum: 1 },
              totalPublishedProducts: { $sum: '$currentPublishedCount' },
              avgPublishedPerStore: { $avg: '$currentPublishedCount' },
              maxPublished: { $max: '$peakPublishedCount' },
            },
          },
        ],
        badgeDistribution: [
          {
            $bucket: {
              groupBy: '$peakPublishedCount',
              boundaries: Array.from(PTE_BADGE_BOUNDARIES),
              default: 'no_badge',
              output: {
                count: { $sum: 1 },
              },
            },
          },
        ],
        activityMetrics: [
          {
            $group: {
              _id: null,
              activeStores: {
                $sum: {
                  $cond: [{ $gt: ['$currentPublishedCount', 0] }, 1, 0],
                },
              },
              dormantStores: {
                $sum: {
                  $cond: [{ $eq: ['$currentPublishedCount', 0] }, 1, 0],
                },
              },
            },
          },
        ],
      },
    },
  ])

  return results[0] || { overview: [], badgeDistribution: [], activityMetrics: [] }
}

/**
 * Get cohort analysis for a campaign
 * Groups integrations by first publish week and calculates retention metrics
 *
 * @param campaignId - Campaign ID to analyze
 * @returns Array of cohort data with retention rates and engagement metrics
 */
export async function getCohortAnalysis(campaignId: string) {
  const Integration = (await import('./Integration.server')).default

  return Integration.aggregate([
    // Stage 1: Get all integrations in campaign
    {
      $match: { pteCampaigns: campaignId },
    },

    // Stage 2: Add cohort week calculation and metrics
    {
      $addFields: {
        cohortWeek: {
          $dateToString: {
            format: '%Y-W%U', // e.g., "2026-W02"
            date: '$publishedAt',
          },
        },
        daysActive: {
          $cond: {
            if: { $ne: ['$unpublishedAt', null] },
            then: {
              $divide: [{ $subtract: ['$unpublishedAt', '$publishedAt'] }, 86400000], // milliseconds per day
            },
            else: {
              $divide: [{ $subtract: [new Date(), '$publishedAt'] }, 86400000],
            },
          },
        },
        isActive: {
          $eq: ['$unpublishedAt', null],
        },
      },
    },

    // Stage 3: Group by cohort
    {
      $group: {
        _id: '$cohortWeek',
        totalStarts: { $sum: 1 },
        stillActive: {
          $sum: { $cond: ['$isActive', 1, 0] },
        },
        avgDaysActive: { $avg: '$daysActive' },
        shops: { $addToSet: '$shopDomain' },
      },
    },

    // Stage 4: Calculate retention rate
    {
      $addFields: {
        retentionRate: {
          $multiply: [{ $divide: ['$stillActive', '$totalStarts'] }, 100],
        },
      },
    },

    // Stage 5: Sort by cohort week
    {
      $sort: { _id: 1 },
    },
  ])
}

/**
 * Get engagement time-series data for a campaign
 * Tracks daily publish and unpublish events to visualize engagement trends
 *
 * @param campaignId - Campaign ID to analyze
 * @returns Object with publishes and unpublishes arrays grouped by date
 */
export async function getCampaignEngagementTimeSeries(campaignId: string) {
  const Integration = (await import('./Integration.server')).default

  return Integration.aggregate([
    {
      $match: { pteCampaigns: campaignId },
    },
    {
      $facet: {
        publishes: [
          { $match: { publishedAt: { $ne: null } } },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$publishedAt',
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        unpublishes: [
          { $match: { unpublishedAt: { $ne: null } } },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$unpublishedAt',
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ])
}

/**
 * Get campaign integrations with details
 * Returns list of integrations for a campaign with pagination and filtering
 */
export async function getCampaignIntegrations(params: {
  campaignId: string
  shopDomain?: string
  page?: number
  limit?: number
  filters?: {
    status?: 'published' | 'unpublished' | 'all'
    lifecycleStage?: 'new' | 'active' | 'veteran' | 'churned' | 'all'
    minDays?: number
    maxDays?: number
    dateFrom?: string | null
    dateTo?: string | null
  }
}) {
  const { campaignId, shopDomain, page = 1, limit = 50, filters } = params
  const skip = (page - 1) * limit

  const Integration = (await import('./Integration.server')).default
  const Mockup = (await import('./Mockup.server')).default

  // Query ALL integrations ever in campaign (published or unpublished)
  const integrationQuery: any = {
    pteCampaigns: campaignId,
  }

  if (shopDomain) {
    integrationQuery.shopDomain = shopDomain
  }

  // Get all integrations with their metadata
  // Sort: Published ones first (by publishedAt desc), then unpublished ones (by updatedAt desc)
  const integrations = await Integration.find(integrationQuery)
    .select('_id shopDomain publishedAt unpublishedAt createdAt updatedAt')
    .lean()

  // Custom sort: Published first (by publishedAt desc), then unpublished (by updatedAt desc)
  integrations.sort((a, b) => {
    const aPublished = a.publishedAt !== null && a.publishedAt !== undefined
    const bPublished = b.publishedAt !== null && b.publishedAt !== undefined

    if (aPublished && !bPublished) return -1
    if (!aPublished && bPublished) return 1

    if (aPublished && bPublished) {
      return new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime()
    }

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  // Apply filters if provided
  let filteredIntegrations = integrations

  if (filters) {
    filteredIntegrations = integrations.filter(integration => {
      const isPublished = integration.publishedAt !== null && integration.publishedAt !== undefined

      // Filter by status
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'published' && !isPublished) return false
        if (filters.status === 'unpublished' && isPublished) return false
      }

      // Filter by date range
      if (filters.dateFrom && integration.publishedAt) {
        if (new Date(integration.publishedAt) < new Date(filters.dateFrom)) return false
      }
      if (filters.dateTo && integration.publishedAt) {
        if (new Date(integration.publishedAt) > new Date(filters.dateTo)) return false
      }

      return true
    })
  }

  const total = filteredIntegrations.length

  // Paginate the integration IDs
  const paginatedIntegrationIds = filteredIntegrations.slice(skip, skip + limit).map(i => i._id)

  // Get mockup data for these integrations to retrieve product labels
  const mockups = await Mockup.aggregate([
    {
      $match: {
        'denormalizedData.integration._id': { $in: paginatedIntegrationIds },
        ...(shopDomain ? { shopDomain } : {}),
      },
    },
    {
      $group: {
        _id: '$denormalizedData.integration._id',
        label: { $first: '$label' },
        integrationName: { $first: '$denormalizedData.integration.name' },
      },
    },
  ])

  // Create a map for quick lookup
  const mockupMap = new Map(mockups.map(m => [m._id, m]))

  // Combine integration data with mockup labels and lifecycle metrics
  let results = filteredIntegrations.slice(skip, skip + limit).map(integration => {
    const mockupData = mockupMap.get(integration._id)
    const isPublished = integration.publishedAt !== null && integration.publishedAt !== undefined

    // Calculate days active
    const daysActive = isPublished
      ? Math.floor((Date.now() - new Date(integration.publishedAt!).getTime()) / 86400000)
      : integration.unpublishedAt && integration.publishedAt
        ? Math.floor(
            (new Date(integration.unpublishedAt).getTime() - new Date(integration.publishedAt).getTime()) / 86400000
          )
        : 0

    // Calculate lifecycle stage
    const lifecycleStage = isPublished ? (daysActive <= 7 ? 'new' : daysActive <= 30 ? 'active' : 'veteran') : 'churned'

    return {
      _id: integration._id,
      title: mockupData?.label || mockupData?.integrationName || 'Untitled Integration',
      shopDomain: integration.shopDomain,
      publishedAt: integration.publishedAt,
      unpublishedAt: integration.unpublishedAt,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
      status: isPublished ? 'Published' : 'Unpublished',
      daysActive,
      lifecycleStage,
    }
  })

  // Apply lifecycle stage and days active filters (after calculation)
  if (filters) {
    results = results.filter(result => {
      // Filter by lifecycle stage
      if (filters.lifecycleStage && filters.lifecycleStage !== 'all') {
        if (result.lifecycleStage !== filters.lifecycleStage) return false
      }

      // Filter by days active range
      if (filters.minDays !== undefined && result.daysActive < filters.minDays) return false
      if (filters.maxDays !== undefined && result.daysActive > filters.maxDays) return false

      return true
    })
  }

  return {
    integrations: results,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      pageSize: limit,
    },
    summary: {
      total,
      published: filteredIntegrations.filter(i => i.publishedAt !== null && i.publishedAt !== undefined).length,
      unpublished: filteredIntegrations.filter(i => i.publishedAt === null || i.publishedAt === undefined).length,
    },
  }
}
