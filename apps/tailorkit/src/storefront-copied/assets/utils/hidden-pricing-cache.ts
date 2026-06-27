import { OPTION_PRICING_PRODUCT_HANDLE } from '../constants/option-pricing'

interface ShopifyProduct {
  id: number
  handle: string
  title: string
  variants: Array<{
    id: number
    title: string
    price: number
    available: boolean
    inventory_quantity: number
  }>
}

interface HiddenPricingCache {
  product: ShopifyProduct | null
  lastFetched: number
  isInitialized: boolean
  error: string | null
}

// Cache duration: 10 minutes
const CACHE_DURATION = 10 * 60 * 1000

// Global cache object
const hiddenPricingCache: HiddenPricingCache = {
  product: null,
  lastFetched: 0,
  isInitialized: false,
  error: null,
}

/**
 * Fetch hidden pricing product from Shopify
 */
const fetchHiddenPricingProduct = async (): Promise<ShopifyProduct | null> => {
  try {
    const response = await fetch(`/products/${OPTION_PRICING_PRODUCT_HANDLE}.js`)

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          `Hidden pricing product '${OPTION_PRICING_PRODUCT_HANDLE}' not found. Please create this product in your Shopify admin.`
        )
      }
      throw new Error(`Failed to fetch hidden pricing product: ${response.status} ${response.statusText}`)
    }

    const product: ShopifyProduct = await response.json()

    const convertedProduct = {
      ...product,
      variants: product.variants.map(variant => ({
        ...variant,
        price: variant.price / 100, // Divide by 100 for ALL currencies
      })),
    }

    // Validate product has available variants
    const availableVariants = convertedProduct.variants.filter(variant => variant.available)
    if (availableVariants.length === 0) {
      throw new Error(`Hidden pricing product '${convertedProduct.title}' has no available variants`)
    }

    return convertedProduct
  } catch (error) {
    console.error('[TailorKit] Error fetching hidden pricing product:', error)
    throw error
  }
}

/**
 * Initialize the hidden pricing product cache
 */
export const initializeHiddenPricingProductCache = async (): Promise<void> => {
  try {
    const product = await fetchHiddenPricingProduct()

    hiddenPricingCache.product = product
    hiddenPricingCache.lastFetched = Date.now()
    hiddenPricingCache.isInitialized = true
    hiddenPricingCache.error = null

    // Expose on window so cart-form-sync can read it without importing this module
    ;(window as any).__tlk_pricing_cache = hiddenPricingCache
  } catch (error) {
    hiddenPricingCache.product = null
    hiddenPricingCache.lastFetched = Date.now()
    hiddenPricingCache.isInitialized = true
    hiddenPricingCache.error = error instanceof Error ? error.message : 'Unknown error'

    console.error('[TailorKit] Failed to initialize hidden pricing product cache:', error)

    // Don't throw here - let the app continue running
    // The middleware will handle the missing product gracefully
  }
}

// When init fails, retry after this interval instead of caching the error for the whole
// CACHE_DURATION. Important when the app has just published the hidden product to a new
// Markets catalog — the buyer's storefront JS would otherwise stay stuck on the cached 404
// until page reload.
const ERROR_RETRY_INTERVAL = 30 * 1000 // 30 seconds

/**
 * Get cached hidden pricing product
 */
export const getCachedHiddenPricingProduct = async (): Promise<ShopifyProduct | null> => {
  // If not initialized, try to initialize
  if (!hiddenPricingCache.isInitialized) {
    await initializeHiddenPricingProductCache()
  }

  const now = Date.now()
  const cacheAge = now - hiddenPricingCache.lastFetched

  if (cacheAge > CACHE_DURATION && hiddenPricingCache.product) {
    // Refresh cache in background, but return current cached version
    initializeHiddenPricingProductCache().catch(error => {
      console.warn('[TailorKit] Background cache refresh failed:', error)
    })
  }

  // Previous fetch errored (e.g. product 404'd because it wasn't yet published to the buyer's
  // market). Retry after ERROR_RETRY_INTERVAL so the cart can recover without a page reload
  // once the product becomes reachable.
  if (hiddenPricingCache.error && !hiddenPricingCache.product) {
    if (cacheAge > ERROR_RETRY_INTERVAL) {
      await initializeHiddenPricingProductCache()
      if (hiddenPricingCache.product) return hiddenPricingCache.product
    }
    console.warn('[TailorKit] Hidden pricing product cache has error:', hiddenPricingCache.error)
    return null
  }

  return hiddenPricingCache.product
}

/**
 * Force refresh the cache
 */
export const refreshHiddenPricingProductCache = async (): Promise<ShopifyProduct | null> => {
  await initializeHiddenPricingProductCache()
  return hiddenPricingCache.product
}

/**
 * Get cache status for debugging
 */
export const getHiddenPricingCacheStatus = () => {
  return {
    isInitialized: hiddenPricingCache.isInitialized,
    hasProduct: !!hiddenPricingCache.product,
    lastFetched: hiddenPricingCache.lastFetched,
    cacheAge: Date.now() - hiddenPricingCache.lastFetched,
    error: hiddenPricingCache.error,
    productTitle: hiddenPricingCache.product?.title || null,
  }
}

/**
 * Clear the cache (useful for testing)
 */
export const clearHiddenPricingCache = () => {
  hiddenPricingCache.product = null
  hiddenPricingCache.lastFetched = 0
  hiddenPricingCache.isInitialized = false
  hiddenPricingCache.error = null
}
