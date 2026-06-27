import { useCallback, useEffect, useRef, useState } from 'react'
import type { LiveCharmProduct } from '~/routes/api.charm-products/route'

type UseLiveCharmProductsResult = {
  /** Map of productId → live product data */
  liveProducts: Map<string, LiveCharmProduct>
  /** Whether initial fetch is in progress */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Manually refresh product data */
  refresh: () => void
}

/**
 * Module-level product cache: persists across component mounts.
 * Prevents skeleton flash when CharmPreviewPicker remounts (tab switch).
 */
const globalProductCache = new Map<string, LiveCharmProduct>()

/**
 * Hook to fetch live product data from Shopify Admin API.
 * Caches results both per-instance (fetchedIdsRef) and globally (globalProductCache)
 * so remounts use cached data immediately without skeleton flash.
 *
 * @param productIds - Array of Shopify product IDs to fetch
 * @returns Live product data map, loading state, and error
 */
export function useLiveCharmProducts(productIds: string[]): UseLiveCharmProductsResult {
  // Initialize from global cache — prevents skeleton on remount
  const [liveProducts, setLiveProducts] = useState<Map<string, LiveCharmProduct>>(() => {
    const cached = new Map<string, LiveCharmProduct>()
    for (const id of productIds) {
      const product = globalProductCache.get(id)
      if (product) cached.set(id, product)
    }
    return cached
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track which IDs we've already fetched to avoid duplicate requests
  // Seed from global cache so cached IDs aren't re-fetched
  const fetchedIdsRef = useRef<Set<string>>(new Set(productIds.filter(id => globalProductCache.has(id))))
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchProducts = useCallback(async (ids: string[], forceRefresh = false) => {
    if (ids.length === 0) return

    // Filter to only fetch IDs we haven't fetched yet (unless forcing refresh)
    const idsToFetch = forceRefresh ? ids : ids.filter(id => !fetchedIdsRef.current.has(id))

    if (idsToFetch.length === 0) return

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/charm-products?ids=${encodeURIComponent(idsToFetch.join(','))}`, {
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      // Merge new products into existing map + global cache
      setLiveProducts(prev => {
        const next = new Map(prev)
        for (const product of data.products as LiveCharmProduct[]) {
          next.set(product.id, product)
          fetchedIdsRef.current.add(product.id)
          globalProductCache.set(product.id, product)
        }
        return next
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, ignore
        return
      }
      console.error('[useLiveCharmProducts] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch products')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch when productIds change
  useEffect(() => {
    fetchProducts(productIds)
  }, [productIds, fetchProducts])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const refresh = useCallback(() => {
    fetchedIdsRef.current.clear()
    fetchProducts(productIds, true)
  }, [productIds, fetchProducts])

  return { liveProducts, isLoading, error, refresh }
}

/**
 * Get display data for a charm product, preferring live data over snapshot.
 *
 * @param productId - Shopify product ID
 * @param selectedVariantId - Optional pre-selected variant ID
 * @param liveProducts - Map of live product data
 * @param snapshot - Snapshot data stored in CharmProductRef
 * @returns Display data (title, price, image, availability)
 */
export function getCharmDisplayData(
  productId: string,
  _selectedVariantId: string | undefined,
  liveProducts: Map<string, LiveCharmProduct>,
  snapshot: { title: string; price: string; currencyCode: string; thumbnailUrl: string }
): {
  title: string
  price: string
  currencyCode: string
  thumbnailUrl: string
  available: boolean
  isLive: boolean
} {
  const liveProduct = liveProducts.get(productId)

  if (!liveProduct) {
    return {
      title: snapshot.title,
      price: snapshot.price,
      currencyCode: snapshot.currencyCode,
      thumbnailUrl: snapshot.thumbnailUrl,
      available: true,
      isLive: false,
    }
  }

  // Charm = product level, no variant selection needed
  return {
    title: liveProduct.title,
    price: liveProduct.priceRange.minPrice,
    currencyCode: liveProduct.priceRange.currencyCode,
    thumbnailUrl: liveProduct.featuredImageUrl || snapshot.thumbnailUrl,
    available: liveProduct.available,
    isLive: true,
  }
}
