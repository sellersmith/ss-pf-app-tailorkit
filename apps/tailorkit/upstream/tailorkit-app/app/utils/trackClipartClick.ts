import type { ClickContext } from '~/models/ClipartClickEvent'
import { AssetType } from '~/models/ClipartClickEvent'

export interface TrackClickParams {
  assetId: string
  assetType?: AssetType
  context: ClickContext
  category?: string
  searchQuery?: string
}

/**
 * Track clipart click on the server side
 * This records detailed analytics including context, category, and search query
 *
 * @param clipartId - The ID of the clipart that was clicked
 * @param context - Where the click happened (required for analytics)
 * @param options - Additional tracking context
 * @returns Promise<void>
 */
export async function trackClipartClick(
  clipartId: string,
  context: ClickContext,
  options?: {
    category?: string
    searchQuery?: string
  }
): Promise<void> {
  return trackAssetClick({
    assetId: clipartId,
    assetType: AssetType.CLIPART,
    context,
    category: options?.category,
    searchQuery: options?.searchQuery,
  })
}

/**
 * Track asset click (generalized version)
 * @param params - Tracking parameters
 * @returns Promise<void>
 */
export async function trackAssetClick(params: TrackClickParams): Promise<void> {
  try {
    const response = await fetch('/api/analytics/cliparts?action=track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'track',
        assetId: params.assetId,
        assetType: params.assetType || AssetType.CLIPART,
        context: params.context,
        category: params.category,
        searchQuery: params.searchQuery,
      }),
    })
    await response.json()
  } catch (error) {
    // Silently fail - don't block user interaction if tracking fails
    console.error('[trackAssetClick] Failed:', error)
  }
}
