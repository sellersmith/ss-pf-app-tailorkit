import { useCallback, useEffect, useState } from 'react'
import { authenticatedFetch } from '~/shopify/fns.client'
import type { IDummyProductsData } from '../type'

export const useDummyProductsData = () => {
  const [dummyProductsData, setDummyProductsData] = useState<IDummyProductsData[]>([])
  const [loadingDummyProducts, setLoadingDummyProducts] = useState(false)

  const getDummyProductsSuggestionFromClipartData = useCallback(
    (selectedClipart: any[]) => {
      // Get clipart categories and names
      const clipartCategories = selectedClipart.flatMap(clipart => clipart.categories)
      const clipartName = selectedClipart.flatMap(clipart => clipart.name)

      // Filter dummy products data by clipart categories
      const dummyProductsDataFiltered = dummyProductsData.filter(product =>
        clipartCategories.includes(product.clipartCategory)
      )
      const dummyProducts = dummyProductsDataFiltered.flatMap(product => product.products)

      // Filter dummy products by clipart name
      const products = dummyProducts.filter(p => clipartName.includes(p.tailorkitClipart))
      return products
    },
    [dummyProductsData]
  )

  useEffect(() => {
    try {
      setLoadingDummyProducts(true)

      const fetchDummyProducts = async () => {
        const response = await authenticatedFetch(`/api/products?source=dummy&onlySuggestions=true`, {
          preferCache: true,
        })
        if (response?.success && response?.items) {
          setDummyProductsData(response.items)
        }
      }

      fetchDummyProducts()
    } catch (error) {
      console.error(error)
    } finally {
      setLoadingDummyProducts(false)
    }
  }, [])

  return { dummyProductsData, loadingDummyProducts, getDummyProductsSuggestionFromClipartData }
}
