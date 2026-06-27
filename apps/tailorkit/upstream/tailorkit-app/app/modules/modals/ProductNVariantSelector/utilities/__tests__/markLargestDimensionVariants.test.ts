import { describe, it, expect } from 'vitest'
import { markLargestDimensionVariants } from '../markLargestDimensionVariants'
import type { IProductWithVariants } from '~/types/shopify-product'
import { DEFAULT_PRODUCT_VARIANT_METAFIELD_NAMESPACE } from '~/shopify/graphql/products/constants'

describe('markLargestDimensionVariants', () => {
  const createMockProduct = (variants: any[]): IProductWithVariants => ({
    id: '1',
    handle: 'test-product',
    title: 'Test Product',
    featuredImage: {
      altText: '',
      width: 100,
      height: 100,
      url: '',
    },
    variants,
    collections: [],
    tags: [],
    vendor: '',
    productType: '',
  })

  const createMockVariant = (id: string, title: string, placeholders: any[] = []) => ({
    id,
    title,
    product: null,
    metafields: {
      nodes: [
        {
          id: '1',
          key: DEFAULT_PRODUCT_VARIANT_METAFIELD_NAMESPACE,
          namespace: DEFAULT_PRODUCT_VARIANT_METAFIELD_NAMESPACE,
          type: 'json',
          value: JSON.stringify({
            product_id: '1',
            provider_id: '1',
            variant_id: id,
            placeholders,
          }),
        },
      ],
    },
  })

  it('should mark variants with largest dimensions', () => {
    const variants = [
      createMockVariant('1', 'Heather Grey / L', [{ position: 'front', width: 100, height: 100 }]),
      createMockVariant('2', 'Heather Grey / XL', [{ position: 'front', width: 200, height: 200 }]),
      createMockVariant('3', 'Heather Grey / 2XL', [{ position: 'front', width: 200, height: 200 }]),
      createMockVariant('4', 'Heather Grey / 3XL', [{ position: 'front', width: 200, height: 200 }]),
      createMockVariant('5', 'Solid White / L', [{ position: 'front', width: 200, height: 200 }]),
      createMockVariant('6', 'Solid White / XL', [{ position: 'front', width: 200, height: 200 }]),
      createMockVariant('7', 'Solid White / 2XL', [{ position: 'front', width: 200, height: 200 }]),
    ]

    const products = [createMockProduct(variants)]
    const result = markLargestDimensionVariants(products)

    // Debug logs
    console.log('First variant metafields:', variants[0].metafields)
    console.log(
      'Areas:',
      result[0].variants.map(v => ({ id: v.id, title: v.title, area: v.totalPrintArea }))
    )
    console.log(
      'Flags:',
      result[0].variants.map(v => ({ id: v.id, title: v.title, hasLargest: v.hasLargestDimension }))
    )

    // Should mark only the last variant of each prefix group that has largest dimensions
    expect(result[0].variants.filter(v => v.hasLargestDimension)).toHaveLength(2)
    expect(result[0].variants.find(v => v.id === '4')?.hasLargestDimension).toBe(true) // Heather Grey / 3XL
    expect(result[0].variants.find(v => v.id === '7')?.hasLargestDimension).toBe(true) // Solid White / 2XL
  })

  // ... rest of the tests ...
})
