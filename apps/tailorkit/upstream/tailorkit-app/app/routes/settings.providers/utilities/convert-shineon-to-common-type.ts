import type { TemporaryData } from '~/models/TemporaryFulfillmentProducts'
import type { TProductToImport } from '~/routes/api.providers-integration.$id/constants'
import type { ShineOnNormalizedProduct } from '~/modules/Fulfillments/ShineOn/types'

/**
 * Converts ShineOn normalized products to a common product type format
 * Time Complexity: O(n) where n is the number of products
 * Space Complexity: O(n) for the output array
 *
 * @param products - Array of ShineOn normalized products
 * @returns Converted products in common format
 * @throws {Error} If products array is invalid or required properties are missing
 */
export const convertShineOnProductToCommonType = (
  products: ShineOnNormalizedProduct[]
): Omit<TemporaryData, 'products'> & {
  products: TProductToImport[]
} => {
  // Validate input type
  if (!Array.isArray(products)) {
    throw new Error('Invalid input: products must be an array')
  }

  // Handle empty array case
  if (products.length === 0) {
    return { products: [] }
  }

  // Convert products to common type
  const convertedProducts = products.map(product => {
    // Validate required fields
    if (!product.productId) {
      throw new Error('Invalid product: missing required productId')
    }
    if (!product.title) {
      throw new Error('Invalid product: missing required title')
    }

    const { productId, title, description = '', images = [], baseProfitMargin = 0 } = product

    return {
      productId,
      title,
      description,
      images: Array.isArray(images) ? images : [],
      baseProfitMargin,
    }
  })

  return {
    products: convertedProducts,
  }
}
