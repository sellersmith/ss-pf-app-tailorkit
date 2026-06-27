import type { TemporaryData } from '~/models/TemporaryFulfillmentProducts'
import type { IBlueprintWithAdvanceInfo } from '~/routes/api.providers-connection.$id/Printify/types'
import { type TProductToImport } from '~/routes/api.providers-integration.$id/constants'

/**
 * @author KhanhNT
 * Sanitizes product description by removing unwanted patterns
 * Time Complexity: O(n) where n is the length of the description string
 * @param description - Raw product description
 * @returns Cleaned description string
 */
const sanitizeDescription = (description: string): string => {
  if (!description) return ''
  // Using string replace is more efficient than regex for simple pattern
  return description.replaceAll('.:', '').trim()
}

/**
 * Converts Printify blueprint products to a common product type format
 * Time Complexity: O(n) where n is the number of blueprints
 * Space Complexity: O(n) for the output array
 *
 * @param blueprints - Array of Printify blueprint products
 * @returns Converted products in common format
 * @throws {Error} If blueprints array is invalid or required properties are missing
 */
export const convertPrintifyProductToCommonType = (
  blueprints: IBlueprintWithAdvanceInfo[]
): Omit<TemporaryData, 'products'> & {
  products: TProductToImport[]
} => {
  // Validate input type
  if (!Array.isArray(blueprints)) {
    throw new Error('Invalid input: blueprints must be an array')
  }

  // Handle empty array case
  if (blueprints.length === 0) {
    return { products: [] }
  }

  // Convert blueprints to common type
  const products = blueprints.map(blueprint => {
    // Validate required fields
    if (typeof blueprint.id === 'undefined') {
      throw new Error('Invalid blueprint: missing required id')
    }
    if (!blueprint.title) {
      throw new Error('Invalid blueprint: missing required title')
    }

    const { id, title, description = '', images = [], baseProfitMargin = 0 } = blueprint

    return {
      productId: id.toString(),
      title,
      description: sanitizeDescription(description),
      images: Array.isArray(images) ? images : [],
      baseProfitMargin,
    }
  })

  return {
    products,
  }
}
