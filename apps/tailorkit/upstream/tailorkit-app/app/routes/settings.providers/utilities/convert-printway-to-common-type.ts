import type { TemporaryData, TemporaryVariant } from '~/models/TemporaryFulfillmentProducts'
import type { TProductToImport } from '~/routes/api.providers-integration.$id/constants'
import type { NormalizedProduct } from '~/services/fulfillment/types'

/**
 * Converts PrintWay normalized products to the common temporary product import format.
 * Includes variant data with options for variant selection UI.
 *
 * @param products - Array of PrintWay normalized products
 * @returns Products in common import format with variants
 * @throws {Error} If products array is invalid or required fields are missing
 */
export const convertPrintWayProductToCommonType = (
  products: NormalizedProduct[]
): Omit<TemporaryData, 'products'> & {
  products: (TProductToImport & { variants?: TemporaryVariant[] })[]
} => {
  if (!Array.isArray(products)) {
    throw new Error('Invalid input: products must be an array')
  }

  if (products.length === 0) {
    return { products: [] }
  }

  const convertedProducts = products.map(product => {
    if (!product.externalId) {
      throw new Error('Invalid product: missing required externalId')
    }
    if (!product.title) {
      throw new Error('Invalid product: missing required title')
    }

    const { externalId, title, description = '', images = [], baseCost = 0, variants = [] } = product

    const convertedVariants: TemporaryVariant[] = variants.map(variant => {
      const variantCost = variant.cost || baseCost
      return {
        id: variant.externalId,
        title: variant.title,
        cost: variantCost,
        price: variantCost, // Default price = cost (0% margin)
        profitMargin: 0,
        active: true,
        options: variant.options || {},
        placeholders: variant.placeholders?.map(p => ({
          position: p.position,
          width: p.width,
          height: p.height,
        })),
      }
    })

    return {
      productId: externalId,
      title,
      description,
      images: Array.isArray(images) ? images : [],
      baseProfitMargin: baseCost,
      variants: convertedVariants,
    }
  })

  return {
    products: convertedProducts,
  }
}
