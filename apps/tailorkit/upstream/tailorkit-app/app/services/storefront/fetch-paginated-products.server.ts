import { SHOPIFY_API_VERSION } from '~/constants/shopify'

/**
 * Fetch products from Shopify Admin REST API with pagination support
 * Used as fallback when Storefront API is not available
 */
export async function fetchPaginatedProducts(shopDomain: string, accessToken: string, ids: string[]): Promise<any[]> {
  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': accessToken,
  }
  const firstPageUrl = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/products.json?ids=${ids.toString()}`
  let allProducts: any[] = []
  let nextPageUrl: string | null = firstPageUrl

  // Handle pagination of product data
  while (nextPageUrl) {
    const res: Response = await fetch(nextPageUrl, {
      method: 'GET',
      headers,
    })

    const data = await res.json()
    allProducts = [...allProducts, ...data.products]

    // Check for pagination link in the response headers
    const linkHeader = res.headers.get('Link')
    if (linkHeader && linkHeader.includes('rel="next"')) {
      nextPageUrl = linkHeader.match(/<(.*?)>; rel="next"/)?.[1] || null
    } else {
      nextPageUrl = null // No more pages
    }
  }

  return allProducts
}
