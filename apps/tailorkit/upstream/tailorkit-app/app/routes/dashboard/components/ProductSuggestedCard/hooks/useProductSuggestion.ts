/**
 * @description Hook to get product suggestions - returns top 5 selling products
 * @returns {Object} { products, loading, error }
 */
import { useState, useLayoutEffect } from 'react'
import { authenticatedFetch } from '~/shopify/fns.client'
import { PRODUCT_QUERY_ACTIONS } from '~/routes/api.products/constants'
import type { ITopSellingProductsResult } from '~/routes/api.products/constants'

interface UseProductSuggestionReturn {
  products: ITopSellingProductsResult[]
  loading: boolean
  error: Error | null
}

export function useProductSuggestion(
  defaultProducts?: ITopSellingProductsResult[],
  limit?: number
): UseProductSuggestionReturn {
  const [products, setProducts] = useState<ITopSellingProductsResult[]>(defaultProducts || [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useLayoutEffect(() => {
    if (products.length > 0) {
      setLoading(false)
      return
    }

    const fetchProducts = async () => {
      try {
        setLoading(true)
        // Fetch top selling products using the action function
        const response = await authenticatedFetch('/api/products', {
          method: 'POST',
          body: JSON.stringify({
            action: PRODUCT_QUERY_ACTIONS.GET_TOP_SELLING_PRODUCTS,
            limit: limit || 5,
          }),
        })

        if (!response?.success || !response?.items) {
          throw new Error('Failed to fetch product suggestions')
        }

        setProducts(response.items)
        setError(null)
      } catch (err) {
        console.error('Error fetching product suggestions:', err)
        setError(err instanceof Error ? err : new Error('Failed to fetch product suggestions'))
        setProducts([])
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [products.length, limit])

  return { products, loading, error }
}
