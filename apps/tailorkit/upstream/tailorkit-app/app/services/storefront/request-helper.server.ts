import { getStorefrontAccessToken } from './storefront-access-token.server'

/**
 * Sets the 'X-Shopify-Storefront-Access-Token' header for a given request.
 * If the header is not already present, it retrieves the token from the database.
 *
 * @param request - The request object to modify
 * @param shop - The shop domain used to retrieve the storefront access token
 * @returns A promise that resolves to the modified request object
 */
export async function setRequestHeadersForStorefront(request: Request, shop: string): Promise<Request> {
  try {
    const existingToken = request.headers.get('X-Shopify-Storefront-Access-Token')

    if (!existingToken) {
      const storefrontAccessToken = await getStorefrontAccessToken(shop)

      if (storefrontAccessToken) {
        // Create new Request with updated headers (Request headers are immutable).
        // Use request.url + method instead of passing the Request object directly,
        // because the original request body may already be consumed (e.g. by formData()).
        const newHeaders = new Headers(request.headers)
        newHeaders.set('X-Shopify-Storefront-Access-Token', storefrontAccessToken)
        return new Request(request.url, { method: request.method, headers: newHeaders })
      }
    }
  } catch (e) {
    console.error('[Storefront] Error when setRequestHeadersForStorefront:', e)
  }

  return request
}
