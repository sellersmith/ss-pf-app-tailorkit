import { z } from 'zod'
import { Http } from '../core/httpClient'
import { parseWithZod } from '../core/validation'
import { INTEGRATION_ACTION } from '~/routes/api.integrations/constants'
import type { IVariant, IProduct } from '~/types/shopify-product'

// Zod schema for product variants response validation
// Using passthrough to allow extra fields (similar to TemplatesService pattern)
const ProductVariantZ = z.object({}).passthrough()

const FetchProductVariantsByVariantIdsResponseZ = z.object({
  success: z.boolean(),
  productVariants: z.array(ProductVariantZ).default([]),
})

// Zod schema for product response validation
const ProductZ = z.object({}).passthrough()

const FetchProductByProductIdResponseZ = z.object({
  success: z.boolean(),
  products: z.array(ProductZ).default([]),
})

// Zod schema for shared templates response validation
const CheckSharedTemplatesResponseZ = z.object({
  success: z.boolean(),
  sharedIntegrationIds: z.array(z.string()).default([]),
})

/**
 * Service for interacting with Integrations API.
 * Provides methods to fetch product variants and related integration data.
 */
export const IntegrationsService = {
  /**
   * Fetch product variants by their variant IDs.
   * Returns variants enriched with product data from Shopify.
   *
   * @param variantIds - Array of Shopify variant IDs to fetch
   * @returns Promise resolving to object with variants array
   */
  async getProductVariantsByVariantIds(variantIds: string[]): Promise<{ variants: IVariant[] }> {
    try {
      if (!variantIds || variantIds.length === 0) {
        return { variants: [] }
      }

      const url = `/api/integrations?action=${INTEGRATION_ACTION.FETCH_PRODUCT_VARIANTS_BY_VARIANT_IDS}`
      const res = await Http.post<unknown, { variantIds: string[] }>(url, { variantIds })

      if (!res.ok || !res.data) {
        return { variants: [] }
      }

      const parsed = parseWithZod(FetchProductVariantsByVariantIdsResponseZ, res.data, 'product-variants-by-ids')

      if (parsed.success) {
        return {
          variants: (parsed.productVariants || []) as IVariant[],
        }
      }

      return { variants: [] }
    } catch (error) {
      console.error('Error fetching product variants by variant IDs:', error)
      return { variants: [] }
    }
  },

  /**
   * Fetch product by product ID.
   * Returns product with variants enriched with product data from Shopify.
   *
   * @param productId - Shopify product ID (numeric or GID format)
   * @returns Promise resolving to product with variants array
   */
  async getProductByProductId(productId: string): Promise<{ product: IProduct | null }> {
    try {
      if (!productId) {
        return { product: null }
      }

      const url = `/api/integrations?action=${INTEGRATION_ACTION.FETCH_PRODUCT_BY_PRODUCT_ID}`
      const res = await Http.post<unknown, { productIds: string[] }>(url, { productIds: [productId] })

      if (!res.ok || !res.data) {
        return { product: null }
      }

      const parsed = parseWithZod(FetchProductByProductIdResponseZ, res.data, 'product-by-product-id')

      if (parsed.success && parsed.products && parsed.products.length > 0) {
        return {
          product: parsed.products[0] as IProduct,
        }
      }

      return { product: null }
    } catch (error) {
      console.error('Error fetching product by product ID:', error)
      return { product: null }
    }
  },

  /**
   * Check which published integrations share templates with the current integration.
   * Used to determine if "Publish all products" option should be shown.
   *
   * @param integrationId - Current integration ID to exclude from results
   * @param templateIds - Array of template IDs to check for sharing
   * @returns Promise resolving to array of integration IDs that share templates
   */
  async checkSharedTemplatesWithPublished(
    integrationId: string,
    templateIds: string[]
  ): Promise<{ sharedIntegrationIds: string[] }> {
    try {
      if (!integrationId || !templateIds || templateIds.length === 0) {
        return { sharedIntegrationIds: [] }
      }

      const url = `/api/integrations?action=${INTEGRATION_ACTION.CHECK_SHARED_TEMPLATES_WITH_PUBLISHED}`
      const res = await Http.post<unknown, { integrationId: string; templateIds: string[] }>(url, {
        integrationId,
        templateIds,
      })

      if (!res.ok || !res.data) {
        return { sharedIntegrationIds: [] }
      }

      const parsed = parseWithZod(CheckSharedTemplatesResponseZ, res.data, 'check-shared-templates')

      if (parsed.success) {
        return {
          sharedIntegrationIds: parsed.sharedIntegrationIds ?? [],
        }
      }

      return { sharedIntegrationIds: [] }
    } catch (error) {
      console.error('Error checking shared templates:', error)
      return { sharedIntegrationIds: [] }
    }
  },
}
