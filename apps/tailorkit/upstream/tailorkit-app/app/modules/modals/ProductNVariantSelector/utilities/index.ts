import type { IVariant } from '~/types/shopify-product'

/**
 * Get the display name of a product variant
 * @param variant - The variant to get the display name of
 * @returns The display name of the variant
 */
export function getProductVariantDisplayName(variant: IVariant) {
  return variant?.displayName || ''
}
