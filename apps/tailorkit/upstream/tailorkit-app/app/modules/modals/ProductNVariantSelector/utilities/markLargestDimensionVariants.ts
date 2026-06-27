import { type IVariant, type IProductWithVariants, type MetafieldValue } from '~/types/shopify-product'
import { DEFAULT_PRODUCT_VARIANT_METAFIELD_NAMESPACE } from '~/shopify/graphql/products/constants'
import { isJSON } from 'extensions/tailorkit-src/src/assets/fns/is-json'

interface VariantWithArea extends IVariant {
  totalPrintArea?: number
  hasLargestDimension?: boolean
}

interface ProductWithAreaVariants extends IProductWithVariants {
  variants: VariantWithArea[]
}

/**
 * Calculates total print area for a variant from its metafields
 */
const calculateVariantTotalArea = (variant: IVariant): number => {
  let totalArea = 0

  const nodeMetafield = variant.metafields.nodes.find(
    node => node.namespace === DEFAULT_PRODUCT_VARIANT_METAFIELD_NAMESPACE
  )

  if (nodeMetafield && isJSON(nodeMetafield.value)) {
    const metafieldValue = JSON.parse(nodeMetafield.value) as MetafieldValue
    totalArea = metafieldValue.placeholders.reduce((sum, placeholder) => {
      return sum + placeholder.width * placeholder.height
    }, 0)
  }

  return totalArea
}

/**
 * Marks variants with the largest dimensions in each product.
 * For variants with the same prefix (before "/"), only the last one keeps the flag.
 */
export const markLargestDimensionVariants = (products: IProductWithVariants[]): ProductWithAreaVariants[] => {
  return products.map(product => {
    // Calculate total print area for each variant
    const variantsWithTotalArea = (product.variants || []).map(variant => ({
      ...variant,
      totalPrintArea: calculateVariantTotalArea(variant),
    }))

    // Find the variant with largest total print area
    const maxArea = Math.max(...variantsWithTotalArea.map(v => v.totalPrintArea || 0))

    // First mark all variants with largest dimension
    const variantsWithInitialFlag = variantsWithTotalArea.map(variant => ({
      ...variant,
      hasLargestDimension: variant.totalPrintArea !== 0 && variant.totalPrintArea === maxArea,
    }))

    // Group variants by their prefix
    const variantGroups = variantsWithInitialFlag.reduce((groups: { [key: string]: VariantWithArea[] }, variant) => {
      if (!variant.hasLargestDimension) return groups

      const [prefix] = variant.title.split('/').map(part => part.trim())
      if (!groups[prefix]) {
        groups[prefix] = []
      }
      groups[prefix].push(variant)
      return groups
    }, {})

    // For each group, only keep the last variant's hasLargestDimension flag
    const variantsWithFlag = variantsWithInitialFlag.map(variant => {
      if (!variant.hasLargestDimension) return variant

      const [prefix] = variant.title.split('/').map(part => part.trim())
      const group = variantGroups[prefix]

      // If this variant is the last one in its group, keep the flag
      const isLastInGroup = group[group.length - 1].id === variant.id

      return {
        ...variant,
        hasLargestDimension: isLastInGroup,
      }
    })

    return {
      ...product,
      variants: variantsWithFlag,
    }
  })
}
