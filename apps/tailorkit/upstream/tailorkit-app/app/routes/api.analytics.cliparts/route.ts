import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { authenticate } from '~/shopify/app.server'
import { json } from '~/bootstrap/fns/fetch.server'
import { catchAsync } from '~/utils/catchAsync'
import { AssetType, ClickContext } from '~/models/ClipartClickEvent'
import { createClickEvent } from '~/models/ClipartClickEvent.server'
import ShopAssetAnalyticsModel, {
  incrementShopAssetClick,
  getShopAssetAnalytics,
  getTopAssetsForShop,
  getShopClickDistribution,
} from '~/models/ShopAssetAnalytics.server'
import { getShopData } from '~/models/Shop.server'
import { ANALYTICS_ACTIONS } from './constants'

// Zod validation schemas
const trackClickSchema = z.object({
  action: z.literal('track'),
  assetId: z.string().min(1),
  assetType: z.nativeEnum(AssetType).optional().default(AssetType.CLIPART),
  context: z.nativeEnum(ClickContext),
  category: z.string().optional(),
  searchQuery: z.string().optional(),
})

/**
 * GET /api/analytics/cliparts
 * Consolidated analytics endpoint for cliparts
 *
 * Actions:
 * - trending: Get trending or popular assets
 * - insights: Get shop-specific analytics insights
 *
 * Query params vary by action (see individual handlers)
 */
export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  switch (action) {
    case ANALYTICS_ACTIONS.TRENDING:
      return handleTrending(request, searchParams)

    case ANALYTICS_ACTIONS.INSIGHTS:
      return handleInsights(request, searchParams)

    default:
      return json({ error: 't(Invalid action)' }, { status: 400 })
  }
})

/**
 * POST /api/analytics/cliparts
 * Consolidated analytics endpoint for cliparts
 *
 * Actions:
 * - track: Track clipart click events
 *
 * Body params vary by action (see individual handlers)
 */
export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const body = await request.json()
  const { action } = body

  switch (action) {
    case ANALYTICS_ACTIONS.TRACK:
      return handleTrack(session.shop, body)

    default:
      return json({ error: 't(Invalid action)' }, { status: 400 })
  }
})

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

/**
 * Handle TRENDING action
 * Get trending or popular assets based on total clicks
 *
 * Query params:
 * - assetType: 'clipart' | 'template' | 'font' | 'image' (default: 'clipart')
 * - type: 'trending' | 'popular' (default: 'trending')
 * - limit: number (default: 20)
 */
async function handleTrending(request: Request, searchParams: URLSearchParams) {
  const assetType = (searchParams.get('assetType') as AssetType) || AssetType.CLIPART
  const type = searchParams.get('type') || 'trending'
  const limit = Number.parseInt(searchParams.get('limit') || '20', 10)

  try {
    // Real-time aggregation from ShopAssetAnalytics (replaces AssetMetrics)
    // Aggregate total clicks across all shops for each asset
    const assets = await ShopAssetAnalyticsModel.aggregate([
      {
        $match: { assetType },
      },
      {
        $group: {
          _id: '$assetId',
          totalClicks: { $sum: '$totalClicks' },
          uniqueShops: { $sum: 1 },
          lastClickedAt: { $max: '$lastClickedAt' },
        },
      },
      {
        $sort: type === 'popular' ? { totalClicks: -1 } : { totalClicks: -1, lastClickedAt: -1 },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          assetId: '$_id',
          totalClicks: 1,
          uniqueShops: 1,
          _id: 0,
        },
      },
    ])

    return json(
      {
        type,
        assetType,
        assets,
        count: assets.length,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('t(Error getting trending cliparts):', error)
    return json({ error: 't(Failed to get trending assets)' }, { status: 500 })
  }
}

/**
 * Handle INSIGHTS action
 * Get analytics insights for cliparts
 *
 * Query params:
 * - shopDomain: string (optional, defaults to current shop)
 * - assetId: string (optional, get specific asset analytics)
 * - assetType: 'clipart' | 'template' | 'font' | 'image' (optional)
 * - topAssets: boolean (get top clicked assets)
 * - limit: number (for top assets, default 10)
 */
async function handleInsights(request: Request, searchParams: URLSearchParams) {
  const { session } = await authenticate.admin(request)
  const currentShopDomain = session.shop

  const shopDomain = searchParams.get('shopDomain') || currentShopDomain
  const assetId = searchParams.get('assetId')
  const assetType = (searchParams.get('assetType') as AssetType) || 'clipart'
  const topAssets = searchParams.get('topAssets') === 'true'
  const limit = Number.parseInt(searchParams.get('limit') || '10', 10)

  try {
    // Get specific asset analytics
    if (assetId) {
      const [shopAnalytics, globalMetrics] = await Promise.all([
        getShopAssetAnalytics(shopDomain, assetId),
        // Real-time global clicks aggregation (replaces AssetMetrics.getAssetClickCounts)
        ShopAssetAnalyticsModel.aggregate([
          { $match: { assetId, assetType } },
          {
            $group: {
              _id: '$assetId',
              totalClicks: { $sum: '$totalClicks' },
            },
          },
        ]),
      ])

      const globalClicks = globalMetrics.length > 0 ? globalMetrics[0].totalClicks : 0

      return json(
        {
          assetId,
          shopAnalytics,
          globalClicks,
        },
        { status: 200 }
      )
    }

    // Get top assets for shop
    if (topAssets) {
      const [assets, clickDistribution] = await Promise.all([
        getTopAssetsForShop(shopDomain, { assetType, limit }),
        getShopClickDistribution(shopDomain, assetType),
      ])

      return json(
        {
          topAssets: assets,
          clickDistribution,
        },
        { status: 200 }
      )
    }

    // Default: return shop overview
    const clickDistribution = await getShopClickDistribution(shopDomain, assetType)

    return json(
      {
        shopDomain,
        clickDistribution,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('t(Error getting clipart insights):', error)
    return json({ error: 't(Failed to get insights)' }, { status: 500 })
  }
}

/**
 * Handle TRACK action
 * Track clipart click with detailed analytics
 *
 * Body: {
 *   action: 'track',
 *   assetId: string,
 *   assetType: 'clipart' | 'template' | 'font' | 'image',
 *   context: ClickContext enum value,
 *   category?: string,
 *   searchQuery?: string
 * }
 */
async function handleTrack(shopDomain: string, body: unknown) {
  // Validate request body with Zod
  const validation = trackClickSchema.safeParse(body)

  if (!validation.success) {
    return json(
      {
        error: 't(Invalid request body)',
        details: validation.error.format(),
      },
      { status: 400 }
    )
  }

  const { assetId, assetType, context, category, searchQuery } = validation.data

  try {
    // Fetch shop data for email and owner
    const shopData = await getShopData(shopDomain)
    const shopInfo = shopData?.shopConfig
      ? {
          email: shopData.shopConfig.email,
          owner: shopData.shopConfig.shop_owner,
        }
      : undefined

    // Track in parallel for performance
    await Promise.all([
      // Detailed events for future analytics
      createClickEvent({
        assetId,
        assetType,
        shopDomain,
        clickedAt: new Date(),
        context,
        category,
        searchQuery,
      }),

      // Real-time counters for display (with shop info)
      incrementShopAssetClick(shopDomain, assetId, assetType, context, shopInfo),
    ])

    return json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('t(Error tracking clipart click):', error)
    // Still return success - don't block user
    return json({ success: true, warning: 't(Partial tracking failure)' }, { status: 200 })
  }
}
