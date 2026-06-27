import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '~/bootstrap/fns/fetch.server'
import { authenticate } from '~/shopify/app.server'
import { ShopifyApiClient } from '~/shopify/graphql/api.server'
import { SIMPLIFIED_PRODUCT_LIST_FIELD_SELECTION } from '~/shopify/graphql/products/constants'

/**
 * Live product data for charm display in admin
 */
export type LiveCharmProduct = {
  id: string
  title: string
  handle: string
  featuredImageUrl: string | null
  available: boolean
  priceRange: {
    minPrice: string
    maxPrice: string
    currencyCode: string
  }
}

/** Shape of product data returned by ShopifyApiClient.getProductsByIds */
type ShopifyProductNode = {
  id: string
  title: string
  handle: string
  featuredImage?: { url: string } | null
  status: string
  priceRangeV2?: {
    minVariantPrice?: { amount: string; currencyCode: string }
    maxVariantPrice?: { amount: string }
  }
}

/**
 * Transform raw Shopify product data to LiveCharmProduct format
 */
function transformProduct(product: ShopifyProductNode): LiveCharmProduct {
  const minPrice = product.priceRangeV2?.minVariantPrice
  const currencyCode = minPrice?.currencyCode || 'USD'

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    featuredImageUrl: product.featuredImage?.url || null,
    available: product.status !== 'DRAFT' && product.status !== 'ARCHIVED',
    priceRange: {
      minPrice: minPrice?.amount || '0',
      maxPrice: product.priceRangeV2?.maxVariantPrice?.amount || '0',
      currencyCode,
    },
  }
}

/**
 * GET /api/charm-products?ids=gid://shopify/Product/123,gid://shopify/Product/456
 *
 * Fetches live product data from Shopify Admin API for charm display.
 * Uses existing ShopifyApiClient.getProductsByIds method.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request)
    const apiClient = new ShopifyApiClient(admin)

    const url = new URL(request.url)
    const idsParam = url.searchParams.get('ids')

    if (!idsParam) {
      return json({ products: [], error: null })
    }

    const productIds = idsParam.split(',').filter(Boolean)
    if (productIds.length === 0) {
      return json({ products: [], error: null })
    }

    // Use existing method from ShopifyApiClient
    const rawProducts = await apiClient.getProductsByIds(productIds, SIMPLIFIED_PRODUCT_LIST_FIELD_SELECTION)

    // Transform to LiveCharmProduct format
    const products: LiveCharmProduct[] = rawProducts
      .filter((p): p is ShopifyProductNode => p !== null && p !== undefined && p.id !== null && p.id !== undefined)
      .map(transformProduct)

    return json({ products, error: null })
  } catch (error) {
    console.error('[api.charm-products] Error:', error)
    return json({
      products: [],
      error: error instanceof Error ? error.message : 'Failed to fetch products',
    })
  }
}
