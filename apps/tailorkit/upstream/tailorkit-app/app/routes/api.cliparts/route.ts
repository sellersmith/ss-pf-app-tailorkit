import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'
import { BASE_CLICK_COUNT, CLIPART_ACTIONS } from './constants'
import { json } from '~/bootstrap/fns/fetch.server'
import ShopAssetAnalyticsModel from '~/models/ShopAssetAnalytics.server'
import { getExcludedShopDomains } from './helpers.server'

/**
 * GET /api/cliparts?action=get_click_counts&assetIds=id1,id2,id3&assetType=clipart
 * Returns a map of assetId to uses count (formula: 100 + actual clicks)
 */
export const loader = catchAsync(async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  // Default to GET_CLICK_COUNTS if no action specified (backward compatibility)
  if (!action || action === CLIPART_ACTIONS.GET_CLICK_COUNTS) {
    // Support both new and legacy parameter names for backward compatibility
    const assetIdsParam = searchParams.get('assetIds') || searchParams.get('clipartIds')
    const assetType = searchParams.get('assetType') || 'clipart'

    if (!assetIdsParam) {
      return json({ clickCounts: {} }, { status: 200 })
    }

    // Parse comma-separated asset IDs
    const assetIds = assetIdsParam
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0)

    if (assetIds.length === 0) {
      return json({ clickCounts: {} }, { status: 200 })
    }

    // Get excluded shop domains (shops with internal email domains)
    const excludedShopDomains = await getExcludedShopDomains()

    // Aggregate clicks from ShopAssetAnalytics (sum across all shops)
    // EXCLUDE shops with emails ending with EMAIL_DOMAINS_TO_EXCLUDE_CLICK_COUNT
    const aggregates = await ShopAssetAnalyticsModel.aggregate([
      {
        $match: {
          assetId: { $in: assetIds },
          assetType,
          shopDomain: { $nin: excludedShopDomains }, // Exclude internal shops
        },
      },
      {
        $group: {
          _id: '$assetId',
          totalClicks: { $sum: '$totalClicks' },
        },
      },
    ])

    // Convert to plain object with formula: BASE_CLICK_COUNT + actual clicks
    const clickCounts: Record<string, number> = {}

    // Fill in aggregated counts
    aggregates.forEach((agg: any) => {
      clickCounts[agg._id] = BASE_CLICK_COUNT + agg.totalClicks
    })

    // Ensure all requested IDs have a value (default to BASE_CLICK_COUNT)
    assetIds.forEach(id => {
      if (!clickCounts[id]) {
        clickCounts[id] = BASE_CLICK_COUNT
      }
    })

    return json({ clickCounts }, { status: 200 })
  }

  return json({ error: 'Invalid action' }, { status: 400 })
})

/**
 * POST /api/cliparts - Legacy endpoint (deprecated)
 * Use /api/analytics/cliparts/track instead
 */
export const action = catchAsync(async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request)

  // Redirect to new analytics endpoint
  return json(
    {
      error: 'Deprecated endpoint. Use /api/analytics/cliparts/track instead',
    },
    { status: 410 }
  )
})
