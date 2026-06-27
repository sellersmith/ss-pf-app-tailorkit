import uniqBy from 'lodash/uniqBy'

const SHOPIFY_PRODUCT_ID_PREFIX = 'gid://shopify/Product/'
const SHOPIFY_VARIANT_ID_PREFIX = 'gid://shopify/ProductVariant/'

type PageInfo = {
  hasNextPage: boolean
  endCursor: string
  hasPreviousPage: boolean
  startCursor: string
}

type StorefrontGraphql = (query: string, options?: { variables?: Record<string, any> }) => Promise<Response>

const defaultPageInfo: PageInfo = {
  hasNextPage: false,
  endCursor: '',
  hasPreviousPage: false,
  startCursor: '',
}

/**
 * Build query string for fetching products by IDs
 */
function buildProductQuery(ids: string[]): string {
  return ids.map(id => `id:${id}`).join(' OR ') || ''
}

/**
 * Fetch products by IDs from Storefront API with pagination
 */
async function getProductsByIds(
  query: string,
  graphql: StorefrontGraphql,
  country: string,
  limit: number = 250,
  pageInfo?: PageInfo
): Promise<{ products: any[]; pageInfo: PageInfo }> {
  try {
    const endCursor = pageInfo?.endCursor ? `after: "${pageInfo.endCursor}"` : ''

    const response = await graphql(
      `
      query getProducts($first: Int, $country: CountryCode!) @inContext(country: $country) {
        products(
          query: "${query} status:active",
          first: $first
          ${endCursor}
        ) {
          edges {
            node {
              id
              handle
              title
              requiresSellingPlan
              variants(first: 250) {
                edges {
                  node {
                    id
                    title
                    price {
                      amount
                      currencyCode
                    }
                    compareAtPrice {
                      amount
                      currencyCode
                    }
                    availableForSale
                  }
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            endCursor
            startCursor
          }
        }
      }
      `,
      {
        variables: {
          first: limit,
          country,
        },
      }
    )

    const data = await response.json()
    const products = data.data?.products?.edges?.map((edge: any) => edge.node) || []

    return {
      products,
      pageInfo: data.data?.products?.pageInfo || defaultPageInfo,
    }
  } catch (error) {
    console.error('[Storefront] Error fetching products by IDs:', error)
    return { products: [], pageInfo: defaultPageInfo }
  }
}

/**
 * Addon variant data format returned to the theme extension
 */
export type AddonVariant = {
  id: string
  addonVariantPrice: string
  addonVariantComparedPrice: string | number // string when has compare price, 0 (number) when not
  requires_selling_plan: boolean
  first_selling_plan_allocation_id: boolean
  allowATC: boolean
  title: string
  product: {
    id: number
    handle: string
    title: string
    variantsCount: number
  }
  /** Whether this product has a published TailorKit integration (cross-product personalization) */
  hasTailorKitIntegration?: boolean
}

/**
 * Fetch all product variants by product IDs and transform to addon variant format
 * Used by checkbox addon feature to get variant pricing and availability
 */
export async function getAllProductsVariantIds(
  ids: string[],
  graphql: StorefrontGraphql,
  country: string,
  limit?: number
): Promise<AddonVariant[]> {
  if (!ids.length) return []

  const query = buildProductQuery(ids)

  let { products, pageInfo } = await getProductsByIds(query, graphql, country, limit)

  // Handle pagination
  while (pageInfo.hasNextPage && (!limit || products.length < limit)) {
    const result = await getProductsByIds(query, graphql, country, limit, pageInfo)
    products = [...products, ...result.products]
    pageInfo = result.pageInfo
  }

  // Remove duplicates
  const uniqueProducts = uniqBy(products, 'id')

  // Transform products to addon variant format
  const transformedProducts = uniqueProducts.map((product: any) => {
    const variants
      = product.variants?.edges?.map((variantEdge: any) => {
        const variant = variantEdge.node

        const currentVariantId = variant.id
        const addonVariantPrice = variant.price?.amount || '0'
        // Match OneTick: return 0 (number) when no compare price, not '0' (string)
        const addonVariantComparedPrice = variant.compareAtPrice ? variant.compareAtPrice.amount : 0
        const requiresSellingPlan = product.requiresSellingPlan || false
        const firstSellingPlanAllocationId = variant.sellingPlanAllocations
          ? variant.sellingPlanAllocations[0]?.node?.sellingPlan?.id
          : null
        const allowATC = variant.availableForSale

        return {
          id: currentVariantId.split(SHOPIFY_VARIANT_ID_PREFIX)[1] || currentVariantId,
          addonVariantPrice,
          addonVariantComparedPrice,
          requires_selling_plan: requiresSellingPlan,
          first_selling_plan_allocation_id: !!firstSellingPlanAllocationId,
          allowATC,
          title: variant.title,
          product: {
            id: +(product.id?.split(SHOPIFY_PRODUCT_ID_PREFIX)[1] || 0),
            handle: product.handle || '',
            title: product.title,
            variantsCount: product.variants?.edges?.length || 0,
          },
        }
      }) || []

    return variants
  })

  // Flatten the array of variants
  const allVariants: AddonVariant[] = transformedProducts.flat()

  return limit ? allVariants.slice(0, limit) : allVariants
}
