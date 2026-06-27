import { PREFIX_VARIANT_ID, PREFIX_PRODUCT_ID } from '~/constants/shopify'

/**
 * Extract clean Shopify variant IDs from GID format
 * @param gids - Array of Shopify variant GIDs (e.g., "gid://shopify/ProductVariant/123")
 * @returns Array of clean variant IDs (e.g., ["123"])
 */
export function extractVariantIds(gids: string[]): string[] {
  return gids.map((gid: string) => gid.replace(PREFIX_VARIANT_ID, ''))
}

/**
 * Extract clean Shopify product ID from GID format
 * @param gid - Shopify product GID (e.g., "gid://shopify/Product/123")
 * @returns Clean product ID (e.g., "123")
 */
export function extractProductId(gid: string): string {
  return gid.replace(PREFIX_PRODUCT_ID, '')
}

/**
 * Validate and extract variant/product data from product recommendation
 * @param productData - Product recommendation data
 * @param globalFallback - Optional global context fallback
 * @returns Object with cleaned variant and product IDs
 */
export function extractProductVariantData(
  productData?: { variantIds?: string[]; productId?: string },
  globalFallback?: any
): { variantIds: string[]; productId: string } {
  const variantIds = productData?.variantIds || globalFallback?.variantIds || []
  const productId = productData?.productId || globalFallback?.productId

  if (!variantIds.length || !productId) {
    throw new Error('No product/variant data available for integration')
  }

  return {
    variantIds: extractVariantIds(variantIds),
    productId: extractProductId(productId),
  }
}
