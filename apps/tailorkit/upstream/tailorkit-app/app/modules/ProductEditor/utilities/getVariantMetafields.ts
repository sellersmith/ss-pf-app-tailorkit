import { FULFILLMENT_PROVIDERS } from '~/constants/fulfillment-providers'
import { INTEGRATION_ACTION } from '~/routes/api.integrations/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import type { IProductWithVariants } from '~/types/shopify-product'

export const getVariantMetafields = async (args: { variantIds: string[] }) => {
  const { variantIds } = args
  try {
    const res = await authenticatedFetch(
      `/api/integrations?action=${INTEGRATION_ACTION.FETCH_PRODUCT_VARIANT_METAFIELDS}`,
      {
        method: 'POST',
        body: JSON.stringify({ variantIds }),
      }
    )

    if (res && res.success) {
      return res.groupVariantMetafields || {}
    }
  } catch (err) {
    console.log(err)
    return {}
  }
}

/**
 * Check if the product is imported
 *
 * @param product
 * @returns { boolean }
 */
export const checkIsImportedProduct = (product: IProductWithVariants | undefined) => {
  const productVendor = product?.vendor || ''
  const isImportedProduct = FULFILLMENT_PROVIDERS.includes(productVendor)

  return isImportedProduct
}
