import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ProductTemplate } from '@sellersmith/shineon-sdk'
import type { ShineOnNormalizedProduct } from '~/modules/Fulfillments/ShineOn/types'
import { normalizeProductTemplates } from '~/modules/Fulfillments/ShineOn/catalog/normalize-product-template'
import { FulfillmentProvidersService } from '~/api/services/fulfillment-providers'

interface UseFetchShineOnProductsOptions {
  providerId: string
  queryString?: string
  productTypeFilter?: string[]
}

interface UseFetchShineOnProductsReturn {
  products: ShineOnNormalizedProduct[]
  allProducts: ShineOnNormalizedProduct[]
  isFetching: boolean
  isSearching: boolean
}

export const useFetchShineOnProducts = ({
  providerId,
  queryString = '',
  productTypeFilter = [],
}: UseFetchShineOnProductsOptions): UseFetchShineOnProductsReturn => {
  const [isFetching, setIsFetching] = useState(true)
  const [allProducts, setAllProducts] = useState<ShineOnNormalizedProduct[]>([])

  const fetchProductTemplates = useCallback(async () => {
    try {
      setIsFetching(true)

      const { productTemplates } = await FulfillmentProvidersService.getShineOnProductTemplates(providerId)

      if (Array.isArray(productTemplates) && productTemplates.length > 0) {
        const normalized = normalizeProductTemplates(productTemplates as ProductTemplate[])
        setAllProducts(normalized)
      } else {
        setAllProducts([])
      }
    } catch (error) {
      console.error('Failed to fetch ShineOn products:', error)
      setAllProducts([])
    } finally {
      setIsFetching(false)
    }
  }, [providerId])

  // Filtered products based on current filters
  const products = useMemo(() => {
    const lowerQuery = queryString.toLowerCase()

    return allProducts.filter(product => {
      const matchesQuery = queryString ? product.title.toLowerCase().includes(lowerQuery) : true

      const matchesType = productTypeFilter.length > 0 ? productTypeFilter.includes(product.productType || '') : true

      return matchesQuery && matchesType
    })
  }, [allProducts, queryString, productTypeFilter])

  const isSearching = !isFetching && (!!queryString || productTypeFilter.length > 0)

  // Initial fetch
  useEffect(() => {
    fetchProductTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    products,
    allProducts,
    isFetching,
    isSearching,
  }
}
