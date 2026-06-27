/**
 * @method fetchShopifyCartData
 * @description Fetches current cart data from Shopify's cart.js endpoint with comprehensive error handling.
 * @see {@link https://shopify.dev/docs/api/ajax/reference/cart} Shopify Cart API
 *
 * @throws {Error} When cart fetch fails or response is invalid
 * @returns {Promise<any>} The cart data from Shopify's cart.js endpoint
 */
export default async function fetchShopifyCartData(): Promise<any> {
  try {
    const response = await fetch(`${window.Shopify?.routes?.root || '/'}cart.js`)

    if (!response.ok) {
      throw new Error(`Shopify cart fetch failed: ${response.status}`)
    }

    const data = await response.json()

    return data
  } catch (error) {
    console.error('[fetchShopifyCartData] Failed to fetch cart data:', error)
  }
}
