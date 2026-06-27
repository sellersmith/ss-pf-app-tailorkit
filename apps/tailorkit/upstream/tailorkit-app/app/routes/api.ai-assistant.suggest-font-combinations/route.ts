import type { ActionFunction, ActionFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { catchAsync } from '~/utils/catchAsync'
import { getShopData } from '~/models/Shop.server'
import { z } from 'zod'
import {
  isCacheValid,
  generateFontCombinationSuggestions,
  getCachedSuggestions,
  updateMockupSuggestions,
  getClipartDetailsFromIds,
} from './fns.server'

// Zod schema for request validation
const requestBodySchema = z.object({
  mockupId: z.string().min(1, 'mockupId is required'),
  productId: z.string().min(1, 'productId is required'),
  productTitle: z.string().min(1, 'productTitle is required'),
  variantTitles: z.array(z.string()).optional(),
  isFirstVariant: z.boolean().optional(),
  variantHash: z.string().optional(),
})

export const action: ActionFunction = catchAsync(async ({ request }: ActionFunctionArgs) => {
  const {
    session: { shop },
  } = await authenticate.admin(request)

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 })
  }

  if (!shop) {
    return json({ success: false, error: 'Shop data not found' }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Validate request body with Zod
    const validationResult = requestBodySchema.safeParse(body)
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      return json({ success: false, error: `Validation error: ${errors}` }, { status: 400 })
    }

    const { mockupId, variantTitles, productId, productTitle, isFirstVariant, variantHash } = validationResult.data

    // Normalize variantTitles to array
    const normalizedVariantTitles: string[] = Array.isArray(variantTitles)
      ? variantTitles.filter(Boolean)
      : variantTitles
        ? [variantTitles]
        : []

    const variantData = {
      variantTitles: normalizedVariantTitles,
      productId,
      productTitle,
    }

    // IMPORTANT:
    // Cache is stored per (mockupId, productId, productTitle) (see `generateCacheKey` in `fns.server.ts`),
    // not per-variant. To avoid duplicated writes across multiple variant requests, the client
    // marks a single "canonical" request (typically the first variant it renders) via `isFirstVariant`.
    //
    // Note: the server cannot verify which variant is actually "first"; it only trusts the boolean.
    const normalizedVariantHash = typeof variantHash === 'string' ? variantHash : ''
    const shouldUseCache = typeof isFirstVariant === 'boolean' ? isFirstVariant : false

    // Run cache check and shop data fetch in parallel for faster response
    const [cachedSuggestions, shopData] = await Promise.all([
      shouldUseCache
        ? getCachedSuggestions(mockupId, productId, productTitle, normalizedVariantTitles)
        : Promise.resolve(null),
      getShopData(shop),
    ])

    // Only use cache when client opted into caching (`isFirstVariant`) and cache is valid.
    const cached = cachedSuggestions ?? undefined
    if (shouldUseCache && cached && isCacheValid(cached, productId, normalizedVariantHash)) {
      // Get clipart details for cached IDs
      const cliparts = await getClipartDetailsFromIds(cached.clipartIds)
      return json({
        success: true,
        clipartIds: cached.clipartIds,
        cliparts,
        reasoning: cached.reasoning || 'Cached result',
        fromCache: true,
      })
    }

    // Generate new suggestions based on variant data
    // shopData already fetched in parallel above
    const result = await generateFontCombinationSuggestions({
      variantData,
      shopDomain: shop,
      shopData,
    })

    // Fire and forget - don't wait for cache update (saves ~50-100ms)
    // Only persist cache when client opted into caching (`isFirstVariant`).
    if (shouldUseCache) {
      const newSuggestions = {
        clipartIds: result.clipartIds,
        generatedAt: Date.now(),
        productId, // Track productId for webhook invalidation
        variantHash: normalizedVariantHash,
        reasoning: result.reasoning,
      }
      updateMockupSuggestions(mockupId, newSuggestions, productId, productTitle, normalizedVariantTitles).catch(err => {
        console.error('Error updating mockup suggestions:', err)
      })
    }

    return json({
      success: true,
      clipartIds: result.clipartIds,
      cliparts: result.cliparts,
      reasoning: result.reasoning,
      fromCache: false,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[FONT_SUGGESTIONS] Error generating font combination suggestions:', errorMessage, error)
    return json({ success: false, error: 'Failed to generate font combination suggestions' }, { status: 500 })
  }
})
