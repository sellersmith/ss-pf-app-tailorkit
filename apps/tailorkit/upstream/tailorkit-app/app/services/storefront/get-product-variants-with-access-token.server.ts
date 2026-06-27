import { fetchPaginatedProducts } from './fetch-paginated-products.server'

type ShopWithSession = {
  shopDomain: string
  session?: {
    accessToken?: string
  } | null
}

/**
 * Addon variant data format returned to the theme extension (Admin API version)
 */
export type AddonVariantWithAccessToken = {
  id: string
  addonVariantPrice: string
  addonVariantComparedPrice: string | number // string when has compare price, 0 (number) when not
  requires_selling_plan: boolean
  first_selling_plan_allocation_id: boolean
  allowATC: boolean
  title: string
  product: {
    id: number
    title: string
    variantsCount: number
  }
}

/**
 * Fetch all product variants by product IDs using Admin REST API
 * Used as fallback when Storefront API access is not available
 *
 * @param ids - Array of product IDs
 * @param shop - Shop data with session containing access token
 */
export async function getAllProductsVariantIdsWithAccessToken(
  ids: string[],
  shop: ShopWithSession | null
): Promise<AddonVariantWithAccessToken[]> {
  try {
    if (!ids.length) return []
    if (!shop?.session?.accessToken) return []

    const { shopDomain, session } = shop
    const { accessToken } = session

    const allProducts = await fetchPaginatedProducts(shopDomain, accessToken!, ids)

    const transformedProducts = allProducts.reduce((acc: AddonVariantWithAccessToken[], product: any) => {
      const variants = product.variants.map((variant: any) => {
        const {
          id,
          price,
          compare_at_price,
          requires_selling_plan,
          first_selling_plan_allocation_id,
          inventory_management,
          inventory_policy,
          inventory_quantity,
          title,
          product_id,
        } = variant

        return {
          id: `${id}`,
          addonVariantPrice: price,
          addonVariantComparedPrice: compare_at_price || 0,
          requires_selling_plan: !!requires_selling_plan,
          first_selling_plan_allocation_id: !!first_selling_plan_allocation_id,
          allowATC: !(!inventory_management || inventory_policy === 'continue' || inventory_quantity <= 0),
          title: title,
          product: {
            id: product_id,
            title: product.title,
            variantsCount: product.variants.length,
          },
        }
      })

      return [...acc, ...variants]
    }, [])

    return transformedProducts
  } catch (error) {
    console.error('[Storefront] Error when fetching all products variant ids with access token:', error)
    return []
  }
}
