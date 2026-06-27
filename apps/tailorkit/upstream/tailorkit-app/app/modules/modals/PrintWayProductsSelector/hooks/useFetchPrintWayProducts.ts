import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NormalizedProduct } from '~/services/fulfillment/types'
import { Http } from '~/api/core/httpClient'

const GET_PRINTWAY_PRODUCTS_ACTION = 'get-printway-products'

interface UseFetchPrintWayProductsOptions {
  providerId: string
  queryString?: string
}

interface UseFetchPrintWayProductsReturn {
  products: NormalizedProduct[]
  allProducts: NormalizedProduct[]
  isFetching: boolean
  isSearching: boolean
}

interface GetPrintWayProductsResponse {
  success: boolean
  products?: NormalizedProduct[]
}

export const useFetchPrintWayProducts = ({
  providerId,
  queryString = '',
}: UseFetchPrintWayProductsOptions): UseFetchPrintWayProductsReturn => {
  const [isFetching, setIsFetching] = useState(true)
  const [allProducts, setAllProducts] = useState<NormalizedProduct[]>([])

  const fetchProducts = useCallback(async () => {
    try {
      setIsFetching(true)

      const res = await Http.post<GetPrintWayProductsResponse>('/api/providers', {
        action: GET_PRINTWAY_PRODUCTS_ACTION,
        vendor: 'PrintWay',
        providerId,
      })

      if (res.ok && res.data?.success && Array.isArray(res.data.products)) {
        setAllProducts(res.data.products)
      } else {
        setAllProducts([])
      }
    } catch (error) {
      console.error('Failed to fetch PrintWay products:', error)
      setAllProducts([])
    } finally {
      setIsFetching(false)
    }
  }, [providerId])

  const products = useMemo(() => {
    if (!queryString) return allProducts
    const lowerQuery = queryString.toLowerCase()
    return allProducts.filter(product => product.title.toLowerCase().includes(lowerQuery))
  }, [allProducts, queryString])

  const isSearching = !isFetching && !!queryString

  useEffect(() => {
    fetchProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    products,
    allProducts,
    isFetching,
    isSearching,
  }
}
