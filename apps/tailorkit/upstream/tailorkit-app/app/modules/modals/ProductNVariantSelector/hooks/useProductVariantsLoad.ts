import { useCallback } from 'react'
import { useStore } from '~/libs/external-store'
import type { IProductWithVariants } from '~/types/shopify-product'
import { shopifyProductsStore, shopifyProductsActions } from '../stores/productVariantsStore'

/**
 * Custom hook to load product variants when a product is expanded or selected
 * @returns Object with loading state and functions to load variants
 */
export const useProductVariantsLoad = () => {
  const productVariantsMap = useStore(shopifyProductsStore, state => state)

  const toggleExpandedProduct = useCallback(
    (productId: string) => {
      shopifyProductsActions.setExpandedProduct(productId, !productVariantsMap[productId].isExpanded)
    },
    [productVariantsMap]
  )

  /**
   * Check if a product is expanded
   * @param productId Product ID to check
   * @returns Boolean indicating if the product is expanded
   */
  const isExpandedProduct = useCallback(
    (productId: string) => {
      return !!productVariantsMap[productId]?.isExpanded
    },
    [productVariantsMap]
  )

  /**
   * Get variants for a specific product
   * @param productId Product ID to get variants for
   * @returns Array of variants for the product or empty array if not loaded
   */
  const getProductVariants = useCallback(
    (productId: string) => {
      return productVariantsMap[productId]?.variants || []
    },
    [productVariantsMap]
  )

  /**
   * Get a product by ID
   * @param productId Product ID to get
   * @returns Product object or undefined if not found
   */
  const getProductById = useCallback(
    (productId: string) => {
      return productVariantsMap[productId]
    },
    [productVariantsMap]
  )

  /**
   * Initialize a product
   * @param product Product to initialize
   */
  const initializeProduct = useCallback(async (product: IProductWithVariants) => {
    shopifyProductsActions.initializeProduct(product)
  }, [])

  /**
   * Reset all product variants data
   */
  const resetProductVariants = useCallback(() => {
    shopifyProductsActions.reset()
  }, [])

  return {
    productVariantsMap,
    initializeProduct,
    toggleExpandedProduct,
    getProductVariants,
    isExpandedProduct,
    getProductById,
    resetProductVariants,
  }
}
