import { type LoaderFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { mongoDBCacheStorage } from '~/models/Cache.server'
import { json } from '~/bootstrap/fns/fetch.server'

/**
 * Cache statistics and management API
 *
 * GET: Returns cache statistics
 * ?action=cleanup - Manually cleanup expired entries
 * ?action=clear&shop={shopDomain} - Clear cache for specific shop
 * ?action=clearAll - Clear all cache (use with caution)
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)

  const url = new URL(request.url)
  const action = url.searchParams.get('action')
  const shopDomain = url.searchParams.get('shop')

  try {
    // Handle different actions
    switch (action) {
      case 'cleanup': {
        const deletedCount = await mongoDBCacheStorage.cleanupExpired()
        return json({
          success: true,
          message: `Cleaned up ${deletedCount} expired cache entries`,
          deletedCount,
        })
      }

      case 'clear': {
        if (!shopDomain) {
          return json(
            {
              success: false,
              error: 'Shop domain is required for clear action',
            },
            { status: 400 }
          )
        }

        await mongoDBCacheStorage.clearCacheForShopDomain(shopDomain)
        return json({
          success: true,
          message: `Cleared cache for shop: ${shopDomain}`,
          shopDomain,
        })
      }

      case 'clearAll': {
        await mongoDBCacheStorage.clearAllCache()
        return json({
          success: true,
          message: 'Cleared all cache entries',
        })
      }

      default: {
        // Return cache statistics
        const stats = await mongoDBCacheStorage.getStats()
        return json({
          success: true,
          stats,
          timestamp: new Date().toISOString(),
        })
      }
    }
  } catch (error) {
    console.error('Cache stats error:', error)
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
